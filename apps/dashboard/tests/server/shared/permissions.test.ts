import { describe, it, expect } from "vitest";
import {
  matchPermission,
  expandWildcard,
  resolveEffectivePermissions,
  ALL_PERMISSION_KEYS,
  PERMISSION_REGISTRY,
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

describe("expandWildcard", () => {
  it("expands * to all permission keys", () => {
    const expanded = expandWildcard("*");
    expect(expanded).toEqual(ALL_PERMISSION_KEYS);
    expect(expanded.length).toBeGreaterThan(40);
  });

  it("expands module.* to all permissions in that module", () => {
    const expanded = expandWildcard("moderation.*");
    expect(expanded).toContain("moderation.cases.view");
    expect(expanded).toContain("moderation.cases.manage");
    expect(expanded).toContain("moderation.warnings.view");
    expect(expanded).toContain("moderation.warnings.manage");
    expect(expanded).not.toContain("actions.rules.view");
  });

  it("expands *.*.view to all view permissions", () => {
    const expanded = expandWildcard("*.*.view");
    expect(expanded.every((k) => k.endsWith(".view"))).toBe(true);
    expect(expanded.length).toBeGreaterThan(5);
  });
});

describe("resolveEffectivePermissions", () => {
  it("resolves wildcard to concrete keys", () => {
    const effective = resolveEffectivePermissions(["moderation.*"]);
    expect(effective).toContain("moderation.cases.view");
    expect(effective).toContain("moderation.warnings.manage");
    expect(effective).not.toContain("actions.rules.view");
  });

  it("resolves full wildcard to all keys", () => {
    const effective = resolveEffectivePermissions(["*"]);
    expect(effective).toEqual(ALL_PERMISSION_KEYS);
  });

  it("merges multiple grants", () => {
    const effective = resolveEffectivePermissions(["moderation.*", "actions.rules.view"]);
    expect(effective).toContain("moderation.cases.view");
    expect(effective).toContain("actions.rules.view");
    expect(effective).not.toContain("actions.rules.manage");
  });

  it("returns empty for empty input", () => {
    expect(resolveEffectivePermissions([])).toEqual([]);
  });
});

describe("PERMISSION_REGISTRY", () => {
  it("has all expected modules", () => {
    const moduleKeys = PERMISSION_REGISTRY.map((m) => m.key);
    expect(moduleKeys).toContain("dashboard");
    expect(moduleKeys).toContain("moderation");
    expect(moduleKeys).toContain("actions");
    expect(moduleKeys).toContain("logging");
    expect(moduleKeys).toContain("security");
  });

  it("has unique permission keys across all modules", () => {
    const allKeys = PERMISSION_REGISTRY.flatMap((m) => m.permissions.map((p) => p.key));
    const unique = new Set(allKeys);
    expect(unique.size).toBe(allKeys.length);
  });

  it("ALL_PERMISSION_KEYS matches registry", () => {
    const registryKeys = PERMISSION_REGISTRY.flatMap((m) => m.permissions.map((p) => p.key));
    expect(ALL_PERMISSION_KEYS).toEqual(registryKeys);
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

  it("all preset permissions are valid", () => {
    for (const [, preset] of Object.entries(ROLE_PRESETS)) {
      for (const perm of preset.permissions) {
        if (perm === "*") continue;
        // Wildcard or exact key should expand to at least one concrete key
        const expanded = expandWildcard(perm);
        expect(expanded.length, `"${perm}" should expand to at least one key`).toBeGreaterThan(0);
      }
    }
  });
});
