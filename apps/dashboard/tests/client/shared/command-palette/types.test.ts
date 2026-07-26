import { describe, it, expect } from "vitest";
import { capFor, DEFAULT_GROUP_CAP } from "../../../../src/client/shared/command-palette/types";
import { navItems } from "../../../../src/client/shared/lib/navigation";

describe("capFor", () => {
  it("leaves pages uncapped", () => {
    expect(capFor("pages")).toBe(Number.POSITIVE_INFINITY);
  });

  it("leaves actions uncapped", () => {
    expect(capFor("actions")).toBe(Number.POSITIVE_INFINITY);
  });

  it("falls back to DEFAULT_GROUP_CAP for servers", () => {
    expect(capFor("servers")).toBe(DEFAULT_GROUP_CAP);
  });

  it("falls back to DEFAULT_GROUP_CAP for recent", () => {
    expect(capFor("recent")).toBe(DEFAULT_GROUP_CAP);
  });

  it("keeps the uncapped groups genuinely unbounded, not just large", () => {
    // A future "simplification" to a finite constant (e.g. 50) must fail this,
    // not just the infinity check above — pages already has 18 real entries,
    // so a merely-large cap could still hide the regression.
    expect(capFor("pages")).toBeGreaterThan(navItems.length);
    expect(capFor("actions")).toBeGreaterThan(navItems.length);
  });
});
