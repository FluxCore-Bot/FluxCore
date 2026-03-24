/**
 * Global test setup for integration tests.
 * Silences the logger so test output stays clean.
 */

import { vi } from "vitest";

vi.mock("@fluxcore/utils", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    logLevel: "silent",
    botSyncUrl: "",
    botSyncSecret: "test-secret",
    botSyncPort: 0,
  },
}));
