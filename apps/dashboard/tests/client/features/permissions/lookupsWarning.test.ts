import { describe, it, expect } from "vitest";
import { needsLookupsPermission } from "../../../../src/client/features/permissions/lookupsWarning";

describe("needsLookupsPermission", () => {
  it("warns when a role can configure things but cannot use pickers", () => {
    expect(needsLookupsPermission(new Set(["tickets.panels.manage"]))).toBe(true);
  });

  it("stays quiet once lookups are granted", () => {
    expect(
      needsLookupsPermission(new Set(["tickets.panels.manage", "dashboard.lookups.view"])),
    ).toBe(false);
  });

  it("stays quiet for a view-only role", () => {
    expect(needsLookupsPermission(new Set(["tickets.list.view"]))).toBe(false);
  });

  it("stays quiet for a role whose wildcard already covers lookups", () => {
    expect(needsLookupsPermission(new Set(["dashboard.*"]))).toBe(false);
    expect(needsLookupsPermission(new Set(["*"]))).toBe(false);
  });

  it("warns for a module wildcard that does not cover lookups", () => {
    expect(needsLookupsPermission(new Set(["tickets.*"]))).toBe(true);
  });

  it("stays quiet for an empty role", () => {
    expect(needsLookupsPermission(new Set())).toBe(false);
  });
});
