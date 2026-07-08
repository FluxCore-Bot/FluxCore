import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { dashboardSessionSecret: "test-secret-do-not-use-in-prod-1234567890" },
}));

const createMock = vi.fn();
const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const deleteManyMock = vi.fn();

vi.mock("@fluxcore/database", () => ({
  getPrisma: () => ({
    dashboardSession: {
      create: createMock,
      findUnique: findUniqueMock,
      update: updateMock,
      deleteMany: deleteManyMock,
    },
  }),
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../src/server/shared/auth.js", () => ({
  fetchGuilds: vi.fn().mockResolvedValue([]),
}));

const { createSession } = await import("../../../src/server/shared/session.js");
const { isEncrypted } = await import("../../../src/server/shared/crypto.js");

describe("createSession", () => {
  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue(undefined);
  });

  it("never persists the access token in plaintext", async () => {
    const plaintextToken = "ya29.PLAINTEXT_BEARER_TOKEN";
    await createSession({
      userId: "1",
      username: "u",
      avatar: null,
      accessToken: plaintextToken,
      guilds: [],
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    const stored = createMock.mock.calls[0][0].data.accessToken as string;
    expect(stored).not.toBe(plaintextToken);
    expect(isEncrypted(stored)).toBe(true);
  });
});
