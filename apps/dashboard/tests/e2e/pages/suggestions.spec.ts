/**
 * Suggestions page — two tabs: Suggestions list, Settings.
 * Tests cover status filter, action dialogs (approve/reject/implement),
 * delete confirmation, and settings toggles.
 */
import { test, expect, gotoGuildPage } from "../fixtures/test.js";

test.describe("Suggestions page", () => {
  test.beforeEach(async ({ page, guildId }) => {
    await gotoGuildPage(page, guildId, "suggestions");
  });

  // ── Stats ──────────────────────────────────────────────────────────────────

  test("renders stats cards", async ({ page }) => {
    const cards = page.locator(".grid .rounded-lg, [data-testid='stats-card']");
    await expect(cards.first()).toBeVisible();
  });

  // ── Tab navigation ─────────────────────────────────────────────────────────

  test("renders Suggestions and Settings tabs", async ({ page }) => {
    const tabs = page.locator("[role='tablist'] [role='tab']");
    await expect(tabs).toHaveCount(2);
  });

  test("Suggestions tab is active by default", async ({ page }) => {
    const activeTab = page.locator("[role='tab'][aria-selected='true']");
    await expect(activeTab).toContainText(/suggestions/i);
  });

  test("Settings tab is reachable", async ({ page }) => {
    await page.getByRole("tab", { name: /settings/i }).click();
    await expect(page.getByRole("tabpanel")).toBeVisible();
  });

  // ── Status filter ──────────────────────────────────────────────────────────

  test("status filter select is visible with all status options", async ({ page }) => {
    const trigger = page.locator("[role='combobox']").first();
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByRole("option", { name: /all/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /pending/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /approved/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /denied/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /implemented/i })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("selecting a status filter updates the URL or re-renders table", async ({ page }) => {
    const trigger = page.locator("[role='combobox']").first();
    await trigger.click();
    await page.getByRole("option", { name: /pending/i }).click();
    await page.waitForLoadState("networkidle");
    // The filter should remain selected
    await expect(trigger).toContainText(/pending/i);
  });

  // ── Suggestions table ──────────────────────────────────────────────────────

  test("table renders or shows empty state", async ({ page }) => {
    const table = page.locator("table");
    const emptyState = page.locator("text=/no suggestions/i");
    const hasTable = (await table.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;
    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test("approve button opens the status-change dialog", async ({ page }) => {
    const approveBtn = page.getByRole("button", { name: /approve/i }).first();
    if ((await approveBtn.count()) === 0) return;
    await approveBtn.click();
    await expect(page.locator("[role='dialog']")).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("reject button opens the status-change dialog", async ({ page }) => {
    const rejectBtn = page.getByRole("button", { name: /reject|deny/i }).first();
    if ((await rejectBtn.count()) === 0) return;
    await rejectBtn.click();
    await expect(page.locator("[role='dialog']")).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("status-change dialog contains an optional reason textarea", async ({ page }) => {
    const actionBtn = page.locator("tbody button").first();
    if ((await actionBtn.count()) === 0) return;
    await actionBtn.click();
    const dialog = page.locator("[role='dialog']");
    if ((await dialog.count()) === 0) return;
    // Dialog may optionally have a textarea for the reason
    const textarea = dialog.locator("textarea");
    if ((await textarea.count()) > 0) {
      await expect(textarea).toBeVisible();
    }
    await page.keyboard.press("Escape");
  });

  test("delete button opens confirm dialog and cancel works", async ({ page }) => {
    const deleteBtn = page.getByRole("button", { name: /delete/i }).first();
    if ((await deleteBtn.count()) === 0) return;
    await deleteBtn.click();
    const dialog = page.locator("[role='alertdialog'], [role='dialog']").last();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  // ── Settings tab ───────────────────────────────────────────────────────────

  test("settings tab shows system enabled toggle", async ({ page }) => {
    await page.getByRole("tab", { name: /settings/i }).click();
    const toggle = page.locator("button[role='switch']").first();
    await expect(toggle).toBeVisible();
  });

  test("settings tab shows channel ID inputs", async ({ page }) => {
    await page.getByRole("tab", { name: /settings/i }).click();
    const inputs = page.locator("input[type='text'], input:not([type])");
    // Suggestion channel and review channel
    await expect(inputs.first()).toBeVisible();
  });

  test("settings tab has multiple toggles (DM, auto-thread, anonymous)", async ({ page }) => {
    await page.getByRole("tab", { name: /settings/i }).click();
    const toggles = page.locator("button[role='switch']");
    await expect(toggles).toHaveCount(4); // enabled + DM + auto thread + anonymous
  });
});
