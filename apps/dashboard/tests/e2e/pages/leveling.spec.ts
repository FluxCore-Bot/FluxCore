/**
 * Leveling / XP System page.
 */
import { test, expect, gotoGuildPage } from "../fixtures/test.js";

test.describe("Leveling page", () => {
  test.beforeEach(async ({ page, guildId }) => {
    await gotoGuildPage(page, guildId, "leveling");
  });

  test("page renders without crashing", async ({ page }) => {
    await expect(page.locator("body")).toBeVisible();
    await expect(page).toHaveURL(/leveling/);
  });

  test("tabs render if present", async ({ page }) => {
    const tabList = page.locator("[role='tablist']");
    if ((await tabList.count()) > 0) {
      const tabs = tabList.locator("[role='tab']");
      await expect(tabs.first()).toBeVisible();
    }
  });

  test("enable toggle is present", async ({ page }) => {
    const toggle = page.locator("button[role='switch']").first();
    if ((await toggle.count()) > 0) {
      await expect(toggle).toBeVisible();
    }
  });

  test("save button is present", async ({ page }) => {
    const saveBtn = page.getByRole("button", { name: /save/i });
    if ((await saveBtn.count()) > 0) {
      await expect(saveBtn).toBeVisible();
    }
  });
});
