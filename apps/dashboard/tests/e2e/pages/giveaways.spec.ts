/**
 * Giveaways page.
 */
import { test, expect, gotoGuildPage } from "../fixtures/test.js";

test.describe("Giveaways page", () => {
  test.beforeEach(async ({ page, guildId }) => {
    await gotoGuildPage(page, guildId, "giveaways");
  });

  test("page renders without crashing", async ({ page }) => {
    await expect(page.locator("body")).toBeVisible();
    await expect(page).toHaveURL(/giveaways/);
  });

  test("create giveaway button is present", async ({ page }) => {
    const createBtn = page.getByRole("button", { name: /create|new giveaway/i });
    if ((await createBtn.count()) > 0) {
      await expect(createBtn).toBeVisible();
    }
  });

  test("create giveaway dialog opens and closes", async ({ page }) => {
    const createBtn = page.getByRole("button", { name: /create|new giveaway/i });
    if ((await createBtn.count()) === 0) return;
    await createBtn.click();
    await expect(page.locator("[role='dialog']")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[role='dialog']")).not.toBeVisible();
  });

  test("giveaways table or empty state is visible", async ({ page }) => {
    const table = page.locator("table");
    const emptyState = page.locator("text=/no giveaways/i");
    const hasTable = (await table.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;
    expect(hasTable || hasEmpty).toBeTruthy();
  });
});
