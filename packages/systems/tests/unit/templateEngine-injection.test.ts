import { describe, it, expect } from "vitest";
import { resolveTemplate } from "../../src/actions/templateEngine.js";
import type { EventContext } from "../../src/actions/types.js";

const baseCtx: EventContext = {
  eventType: "memberJoin",
  guildId: "g1",
  guildName: "Guild",
  userId: "u1",
  userName: "alice",
  userTag: "alice#0001",
  userMention: "<@u1>",
  channelId: "c1",
  memberCount: 5,
  timestamp: "2026-04-07T00:00:00.000Z",
};

describe("resolveTemplate — literal replacement only", () => {
  it("replaces known core variables", () => {
    expect(resolveTemplate("hi {user.name}", baseCtx)).toBe("hi alice");
  });

  it("does NOT evaluate JavaScript expressions inside braces", () => {
    expect(resolveTemplate("{1+1}", baseCtx)).toBe("{1+1}");
    expect(resolveTemplate("{process.env.HOME}", baseCtx)).toBe(
      "{process.env.HOME}",
    );
  });

  it("does NOT evaluate ${...} interpolation", () => {
    // The literal $ and ${...} must be returned unchanged
    expect(resolveTemplate("${1+1}", baseCtx)).toBe("${1+1}");
  });

  it("does NOT recurse into user-controlled extra values", () => {
    // A malicious message.content tries to smuggle {user.id} as the value
    // for {message.content}. The escape MUST prevent the second resolver
    // pass from expanding it.
    const ctx: EventContext = {
      ...baseCtx,
      extra: { "message.content": "{user.id}" },
    };
    const out = resolveTemplate("said: {message.content}", ctx);
    expect(out).not.toBe("said: u1");
    expect(out).toContain("\u200B{user.id}");
  });

  it("does NOT recurse via nested core variables in extra", () => {
    const ctx: EventContext = {
      ...baseCtx,
      extra: { "ban.reason": "{user.tag}{guild}" },
    };
    const out = resolveTemplate("reason: {ban.reason}", ctx);
    expect(out).not.toContain("alice#0001");
    expect(out).toContain("\u200B{user.tag}");
  });

  it("leaves unknown {placeholders} untouched", () => {
    expect(resolveTemplate("{this.does.not.exist}", baseCtx)).toBe(
      "{this.does.not.exist}",
    );
  });

  it("truncates output to MAX_TEMPLATE_LENGTH", () => {
    const big = "x".repeat(5000);
    const out = resolveTemplate(big, baseCtx);
    expect(out.length).toBeLessThanOrEqual(2000);
  });

  it("never throws on non-string extra values being absent", () => {
    expect(() =>
      resolveTemplate("{user.name} joined {guild}", baseCtx),
    ).not.toThrow();
  });
});
