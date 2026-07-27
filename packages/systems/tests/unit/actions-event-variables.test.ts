import { describe, it, expect } from "vitest";
import {
  EVENT_TYPES,
  EVENT_TYPE_VARIABLES,
  TEMPLATE_VARIABLES,
  EVENT_CONDITION_SUPPORT,
} from "../../src/actions/constants.js";

/**
 * EVENT_TYPE_VARIABLES is a promise to the user: these are the tokens you may
 * write in a template for this trigger. It used to hand every event the same
 * GENERAL_VARIABLES block, so a memberJoin rule advertised {channel} and a
 * channelCreated rule advertised {user.name} — neither of which the bot
 * populates. The dashboard preview rendered "#general" / "@Ada" while the bot
 * posted "Unknown Channel" / "Unknown", and the editor's unknown-token warning
 * stayed silent because the token looked legitimate.
 *
 * These assertions pin the list against what eventBridge.ts actually builds.
 */
describe("EVENT_TYPE_VARIABLES", () => {
  it("covers every event type", () => {
    for (const eventType of Object.keys(EVENT_TYPES)) {
      expect(
        EVENT_TYPE_VARIABLES[eventType as keyof typeof EVENT_TYPE_VARIABLES],
        eventType,
      ).toBeDefined();
    }
  });

  it("only promises tokens the template engine knows", () => {
    for (const [eventType, tokens] of Object.entries(EVENT_TYPE_VARIABLES)) {
      for (const token of tokens) {
        expect(TEMPLATE_VARIABLES, `${eventType} -> ${token}`).toHaveProperty(token);
      }
    }
  });

  it("promises no token twice", () => {
    for (const [eventType, tokens] of Object.entries(EVENT_TYPE_VARIABLES)) {
      expect(new Set(tokens).size, eventType).toBe(tokens.length);
    }
  });

  it("always offers the guild tokens, which every context carries", () => {
    for (const [eventType, tokens] of Object.entries(EVENT_TYPE_VARIABLES)) {
      expect(tokens, eventType).toContain("{guild}");
      expect(tokens, eventType).toContain("{guild.memberCount}");
      expect(tokens, eventType).toContain("{timestamp}");
    }
  });

  // buildMemberContext / buildBanContext / buildRoleContext set no channel at
  // all, so a {channel} token on those events can only ever render "Unknown".
  it("does not offer channel tokens on events with no channel", () => {
    for (const eventType of [
      "memberJoin",
      "memberLeave",
      "memberBanned",
      "memberUnbanned",
      "roleAdded",
      "roleRemoved",
      "nicknameChanged",
      "memberTimeout",
      "boostStart",
      "boostEnd",
    ]) {
      const tokens = EVENT_TYPE_VARIABLES[eventType as keyof typeof EVENT_TYPE_VARIABLES];
      expect(tokens, eventType).not.toContain("{channel}");
      expect(tokens, eventType).not.toContain("{channel.name}");
      expect(tokens, eventType).not.toContain("{channel.id}");
    }
  });

  // buildChannelContext has no acting user — the gateway event does not carry one.
  it("does not offer user tokens on channel events", () => {
    for (const eventType of ["channelCreated", "channelDeleted"]) {
      const tokens = EVENT_TYPE_VARIABLES[eventType as keyof typeof EVENT_TYPE_VARIABLES];
      expect(tokens, eventType).not.toContain("{user}");
      expect(tokens, eventType).not.toContain("{user.name}");
    }
  });

  // threadCreate resolves only `ownerId`, never a username or tag.
  it("offers only the id-based user tokens on threadCreated", () => {
    const tokens = EVENT_TYPE_VARIABLES.threadCreated;
    expect(tokens).toContain("{user}");
    expect(tokens).toContain("{user.id}");
    expect(tokens).not.toContain("{user.name}");
    expect(tokens).not.toContain("{user.tag}");
  });

  it("offers the event-specific tokens each trigger actually sets", () => {
    expect(EVENT_TYPE_VARIABLES.memberBanned).toContain("{ban.reason}");
    expect(EVENT_TYPE_VARIABLES.nicknameChanged).toContain("{new.nickname}");
    expect(EVENT_TYPE_VARIABLES.memberTimeout).toContain("{timeout.until}");
    expect(EVENT_TYPE_VARIABLES.boostStart).toContain("{boost.since}");
    expect(EVENT_TYPE_VARIABLES.reactionAdded).toContain("{emoji}");
    expect(EVENT_TYPE_VARIABLES.voiceJoin).toContain("{voice.channel}");
    expect(EVENT_TYPE_VARIABLES.threadCreated).toContain("{thread.name}");
    expect(EVENT_TYPE_VARIABLES.messageCreated).toContain("{message.content}");
  });

  // Both maps describe the same underlying question — what does this event's
  // context carry — so they must not disagree.
  it("agrees with EVENT_CONDITION_SUPPORT about channels and users", () => {
    for (const [eventType, subjects] of Object.entries(EVENT_CONDITION_SUPPORT)) {
      const tokens = EVENT_TYPE_VARIABLES[eventType as keyof typeof EVENT_TYPE_VARIABLES];
      expect(tokens.includes("{channel.id}"), `${eventType} channel`).toBe(
        subjects.includes("channel"),
      );
      expect(tokens.includes("{user.id}"), `${eventType} user`).toBe(
        subjects.includes("user"),
      );
    }
  });
});
