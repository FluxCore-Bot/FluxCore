import { describe, expect, it } from "vitest";
import { deriveStatus } from "../scripts/manifest/status.mjs";

const empty = {
  system: null,
  botFeature: null,
  serverFeature: null,
  clientRoute: null,
  commands: [],
  spec: null,
};

describe("deriveStatus", () => {
  it("returns shipped when a system exists and commands are registered", () => {
    expect(
      deriveStatus({
        ...empty,
        system: "packages/systems/src/moderation",
        botFeature: "apps/bot/src/features/moderation",
        commands: ["ban", "kick"],
      }),
    ).toBe("shipped");
  });

  it("returns shipped when a system exists and a dashboard route exists", () => {
    expect(
      deriveStatus({
        ...empty,
        system: "packages/systems/src/starboard",
        serverFeature: "apps/dashboard/src/server/features/starboard",
        clientRoute: "/guild/$guildId/starboard",
      }),
    ).toBe("shipped");
  });

  it("returns planned when only a spec exists", () => {
    expect(deriveStatus({ ...empty, spec: "docs/features/economy.md" })).toBe(
      "planned",
    );
  });

  it("returns partial when source exists but nothing is user-reachable", () => {
    expect(
      deriveStatus({ ...empty, system: "packages/systems/src/queue" }),
    ).toBe("partial");
  });

  it("returns planned for a feature with no evidence at all", () => {
    expect(deriveStatus(empty)).toBe("planned");
  });

  it("ignores the spec when source proves the feature shipped", () => {
    // Regression guard: CLAUDE.md marks these "Not Started" while they ship.
    expect(
      deriveStatus({
        ...empty,
        system: "packages/systems/src/leveling",
        botFeature: "apps/bot/src/features/leveling",
        commands: ["rank"],
        spec: "docs/features/leveling.md",
      }),
    ).toBe("shipped");
  });
});
