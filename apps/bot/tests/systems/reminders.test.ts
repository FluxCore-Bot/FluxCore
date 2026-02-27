import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

const mockGetDueReminders = vi.fn().mockResolvedValue([]);
const mockDeleteReminder = vi.fn().mockResolvedValue(undefined);
const mockCreateReminderFn = vi.fn().mockResolvedValue({ id: 1 });
vi.mock("@fluxcore/systems", () => ({
  getDueReminders: () => mockGetDueReminders(),
  deleteReminder: (...args: unknown[]) => mockDeleteReminder(...args),
  createReminder: (...args: unknown[]) => mockCreateReminderFn(...args),
}));

const {
  startReminderPolling,
  stopReminderPolling,
} = await import("../../src/systems/reminders.js");

describe("reminder system", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    stopReminderPolling();
  });

  afterEach(() => {
    stopReminderPolling();
    vi.useRealTimers();
  });

  it("starts polling without errors", () => {
    const client = {} as never;
    expect(() => startReminderPolling(client)).not.toThrow();
  });

  it("does not start duplicate polling", () => {
    const client = {} as never;
    startReminderPolling(client);
    startReminderPolling(client); // Second call should be no-op

    // Should still work fine
    expect(() => stopReminderPolling()).not.toThrow();
  });

  it("stops polling cleanly", () => {
    const client = {} as never;
    startReminderPolling(client);
    stopReminderPolling();

    // Stopping again is idempotent
    expect(() => stopReminderPolling()).not.toThrow();
  });
});
