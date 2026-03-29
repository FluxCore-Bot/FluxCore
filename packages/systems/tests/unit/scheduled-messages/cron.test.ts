import { describe, it, expect } from "vitest";
import {
  parseCronExpression,
  validateCronExpression,
  getNextCronRun,
  describeCron,
} from "../../../src/scheduled-messages/cron.js";

describe("parseCronExpression", () => {
  it("parses a simple daily cron", () => {
    const result = parseCronExpression("0 9 * * *");
    expect(result.minutes).toEqual([0]);
    expect(result.hours).toEqual([9]);
    expect(result.daysOfMonth.length).toBe(31);
    expect(result.months.length).toBe(12);
    expect(result.daysOfWeek.length).toBe(7);
  });

  it("parses every hour", () => {
    const result = parseCronExpression("0 * * * *");
    expect(result.minutes).toEqual([0]);
    expect(result.hours.length).toBe(24);
  });

  it("parses a specific weekday", () => {
    const result = parseCronExpression("0 9 * * 1");
    expect(result.daysOfWeek).toEqual([1]);
  });

  it("parses step expressions", () => {
    const result = parseCronExpression("*/15 * * * *");
    expect(result.minutes).toEqual([0, 15, 30, 45]);
  });

  it("parses range expressions", () => {
    const result = parseCronExpression("0 9-17 * * *");
    expect(result.hours).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
  });

  it("parses comma-separated values", () => {
    const result = parseCronExpression("0 9,12,18 * * *");
    expect(result.hours).toEqual([9, 12, 18]);
  });

  it("parses combined range with step", () => {
    const result = parseCronExpression("0 */6 * * *");
    expect(result.hours).toEqual([0, 6, 12, 18]);
  });

  it("throws for invalid number of fields", () => {
    expect(() => parseCronExpression("0 9 * *")).toThrow("expected 5 fields");
    expect(() => parseCronExpression("0 9 * * * *")).toThrow("expected 5 fields");
  });

  it("throws for invalid values", () => {
    expect(() => parseCronExpression("abc 9 * * *")).toThrow();
  });
});

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
