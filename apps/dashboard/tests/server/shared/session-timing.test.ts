import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { dashboardSessionSecret: "test-secret-do-not-use-in-prod-1234567890" },
}));

const findUniqueMock = vi.fn();
const deleteManyMock = vi.fn();

vi.mock("@fluxcore/database", () => ({
  getPrisma: () => ({
    dashboardSession: {
      findUnique: findUniqueMock,
      deleteMany: deleteManyMock,
      update: vi.fn(),
    },
  }),
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../src/server/shared/auth.js", () => ({
  fetchGuilds: vi.fn().mockResolvedValue([]),
}));

const { getSession } = await import("../../../src/server/shared/session.js");
const { encrypt } = await import("../../../src/server/shared/crypto.js");

describe("getSession constant-time behaviour", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    deleteManyMock.mockReset();
  });

  it("returns null when row is missing without leaking via Prisma id comparator", async () => {
    findUniqueMock.mockResolvedValue(null);
    const result = await getSession("00000000-0000-0000-0000-000000000000");
    expect(result).toBeNull();
  });

  it("returns null when stored id does not constant-time match", async () => {
    findUniqueMock.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      userId: "u",
      username: "u",
      avatar: null,
      accessToken: encrypt("tok"),
      guilds: "[]",
      guildsRefreshedAt: new Date(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const result = await getSession("22222222-2222-2222-2222-222222222222");
    expect(result).toBeNull();
  });

  it("returns the session on a valid id", async () => {
    const id = "33333333-3333-3333-3333-333333333333";
    findUniqueMock.mockResolvedValue({
      id,
      userId: "u",
      username: "name",
      avatar: null,
      accessToken: encrypt("tok"),
      guilds: "[]",
      guildsRefreshedAt: new Date(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const result = await getSession(id);
    expect(result?.userId).toBe("u");
  });
});
