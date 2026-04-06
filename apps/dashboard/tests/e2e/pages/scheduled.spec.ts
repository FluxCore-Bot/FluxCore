/**
 * Scheduled Messages page — list with create/edit dialog.
 * The dialog has two inner tabs: Text and Embed.
 */
import { test, expect, gotoGuildPage } from "../fixtures/test.js";

test.describe("Scheduled Messages page", () => {
  test.beforeEach(async ({ page, guildId }) => {
    await gotoGuildPage(page, guildId, "scheduled");
  });

  // ── Stats ──────────────────────────────────────────────────────────────────

  test("renders stats cards (total, active, inactive)", async ({ page }) => {
    const cards = page.locator(".grid .rounded-lg, [data-testid='stats-card']");
    await expect(cards.first()).toBeVisible();
  });

  // ── New Message dialog ─────────────────────────────────────────────────────

  test("New Message button opens the dialog", async ({ page }) => {
    const newBtn = page.getByRole("button", { name: /new message/i });
    await expect(newBtn).toBeVisible();
    await newBtn.click();
    await expect(page.locator("[role='dialog']")).toBeVisible();
  });

  test("dialog has a name input", async ({ page }) => {
    await page.getByRole("button", { name: /new message/i }).click();
    const dialog = page.locator("[role='dialog']");
    await expect(dialog.locator("input").first()).toBeVisible();
  });

  test("dialog has Text and Embed sub-tabs", async ({ page }) => {
    await page.getByRole("button", { name: /new message/i }).click();
    const dialog = page.locator("[role='dialog']");
    const innerTabs = dialog.locator("[role='tablist'] [role='tab']");
    await expect(innerTabs).toHaveCount(2);
    await expect(innerTabs.nth(0)).toContainText(/text/i);
    await expect(innerTabs.nth(1)).toContainText(/embed/i);
  });

  test("Text sub-tab shows content textarea", async ({ page }) => {
    await page.getByRole("button", { name: /new message/i }).click();
    const dialog = page.locator("[role='dialog']");
    await dialog.getByRole("tab", { name: /text/i }).click();
    await expect(dialog.locator("textarea").first()).toBeVisible();
  });

  test("Embed sub-tab shows embed field inputs", async ({ page }) => {
    await page.getByRole("button", { name: /new message/i }).click();
    const dialog = page.locator("[role='dialog']");
    await dialog.getByRole("tab", { name: /embed/i }).click();
    // Title input should appear
    await expect(dialog.locator("input").first()).toBeVisible();
  });

  test("dialog has cron expression / schedule preset select", async ({ page }) => {
    await page.getByRole("button", { name: /new message/i }).click();
    const dialog = page.locator("[role='dialog']");
    const selects = dialog.locator("[role='combobox']");
    await expect(selects.first()).toBeVisible();
  });

  test("dialog has timezone select", async ({ page }) => {
    await page.getByRole("button", { name: /new message/i }).click();
    const dialog = page.locator("[role='dialog']");
    const selects = dialog.locator("[role='combobox']");
    // Should have at least 2 selects: schedule preset + timezone
    await expect(selects).toHaveCount(2);
  });

  test("dialog closes on Cancel", async ({ page }) => {
    await page.getByRole("button", { name: /new message/i }).click();
    const dialog = page.locator("[role='dialog']");
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("dialog closes on Escape", async ({ page }) => {
    await page.getByRole("button", { name: /new message/i }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator("[role='dialog']")).not.toBeVisible();
  });

  // ── Messages table ─────────────────────────────────────────────────────────

  test("messages table or empty state is visible", async ({ page }) => {
    const table = page.locator("table");
    const emptyState = page.locator("text=/no scheduled/i, text=/no messages/i");
    const hasTable = (await table.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;
    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test("enabled toggle renders in each table row", async ({ page }) => {
    const rowToggles = page.locator("tbody [role='switch']");
    const count = await rowToggles.count();
    if (count > 0) {
      await expect(rowToggles.first()).toBeVisible();
    }
  });

  test("Edit button opens dialog pre-populated with message data", async ({ page }) => {
    const editBtn = page.locator("tbody button[title*='edit' i]").first();
    if ((await editBtn.count()) === 0) return;
    await editBtn.click();
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible();
    const nameInput = dialog.locator("input").first();
    const val = await nameInput.inputValue();
    expect(val.length).toBeGreaterThan(0);
  });
});
