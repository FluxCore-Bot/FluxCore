# Reaction / Button / Dropdown Roles

> **Phase:** 2 — Community Engagement
> **Priority:** P0
> **Status:** Not Started
> **Depends on:** Nothing

## Overview

Self-assignable roles via reactions, buttons, or dropdown menus on messages. Discord's "Role Prompts" feature was announced but never fully shipped — bots remain the standard solution. This is one of the most requested features for any Discord bot.

## Features

| Feature | Description |
|---------|-------------|
| Reaction roles | Click emoji → get/remove role |
| Button roles | Click Discord button → get/remove role |
| Dropdown roles | Select from dropdown menu → get roles |
| Multiple modes | Normal (toggle), Unique (one per group), Verify (one-time add) |
| Role groups | Categorize roles (e.g., "Colors", "Games", "Notifications") |
| Custom embeds | Attach role selectors to custom embed messages |
| Dashboard builder | Visual role panel builder |
| Auto-role on join | Already handled in Welcome system |

## Database Schema

```prisma
model RolePanel {
  id          Int      @id @default(autoincrement())
  guildId     String
  channelId   String
  messageId   String?  // Populated after message is sent
  name        String
  type        String   // "reaction" | "button" | "dropdown"
  mode        String   @default("toggle") // "toggle" | "unique" | "verify"
  embed       String   @default("{}") // JSON embed config
  roles       String   @default("[]") // JSON array of RolePanelEntry
  maxRoles    Int?     // Max roles selectable (for dropdown)
  minRoles    Int?     // Min roles required (for dropdown)
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([guildId, messageId])
  @@index([guildId])
}
```

### RolePanelEntry (JSON in `roles` field)

```typescript
interface RolePanelEntry {
  roleId: string;
  label: string;        // Display label
  emoji?: string;       // Emoji ID or unicode
  description?: string; // For dropdown options
  style?: number;       // Button style: 1=Primary, 2=Secondary, 3=Success, 4=Danger
}
```

## Interaction Modes

### Toggle (default)
- Click → add role. Click again → remove role.
- Multiple roles can be held simultaneously.

### Unique
- Click → add role + remove all other roles in this panel.
- Only one role from the group at a time.

### Verify
- Click → add role. Cannot remove.
- Used for verification/agreement flows.

## Bot Commands

### `/rolepanel create <name> <type> <channel> [mode]`

```
Options:
  name: String (required, max 50)
  type: String (required) — "button" | "dropdown" | "reaction"
  channel: Channel (required)
  mode: String (optional) — "toggle" | "unique" | "verify" (default: "toggle")
Permission: ManageRoles
```

Creates a panel definition. Roles are added via `/rolepanel addrole`.

### `/rolepanel addrole <panel_name> <role> [label] [emoji] [description]`

```
Permission: ManageRoles
```

Adds a role entry to a panel. Max 25 roles per panel (Discord component limit).

### `/rolepanel removerole <panel_name> <role>`

Removes a role entry from a panel.

### `/rolepanel send <panel_name>`

Sends the panel message to its configured channel and stores the `messageId`.

### `/rolepanel edit <panel_name>`

Re-sends/updates the panel message with current config.

### `/rolepanel delete <panel_name>`

Deletes the panel (and optionally the Discord message).

### `/rolepanel list`

Lists all panels in the guild.

## Interaction Handlers

### Button Click

```typescript
// In interactionCreate.ts
if (interaction.isButton()) {
  if (interaction.customId.startsWith("rp_")) {
    const [_, panelId, roleId] = interaction.customId.split("_");
    await handleRolePanelButton(interaction, parseInt(panelId), roleId);
    return;
  }
}
```

```typescript
async function handleRolePanelButton(
  interaction: ButtonInteraction,
  panelId: number,
  roleId: string,
): Promise<void> {
  const panel = await getRolePanel(panelId);
  if (!panel) return;

  const member = interaction.member as GuildMember;
  const hasRole = member.roles.cache.has(roleId);

  if (panel.mode === "verify" && hasRole) {
    await interaction.reply({ content: "You already have this role.", ephemeral: true });
    return;
  }

  if (panel.mode === "unique" && !hasRole) {
    // Remove all other roles in this panel first
    const otherRoleIds = panel.roles.filter(r => r.roleId !== roleId).map(r => r.roleId);
    const toRemove = otherRoleIds.filter(id => member.roles.cache.has(id));
    if (toRemove.length > 0) await member.roles.remove(toRemove);
  }

  if (hasRole && panel.mode !== "verify") {
    await member.roles.remove(roleId);
    await interaction.reply({ content: `Removed <@&${roleId}>`, ephemeral: true });
  } else {
    await member.roles.add(roleId);
    await interaction.reply({ content: `Added <@&${roleId}>`, ephemeral: true });
  }
}
```

### Dropdown Select

```typescript
if (interaction.isStringSelectMenu()) {
  if (interaction.customId.startsWith("rpd_")) {
    const panelId = parseInt(interaction.customId.split("_")[1]);
    await handleRolePanelDropdown(interaction, panelId);
    return;
  }
}
```

### Reaction Add/Remove

Listen to `messageReactionAdd` and `messageReactionRemove` events.

## Building Components

### Button Panel

```typescript
function buildButtonComponents(panel: RolePanel): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();

  for (const entry of panel.roles) {
    if (currentRow.components.length >= 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
    }
    const button = new ButtonBuilder()
      .setCustomId(`rp_${panel.id}_${entry.roleId}`)
      .setLabel(entry.label)
      .setStyle(entry.style ?? ButtonStyle.Secondary);

    if (entry.emoji) button.setEmoji(entry.emoji);
    currentRow.addComponents(button);
  }

  if (currentRow.components.length > 0) rows.push(currentRow);
  return rows; // Max 5 rows = 25 buttons
}
```

### Dropdown Panel

```typescript
function buildDropdownComponent(panel: RolePanel): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`rpd_${panel.id}`)
    .setPlaceholder("Select roles...")
    .setMinValues(panel.minRoles ?? 0)
    .setMaxValues(panel.maxRoles ?? panel.roles.length)
    .addOptions(
      panel.roles.map(entry => ({
        label: entry.label,
        value: entry.roleId,
        description: entry.description,
        emoji: entry.emoji ? { name: entry.emoji } : undefined,
      })),
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}
```

## API Endpoints

```
GET    /api/guilds/:guildId/role-panels                  → List all panels
POST   /api/guilds/:guildId/role-panels                  → Create panel
PUT    /api/guilds/:guildId/role-panels/:panelId         → Update panel
DELETE /api/guilds/:guildId/role-panels/:panelId         → Delete panel
POST   /api/guilds/:guildId/role-panels/:panelId/send    → Send/resend panel message
```

## Dashboard Page

**Route:** `/guild/:guildId/roles`

**Sections:**
1. **Panel list** — All role panels with status (sent/draft)
2. **Panel builder** — Create/edit with: name, type, mode, channel, embed editor, role entries
3. **Role entry editor** — Add roles with label, emoji, description, style
4. **Live preview** — Shows how the panel will look in Discord

## System Package

**Location:** `packages/systems/src/rolePanel/`

```
rolePanel/
  types.ts        — RolePanel, RolePanelEntry, PanelMode, PanelType
  constants.ts    — MAX_ROLES_PER_PANEL (25), BUTTON_STYLES
  persistence.ts  — CRUD operations
  builder.ts      — buildButtonComponents, buildDropdownComponent, buildReactionSetup
  handler.ts      — handleRolePanelButton, handleRolePanelDropdown, handleRolePanelReaction
```

## Implementation Notes

- **25 role limit:** Discord allows max 5 rows × 5 buttons = 25, or 25 dropdown options. Enforce in validation.
- **Role hierarchy:** Bot can only assign roles below its own highest role. Validate on panel creation.
- **Reaction roles:** Require `GuildMessageReactions` intent (already enabled). Use reaction collector or persistent listener.
- **Persistence:** When bot restarts, reaction role listeners must be re-established. Query all panels with `type="reaction"` and re-attach listeners, or use raw event handling.
- **Dropdown unique mode:** For unique dropdowns, compare selected values vs current roles and compute diff.
