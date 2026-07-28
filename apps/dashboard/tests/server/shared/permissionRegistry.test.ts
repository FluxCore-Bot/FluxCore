import { describe, it, expect } from "vitest";
import {
  buildPermissionRegistry,
  validatePermissionRegistry,
} from "../../../src/server/shared/permissionRegistry.js";

describe("buildPermissionRegistry", () => {
  it("groups keys by module in MODULE_META order", () => {
    const registry = buildPermissionRegistry(
      new Set(["tickets.list.view", "dashboard.roles.view", "tickets.panels.manage"]),
    );

    expect(registry.map((m) => m.key)).toEqual(["dashboard", "tickets"]);
    expect(registry[1].permissions.map((p) => p.key)).toEqual([
      "tickets.list.view",
      "tickets.panels.manage",
    ]);
  });

  it("exposes i18n keys rather than English labels", () => {
    const [mod] = buildPermissionRegistry(new Set(["tickets.list.view"]));

    expect(mod.labelKey).toBe("permissions:permissionCategories.tickets");
    expect(mod.permissions[0]).toEqual({
      key: "tickets.list.view",
      resourceKey: "permissions:resources.list",
      actionKey: "permissions:permissionActions.view",
    });
  });

  it("carries the module icon", () => {
    const [mod] = buildPermissionRegistry(new Set(["moderation.cases.view"]));
    expect(mod.icon).toBe("Shield");
  });
});

describe("validatePermissionRegistry", () => {
  it("accepts well-formed keys in known modules", () => {
    expect(() =>
      validatePermissionRegistry(new Set(["tickets.list.view"])),
    ).not.toThrow();
  });

  it("rejects a key whose module has no metadata", () => {
    expect(() =>
      validatePermissionRegistry(new Set(["quests.list.view"])),
    ).toThrow(/quests/);
  });

  it("rejects a key that is not module.resource.action", () => {
    expect(() =>
      validatePermissionRegistry(new Set(["tickets.view"])),
    ).toThrow(/tickets\.view/);
  });

  it("rejects an unknown action verb", () => {
    expect(() =>
      validatePermissionRegistry(new Set(["tickets.list.obliterate"])),
    ).toThrow(/obliterate/);
  });
});
