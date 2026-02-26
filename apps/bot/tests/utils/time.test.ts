import { describe, it, expect, vi } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    logLevel: "info",
  },
}));

import { parseDuration, formatDuration } from "@fluxcore/utils";

describe("parseDuration", () => {
  it("parses seconds", () => {
    expect(parseDuration("30s")).toBe(30_000);
  });

  it("parses minutes", () => {
    expect(parseDuration("5m")).toBe(300_000);
  });

  it("parses hours", () => {
    expect(parseDuration("2h")).toBe(7_200_000);
  });

  it("parses days", () => {
    expect(parseDuration("1d")).toBe(86_400_000);
  });

  it("parses weeks", () => {
    expect(parseDuration("1w")).toBe(604_800_000);
  });

  it("is case insensitive", () => {
    expect(parseDuration("5M")).toBe(300_000);
    expect(parseDuration("2H")).toBe(7_200_000);
  });

  it("returns null for invalid input", () => {
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("10x")).toBeNull();
    expect(parseDuration("0s")).toBeNull();
  });

  it("returns null for negative values", () => {
    expect(parseDuration("-5m")).toBeNull();
  });
});

describe("formatDuration", () => {
  it("formats seconds", () => {
    expect(formatDuration(5_000)).toBe("5s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(90_000)).toBe("1m 30s");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(3_660_000)).toBe("1h 1m");
  });

  it("formats days and hours", () => {
    expect(formatDuration(90_000_000)).toBe("1d 1h");
  });

  it("formats zero", () => {
    expect(formatDuration(0)).toBe("0s");
  });
});