# Levelup Announcement Mass-Mention Prevention — Fix Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Severity:** Low
**Goal:** Stop the leveling system's level-up announcement from being able to ping `@everyone`, `@here`, arbitrary roles, or arbitrary users via the moderator-configured `announceMessage` template. Restrict mentions to the leveling user themself and explicitly disable role/everyone parses.
**Architecture:** `apps/bot/src/events/messageCreate.ts` lines 27-50 builds an announcement string with `settings.announceMessage` (a template moderators can edit) and calls `(message.channel as ...).send(text)`. Discord.js will parse `@everyone`, `<@&roleId>`, etc. by default. The fix migrates the three send sites to send `{ content, allowedMentions: { parse: [], users: [message.author.id] } }`. The DM branch keeps `parse: []` (no mentions in DMs make sense). The TypeScript cast at line 41 also widens `send` to accept the structured options.
**Tech Stack:** discord.js v14, TypeScript, Prisma, Vitest

---

## Vulnerability

```typescript
const text = settings.announceMessage
  .replace("{user}", `<@${message.author.id}>`)
  .replace("{level}", String(newLevel))
  .replace("{username}", message.author.displayName);

try {
  if (settings.announceChannel === "dm") {
    await message.author.send(text);
  } else if (settings.announceChannel) {
    const channel = message.guild?.channels.cache.get(settings.announceChannel);
    if (channel?.isTextBased()) {
      await (channel as TextChannel).send(text);
    }
  } else {
    await (message.channel as { send: (text: string) => Promise<unknown> }).send(text);
  }
}
```

A guild admin who edits `announceMessage` to `"@everyone {user} reached level {level}!"` will get a server-wide ping every time anyone levels up. Even without malice, an admin who copies a sample template containing `<@&modRole>` will inadvertently DM-storm a moderator role on every level-up.

## Files

- `apps/bot/src/events/messageCreate.ts` (lines 20-50)
- New: `apps/bot/tests/events/levelup-mentions.test.ts`

## Tasks

### Task 1: Pass allowedMentions on every level-up send

- [ ] **Step 1: Write failing test** — create `apps/bot/tests/events/levelup-mentions.test.ts`:

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

vi.mock("@fluxcore/systems/leveling/config", () => ({
  getLevelSettings: vi.fn().mockResolvedValue({
    enabled: true,
    xpPerMessage: 10,
    xpCooldownSeconds: 0,
    noXpChannels: [],
    noXpRoles: [],
    multipliers: [],
    announceEnabled: true,
    announceChannel: null, // reply in same channel
    announceMessage: "@everyone {user} hit {level}!",
  }),
}));
vi.mock("@fluxcore/systems/leveling/persistence", () => ({
  getUserLevel: vi.fn().mockResolvedValue(null),
  addXp: vi.fn().mockResolvedValue({ leveledUp: true, newLevel: 2 }),
}));
vi.mock("@fluxcore/systems/leveling/xp", () => ({
  applyMultipliers: (xp: number) => xp,
}));
vi.mock("@fluxcore/systems/leveling/constants", () => ({ XP_RANDOMNESS: 1 }));
vi.mock("@fluxcore/systems/leveling/rewards", () => ({
  checkAndGrantRewards: vi.fn(),
}));

const event = (await import("../../src/events/messageCreate.js")).default;

describe("level-up announcement allowedMentions", () => {
  it("passes allowedMentions to channel.send when announcing in same channel", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const message = {
      guild: { id: "g1", channels: { cache: { get: () => null } } },
      author: { id: "u1", bot: false, displayName: "Alice", send: vi.fn() },
      member: { roles: { cache: new Map() } },
      channelId: "c1",
      channel: { send },
    } as never;

    await event.execute(message);

    expect(send).toHaveBeenCalledTimes(1);
    const arg = send.mock.calls[0][0];
    expect(typeof arg).toBe("object");
    expect(arg.content).toContain("@everyone");
    expect(arg.allowedMentions).toEqual({ parse: [], users: ["u1"] });
  });

  it("passes allowedMentions when announceChannel is configured", async () => {
    const { getLevelSettings } = await import("@fluxcore/systems/leveling/config");
    (getLevelSettings as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      enabled: true,
      xpPerMessage: 10,
      xpCooldownSeconds: 0,
      noXpChannels: [],
      noXpRoles: [],
      multipliers: [],
      announceEnabled: true,
      announceChannel: "ch-announce",
      announceMessage: "<@&modRole> {user} hit {level}!",
    });

    const announceSend = vi.fn().mockResolvedValue(undefined);
    const message = {
      guild: {
        id: "g1",
        channels: {
          cache: {
            get: (id: string) =>
              id === "ch-announce"
                ? { isTextBased: () => true, send: announceSend }
                : null,
          },
        },
      },
      author: { id: "u1", bot: false, displayName: "Alice", send: vi.fn() },
      member: { roles: { cache: new Map() } },
      channelId: "c1",
      channel: { send: vi.fn() },
    } as never;

    await event.execute(message);

    expect(announceSend).toHaveBeenCalledTimes(1);
    expect(announceSend.mock.calls[0][0].allowedMentions).toEqual({
      parse: [],
      users: ["u1"],
    });
  });
});
```

- [ ] **Step 2: Run** — `docker compose run --rm bot pnpm test apps/bot/tests/events/levelup-mentions.test.ts`. Expected: FAIL (current code sends a plain string).

- [ ] **Step 3: Implement** — replace the body of `handleLevelUp` in `apps/bot/src/events/messageCreate.ts` (lines 20-50) with:

```typescript
async function handleLevelUp(
  message: Message,
  settings: { announceEnabled: boolean; announceChannel: string | null; announceMessage: string },
  newLevel: number,
): Promise<void> {
  if (!settings.announceEnabled) return;

  const text = settings.announceMessage
    .replace("{user}", `<@${message.author.id}>`)
    .replace("{level}", String(newLevel))
    .replace("{username}", message.author.displayName);

  // Lock allowedMentions so a moderator-configured template cannot ping
  // @everyone, @here, or arbitrary roles. Only the leveling user
  // themself is allowed to be mentioned.
  const allowedMentions = { parse: [], users: [message.author.id] } as const;

  try {
    if (settings.announceChannel === "dm") {
      await message.author.send({ content: text, allowedMentions: { parse: [] } });
    } else if (settings.announceChannel) {
      const channel = message.guild?.channels.cache.get(settings.announceChannel);
      if (channel?.isTextBased()) {
        await (channel as TextChannel).send({ content: text, allowedMentions });
      }
    } else {
      await (
        message.channel as {
          send: (payload: { content: string; allowedMentions: typeof allowedMentions }) => Promise<unknown>;
        }
      ).send({ content: text, allowedMentions });
    }
  } catch (error) {
    logger.debug(
      `Failed to send level-up announcement for ${message.author.id}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
```

- [ ] **Step 4: Run** — `docker compose run --rm bot pnpm test apps/bot/tests/events/levelup-mentions.test.ts && docker compose run --rm bot pnpm typecheck`. Expected: PASS.

- [ ] **Step 5: Commit** —

```
fix(leveling): block @everyone/role mentions in level-up announcement

Pass allowedMentions: { parse: [], users: [message.author.id] } to
every send site so a moderator-configured announceMessage template
containing @everyone, @here, or <@&roleId> can no longer ping the
server.
```
