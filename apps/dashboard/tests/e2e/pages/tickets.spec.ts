/**
 * Ticket System page.
 */
import { test, expect, gotoGuildPage } from "../fixtures/test.js";

test.describe("Tickets page", () => {
  test.beforeEach(async ({ page, guildId }) => {
    await gotoGuildPage(page, guildId, "tickets");
  });

  test("page renders without crashing", async ({ page }) => {
    await expect(page.locator("body")).toBeVisible();
    await expect(page).toHaveURL(/tickets/);
  });

  test("tabs render if present", async ({ page }) => {
    const tabList = page.locator("[role='tablist']");
    if ((await tabList.count()) > 0) {
      const tabs = tabList.locator("[role='tab']");
      await expect(tabs.first()).toBeVisible();
      // Clicking each tab should not throw
      const count = await tabs.count();
      for (let i = 0; i < count; i++) {
        await tabs.nth(i).click();
        await expect(page.getByRole("tabpanel")).toBeVisible();
      }
    }
  });

  test("create ticket button or form is present", async ({ page }) => {
    const createBtn = page.getByRole("button", { name: /create|new ticket/i });
    const form = page.locator("form");
    expect((await createBtn.count()) + (await form.count())).toBeGreaterThan(0);
  });

  test("ticket list or empty state is present", async ({ page }) => {
    const table = page.locator("table");
    const emptyState = page.locator("text=/no tickets/i");
    const hasTable = (await table.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;
    expect(hasTable || hasEmpty).toBeTruthy();
  });
});
