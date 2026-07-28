import { describe, it, expect } from "vitest";
import {
  EVENT_TYPES,
  EVENT_CONDITION_SUPPORT,
  supportsCondition,
  type ConditionSubject,
} from "../../src/actions/constants.js";

const SUBJECTS: ConditionSubject[] = ["channel", "role", "user"];

describe("EVENT_CONDITION_SUPPORT", () => {
  // Trigger filters fail closed, so a filter offered for an event that cannot
  // answer it silently disables the rule. A missing entry here would read as
  // "supports nothing", which is the safe direction — but it would also strip
  // every filter from that trigger in the editor, so the gap must be loud.
  it("covers every event type", () => {
    for (const eventType of Object.keys(EVENT_TYPES)) {
      expect(
        EVENT_CONDITION_SUPPORT[eventType as keyof typeof EVENT_CONDITION_SUPPORT],
      ).toBeDefined();
    }
  });

  it("declares no unknown event types", () => {
    for (const eventType of Object.keys(EVENT_CONDITION_SUPPORT)) {
      expect(EVENT_TYPES).toHaveProperty(eventType);
    }
  });

  it("only lists known subjects, with no duplicates", () => {
    for (const [eventType, subjects] of Object.entries(EVENT_CONDITION_SUPPORT)) {
      expect(subjects.length, eventType).toBeGreaterThan(0);
      expect(new Set(subjects).size, eventType).toBe(subjects.length);
      for (const subject of subjects) {
        expect(SUBJECTS, eventType).toContain(subject);
      }
    }
  });

  // These four are the combinations that were silently broken before filters
  // failed closed — they are the reason this map exists.
  it("does not offer role filters on ban events (the user is no longer a member)", () => {
    expect(supportsCondition("memberBanned", "role")).toBe(false);
    expect(supportsCondition("memberUnbanned", "role")).toBe(false);
  });

  it("does not offer channel filters on member events (no channel in context)", () => {
    expect(supportsCondition("memberJoin", "channel")).toBe(false);
    expect(supportsCondition("memberLeave", "channel")).toBe(false);
  });

  it("does not offer user filters on channel events (no acting user in context)", () => {
    expect(supportsCondition("channelCreated", "user")).toBe(false);
    expect(supportsCondition("channelDeleted", "user")).toBe(false);
  });

  it("does not offer role filters on threadCreated (the owner is a bare id)", () => {
    expect(supportsCondition("threadCreated", "role")).toBe(false);
    expect(supportsCondition("threadCreated", "channel")).toBe(true);
  });

  it("offers the full set on message, reaction and voice events", () => {
    for (const eventType of [
      "messageCreated",
      "messageDeleted",
      "reactionAdded",
      "reactionRemoved",
      "voiceJoin",
      "voiceLeave",
    ]) {
      for (const subject of SUBJECTS) {
        expect(supportsCondition(eventType, subject), `${eventType}/${subject}`).toBe(true);
      }
    }
  });

  it("reports false for an unknown event type rather than throwing", () => {
    expect(supportsCondition("notAnEvent", "user")).toBe(false);
  });
});
