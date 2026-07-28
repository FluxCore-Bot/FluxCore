import { describe, it, expect } from "vitest";
import {
  buildPermissionRegistry,
  validatePermissionRegistry,
} from "../../../src/server/shared/permissionRegistry.js";
import { scanDeclaredPermissionKeys } from "../../helpers/declaredKeys.js";

describe("buildPermissionRegistry", () => {
  it("groups modules by MODULE_META order, not alphabetical or Set-insertion order", () => {
    // "moderation" has MODULE_META order 1, "actions" has order 2, so the
    // correct grouped output is ["moderation", "actions"]. Both alternative
    // orderings disagree with that and with each other:
    //   - alphabetical:      "actions" < "moderation"      -> ["actions", "moderation"]
    //   - Set-insertion:     moderation's key is added first -> ["moderation", "actions"]
    //     (agrees here, but is irrelevant: buildPermissionRegistry alpha-sorts
    //     the incoming keys before grouping, so insertion order never survives
    //     into the Map either way)
    // A prior version of this test used "dashboard" (order 0) / "tickets"
    // (order 6): alphabetical order happens to already match MODULE_META
    // order for that pair, so deleting the trailing `.sort()` in
    // buildPermissionRegistry would still have produced ["dashboard",
    // "tickets"] and the test would not have caught it. This pair does catch
    // it: deleting that `.sort()` yields the alphabetical grouping order
    // ["actions", "moderation"], which fails the assertion below.
    const registry = buildPermissionRegistry(
      new Set(["moderation.cases.view", "actions.rules.view"]),
    );

    expect(registry.map((m) => m.key)).toEqual(["moderation", "actions"]);
  });

  it("sorts permissions within a module alphabetically", () => {
    const registry = buildPermissionRegistry(
      new Set(["tickets.panels.manage", "tickets.list.view"]),
    );

    expect(registry[0].permissions.map((p) => p.key)).toEqual([
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

// `createApp()` is deliberately not exercised here — it connects to the
// database and `process.exit`s on missing config, which would make this a
// fragile, heavily-mocked integration test. Scanning the route sources
// reproduces the same key set `getDeclaredPermissions()` would accumulate at
// boot, without booting anything, and gives the same CI-time guarantee: a
// route declaring an unknown module or a bad action verb fails this suite
// instead of only surfacing when someone starts the real server.
describe("declared permission keys (scanned from route sources)", () => {
  const scannedKeys = scanDeclaredPermissionKeys();

  it("finds a healthy number of declared keys", () => {
    // Guards against a scan regex that silently matches nothing (a rename of
    // requirePermission, a moved features/ dir, ...), which would make the
    // two assertions below pass vacuously on an empty set.
    expect(scannedKeys.size).toBeGreaterThan(40);
  });

  it("validates without throwing — the CI gate for an unknown module or bad action verb", () => {
    expect(() => validatePermissionRegistry(scannedKeys)).not.toThrow();
  });

  it("every scanned key survives buildPermissionRegistry (no module silently dropped)", () => {
    // buildPermissionRegistry silently *filters out* any module missing from
    // MODULE_META (`.filter(([module]) => module in MODULE_META)`) instead of
    // throwing — a materially different failure mode than
    // validatePermissionRegistry's throw, and the one that matters for the
    // dashboard UI: a permission the UI never renders. Comparing the built
    // count to the scanned-set size directly asserts that guarantee, rather
    // than relying on validatePermissionRegistry (tested above) to imply it.
    const registry = buildPermissionRegistry(scannedKeys);
    const builtCount = registry.reduce(
      (sum, mod) => sum + mod.permissions.length,
      0,
    );

    expect(builtCount).toBe(scannedKeys.size);
  });
});
