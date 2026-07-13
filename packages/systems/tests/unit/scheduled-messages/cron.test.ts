import { describe, it, expect } from "vitest";
import {
  validateCronExpression,
  getNextCronRun,
  describeCron,
} from "../../../src/scheduled-messages/cron.js";

describe("validateCronExpression", () => {
  it("returns null for valid expressions", () => {
    expect(validateCronExpression("0 9 * * *")).toBeNull();
    expect(validateCronExpression("*/15 * * * *")).toBeNull();
    expect(validateCronExpression("0 0 1 * *")).toBeNull();
  });

  it("returns error message for invalid expressions", () => {
    expect(validateCronExpression("invalid")).not.toBeNull();
    expect(validateCronExpression("0 9 *")).not.toBeNull();
    expect(validateCronExpression("")).not.toBeNull();
  });
});

describe("getNextCronRun", () => {
  it("calculates the next run for a daily cron", () => {
    const after = new Date("2026-03-30T08:00:00Z");
    const next = getNextCronRun("0 9 * * *", "UTC", after);
    expect(next.getTime()).toBeGreaterThan(after.getTime());
    expect(next.getUTCHours()).toBe(9);
    expect(next.getUTCMinutes()).toBe(0);
  });

  it("returns a date after 'now' if current time matches", () => {
    const after = new Date("2026-03-30T09:00:00Z");
    const next = getNextCronRun("0 9 * * *", "UTC", after);
    expect(next.getTime()).toBeGreaterThan(after.getTime());
  });

  it("handles every-hour cron", () => {
    const after = new Date("2026-03-30T10:30:00Z");
    const next = getNextCronRun("0 * * * *", "UTC", after);
    expect(next.getUTCMinutes()).toBe(0);
    expect(next.getTime()).toBeGreaterThan(after.getTime());
  });

  it("handles weekly cron (Monday only)", () => {
    // 2026-03-30 is a Monday
    const after = new Date("2026-03-30T10:00:00Z");
    const next = getNextCronRun("0 9 * * 1", "UTC", after);
    // Should be next Monday at 9am
    expect(next.getUTCDay()).toBe(1);
    expect(next.getUTCHours()).toBe(9);
  });

  it("handles monthly cron (1st of month)", () => {
    const after = new Date("2026-03-15T00:00:00Z");
    const next = getNextCronRun("0 9 1 * *", "UTC", after);
    expect(next.getUTCDate()).toBe(1);
    expect(next.getUTCHours()).toBe(9);
    // Should be April 1st since we're past March 1st
    expect(next.getUTCMonth()).toBe(3); // April (0-indexed)
  });
});

describe("describeCron", () => {
  it("returns preset descriptions", () => {
    expect(describeCron("0 * * * *")).toBe("Every hour");
    expect(describeCron("0 9 * * *")).toBe("Daily at 9:00 AM");
    expect(describeCron("0 0 * * *")).toBe("Daily at midnight");
    expect(describeCron("0 9 * * 1")).toBe("Weekly on Monday at 9:00 AM");
  });

  it("describes custom cron expressions", () => {
    const desc = describeCron("30 14 * * *");
    expect(desc).toContain("14:30");
  });

  it("returns the expression itself for unparseable input", () => {
    expect(describeCron("invalid cron")).toBe("invalid cron");
  });
});
