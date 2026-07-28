import { describe, it, expect } from "vitest";
import {
  matchPermission,
  expandWildcard,
  resolveEffectivePermissions,
  ROLE_PRESETS,
} from "@fluxcore/types";

describe("matchPermission", () => {
  it("grants access for full wildcard (*)", () => {
    expect(matchPermission(new Set(["*"]), "moderation.cases.view")).toBe(true);
    expect(matchPermission(new Set(["*"]), "moderation.settings.manage")).toBe(true);
  });

  it("grants access for exact match", () => {
    expect(matchPermission(new Set(["moderation.cases.view"]), "moderation.cases.view")).toBe(true);
  });

  it("denies access when permission not granted", () => {
    expect(matchPermission(new Set(["moderation.cases.view"]), "moderation.cases.manage")).toBe(false);
  });

  it("denies access for empty set", () => {
    expect(matchPermission(new Set(), "moderation.cases.view")).toBe(false);
  });

  it("grants access for module-level wildcard (moderation.*)", () => {
    const granted = new Set(["moderation.*"]);
    expect(matchPermission(granted, "moderation.cases.view")).toBe(true);
    expect(matchPermission(granted, "moderation.cases.manage")).toBe(true);
    expect(matchPermission(granted, "moderation.warnings.view")).toBe(true);
    expect(matchPermission(granted, "actions.rules.view")).toBe(false);
  });

  it("grants access for resource-level wildcard (moderation.cases.*)", () => {
    const granted = new Set(["moderation.cases.*"]);
    expect(matchPermission(granted, "moderation.cases.view")).toBe(true);
    expect(matchPermission(granted, "moderation.cases.manage")).toBe(true);
    expect(matchPermission(granted, "moderation.settings.manage")).toBe(false);
  });

  it("handles cross-module wildcard (*.settings.manage)", () => {
    const granted = new Set(["*.settings.manage"]);
    expect(matchPermission(granted, "moderation.settings.manage")).toBe(true);
    expect(matchPermission(granted, "actions.settings.manage")).toBe(true);
    expect(matchPermission(granted, "moderation.cases.view")).toBe(false);
    expect(matchPermission(granted, "moderation.warnings.manage")).toBe(false);
  });

  it("handles *.*.view wildcard", () => {
    const granted = new Set(["*.*.view"]);
    expect(matchPermission(granted, "moderation.cases.view")).toBe(true);
    expect(matchPermission(granted, "actions.rules.view")).toBe(true);
    expect(matchPermission(granted, "moderation.cases.manage")).toBe(false);
  });

  it("handles multiple granted permissions", () => {
    const granted = new Set(["moderation.*", "actions.rules.view"]);
    expect(matchPermission(granted, "moderation.cases.manage")).toBe(true);
    expect(matchPermission(granted, "actions.rules.view")).toBe(true);
    expect(matchPermission(granted, "actions.rules.manage")).toBe(false);
  });

  it("does not partially match non-wildcard keys", () => {
    const granted = new Set(["moderation.cases"]);
    expect(matchPermission(granted, "moderation.cases.view")).toBe(false);
  });
});

const KEYS = [
  "moderation.cases.view",
  "moderation.cases.manage",
  "moderation.settings.manage",
  "actions.rules.view",
  "tickets.list.view",
];

describe("expandWildcard", () => {
  it("expands * to every key", () => {
    expect(expandWildcard("*", KEYS)).toEqual(KEYS);
  });

  it("expands a module wildcard", () => {
    expect(expandWildcard("moderation.*", KEYS)).toEqual([
      "moderation.cases.view",
      "moderation.cases.manage",
      "moderation.settings.manage",
    ]);
  });

  it("expands a cross-module action wildcard", () => {
    expect(expandWildcard("*.*.view", KEYS)).toEqual([
      "moderation.cases.view",
      "actions.rules.view",
      "tickets.list.view",
    ]);
  });
});

describe("resolveEffectivePermissions", () => {
  it("returns nothing for an empty grant", () => {
    expect(resolveEffectivePermissions([], KEYS)).toEqual([]);
  });

  it("merges wildcards and literals", () => {
    expect(resolveEffectivePermissions(["moderation.*", "actions.rules.view"], KEYS)).toEqual([
      "moderation.cases.view",
      "moderation.cases.manage",
      "moderation.settings.manage",
      "actions.rules.view",
    ]);
  });
});

describe("ROLE_PRESETS", () => {
  it("has expected presets", () => {
    expect(Object.keys(ROLE_PRESETS)).toEqual(
      expect.arrayContaining(["moderator", "content-manager", "full-admin", "viewer"]),
    );
  });

  it("moderator preset has moderation permissions", () => {
    const mod = ROLE_PRESETS.moderator;
    expect(mod.permissions).toContain("moderation.*");
  });

  it("full-admin has full wildcard", () => {
    expect(ROLE_PRESETS["full-admin"].permissions).toEqual(["*"]);
  });
});
