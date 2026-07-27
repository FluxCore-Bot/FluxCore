import { describe, it, expect } from "vitest";
import { navItems } from "../../../../src/client/shared/lib/navigation";

describe("navigation registry", () => {
  it("lists every guild route", () => {
    expect(navItems).toHaveLength(18);
  });

  it("gives every item a guild-scoped path, an i18n key, and an icon", () => {
    for (const item of navItems) {
      expect(item.path).toMatch(/^\/guild\/\$guildId\//);
      expect(item.i18nKey).toMatch(/^nav\./);
      expect(item.icon).toBeTruthy();
    }
  });

  it("uses unique paths", () => {
    const paths = navItems.map((i) => i.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("permission-gates every item except the overview", () => {
    const ungated = navItems.filter((i) => !i.permission);
    expect(ungated.map((i) => i.path)).toEqual(["/guild/$guildId/overview"]);
  });
});
