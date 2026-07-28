import { describe, it, expect } from "vitest";
import { ROLE_PRESETS } from "@fluxcore/types";
import { navItems } from "../../../src/client/shared/lib/navigation.js";
import { scanDeclaredPermissionKeys } from "../../helpers/declaredKeys.js";

describe("permission drift", () => {
  it("finds permission keys to check", () => {
    expect(scanDeclaredPermissionKeys().size).toBeGreaterThan(40);
  });

  it("enforces every permission the sidebar navigates by", () => {
    const declared = scanDeclaredPermissionKeys();

    const missing = navItems
      .map((item) => item.permission)
      .filter((perm): perm is string => Boolean(perm))
      .filter((perm) => !declared.has(perm));

    expect(missing).toEqual([]);
  });

  it("enforces every literal key used by a role preset", () => {
    const declared = scanDeclaredPermissionKeys();

    const missing = Object.values(ROLE_PRESETS)
      .flatMap((preset) => preset.permissions)
      .filter((perm) => !perm.includes("*"))
      .filter((perm) => !declared.has(perm));

    expect(missing).toEqual([]);
  });
});
