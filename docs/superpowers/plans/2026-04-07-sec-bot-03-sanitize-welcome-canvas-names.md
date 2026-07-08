# Sanitize Usernames Before Welcome Canvas Render — Fix Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Severity:** High
**Goal:** Strip zero-width, RTL/LTR override, and other invisible Unicode control characters from `member.user.username`, `member.displayName`, and `guild.name` before they are passed to the welcome image renderer, and cap their length, so a hostile member name cannot deface the welcome card, mojibake other guilds' members, or trigger pathological canvas measurements.
**Architecture:** `apps/bot/src/events/guildMemberAdd.ts` calls `generateWelcomeImage({ member: { username, displayName, avatarUrl }, guild: { name, ... }, ... })` (lines 152-165). The renderer (`packages/systems/src/welcome/image/renderer.ts`) interpolates these strings into template substitution and into a canvas `fillText` call. The fix introduces a `sanitizeDisplayName(raw, maxLen)` helper in `packages/systems/src/welcome/image/index.ts` that (a) removes Unicode control category chars except space, (b) removes the dangerous bidi override characters (U+202A..U+202E, U+2066..U+2069), (c) collapses zero-width chars (U+200B..U+200D, U+2060, U+FEFF), (d) normalizes to NFC, and (e) truncates to a fixed graphemes-safe length. The handler calls it on the three fields before constructing the render input.
**Tech Stack:** discord.js v14, TypeScript, Prisma, Vitest

---

## Vulnerability

`apps/bot/src/events/guildMemberAdd.ts` lines 155-162 pass raw Discord-supplied strings into the canvas pipeline:

```typescript
member: {
  username: member.user.username,
  displayName: member.displayName,
  avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 256 }),
},
guild: {
  name: member.guild.name,
  ...
},
```

A malicious member can set their display name to e.g. `"\u202Eevil\u202D"` to flip the welcome banner right-to-left, or `"A\u200B".repeat(500)` to inflate canvas measurement work and render time. There is no length cap and no character-class filter. The renderer trusts the input.

## Files

- `packages/systems/src/welcome/image/index.ts` (add `sanitizeDisplayName` export)
- New: `packages/systems/src/welcome/image/sanitize.ts`
- `apps/bot/src/events/guildMemberAdd.ts` (lines 149-165)
- New: `packages/systems/tests/unit/welcome/sanitize.test.ts`
- New: `apps/bot/tests/events/welcome-sanitize.test.ts`

## Tasks

### Task 1: Add sanitizeDisplayName helper with unit tests

- [ ] **Step 1: Write failing test** — create `packages/systems/tests/unit/welcome/sanitize.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { sanitizeDisplayName } from "../../../src/welcome/image/sanitize.js";

describe("sanitizeDisplayName", () => {
  it("returns plain ASCII unchanged", () => {
    expect(sanitizeDisplayName("Alice", 32)).toBe("Alice");
  });

  it("strips zero-width spaces and joiners", () => {
    expect(sanitizeDisplayName("a\u200Bb\u200Cc\u200Dd\uFEFFe", 32)).toBe("abcde");
  });

  it("strips RTL/LTR override characters (U+202A..U+202E)", () => {
    expect(sanitizeDisplayName("\u202Eevil\u202D", 32)).toBe("evil");
  });

  it("strips bidi isolate characters (U+2066..U+2069)", () => {
    expect(sanitizeDisplayName("\u2066hidden\u2069", 32)).toBe("hidden");
  });

  it("strips C0/C1 control characters but keeps spaces", () => {
    expect(sanitizeDisplayName("a\u0007 b\u0000c", 32)).toBe("a bc");
  });

  it("truncates to maxLen", () => {
    expect(sanitizeDisplayName("x".repeat(500), 32)).toHaveLength(32);
  });

  it("normalizes to NFC", () => {
    // "é" as NFD (U+0065 U+0301) → NFC ("\u00E9")
    const decomposed = "e\u0301";
    const out = sanitizeDisplayName(decomposed, 32);
    expect(out).toBe("\u00E9");
  });

  it("returns 'Unknown' for empty/whitespace-only input", () => {
    expect(sanitizeDisplayName("", 32)).toBe("Unknown");
    expect(sanitizeDisplayName("   ", 32)).toBe("Unknown");
    expect(sanitizeDisplayName("\u200B\u200C", 32)).toBe("Unknown");
  });

  it("collapses runs of whitespace", () => {
    expect(sanitizeDisplayName("a    b\t\tc", 32)).toBe("a b c");
  });
});
```

- [ ] **Step 2: Run** — `docker compose run --rm bot pnpm test packages/systems/tests/unit/welcome/sanitize.test.ts`. Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement** — create `packages/systems/src/welcome/image/sanitize.ts`:

```typescript
/**
 * Sanitize a Discord-supplied display name, username, or guild name before
 * rendering it onto the welcome canvas. Removes control characters,
 * zero-width chars, bidi overrides/isolates, normalizes to NFC, collapses
 * whitespace, and hard-truncates to maxLen UTF-16 code units.
 */

// Bidi override + isolate ranges
const BIDI_OVERRIDES = /[\u202A-\u202E\u2066-\u2069]/g;
// Zero-width chars
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;
// C0 + C1 control characters EXCEPT \t \n \r (we still collapse them later)
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
// Whitespace runs (after we've stripped controls)
const WHITESPACE_RUN = /\s+/g;

export function sanitizeDisplayName(raw: string, maxLen: number): string {
  if (typeof raw !== "string") return "Unknown";

  let out = raw
    .normalize("NFC")
    .replace(BIDI_OVERRIDES, "")
    .replace(ZERO_WIDTH, "")
    .replace(CONTROL_CHARS, "")
    .replace(WHITESPACE_RUN, " ")
    .trim();

  if (out.length === 0) return "Unknown";
  if (out.length > maxLen) out = out.slice(0, maxLen);
  return out;
}
```

Then export it from `packages/systems/src/welcome/image/index.ts` by adding:

```typescript
// Sanitization
export { sanitizeDisplayName } from "./sanitize.js";
```

- [ ] **Step 4: Run** — `docker compose run --rm bot pnpm test packages/systems/tests/unit/welcome/sanitize.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** —

```
feat(welcome): add sanitizeDisplayName helper for canvas inputs

Strips zero-width chars, bidi overrides/isolates, control characters,
normalizes to NFC, collapses whitespace, and truncates. Used by the
welcome image pipeline to neutralize hostile usernames.
```

### Task 2: Apply sanitizer in guildMemberAdd before generateWelcomeImage

- [ ] **Step 1: Write failing test** — create `apps/bot/tests/events/welcome-sanitize.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "t", clientId: "c", guildId: undefined, logLevel: "info" },
}));

vi.mock("@fluxcore/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/utils")>();
  return {
    ...actual,
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
  };
});

vi.mock("@fluxcore/systems/logging/config", () => ({
  getLogConfig: vi.fn().mockResolvedValue(null),
}));
vi.mock("@fluxcore/systems/logging/persistence", () => ({
  createLogEntry: vi.fn(),
}));
vi.mock("@fluxcore/systems/logging/sender", () => ({
  sendLogEmbed: vi.fn(),
}));
vi.mock("@fluxcore/systems/logging/formatter", () => ({
  formatMemberJoin: vi.fn(),
}));

vi.mock("@fluxcore/systems/antiraid/config", () => ({
  getAntiRaidConfig: vi.fn().mockResolvedValue({ enabled: false }),
}));
vi.mock("@fluxcore/systems/antiraid/tracker", () => ({ recordJoin: vi.fn() }));
vi.mock("@fluxcore/systems/antiraid/actions", () => ({
  executeRaidAction: vi.fn(),
  lockdownGuild: vi.fn(),
}));
vi.mock("@fluxcore/systems/antiraid/persistence", () => ({
  createRaidEvent: vi.fn(),
}));

vi.mock("@fluxcore/systems/welcome/config", () => ({
  getWelcomeConfig: vi.fn().mockResolvedValue({
    autoRoleIds: [],
    welcomeEnabled: true,
    welcomeChannelId: "ch-welcome",
    welcomeMessage: "hi",
    welcomeImageEnabled: true,
    welcomeImageConfig: { sendMode: "with" },
    dmEnabled: false,
    dmMessage: "",
  }),
}));

vi.mock("@fluxcore/systems/welcome/builder", () => ({
  buildWelcomeEmbed: vi.fn().mockReturnValue({
    setImage: vi.fn().mockReturnThis(),
  }),
}));

const generateWelcomeImage = vi
  .fn()
  .mockResolvedValue(Buffer.from("image"));
vi.mock("@fluxcore/systems/welcome/image", () => ({
  generateWelcomeImage: (...args: unknown[]) => generateWelcomeImage(...args),
  createStorageAdapter: vi.fn().mockReturnValue({}),
}));

const event = (
  await import("../../src/events/guildMemberAdd.js")
).default;

describe("guildMemberAdd: sanitizes hostile names before canvas render", () => {
  beforeEach(() => {
    generateWelcomeImage.mockClear();
  });

  it("strips RTL override and zero-width from username/displayName/guild.name", async () => {
    const sentChannel = { isTextBased: () => true, send: vi.fn() };
    const member = {
      id: "m1",
      user: {
        bot: false,
        username: "\u202Eevil\u202Duser",
        createdTimestamp: Date.now() - 10 * 86_400_000,
        displayAvatarURL: () => "https://cdn/avatar.png",
        tag: "tag",
      },
      displayName: "a\u200B".repeat(100),
      guild: {
        id: "g1",
        name: "Server\u202Ename",
        memberCount: 5,
        channels: { cache: { get: () => sentChannel } },
        iconURL: () => null,
        members: { me: null },
        roles: { cache: new Map() },
      },
      roles: { cache: new Map(), add: vi.fn() },
      send: vi.fn(),
    } as never;

    await event.execute(member);

    expect(generateWelcomeImage).toHaveBeenCalledTimes(1);
    const call = generateWelcomeImage.mock.calls[0][0];
    expect(call.member.username).toBe("eviluser");
    expect(call.member.displayName).not.toContain("\u200B");
    expect(call.member.displayName.length).toBeLessThanOrEqual(80);
    expect(call.guild.name).toBe("Servername");
  });
});
```

- [ ] **Step 2: Run** — `docker compose run --rm bot pnpm test apps/bot/tests/events/welcome-sanitize.test.ts`. Expected: FAIL (current handler passes raw values).

- [ ] **Step 3: Implement** — edit `apps/bot/src/events/guildMemberAdd.ts`. Add the import at the top alongside the other welcome imports:

```typescript
import { generateWelcomeImage, createStorageAdapter, sanitizeDisplayName } from "@fluxcore/systems/welcome/image";
```

Then replace the `generateWelcomeImage({ ... })` call (lines 152-165) with:

```typescript
            const safeUsername = sanitizeDisplayName(member.user.username, 32);
            const safeDisplayName = sanitizeDisplayName(member.displayName, 80);
            const safeGuildName = sanitizeDisplayName(member.guild.name, 80);
            const imageBuffer = await generateWelcomeImage({
              settings: welcomeConfig.welcomeImageConfig,
              member: {
                username: safeUsername,
                displayName: safeDisplayName,
                avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 256 }),
              },
              guild: {
                name: safeGuildName,
                iconUrl: member.guild.iconURL({ size: 256 }) ?? undefined,
                memberCount: member.guild.memberCount,
              },
              storage,
            });
```

- [ ] **Step 4: Run** — `docker compose run --rm bot pnpm test apps/bot/tests/events/welcome-sanitize.test.ts && docker compose run --rm bot pnpm typecheck`. Expected: PASS.

- [ ] **Step 5: Commit** —

```
fix(welcome): sanitize hostile usernames before canvas rendering

Discord-supplied username, displayName, and guild.name are now passed
through sanitizeDisplayName before generateWelcomeImage, removing
zero-width chars, bidi overrides, and capping length so a malicious
member cannot deface the welcome banner or trigger pathological
canvas measurements.
```
