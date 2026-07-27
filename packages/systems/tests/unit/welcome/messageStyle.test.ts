import { describe, it, expect, vi, beforeEach } from "vitest";

const upsert = vi.fn();
const findUnique = vi.fn();

vi.mock("@fluxcore/database", () => ({
  getPrisma: () => ({ welcomeConfig: { upsert, findUnique } }),
}));

const ROW = {
  guildId: "1",
  welcomeEnabled: true,
  welcomeChannelId: "c1",
  welcomeMessage: "{}",
  welcomeMessageStyle: "plain",
  welcomeContent: "Welcome {user}!",
  farewellEnabled: false,
  farewellChannelId: null,
  farewellMessage: "{}",
  farewellMessageStyle: "embed",
  farewellContent: "",
  dmEnabled: false,
  dmMessage: "{}",
  autoRoleIds: "[]",
  welcomeImageEnabled: false,
  welcomeImageConfig: "{}",
  farewellImageEnabled: false,
  farewellImageConfig: "{}",
};

beforeEach(() => {
  upsert.mockReset();
  findUnique.mockReset();
});

describe("getWelcomeConfig", () => {
  it("surfaces the message style and content fields", async () => {
    findUnique.mockResolvedValue(ROW);
    const { getWelcomeConfig } = await import("../../../src/welcome/config.js");
    const config = await getWelcomeConfig("1");

    expect(config?.welcomeMessageStyle).toBe("plain");
    expect(config?.welcomeContent).toBe("Welcome {user}!");
    expect(config?.farewellMessageStyle).toBe("embed");
    expect(config?.farewellContent).toBe("");
  });

  it("defaults an absent style column to plain", async () => {
    const { welcomeMessageStyle, farewellMessageStyle, ...partial } = ROW;
    void welcomeMessageStyle;
    void farewellMessageStyle;
    findUnique.mockResolvedValue(partial);
    const { getWelcomeConfig } = await import("../../../src/welcome/config.js");
    const config = await getWelcomeConfig("1");

    expect(config?.welcomeMessageStyle).toBe("plain");
  });
});

describe("upsertWelcomeConfig", () => {
  it("persists the new fields when provided", async () => {
    upsert.mockResolvedValue(ROW);
    const { upsertWelcomeConfig } = await import("../../../src/welcome/config.js");
    await upsertWelcomeConfig("1", {
      welcomeMessageStyle: "plain",
      welcomeContent: "Hi {user}",
    });

    const arg = upsert.mock.calls[0]![0];
    expect(arg.update.welcomeMessageStyle).toBe("plain");
    expect(arg.update.welcomeContent).toBe("Hi {user}");
  });

  it("omits fields that were not provided", async () => {
    upsert.mockResolvedValue(ROW);
    const { upsertWelcomeConfig } = await import("../../../src/welcome/config.js");
    await upsertWelcomeConfig("1", { welcomeEnabled: true });

    const arg = upsert.mock.calls[0]![0];
    expect(arg.update).not.toHaveProperty("welcomeMessageStyle");
    expect(arg.update).not.toHaveProperty("welcomeContent");
  });
});
