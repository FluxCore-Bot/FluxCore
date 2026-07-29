import { describe, expect, it } from "vitest";
import { deriveStatus } from "../scripts/manifest/status.mjs";

type Evidence = import("../scripts/manifest/status.mjs").Evidence;

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

  it("does not throw when commands is omitted entirely, and classifies correctly", () => {
    // Regression guard: Task 4's manifest builder assembles Evidence
    // piecemeal from independent source scans. A scan that finds no
    // slash commands may leave the key unset rather than writing `[]` —
    // that must not crash the whole manifest build.
    const withoutCommandsKey: Evidence = {
      system: "packages/systems/src/queue",
      botFeature: null,
      serverFeature: null,
      clientRoute: null,
      spec: null,
    };

    expect(() => deriveStatus(withoutCommandsKey)).not.toThrow();
    expect(deriveStatus(withoutCommandsKey)).toBe("partial");
  });

  it("returns shipped when only botFeature (no system) proves source exists", () => {
    // Mutant guard: without the `|| evidence.botFeature` fallback in
    // hasSource, this would incorrectly fall through to "planned".
    expect(
      deriveStatus({
        ...empty,
        botFeature: "apps/bot/src/features/tickets",
        commands: ["ticket"],
      }),
    ).toBe("shipped");
  });
});
