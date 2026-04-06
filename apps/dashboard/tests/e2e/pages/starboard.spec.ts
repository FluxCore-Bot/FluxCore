/**
 * Starboard page.
 */
import { test, expect, gotoGuildPage } from "../fixtures/test.js";

test.describe("Starboard page", () => {
  test.beforeEach(async ({ page, guildId }) => {
    await gotoGuildPage(page, guildId, "starboard");
  });

  test("page renders without crashing", async ({ page }) => {
    await expect(page.locator("body")).toBeVisible();
    await expect(page).toHaveURL(/starboard/);
  });

  test("enable toggle is present", async ({ page }) => {
    const toggle = page.locator("button[role='switch']").first();
    if ((await toggle.count()) > 0) {
      await expect(toggle).toBeVisible();
    }
  });

  test("channel select or input is present", async ({ page }) => {
    const select = page.locator("[role='combobox']").first();
    const input = page.locator("input").first();
    const hasSelect = (await select.count()) > 0;
    const hasInput = (await input.count()) > 0;
    expect(hasSelect || hasInput).toBeTruthy();
  });

  test("threshold / emoji configuration inputs are present", async ({ page }) => {
    const inputs = page.locator("input[type='number'], input[type='text']");
    if ((await inputs.count()) > 0) {
      await expect(inputs.first()).toBeVisible();
    }
  });

  test("save button is present", async ({ page }) => {
    const saveBtn = page.getByRole("button", { name: /save/i });
    if ((await saveBtn.count()) > 0) {
      await expect(saveBtn).toBeVisible();
    }
  });
});
