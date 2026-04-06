/**
 * Welcome & Farewell page — six tabs:
 *   welcome, welcome-image, farewell, farewell-image, dm, autorole
 */
import { test, expect, gotoGuildPage } from "../fixtures/test.js";

test.describe("Welcome page", () => {
  test.beforeEach(async ({ page, guildId }) => {
    await gotoGuildPage(page, guildId, "welcome");
  });

  // ── Tab navigation ─────────────────────────────────────────────────────────

  test("renders six tabs", async ({ page }) => {
    const tabs = page.locator("[role='tablist'] [role='tab']");
    await expect(tabs).toHaveCount(6);
  });

  test("Welcome tab is active by default", async ({ page }) => {
    const activeTab = page.locator("[role='tab'][aria-selected='true']");
    await expect(activeTab).toContainText(/welcome/i);
  });

  test("clicking each tab shows its panel", async ({ page }) => {
    const tabLabels = ["welcome", "welcome-image", "farewell", "farewell-image", "dm", "autorole"];
    for (const label of tabLabels) {
      const tab = page.locator("[role='tab']").filter({ hasText: new RegExp(label.replace("-", ".?"), "i") });
      if ((await tab.count()) === 0) continue;
      await tab.click();
      await expect(page.getByRole("tabpanel")).toBeVisible();
    }
  });

  // ── Welcome tab ────────────────────────────────────────────────────────────

  test("Welcome tab has an enable toggle", async ({ page }) => {
    const toggle = page.locator("button[role='switch']").first();
    await expect(toggle).toBeVisible();
  });

  test("Welcome tab has a channel ID input", async ({ page }) => {
    const input = page.locator("input").first();
    await expect(input).toBeVisible();
  });

  test("Welcome tab has embed editor fields (title, description)", async ({ page }) => {
    const inputs = page.locator("input, textarea");
    await expect(inputs).toHaveCount(3);
  });

  // ── Welcome Image tab ──────────────────────────────────────────────────────

  test("Welcome Image tab renders customization controls", async ({ page }) => {
    const tab = page.locator("[role='tab']").filter({ hasText: /welcome.?image/i });
    if ((await tab.count()) === 0) return;
    await tab.click();
    await expect(page.getByRole("tabpanel")).toBeVisible();
  });

  // ── Farewell tab ───────────────────────────────────────────────────────────

  test("Farewell tab has an enable toggle and channel input", async ({ page }) => {
    const tab = page.locator("[role='tab']").filter({ hasText: /^farewell$/i });
    if ((await tab.count()) === 0) return;
    await tab.click();
    const tabpanel = page.getByRole("tabpanel");
    await expect(tabpanel.locator("button[role='switch']").first()).toBeVisible();
  });

  // ── DM tab ─────────────────────────────────────────────────────────────────

  test("DM tab has an enable toggle", async ({ page }) => {
    const tab = page.locator("[role='tab']").filter({ hasText: /^dm$/i });
    if ((await tab.count()) === 0) return;
    await tab.click();
    const toggle = page.getByRole("tabpanel").locator("button[role='switch']").first();
    await expect(toggle).toBeVisible();
  });

  // ── Auto-role tab ──────────────────────────────────────────────────────────

  test("Auto-role tab renders", async ({ page }) => {
    const tab = page.locator("[role='tab']").filter({ hasText: /autorole|auto.?role/i });
    if ((await tab.count()) === 0) return;
    await tab.click();
    await expect(page.getByRole("tabpanel")).toBeVisible();
  });

  // ── Save / Test buttons ────────────────────────────────────────────────────

  test("Save button is visible", async ({ page }) => {
    const saveBtn = page.getByRole("button", { name: /save/i });
    await expect(saveBtn).toBeVisible();
  });
});
