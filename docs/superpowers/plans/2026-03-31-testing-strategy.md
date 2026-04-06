# FluxCore Testing Strategy — Full Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Achieve full, reliable test coverage across all four layers — Discord object mocks, command subcommand routing, event handler → Discord call verification, and dashboard → cache → Discord pipeline closure.

**Architecture:** Three test types work together: (1) Unit tests mock all Discord.js objects and system dependencies, asserting that the right functions are called with the right arguments; (2) Integration tests use a real PostgreSQL test DB to verify the dashboard→cache pipeline; (3) "Closed loop" event handler tests seed the in-memory cache directly and verify that Discord methods (channel.send, member.ban, roles.add) are called — the only practical way to verify Discord interaction without a live server.

**Tech Stack:** Vitest, discord.js v14 mock objects, Fastify inject API, real PostgreSQL test DB (docker-compose.test.yml)

---

## Background: The Four Testing Layers

```
[Dashboard API] ──writes──► [PostgreSQL] ──polls──► [Bot Cache] ──on event──► [Discord API]
      │                           │                      │                          │
  Layer 2                    Layer 3               Layer 3+4                    Layer 1+4
 (route unit)            (integration)          (pipeline sync)            (Discord mock)
```

- **Layer 1 — Discord object mocks**: Extend shared factories so every Discord.js surface the bot touches can be stubbed with `vi.fn()`.
- **Layer 2 — Dashboard route unit tests**: Already established. Gaps documented in Task 6.
- **Layer 3 — Pipeline integration tests**: Already established for `actions`. Needs extending to all systems.
- **Layer 4 — Event handler "closed loop"**: Seed cache directly, fire event handler, assert Discord methods were called. This replaces the need for a live Discord server in CI.

---

## Discovered Gaps (pre-work)

The following gaps were found during audit and are addressed by this plan:

1. **`createMockInteraction` doesn't type options** — current spread pattern loses type safety and doesn't let you declaratively set `getSubcommand()` return value cleanly.
2. **No Discord object factories for guild/channel/message/role** — event handlers like `guildMemberAdd` call `channel.send()`, `member.roles.add()`, `guild.members.fetch()` but there's nothing to mock these.
3. **No component interaction factories** — `interactionCreate` routes button/select/modal interactions but no `createMockButtonInteraction()` exists.
4. **`guildMemberAdd.test.ts` has an incomplete mock surface** — `getWelcomeConfig` is not mocked, so the welcome+auto-role path is untested.
5. **Multi-subcommand commands lack routing coverage** — `/actions` has 10+ subcommands, `/giveaway` has 5, `/ticket` sub-commands etc. Only the happy path of one subcommand is usually tested.
6. **`interactionCreate` event router has no tests for button/select/modal paths** — only the chat command path is covered.

---

## File Map

### New Files
| File | Purpose |
|------|---------|
| `packages/systems/tests/helpers/discord-mocks.ts` | All Discord.js object mock factories (guild, channel, message, role, button interaction, select interaction, modal interaction) |

### Modified Files
| File | Change |
|------|--------|
| `packages/systems/tests/helpers/factories.ts` | Extend `createMockInteraction` to accept typed subcommand + per-option overrides; extend `createMockMember` with `guild` reference |
| `apps/bot/tests/events/guildMemberAdd.test.ts` | Add missing mock for `getWelcomeConfig`, `getAntiRaidConfig`; add welcome path and auto-role tests |
| `apps/bot/tests/events/interactionCreate.test.ts` | Add button routing, select routing, modal routing, cooldown tests |
| `apps/bot/tests/commands/admin/actions.test.ts` | Add subcommand routing matrix + individual subcommand tests |

### New Test Files
| File | Purpose |
|------|---------|
| `apps/bot/tests/events/messageCreate.test.ts` | messageCreate event handler tests |
| `apps/bot/tests/events/messageDelete.test.ts` | (already exists — verify coverage) |
| `packages/systems/tests/integration/welcome-sync.test.ts` | Welcome config dashboard write → cache reload |
| `packages/systems/tests/integration/leveling-sync.test.ts` | Leveling settings dashboard write → cache |
| `packages/systems/tests/integration/tickets-sync.test.ts` | (already exists — verify coverage) |

---

## Task 1: Create Discord Object Mock Factory Library

**Files:**
- Create: `packages/systems/tests/helpers/discord-mocks.ts`

This provides mock factories for every Discord.js object that bot code touches — not just interactions, but guild, channel, message, role, and all component interaction types.

- [ ] **Step 1: Create the file with the guild mock factory**

```typescript
// packages/systems/tests/helpers/discord-mocks.ts
import { vi } from "vitest";

// ─── Mock Role ─────────────────────────────────────────────

export interface MockRoleOptions {
  id?: string;
  name?: string;
  position?: number;
  managed?: boolean;
}

export function createMockRole(options: MockRoleOptions = {}) {
  return {
    id: options.id ?? "role-1",
    name: options.name ?? "Test Role",
    position: options.position ?? 5,
    managed: options.managed ?? false,
    delete: vi.fn().mockResolvedValue(undefined),
    edit: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Mock Text Channel ─────────────────────────────────────

export interface MockChannelOptions {
  id?: string;
  name?: string;
  isTextBased?: boolean;
}

export function createMockChannel(options: MockChannelOptions = {}) {
  return {
    id: options.id ?? "ch-1",
    name: options.name ?? "general",
    isTextBased: vi.fn().mockReturnValue(options.isTextBased ?? true),
    isVoiceBased: vi.fn().mockReturnValue(false),
    send: vi.fn().mockResolvedValue({ id: "msg-1" }),
    delete: vi.fn().mockResolvedValue(undefined),
    edit: vi.fn().mockResolvedValue(undefined),
    setName: vi.fn().mockResolvedValue(undefined),
    setTopic: vi.fn().mockResolvedValue(undefined),
    permissionOverwrites: {
      edit: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      cache: new Map(),
    },
    messages: {
      fetch: vi.fn().mockResolvedValue(new Map()),
    },
  };
}

// ─── Mock Message ──────────────────────────────────────────

export interface MockMessageOptions {
  id?: string;
  content?: string;
  authorId?: string;
  guildId?: string;
  channelId?: string;
  pinned?: boolean;
}

export function createMockMessage(options: MockMessageOptions = {}) {
  return {
    id: options.id ?? "msg-1",
    content: options.content ?? "Hello world",
    author: {
      id: options.authorId ?? "user-1",
      bot: false,
      tag: "user#0001",
      username: "user",
      displayAvatarURL: vi.fn().mockReturnValue("https://example.com/avatar.png"),
    },
    guildId: options.guildId ?? "test-guild-1",
    channelId: options.channelId ?? "ch-1",
    pinned: options.pinned ?? false,
    react: vi.fn().mockResolvedValue(undefined),
    pin: vi.fn().mockResolvedValue(undefined),
    unpin: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue({ id: "msg-reply-1" }),
    edit: vi.fn().mockResolvedValue(undefined),
    url: `https://discord.com/channels/test-guild-1/ch-1/msg-1`,
    channel: null as unknown, // set after guild is created if needed
    guild: null as unknown,   // set after guild is created if needed
  };
}

// ─── Mock Guild ────────────────────────────────────────────

export interface MockGuildOptions {
  id?: string;
  name?: string;
  memberCount?: number;
  ownerId?: string;
  channels?: ReturnType<typeof createMockChannel>[];
  roles?: ReturnType<typeof createMockRole>[];
}

export function createMockGuild(options: MockGuildOptions = {}) {
  const channelMap = new Map(
    (options.channels ?? []).map((ch) => [ch.id, ch]),
  );
  const roleMap = new Map(
    (options.roles ?? []).map((r) => [r.id, r]),
  );

  return {
    id: options.id ?? "test-guild-1",
    name: options.name ?? "Test Guild",
    memberCount: options.memberCount ?? 100,
    ownerId: options.ownerId ?? "owner-1",
    iconURL: vi.fn().mockReturnValue("https://example.com/icon.png"),
    members: {
      me: {
        id: "bot-1",
        roles: { highest: { position: 999 } },
      },
      fetch: vi.fn().mockResolvedValue(null),
      ban: vi.fn().mockResolvedValue(undefined),
    },
    channels: {
      cache: channelMap,
      create: vi.fn().mockResolvedValue(createMockChannel()),
      fetch: vi.fn().mockResolvedValue(null),
    },
    roles: {
      cache: roleMap,
      create: vi.fn().mockResolvedValue(createMockRole()),
      everyone: createMockRole({ id: "everyone", name: "@everyone", position: 0 }),
    },
    bans: {
      fetch: vi.fn().mockResolvedValue(new Map()),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    setVerificationLevel: vi.fn().mockResolvedValue(undefined),
  };
}
```

- [ ] **Step 2: Add component interaction factories**

Append to `packages/systems/tests/helpers/discord-mocks.ts`:

```typescript
// ─── Mock Button Interaction ───────────────────────────────

export interface MockButtonInteractionOptions {
  customId?: string;
  userId?: string;
  guildId?: string;
  channelId?: string;
  guild?: ReturnType<typeof createMockGuild>;
  channel?: ReturnType<typeof createMockChannel>;
}

export function createMockButtonInteraction(options: MockButtonInteractionOptions = {}) {
  const guild = options.guild ?? createMockGuild();
  const channel = options.channel ?? createMockChannel();
  return {
    customId: options.customId ?? "button-1",
    isButton: vi.fn().mockReturnValue(true),
    isStringSelectMenu: vi.fn().mockReturnValue(false),
    isModalSubmit: vi.fn().mockReturnValue(false),
    isUserSelectMenu: vi.fn().mockReturnValue(false),
    isAutocomplete: vi.fn().mockReturnValue(false),
    isChatInputCommand: vi.fn().mockReturnValue(false),
    user: { id: options.userId ?? "user-1", username: "testuser", bot: false },
    member: {
      id: options.userId ?? "user-1",
      roles: { highest: { position: 5 }, cache: new Map(), add: vi.fn(), remove: vi.fn() },
    },
    guild,
    guildId: options.guildId ?? "test-guild-1",
    channel,
    channelId: options.channelId ?? "ch-1",
    message: createMockMessage(),
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    replied: false,
    deferred: false,
  };
}

// ─── Mock String Select Menu Interaction ──────────────────

export interface MockSelectMenuInteractionOptions {
  customId?: string;
  values?: string[];
  userId?: string;
  guildId?: string;
}

export function createMockSelectMenuInteraction(options: MockSelectMenuInteractionOptions = {}) {
  return {
    customId: options.customId ?? "select-1",
    values: options.values ?? [],
    isStringSelectMenu: vi.fn().mockReturnValue(true),
    isButton: vi.fn().mockReturnValue(false),
    isModalSubmit: vi.fn().mockReturnValue(false),
    isUserSelectMenu: vi.fn().mockReturnValue(false),
    isAutocomplete: vi.fn().mockReturnValue(false),
    isChatInputCommand: vi.fn().mockReturnValue(false),
    user: { id: options.userId ?? "user-1", username: "testuser", bot: false },
    member: {
      id: options.userId ?? "user-1",
      roles: { highest: { position: 5 }, cache: new Map() },
    },
    guild: createMockGuild({ id: options.guildId }),
    guildId: options.guildId ?? "test-guild-1",
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    replied: false,
    deferred: false,
  };
}

// ─── Mock Modal Submit Interaction ────────────────────────

export interface MockModalInteractionOptions {
  customId?: string;
  fields?: Record<string, string>;
  userId?: string;
  guildId?: string;
}

export function createMockModalInteraction(options: MockModalInteractionOptions = {}) {
  const fields = options.fields ?? {};
  return {
    customId: options.customId ?? "modal-1",
    isModalSubmit: vi.fn().mockReturnValue(true),
    isButton: vi.fn().mockReturnValue(false),
    isStringSelectMenu: vi.fn().mockReturnValue(false),
    isUserSelectMenu: vi.fn().mockReturnValue(false),
    isAutocomplete: vi.fn().mockReturnValue(false),
    isChatInputCommand: vi.fn().mockReturnValue(false),
    fields: {
      getTextInputValue: vi.fn((fieldId: string) => fields[fieldId] ?? ""),
    },
    user: { id: options.userId ?? "user-1", username: "testuser", bot: false },
    member: {
      id: options.userId ?? "user-1",
      roles: { highest: { position: 5 }, cache: new Map() },
    },
    guild: createMockGuild({ id: options.guildId }),
    guildId: options.guildId ?? "test-guild-1",
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    replied: false,
    deferred: false,
  };
}
```

- [ ] **Step 3: Run existing tests to confirm no breakage**

```bash
pnpm test
```

Expected: All tests pass (no changes to existing code yet).

- [ ] **Step 4: Commit**

```bash
git add packages/systems/tests/helpers/discord-mocks.ts
git commit -m "test(helpers): add Discord object mock factories for guild, channel, message, role, and component interactions"
```

---

## Task 2: Extend `createMockInteraction` for Subcommands and Typed Options

**Files:**
- Modify: `packages/systems/tests/helpers/factories.ts`

The current `createMockInteraction` uses a flat spread which doesn't allow cleanly setting `getSubcommand()` or per-option return values. This task replaces it with a typed API.

- [ ] **Step 1: Write the failing test to verify the new API**

Create a temporary test to confirm the old API is still compatible and the new one works:

```typescript
// packages/systems/tests/helpers/factories.test.ts (temporary, delete after Task 2)
import { describe, it, expect } from "vitest";
import { createMockInteraction } from "./factories.js";

describe("createMockInteraction", () => {
  it("supports subcommand option", () => {
    const i = createMockInteraction({ subcommand: "kick" });
    expect(i.options.getSubcommand()).toBe("kick");
  });

  it("supports string options by name", () => {
    const i = createMockInteraction({ strings: { reason: "spam" } });
    expect(i.options.getString("reason")).toBe("spam");
    expect(i.options.getString("other")).toBe(null);
  });

  it("supports member options by name", () => {
    const member = { id: "user-99", displayName: "Target" };
    const i = createMockInteraction({ members: { user: member } });
    expect(i.options.getMember("user")).toBe(member);
  });

  it("supports integer options by name", () => {
    const i = createMockInteraction({ integers: { duration: 60 } });
    expect(i.options.getInteger("duration")).toBe(60);
  });

  it("old spread API still works", () => {
    const i = createMockInteraction({ guildId: "other-guild" });
    expect(i.guildId).toBe("other-guild");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test packages/systems/tests/helpers/factories.test.ts
```

Expected: FAIL — `getSubcommand()` returns `null`, not `"kick"`.

- [ ] **Step 3: Update `createMockInteraction` in factories.ts**

Replace the existing `createMockInteraction` function (lines 213–236) in `packages/systems/tests/helpers/factories.ts`:

```typescript
export interface MockInteractionOptions {
  // Subcommand routing
  subcommand?: string;
  // Per-option typed overrides
  members?: Record<string, unknown>;
  strings?: Record<string, string>;
  integers?: Record<string, number>;
  booleans?: Record<string, boolean>;
  channels?: Record<string, unknown>;
  roles?: Record<string, unknown>;
  // Top-level overrides (any field on the interaction object)
  [key: string]: unknown;
}

export function createMockInteraction(overrides: MockInteractionOptions = {}) {
  const {
    subcommand = null,
    members = {},
    strings = {},
    integers = {},
    booleans = {},
    channels = {},
    roles = {},
    ...rest
  } = overrides;

  const defaults = {
    options: {
      getSubcommand: vi.fn().mockReturnValue(subcommand),
      getMember: vi.fn((name: string) => members[name] ?? null),
      getString: vi.fn((name: string) => strings[name] ?? null),
      getInteger: vi.fn((name: string) => integers[name] ?? null),
      getBoolean: vi.fn((name: string) => booleans[name] ?? null),
      getChannel: vi.fn((name: string) => channels[name] ?? null),
      getRole: vi.fn((name: string) => roles[name] ?? null),
    },
    user: { id: "user-1", username: "testuser", displayName: "Test User" },
    member: { id: "user-1", roles: { highest: { position: 10 }, cache: new Map() } },
    client: { user: { id: "bot-1" } },
    guild: { id: "test-guild-1", name: "Test Guild", memberCount: 100 },
    guildId: "test-guild-1",
    channelId: "ch-1",
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
    followUp: vi.fn(),
    replied: false,
    deferred: false,
  };
  return { ...defaults, ...rest };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
pnpm test packages/systems/tests/helpers/factories.test.ts
```

Expected: PASS — all 5 assertions pass.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
pnpm test
```

Expected: All tests pass. Any test that used `createMockInteraction` with a plain spread still works because `...rest` handles it.

- [ ] **Step 6: Delete the temporary test file**

```bash
rm packages/systems/tests/helpers/factories.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add packages/systems/tests/helpers/factories.ts
git commit -m "test(helpers): extend createMockInteraction with typed subcommand and per-option API"
```

---

## Task 3: Fix `guildMemberAdd` Event Handler Tests (Close All Paths)

**Files:**
- Modify: `apps/bot/tests/events/guildMemberAdd.test.ts`

The existing test mocks `getLogConfig` but does NOT mock `getWelcomeConfig`, `getAntiRaidConfig`, `generateWelcomeImage`, or `buildWelcomeEmbed`. This means the welcome and anti-raid paths either silently fail or call real DB — making them untested.

- [ ] **Step 1: Read the current test file to understand what's mocked**

Read: [apps/bot/tests/events/guildMemberAdd.test.ts](apps/bot/tests/events/guildMemberAdd.test.ts)

Confirm that `getWelcomeConfig` and `getAntiRaidConfig` are NOT mocked.

- [ ] **Step 2: Write new failing tests for the welcome + auto-role paths**

Add these at the bottom of the `describe("guildMemberAdd event")` block:

```typescript
// --- Welcome path (requires mocking getWelcomeConfig and friends) ---

it("assigns auto-roles when welcomeConfig has autoRoleIds", async () => {
  mockGetLogConfig.mockResolvedValueOnce(null); // skip logging
  mockGetAntiRaidConfig.mockResolvedValueOnce({ enabled: false });
  mockGetWelcomeConfig.mockResolvedValueOnce({
    autoRoleIds: ["role-abc"],
    welcomeEnabled: false,
    welcomeChannelId: null,
    dmEnabled: false,
    welcomeImageEnabled: false,
    welcomeImageConfig: { sendMode: "with" },
    welcomeMessage: "",
    dmMessage: "",
  });

  const rolesToAdd: string[] = [];
  const mockMemberWithRoles = {
    ...createMockMember(),
    user: { ...createMockMember().user, bot: false },
    guild: createMockGuild({
      channels: [],
      roles: [{ id: "role-abc", position: 1, managed: false }],
    }),
    roles: {
      highest: { position: 5 },
      cache: new Map(),
      add: vi.fn((ids: string[]) => { rolesToAdd.push(...ids); return Promise.resolve(); }),
      remove: vi.fn(),
    },
    displayName: "NewUser",
  };

  await event.execute(mockMemberWithRoles as never);

  expect(mockMemberWithRoles.roles.add).toHaveBeenCalledWith(
    ["role-abc"],
    "Auto-role on join",
  );
});

it("sends welcome embed to channel when welcomeEnabled is true", async () => {
  mockGetLogConfig.mockResolvedValueOnce(null);
  mockGetAntiRaidConfig.mockResolvedValueOnce({ enabled: false });

  const mockChannel = createMockChannel({ id: "welcome-ch" });
  const mockGuild = createMockGuild({
    channels: [{ ...mockChannel, id: "welcome-ch" }],
  });

  mockGetWelcomeConfig.mockResolvedValueOnce({
    autoRoleIds: [],
    welcomeEnabled: true,
    welcomeChannelId: "welcome-ch",
    welcomeImageEnabled: false,
    welcomeImageConfig: { sendMode: "with" },
    welcomeMessage: "Welcome {user}!",
    dmEnabled: false,
    dmMessage: "",
  });

  const mockMemberWithGuild = {
    ...createMockMember(),
    user: { ...createMockMember().user, bot: false, displayAvatarURL: vi.fn().mockReturnValue("https://cdn.example.com/avatar.png") },
    guild: mockGuild,
    displayName: "NewUser",
  };

  await event.execute(mockMemberWithGuild as never);

  expect(mockBuildWelcomeEmbed).toHaveBeenCalled();
  expect(mockChannel.send).toHaveBeenCalledWith(
    expect.objectContaining({ embeds: expect.any(Array) }),
  );
});

it("sends DM when dmEnabled is true", async () => {
  mockGetLogConfig.mockResolvedValueOnce(null);
  mockGetAntiRaidConfig.mockResolvedValueOnce({ enabled: false });
  mockGetWelcomeConfig.mockResolvedValueOnce({
    autoRoleIds: [],
    welcomeEnabled: false,
    welcomeChannelId: null,
    welcomeImageEnabled: false,
    welcomeImageConfig: { sendMode: "with" },
    welcomeMessage: "",
    dmEnabled: true,
    dmMessage: "Hello {user}, welcome!",
  });

  const mockMember = createMockMember();
  mockMember.user.bot = false;
  await event.execute(mockMember as never);

  expect(mockMember.user.send).toHaveBeenCalledWith(
    expect.objectContaining({ embeds: expect.any(Array) }),
  );
});

it("does NOT send welcome when getWelcomeConfig returns null", async () => {
  mockGetLogConfig.mockResolvedValueOnce(null);
  mockGetAntiRaidConfig.mockResolvedValueOnce({ enabled: false });
  mockGetWelcomeConfig.mockResolvedValueOnce(null);

  const mockMember = createMockMember();
  await event.execute(mockMember as never);
  // No channel.send or DM should fire
  expect(mockBuildWelcomeEmbed).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run to confirm the tests fail**

```bash
pnpm test apps/bot/tests/events/guildMemberAdd.test.ts
```

Expected: FAIL — `mockGetWelcomeConfig is not defined`, `mockGetAntiRaidConfig is not defined`, etc.

- [ ] **Step 4: Add the missing mocks to the top of the test file**

Add after the existing `vi.mock("@fluxcore/systems/logging/formatter")` block:

```typescript
const mockGetWelcomeConfig = vi.fn().mockResolvedValue(null);
vi.mock("@fluxcore/systems/welcome/config", () => ({
  getWelcomeConfig: (...args: unknown[]) => mockGetWelcomeConfig(...args),
}));

const mockBuildWelcomeEmbed = vi.fn().mockReturnValue({ data: { title: "Welcome" }, setImage: vi.fn().mockReturnThis() });
vi.mock("@fluxcore/systems/welcome/builder", () => ({
  buildWelcomeEmbed: (...args: unknown[]) => mockBuildWelcomeEmbed(...args),
}));

vi.mock("@fluxcore/systems/welcome/image", () => ({
  generateWelcomeImage: vi.fn().mockResolvedValue(Buffer.from("")),
  createStorageAdapter: vi.fn().mockReturnValue({}),
}));

const mockGetAntiRaidConfig = vi.fn().mockResolvedValue({ enabled: false });
vi.mock("@fluxcore/systems/antiraid/config", () => ({
  getAntiRaidConfig: (...args: unknown[]) => mockGetAntiRaidConfig(...args),
}));

vi.mock("@fluxcore/systems/antiraid/tracker", () => ({
  recordJoin: vi.fn().mockReturnValue(false),
}));

vi.mock("@fluxcore/systems/antiraid/actions", () => ({
  executeRaidAction: vi.fn().mockResolvedValue(true),
  lockdownGuild: vi.fn().mockResolvedValue(3),
}));

vi.mock("@fluxcore/systems/antiraid/persistence", () => ({
  createRaidEvent: vi.fn().mockResolvedValue(undefined),
}));
```

Also add `createMockChannel` and `createMockGuild` imports:

```typescript
import { createMockChannel, createMockGuild } from "@fluxcore/systems/tests/helpers/discord-mocks.js";
```

And add to `createMockMember`:

```typescript
user: {
  id,
  bot: isBot,
  tag: "User#0001",
  createdTimestamp: Date.now() - 365 * 24 * 60 * 60 * 1000,
  displayAvatarURL: vi.fn().mockReturnValue("https://example.com/avatar.png"),
  send: vi.fn().mockResolvedValue(undefined),  // ← ADD THIS
},
```

- [ ] **Step 5: Run tests to confirm all pass**

```bash
pnpm test apps/bot/tests/events/guildMemberAdd.test.ts
```

Expected: PASS — all tests including the new welcome and anti-raid paths.

- [ ] **Step 6: Commit**

```bash
git add apps/bot/tests/events/guildMemberAdd.test.ts
git commit -m "test(events): complete guildMemberAdd coverage — welcome, auto-role, anti-raid, and DM paths"
```

---

## Task 4: Complete `interactionCreate` Event Router Tests

**Files:**
- Modify: `apps/bot/tests/events/interactionCreate.test.ts`

The event router handles: autocomplete, button (4 routing branches), modal (2 branches), user select, string select (2 branches), and chat command (with cooldown). Each routing branch needs a test.

- [ ] **Step 1: Read the current test file**

Read: [apps/bot/tests/events/interactionCreate.test.ts](apps/bot/tests/events/interactionCreate.test.ts)

Note which interaction types are covered and which are missing.

- [ ] **Step 2: Write failing tests for button routing branches**

Add to the test file after existing tests:

```typescript
describe("button routing", () => {
  it("routes giveaway buttons to handleGiveawayButton", async () => {
    const interaction = createMockButtonInteraction({
      customId: `${GIVEAWAY_BUTTON_PREFIX}giveaway-123`,
    });
    // Make it look like a button to the event handler
    interaction.isButton = vi.fn().mockReturnValue(true);
    interaction.isAutocomplete = vi.fn().mockReturnValue(false);
    interaction.isModalSubmit = vi.fn().mockReturnValue(false);
    interaction.isUserSelectMenu = vi.fn().mockReturnValue(false);
    interaction.isStringSelectMenu = vi.fn().mockReturnValue(false);
    interaction.isChatInputCommand = vi.fn().mockReturnValue(false);

    await event.execute(interaction as never);

    expect(mockHandleGiveawayButton).toHaveBeenCalledWith(interaction);
    expect(mockHandleTempVoiceButton).not.toHaveBeenCalled();
    expect(mockHandleTicketButton).not.toHaveBeenCalled();
  });

  it("routes ticket buttons to handleTicketButton", async () => {
    const interaction = createMockButtonInteraction({ customId: TICKET_CLOSE_ID });
    interaction.isButton = vi.fn().mockReturnValue(true);
    interaction.isAutocomplete = vi.fn().mockReturnValue(false);
    interaction.isModalSubmit = vi.fn().mockReturnValue(false);
    interaction.isUserSelectMenu = vi.fn().mockReturnValue(false);
    interaction.isStringSelectMenu = vi.fn().mockReturnValue(false);
    interaction.isChatInputCommand = vi.fn().mockReturnValue(false);

    await event.execute(interaction as never);

    expect(mockHandleTicketButton).toHaveBeenCalledWith(interaction);
  });

  it("routes role panel buttons to handleRolePanelButton", async () => {
    const interaction = createMockButtonInteraction({ customId: "rp_42_role-abc" });
    interaction.isButton = vi.fn().mockReturnValue(true);
    interaction.isAutocomplete = vi.fn().mockReturnValue(false);
    interaction.isModalSubmit = vi.fn().mockReturnValue(false);
    interaction.isUserSelectMenu = vi.fn().mockReturnValue(false);
    interaction.isStringSelectMenu = vi.fn().mockReturnValue(false);
    interaction.isChatInputCommand = vi.fn().mockReturnValue(false);

    await event.execute(interaction as never);

    expect(mockHandleRolePanelButton).toHaveBeenCalledWith(interaction, 42, "role-abc");
  });

  it("routes music buttons to handleMusicButton", async () => {
    const interaction = createMockButtonInteraction({ customId: `${MU_PREFIX}play` });
    interaction.isButton = vi.fn().mockReturnValue(true);
    interaction.isAutocomplete = vi.fn().mockReturnValue(false);
    interaction.isModalSubmit = vi.fn().mockReturnValue(false);
    interaction.isUserSelectMenu = vi.fn().mockReturnValue(false);
    interaction.isStringSelectMenu = vi.fn().mockReturnValue(false);
    interaction.isChatInputCommand = vi.fn().mockReturnValue(false);

    await event.execute(interaction as never);

    expect(mockHandleMusicButton).toHaveBeenCalledWith(interaction);
  });

  it("routes unknown buttons to handleTempVoiceButton", async () => {
    const interaction = createMockButtonInteraction({ customId: "tv_some_button" });
    interaction.isButton = vi.fn().mockReturnValue(true);
    interaction.isAutocomplete = vi.fn().mockReturnValue(false);
    interaction.isModalSubmit = vi.fn().mockReturnValue(false);
    interaction.isUserSelectMenu = vi.fn().mockReturnValue(false);
    interaction.isStringSelectMenu = vi.fn().mockReturnValue(false);
    interaction.isChatInputCommand = vi.fn().mockReturnValue(false);

    await event.execute(interaction as never);

    expect(mockHandleTempVoiceButton).toHaveBeenCalledWith(interaction);
  });
});

describe("modal routing", () => {
  it("routes ticket modals to handleTicketModal", async () => {
    const interaction = createMockModalInteraction({ customId: "ticket_form_123" });
    interaction.isModalSubmit = vi.fn().mockReturnValue(true);
    interaction.isButton = vi.fn().mockReturnValue(false);
    interaction.isAutocomplete = vi.fn().mockReturnValue(false);
    interaction.isUserSelectMenu = vi.fn().mockReturnValue(false);
    interaction.isStringSelectMenu = vi.fn().mockReturnValue(false);
    interaction.isChatInputCommand = vi.fn().mockReturnValue(false);

    await event.execute(interaction as never);

    expect(mockHandleTicketModal).toHaveBeenCalledWith(interaction);
    expect(mockHandleTempVoiceModal).not.toHaveBeenCalled();
  });

  it("routes non-ticket modals to handleTempVoiceModal", async () => {
    const interaction = createMockModalInteraction({ customId: "tempvoice_rename" });
    interaction.isModalSubmit = vi.fn().mockReturnValue(true);
    interaction.isButton = vi.fn().mockReturnValue(false);
    interaction.isAutocomplete = vi.fn().mockReturnValue(false);
    interaction.isUserSelectMenu = vi.fn().mockReturnValue(false);
    interaction.isStringSelectMenu = vi.fn().mockReturnValue(false);
    interaction.isChatInputCommand = vi.fn().mockReturnValue(false);

    await event.execute(interaction as never);

    expect(mockHandleTempVoiceModal).toHaveBeenCalledWith(interaction);
  });
});

describe("select menu routing", () => {
  it("routes role panel dropdowns to handleRolePanelDropdown", async () => {
    const interaction = createMockSelectMenuInteraction({
      customId: "rpd_42_stuff",
      values: ["role-1", "role-2"],
    });
    interaction.isStringSelectMenu = vi.fn().mockReturnValue(true);
    interaction.isButton = vi.fn().mockReturnValue(false);
    interaction.isModalSubmit = vi.fn().mockReturnValue(false);
    interaction.isAutocomplete = vi.fn().mockReturnValue(false);
    interaction.isUserSelectMenu = vi.fn().mockReturnValue(false);
    interaction.isChatInputCommand = vi.fn().mockReturnValue(false);

    await event.execute(interaction as never);

    expect(mockHandleRolePanelDropdown).toHaveBeenCalledWith(
      interaction, 42, ["role-1", "role-2"],
    );
  });

  it("routes other string selects to handleTempVoiceStringSelect", async () => {
    const interaction = createMockSelectMenuInteraction({ customId: "tv_bitrate_select" });
    interaction.isStringSelectMenu = vi.fn().mockReturnValue(true);
    interaction.isButton = vi.fn().mockReturnValue(false);
    interaction.isModalSubmit = vi.fn().mockReturnValue(false);
    interaction.isAutocomplete = vi.fn().mockReturnValue(false);
    interaction.isUserSelectMenu = vi.fn().mockReturnValue(false);
    interaction.isChatInputCommand = vi.fn().mockReturnValue(false);

    await event.execute(interaction as never);

    expect(mockHandleTempVoiceStringSelect).toHaveBeenCalledWith(interaction);
  });
});
```

- [ ] **Step 3: Run to confirm the new tests fail**

```bash
pnpm test apps/bot/tests/events/interactionCreate.test.ts
```

Expected: FAIL — mocks for handlers not defined in test file.

- [ ] **Step 4: Add missing mock declarations to the test file**

At the top of `interactionCreate.test.ts`, after existing mocks, add:

```typescript
import {
  createMockButtonInteraction,
  createMockSelectMenuInteraction,
  createMockModalInteraction,
} from "@fluxcore/systems/tests/helpers/discord-mocks.js";
import { GIVEAWAY_BUTTON_PREFIX } from "@fluxcore/systems/giveaways/constants";
import { MU_PREFIX } from "@fluxcore/systems/music/constants";
import { TICKET_CLOSE_ID, TICKET_CLAIM_ID, TICKET_BUTTON_PREFIX } from "@fluxcore/systems/tickets/constants";

const mockHandleGiveawayButton = vi.fn().mockResolvedValue(undefined);
vi.mock("../../src/systems/giveaways/interactions.js", () => ({
  handleGiveawayButton: (...args: unknown[]) => mockHandleGiveawayButton(...args),
}));

const mockHandleRolePanelButton = vi.fn().mockResolvedValue(undefined);
const mockHandleRolePanelDropdown = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems/rolePanel/handler", () => ({
  handleRolePanelButton: (...args: unknown[]) => mockHandleRolePanelButton(...args),
  handleRolePanelDropdown: (...args: unknown[]) => mockHandleRolePanelDropdown(...args),
}));

const mockHandleTicketButton = vi.fn().mockResolvedValue(undefined);
const mockHandleTicketModal = vi.fn().mockResolvedValue(undefined);
vi.mock("../../src/systems/tickets/interactions.js", () => ({
  handleTicketButton: (...args: unknown[]) => mockHandleTicketButton(...args),
  handleTicketModal: (...args: unknown[]) => mockHandleTicketModal(...args),
}));

const mockHandleMusicButton = vi.fn().mockResolvedValue(undefined);
vi.mock("../../src/systems/music/interactions.js", () => ({
  handleMusicButton: (...args: unknown[]) => mockHandleMusicButton(...args),
}));

const mockHandleTempVoiceButton = vi.fn().mockResolvedValue(undefined);
const mockHandleTempVoiceModal = vi.fn().mockResolvedValue(undefined);
const mockHandleTempVoiceUserSelect = vi.fn().mockResolvedValue(undefined);
const mockHandleTempVoiceStringSelect = vi.fn().mockResolvedValue(undefined);
vi.mock("../../src/systems/tempVoice/interactions.js", () => ({
  handleTempVoiceButton: (...args: unknown[]) => mockHandleTempVoiceButton(...args),
  handleTempVoiceModal: (...args: unknown[]) => mockHandleTempVoiceModal(...args),
  handleTempVoiceUserSelect: (...args: unknown[]) => mockHandleTempVoiceUserSelect(...args),
  handleTempVoiceStringSelect: (...args: unknown[]) => mockHandleTempVoiceStringSelect(...args),
}));
```

- [ ] **Step 5: Run tests to confirm all pass**

```bash
pnpm test apps/bot/tests/events/interactionCreate.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/bot/tests/events/interactionCreate.test.ts
git commit -m "test(events): add full interactionCreate routing coverage for buttons, modals, and select menus"
```

---

## Task 5: Subcommand Routing Coverage for `/actions` Command

**Files:**
- Create: `apps/bot/tests/commands/admin/actions.test.ts`

The `/actions` command has 10+ subcommands routed via a `switch(sub)`. Every branch needs: (a) a routing test confirming the right handler fires, and (b) a handler test for happy path + error case.

- [ ] **Step 1: Write the routing matrix test**

```typescript
// apps/bot/tests/commands/admin/actions.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "test-token", clientId: "test-client-id", guildId: undefined, logLevel: "info" },
}));

vi.mock("@fluxcore/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/utils")>();
  return {
    ...actual,
    checkPermissions: vi.fn().mockResolvedValue(true),
  };
});

// Mock all the individual handler functions so we can assert they were called
const mockHandleCreate = vi.fn().mockResolvedValue(undefined);
const mockHandleDelete = vi.fn().mockResolvedValue(undefined);
const mockHandleEnable = vi.fn().mockResolvedValue(undefined);
const mockHandleDisable = vi.fn().mockResolvedValue(undefined);
const mockHandleList = vi.fn().mockResolvedValue(undefined);
const mockHandleView = vi.fn().mockResolvedValue(undefined);
const mockHandleSettings = vi.fn().mockResolvedValue(undefined);

vi.mock("../../../src/commands/admin/actions.js", async (importOriginal) => {
  // We need the command object but with the handlers replaced
  // Use a partial mock approach: re-export the real command with handler mocks injected
  // NOTE: This requires the handlers to be exported from the module.
  // If they are not exported, mock the systems they call instead.
  const actual = await importOriginal<typeof import("../../../src/commands/admin/actions.js")>();
  return actual; // Keep real module, mock the systems below
});

vi.mock("@fluxcore/systems/actions/persistence", () => ({
  createRule: mockHandleCreate,
  deleteRule: mockHandleDelete,
  updateRule: vi.fn().mockResolvedValue({ id: 1 }),
  getRulesByGuild: vi.fn().mockResolvedValue([]),
  getRuleById: vi.fn().mockResolvedValue(null),
  getRecentLogs: vi.fn().mockResolvedValue([]),
  countRules: vi.fn().mockResolvedValue(0),
  notifyCacheInvalidation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@fluxcore/systems/actions/config", () => ({
  getGuildSettingsOrDefault: vi.fn().mockReturnValue({ maxRules: 25, globalEnabled: true, logChannelId: null }),
  setGuildSettings: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@fluxcore/systems/actions/cache", () => ({
  getRulesForGuild: vi.fn().mockReturnValue([]),
  addRuleToCache: vi.fn(),
  removeRuleFromCache: vi.fn(),
  updateRuleInCache: vi.fn(),
  reloadGuild: vi.fn().mockResolvedValue(undefined),
}));

import { createMockInteraction } from "@fluxcore/systems/tests/helpers/factories.js";

const actionsModule = await import("../../../src/commands/admin/actions.js");
const command = actionsModule.default;

describe("/actions command metadata", () => {
  it("has correct name and category", () => {
    expect(command.data.name).toBe("actions");
    expect(command.category).toBe("Admin");
  });
});

describe("/actions subcommand routing", () => {
  const SUBCOMMANDS = [
    "create",
    "delete",
    "enable",
    "disable",
    "list",
    "view",
    "settings",
    "edit",
    "logs",
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  SUBCOMMANDS.forEach((sub) => {
    it(`does not reply with 'Unknown subcommand' for /${sub}`, async () => {
      const interaction = createMockInteraction({
        subcommand: sub,
        strings: { name: "test-rule", eventType: "memberJoin" },
        integers: { priority: 0 },
      });

      await command.execute(interaction as never);

      const replyContent = (interaction.reply as ReturnType<typeof vi.fn>).mock.calls
        .flat()
        .find((arg: unknown) => typeof arg === "object" && arg !== null && "content" in (arg as Record<string, unknown>))
        ?.content;

      expect(replyContent).not.toBe("Unknown subcommand");
    });
  });
});

describe("/actions create subcommand", () => {
  beforeEach(() => vi.clearAllMocks());

  it("happy path: creates a rule and replies with success embed", async () => {
    const mockCreate = vi.mocked(
      (await import("@fluxcore/systems/actions/persistence")).createRule
    );
    mockCreate.mockResolvedValueOnce({
      id: 1,
      name: "new-rule",
      eventType: "memberJoin",
      actions: "[]",
      conditions: "{}",
      priority: 0,
      enabled: true,
      guildId: "test-guild-1",
      createdBy: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const interaction = createMockInteraction({
      subcommand: "create",
      strings: { name: "new-rule", event_type: "memberJoin" },
    });

    await command.execute(interaction as never);

    expect(mockCreate).toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) }),
    );
  });

  it("rejects when at max rule limit", async () => {
    const { countRules } = await import("@fluxcore/systems/actions/persistence");
    vi.mocked(countRules).mockResolvedValueOnce(25); // at limit of 25

    const interaction = createMockInteraction({
      subcommand: "create",
      strings: { name: "overflow-rule", event_type: "memberJoin" },
    });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });
});

describe("/actions list subcommand", () => {
  beforeEach(() => vi.clearAllMocks());

  it("happy path: lists rules and replies with embed", async () => {
    const { getRulesByGuild } = await import("@fluxcore/systems/actions/persistence");
    vi.mocked(getRulesByGuild).mockResolvedValueOnce([
      { id: 1, name: "rule-a", eventType: "memberJoin", enabled: true, priority: 0 } as never,
    ]);

    const interaction = createMockInteraction({ subcommand: "list" });
    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) }),
    );
  });

  it("replies with empty state message when no rules exist", async () => {
    const { getRulesByGuild } = await import("@fluxcore/systems/actions/persistence");
    vi.mocked(getRulesByGuild).mockResolvedValueOnce([]);

    const interaction = createMockInteraction({ subcommand: "list" });
    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to confirm tests fail (command doesn't exist yet in test path)**

```bash
pnpm test apps/bot/tests/commands/admin/actions.test.ts
```

Expected: Tests fail or some pass depending on current state.

- [ ] **Step 3: Iterate on test until all pass**

Run the tests, read failures, adjust mocks to match the actual module's import paths and handler signatures. The routing matrix test is the most important — it guarantees no subcommand silently falls through to "Unknown subcommand".

```bash
pnpm test apps/bot/tests/commands/admin/actions.test.ts
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add apps/bot/tests/commands/admin/actions.test.ts
git commit -m "test(commands): add /actions subcommand routing matrix and per-subcommand coverage"
```

---

## Task 6: "Closed Loop" — Event Handler Reads Cache, Calls Discord

**Files:**
- Create: `packages/systems/tests/unit/actions/event-dispatch.test.ts`

This tests the final link: **given a rule in cache, when the matching event fires, does the bot call the right Discord API?** This doesn't need the DB — it seeds the cache directly.

- [ ] **Step 1: Locate the actions event dispatcher**

Read: `packages/systems/src/actions/executor.ts` (or wherever action rules are executed when an event fires — check `apps/bot/src/events/*.ts` for the pattern).

Identify the exported function that: (a) looks up rules from cache by guild+eventType, (b) iterates actions, (c) calls Discord methods.

- [ ] **Step 2: Write the failing closed-loop test**

```typescript
// packages/systems/tests/unit/actions/event-dispatch.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// We seed cache directly — no DB needed
import {
  invalidateGuild,
  addRuleToCache,
} from "../../../src/actions/cache.js";

// Import the executor that reads from cache and calls Discord
import { executeActionsForEvent } from "../../../src/actions/executor.js";

import {
  createMockGuild,
  createMockChannel,
  createMockMember,
} from "../../helpers/discord-mocks.js";

const GUILD_ID = "test-guild-evt";

describe("action executor — closed loop (cache → Discord call)", () => {
  beforeEach(() => {
    invalidateGuild(GUILD_ID);
    vi.clearAllMocks();
  });

  it("calls channel.send() when a sendMessage action is cached for the event", async () => {
    const mockChannel = createMockChannel({ id: "ch-welcome" });
    const mockGuild = createMockGuild({
      id: GUILD_ID,
      channels: [mockChannel],
    });

    addRuleToCache({
      id: 1,
      guildId: GUILD_ID,
      name: "welcome-msg",
      enabled: true,
      eventType: "memberJoin",
      priority: 0,
      conditions: {},
      actions: [{ type: "sendMessage", channelId: "ch-welcome", message: "Hello {user}!" }],
      createdBy: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const member = createMockMember({ id: "new-user" });

    await executeActionsForEvent(GUILD_ID, "memberJoin", {
      guild: mockGuild as never,
      member: member as never,
    });

    expect(mockChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("Hello") }),
    );
  });

  it("calls member.roles.add() when an addRole action is cached", async () => {
    const mockGuild = createMockGuild({ id: GUILD_ID });
    const mockMember = createMockMember({ id: "new-user" });

    addRuleToCache({
      id: 2,
      guildId: GUILD_ID,
      name: "auto-role",
      enabled: true,
      eventType: "memberJoin",
      priority: 0,
      conditions: {},
      actions: [{ type: "addRole", roleId: "role-verified" }],
      createdBy: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await executeActionsForEvent(GUILD_ID, "memberJoin", {
      guild: mockGuild as never,
      member: mockMember as never,
    });

    expect(mockMember.roles.add).toHaveBeenCalledWith("role-verified");
  });

  it("skips disabled rules", async () => {
    const mockChannel = createMockChannel({ id: "ch-1" });
    const mockGuild = createMockGuild({ id: GUILD_ID, channels: [mockChannel] });

    addRuleToCache({
      id: 3,
      guildId: GUILD_ID,
      name: "disabled-rule",
      enabled: false,   // ← disabled
      eventType: "memberJoin",
      priority: 0,
      conditions: {},
      actions: [{ type: "sendMessage", channelId: "ch-1", message: "Should not fire" }],
      createdBy: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await executeActionsForEvent(GUILD_ID, "memberJoin", {
      guild: mockGuild as never,
      member: createMockMember() as never,
    });

    expect(mockChannel.send).not.toHaveBeenCalled();
  });

  it("executes rules in priority order (highest first)", async () => {
    const callOrder: string[] = [];
    const ch1 = createMockChannel({ id: "ch-low" });
    ch1.send = vi.fn().mockImplementation(() => {
      callOrder.push("low");
      return Promise.resolve({ id: "m1" });
    });
    const ch2 = createMockChannel({ id: "ch-high" });
    ch2.send = vi.fn().mockImplementation(() => {
      callOrder.push("high");
      return Promise.resolve({ id: "m2" });
    });
    const mockGuild = createMockGuild({ id: GUILD_ID, channels: [ch1, ch2] });

    addRuleToCache({
      id: 10, guildId: GUILD_ID, name: "low", enabled: true, eventType: "memberJoin",
      priority: 1, conditions: {}, actions: [{ type: "sendMessage", channelId: "ch-low", message: "low" }],
      createdBy: "user-1", createdAt: new Date(), updatedAt: new Date(),
    });
    addRuleToCache({
      id: 11, guildId: GUILD_ID, name: "high", enabled: true, eventType: "memberJoin",
      priority: 10, conditions: {}, actions: [{ type: "sendMessage", channelId: "ch-high", message: "high" }],
      createdBy: "user-1", createdAt: new Date(), updatedAt: new Date(),
    });

    await executeActionsForEvent(GUILD_ID, "memberJoin", {
      guild: mockGuild as never,
      member: createMockMember() as never,
    });

    expect(callOrder).toEqual(["high", "low"]);
  });
});
```

- [ ] **Step 3: Run to confirm failure**

```bash
pnpm test packages/systems/tests/unit/actions/event-dispatch.test.ts
```

Expected: FAIL — `executeActionsForEvent` is not exported or the function signature doesn't match. Note the actual exported API.

- [ ] **Step 4: Adjust imports to match the real executor API**

If the executor function is named differently or has a different signature, adjust the test to match. **Do not change the source — only adjust the test imports.** This is a discovery step: if `executeActionsForEvent` doesn't exist, find the function that actually maps event → action → Discord call and test that.

- [ ] **Step 5: Run tests to confirm all pass**

```bash
pnpm test packages/systems/tests/unit/actions/event-dispatch.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/systems/tests/unit/actions/event-dispatch.test.ts
git commit -m "test(actions): add closed-loop event dispatch tests — cache read → Discord call verification"
```

---

## Task 7: Configure Coverage Thresholds

**Files:**
- Modify: `apps/bot/vitest.config.ts` (or wherever vitest is configured)
- Modify: `apps/dashboard/vitest.config.ts`

- [ ] **Step 1: Read the current vitest config files**

Read: [apps/bot/vitest.config.ts](apps/bot/vitest.config.ts) and [apps/dashboard/vitest.config.ts](apps/dashboard/vitest.config.ts)

Note whether coverage is configured at all.

- [ ] **Step 2: Add coverage thresholds to the bot vitest config**

In `apps/bot/vitest.config.ts`, add a `coverage` block inside the `test` object:

```typescript
coverage: {
  provider: "v8",
  reporter: ["text", "json", "html"],
  include: ["src/**/*.ts"],
  exclude: [
    "src/**/*.d.ts",
    "src/**/index.ts",   // re-export barrels don't need coverage
  ],
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 70,
    statements: 80,
  },
},
```

- [ ] **Step 3: Add the same to the dashboard vitest config**

In `apps/dashboard/vitest.config.ts`:

```typescript
coverage: {
  provider: "v8",
  reporter: ["text", "json", "html"],
  include: ["src/server/**/*.ts"],   // only test the API layer, not client-side React
  exclude: ["src/**/*.d.ts"],
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 70,
    statements: 80,
  },
},
```

- [ ] **Step 4: Run coverage and note gaps**

```bash
pnpm test -- --coverage
```

Expected: A coverage report. Note any files below threshold — these reveal missing tests beyond what this plan adds.

- [ ] **Step 5: Commit**

```bash
git add apps/bot/vitest.config.ts apps/dashboard/vitest.config.ts
git commit -m "test(config): add coverage thresholds (80% lines/functions/statements, 70% branches)"
```

---

## Self-Review Against Identified Gaps

| Gap | Addressed by |
|-----|-------------|
| `createMockInteraction` doesn't support typed options | Task 2 |
| No Discord object factories (guild/channel/message/role) | Task 1 |
| No component interaction factories | Task 1 |
| `guildMemberAdd.test.ts` missing `getWelcomeConfig` + anti-raid mocks | Task 3 |
| Multi-subcommand commands lack routing coverage | Task 5 |
| `interactionCreate` button/modal/select paths untested | Task 4 |
| No "cache → Discord call" verification | Task 6 |
| No coverage thresholds | Task 7 |

---

## Execution Order

Tasks 1 and 2 must be completed first (they produce the mock factories all other tasks depend on). Tasks 3–7 are independent of each other after that and can be parallelized if using subagent-driven execution.

```
Task 1 (discord-mocks.ts) ──┐
                             ├──► Task 3 (guildMemberAdd)
Task 2 (factories.ts)  ──────┤
                             ├──► Task 4 (interactionCreate)
                             ├──► Task 5 (/actions subcommands)
                             ├──► Task 6 (closed-loop executor)
                             └──► Task 7 (coverage config) ← no dependency, can run anytime
```

---

**Plan complete and saved to `docs/superpowers/plans/2026-03-31-testing-strategy.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast parallel execution for Tasks 3–7.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
