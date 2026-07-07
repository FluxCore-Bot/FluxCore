# Variable Text Fields — Autocomplete, Highlighting & Live Preview

- **Date:** 2026-07-07
- **Status:** Approved design (ready for implementation planning)
- **Scope:** `apps/dashboard` — all message/template text fields that support `{variable}` placeholders

## 1. Problem

Across the dashboard, many text fields accept templated message content with `{variable}`
placeholders (welcome/farewell/DM messages, custom command responses, scheduled messages,
leveling announcements, automation action messages, tempvoice channel-name templates). Today
the only affordance is **static hint text** printed below a field (e.g.
`apps/dashboard/src/client/routes/guild/$guildId/welcome.tsx:125-126`). Users must know the
exact token spelling, get no feedback on typos, and cannot see what the rendered message will
look like.

We will make these fields a first-class editing experience: `{`-triggered autocomplete, a
searchable variable browser, inline highlighting of variables, a live Discord-style preview,
and validation of unknown variables — applied consistently everywhere through one reusable
component set.

## 2. Goals / Non-Goals

**Goals**

- One reusable, independently-testable component set used across every variable-bearing field.
- Autocomplete triggered by typing `{`, filtered as the user types, insert-at-cursor.
- A searchable "Insert variable" browser with descriptions, examples, and grouping.
- Inline highlighting of valid variables; distinct highlighting + a listed warning for unknown ones.
- Live **Discord-style** preview (message + embed) resolved with **hybrid** data (real
  guild/user where available, realistic samples otherwise).
- Full i18n and WCAG-AA accessibility.

**Non-Goals (YAGNI)**

- **No renaming/unifying** of existing runtime tokens across features. Token names differ today
  (welcome uses `{user.name}`/`{membercount}`; custom commands use `{username}`/`{memberCount}`).
  Changing them would break already-saved content and bot-side substitution. Each field surfaces
  its **actual** tokens. (Unifying is noted as a possible future cleanup — out of scope here.)
- No new backend endpoints (preview uses already-loaded guild/user state + samples).
- No rich-text/WYSIWYG beyond variable chips; no markdown editing toolbar.
- No preview mode toggle (Discord-style bubble is the single preview).
- Validation is **display-only** — it never blocks saving.

## 3. Current State (findings)

- **Syntax is uniformly `{token}`** (curly braces) across all features.
- **Substitution engines / canonical token sources:**
  - `packages/systems/src/welcome/constants.ts` → `WELCOME_VARIABLES`
    (`{user}`, `{user.tag}`, `{user.name}`, `{user.id}`, `{user.avatar}`, `{server}`,
    `{server.id}`, `{membercount}`, `{server.icon}`).
  - `packages/systems/src/actions/templateEngine.ts` → `resolveTemplate()` +
    `packages/systems/src/actions/constants.ts` → `TEMPLATE_VARIABLES` and the per-event
    variable-availability map (`{ban.reason}` only on `memberBanned`, etc.).
  - Custom commands hint list `VARIABLE_HELP` in `routes/guild/$guildId/commands.tsx`
    (`{user}`, `{username}`, `{userId}`, `{server}`, `{channel}`, `{channelName}`,
    `{memberCount}`).
  - Leveling default `announceMessage` uses `{user}`, `{level}`.
  - TempVoice `nameTemplate` uses `{user}`.
- **UI components** live at `apps/dashboard/src/client/shared/ui/` (not `components/ui` as older
  docs say). `Input` and `Textarea` are trivial wrappers over native elements. `popover.tsx` and
  `scroll-area.tsx` exist. **No** `cmdk`/combobox/command component exists — the picker is built
  from Radix primitives already present.
- i18n: descriptions are surfaced through `t()`; project ships 48 locales with `en` fallback.
  Locale source of truth is `packages/i18n/src/locales/<lang>/*.json`.

## 4. Architecture

New module: `apps/dashboard/src/client/shared/ui/variable-field/`. Three focused units plus a
registry and a pure resolver.

### 4.1 `VariableEditor` (the field)

Drop-in replacement for `Input`/`Textarea`. Native `<input>`/`<textarea>` with an **overlay
mirror** for highlighting.

**Overlay mirror technique (chosen over contentEditable):** the real native element keeps
transparent text + visible caret; a positioned `<div aria-hidden>` behind it renders identical
text with `{tokens}` wrapped in colored spans; scroll is synced (horizontal for input, vertical
for textarea). This preserves native caret, selection, undo/redo, IME, paste, mobile input, and
form semantics — and is accessible by default. `contentEditable` chips were rejected: prettier
but an a11y/IME/undo/paste/mobile minefield that conflicts with the project's WCAG-AA posture.

**Props (superset of native input/textarea):**

```ts
interface VariableEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables: VariableDescriptor[];   // this field's supported tokens
  multiline?: boolean;               // textarea vs input
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  className?: string;
}
```

**Behavior:**

- **Autocomplete:** typing `{` opens a combobox listing this field's variables; keeps filtering
  as the user types (`{use` → `{user}`, `{user.name}`, `{user.tag}`, …). ARIA combobox pattern
  (`role=listbox`/`option`, `aria-activedescendant`, `aria-expanded`). Keyboard: ↑/↓ move,
  Enter/Tab insert, Esc close. Selecting inserts the full `{token}` at the cursor and closes.
- **Highlighting:** valid tokens render in accent color; unknown tokens render in the
  destructive/red color, both via the overlay.
- **Inline validation:** unknown tokens are surfaced below the field (see 4.4). Display-only.

### 4.2 `VariableBrowser` (insert menu)

A popover attached to the field ("Insert variable ▾"): searchable, grouped by `group`
(User / Server / Channel / Event / …), each row shows token + localized description + example.
Selecting inserts `{token}` at the field's cursor (or appends if unfocused). Full keyboard
support; ARIA listbox semantics.

### 4.3 `DiscordMessagePreview` (live preview)

Rendered **once per form** (so an embed's title/description/footer/thumbnail resolve together,
not per field). Renders a Discord-like bubble: avatar + username + timestamp; for embeds the
colored left bar, title, description (mentions + `**markdown**` styled), thumbnail, footer.
Reads its content + a `PreviewContext` and calls the resolver. Wrapped in
`aria-live="polite"`.

### 4.4 Validation

- Detect tokens present in the text that are not in the field's known set → list below field:
  *"Unknown variable `{membercont}`"* with a Levenshtein-based *"did you mean `{membercount}`?"*
  suggestion when a close match exists.
- **Automation event-scope awareness:** a token valid globally but not available for the
  selected event/trigger is flagged separately: *"`{ban.reason}` isn't available for Member
  Join."* Powered by the existing event→variable map.
- Never blocks saving; purely advisory UI paired with text (not color-only).

## 5. Variable Registry (single source of truth)

New `variable-field/registry.ts`:

```ts
type PreviewDataKey =
  | "userMention" | "userName" | "userAvatar" | "userTag" | "userId"
  | "serverName" | "serverId" | "serverIcon" | "memberCount"
  | "channelName" /* ... */;

interface VariableDescriptor {
  token: string;         // "{user.name}" — MUST match runtime substitution exactly
  labelKey: string;      // i18n key for the description
  example: string;       // sample value used in preview + browser ("@Ada")
  group: string;         // "User" | "Server" | "Channel" | "Event" ...
  realKey?: PreviewDataKey; // maps to real guild/user data when available
}
```

- **Token names are imported from the canonical sources** where they exist (`WELCOME_VARIABLES`
  keys, actions `TEMPLATE_VARIABLES` keys) so the registry cannot drift from what the bot
  actually substitutes. Descriptions are i18n keys; examples/groups live in the registry.
- Exposed as per-scope sets: `welcomeVariables`, `customCommandVariables`, `levelingVariables`,
  `tempvoiceVariables`, plus a builder `getAutomationVariables(eventType)` that reuses the
  existing event→variable scoping map so automation autocomplete only offers variables valid for
  the chosen trigger.

## 6. Preview Resolver (hybrid data)

Pure function `resolveTemplatePreview(template: string, ctx: PreviewContext): ResolvedResult`
in `variable-field/resolvePreview.ts`:

- **Real values** from already-loaded dashboard state: `{server}`, `{server.id}`,
  `{server.icon}`, `{membercount}` from the guild; `{user}`, `{user.name}`, `{user.avatar}`,
  `{user.tag}`, `{user.id}` from the signed-in user.
- **Sample values** (from each descriptor's `example`) for event-only tokens (`{ban.reason}` →
  "Spamming", `{level}` → "5", `{old.nickname}`, …).
- **Unknown tokens** are left visible in the output so the preview shows the mistake too.
- Faithful preview of `{token}` replacement — not a re-implementation of bot internals. Pure and
  unit-tested.

`PreviewContext` is assembled by a small hook `usePreviewContext(guildId)` from already-loaded
guild + session data; no new endpoints.

## 7. Rollout Map (every variable field)

All target files confirmed present.

| File | Fields | Treatment |
|---|---|---|
| `routes/guild/$guildId/welcome.tsx` | welcome/farewell/DM: title, description, footer, thumbnail | `VariableEditor` per field + one shared embed preview |
| `routes/guild/$guildId/commands.tsx` | text response; embed title/desc/footer | editor + browser + preview |
| `routes/guild/$guildId/scheduled.tsx` | text content; embed fields | editor + browser + preview |
| `routes/guild/$guildId/leveling.tsx` | announce message | editor + browser + inline preview |
| `features/tempvoice/components/TempVoiceForm.tsx` | name template | single-line editor + inline preview |
| `features/automation/components/ActionFields.tsx` + `workflow/NodeDetailPanel.tsx` | sendMessage, sendEmbed, sendDM, webhook body, setNickname, threadName | editor + event-scoped browser + preview |

Static hint text (e.g. `welcome.tsx:125-126`) is replaced by the interactive
browser + autocomplete.

## 8. i18n

- Component chrome → `common.json`: "Insert variable", "Preview", "No matches",
  "Unknown variable", "Did you mean {suggestion}?", "{variable} isn't available for {event}".
- Per-variable description keys → each feature's locale file
  (`welcome.json`, `logs.json`/commands, `leveling`, `tempvoice.json`, automation).
- English added; other 47 languages fall back to `en`.

## 9. Accessibility (WCAG AA)

- Autocomplete + browser implement the ARIA combobox/listbox pattern with full keyboard control
  (↑/↓/Enter/Tab/Esc).
- Overlay mirror is `aria-hidden` — assistive tech reads the real native field only.
- Preview is an `aria-live="polite"` region.
- Unknown-variable state is conveyed with text, not color alone; red highlight meets contrast.

## 10. Testing (mandatory)

Unit (Vitest):

- `resolveTemplatePreview` — real substitution, sample fallback, unknown passthrough, markdown/mentions.
- Unknown-token detection + "did you mean" (Levenshtein) suggestions.
- Autocomplete filtering (`{use` → correct ordered matches).
- Insert-at-cursor (mid-string insertion, caret position).
- `getAutomationVariables(eventType)` scoping (e.g. `{ban.reason}` present for `memberBanned`,
  absent for `memberJoin`).

Component:

- Keyboard nav through autocomplete + browser; selection inserts the correct token.
- Overlay highlighting reflects valid vs unknown tokens.

## 11. Proposed File Changes

**New**

- `shared/ui/variable-field/VariableEditor.tsx`
- `shared/ui/variable-field/VariableBrowser.tsx`
- `shared/ui/variable-field/DiscordMessagePreview.tsx`
- `shared/ui/variable-field/registry.ts`
- `shared/ui/variable-field/resolvePreview.ts`
- `shared/ui/variable-field/usePreviewContext.ts`
- `shared/ui/variable-field/index.ts`
- Tests mirroring the above under the dashboard test tree.

**Modified** — the six rollout files in §7 (swap native fields → `VariableEditor`, add browser +
preview, remove static hint text) and the locale files in §8.

## 12. Open Questions

None outstanding — design approved. Token-unification across features is explicitly deferred as
a future cleanup.
