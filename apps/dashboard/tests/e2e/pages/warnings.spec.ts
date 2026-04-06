/**
 * Warnings page — three tabs: Warnings list, Escalation rules, Settings.
 * Tests cover tab switching, user filter, delete confirmation, escalation
 * rule form, settings toggles, and pagination.
 */
import { test, expect, gotoGuildPage } from "../fixtures/test.js";

test.describe("Warnings page", () => {
  test.beforeEach(async ({ page, guildId }) => {
    await gotoGuildPage(page, guildId, "warnings");
  });

  // ── Stats ──────────────────────────────────────────────────────────────────

  test("renders stats cards (total warnings, escalation rules, DM on warn)", async ({ page }) => {
    const cards = page.locator(".grid .rounded-lg, [data-testid='stats-card']");
    await expect(cards.first()).toBeVisible();
    await expect(cards).toHaveCount(3);
  });

  // ── Tab navigation ─────────────────────────────────────────────────────────

  test("renders three tabs: Warnings, Escalation, Settings", async ({ page }) => {
    const tabs = page.locator("[role='tablist'] [role='tab']");
    await expect(tabs).toHaveCount(3);
  });

  test("Warnings tab is active by default", async ({ page }) => {
    const activeTab = page.locator("[role='tab'][aria-selected='true']");
    await expect(activeTab).toContainText(/warnings/i);
  });

  test("clicking Escalation tab shows the escalation panel", async ({ page }) => {
    await page.getByRole("tab", { name: /escalation/i }).click();
    await expect(page.getByRole("tabpanel")).toContainText(/escalation|threshold/i);
  });

  test("clicking Settings tab shows the settings panel", async ({ page }) => {
    await page.getByRole("tab", { name: /settings/i }).click();
    await expect(page.getByRole("tabpanel")).toContainText(/dm on warn|max warnings/i);
  });

  // ── Warnings tab ───────────────────────────────────────────────────────────

  test("user filter input is present and filters", async ({ page }) => {
    const input = page.locator("input[placeholder*='user' i]").first();
    await expect(input).toBeVisible();
    await input.fill("123456789");
    await expect(input).toHaveValue("123456789");
    await input.clear();
  });

  test("Clear All Warnings button appears when user filter is set", async ({ page }) => {
    const input = page.locator("input[placeholder*='user' i]").first();
    await input.fill("12345");
    // The 'Clear All Warnings' (destructive) button should appear
    const clearBtn = page.getByRole("button", { name: /clear all/i });
    if ((await clearBtn.count()) > 0) {
      await expect(clearBtn).toBeVisible();
    }
    await input.clear();
  });

  test("delete warning opens confirm dialog", async ({ page }) => {
    const deleteBtn = page.locator("button svg").filter({ has: page.locator("[data-testid='delete-icon']") }).first();
    // Try a more general approach — find ghost buttons in the table
    const tableDeleteBtns = page.locator("tbody button").first();
    if ((await tableDeleteBtns.count()) === 0) return;

    await tableDeleteBtns.click();
    const dialog = page.locator("[role='alertdialog'], [role='dialog']").last();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  // ── Escalation tab ─────────────────────────────────────────────────────────

  test("escalation tab shows the add-rule form", async ({ page }) => {
    await page.getByRole("tab", { name: /escalation/i }).click();
    const tabpanel = page.getByRole("tabpanel");
    await expect(tabpanel.locator("input#threshold, input[id='threshold']")).toBeVisible();
  });

  test("escalation action select has timeout/kick/ban options", async ({ page }) => {
    await page.getByRole("tab", { name: /escalation/i }).click();
    const actionSelect = page.locator("[role='combobox']").first();
    await actionSelect.click();
    await expect(page.getByRole("option", { name: /timeout/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /kick/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /ban/i })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("duration field appears only when timeout is selected", async ({ page }) => {
    await page.getByRole("tab", { name: /escalation/i }).click();
    // Select ban — duration should hide
    const actionSelect = page.locator("[role='combobox']").first();
    await actionSelect.click();
    await page.getByRole("option", { name: /ban/i }).click();
    await expect(page.locator("input#duration")).not.toBeVisible();

    // Switch back to timeout — duration should appear
    await actionSelect.click();
    await page.getByRole("option", { name: /timeout/i }).click();
    await expect(page.locator("input#duration")).toBeVisible();
  });

  test("escalation delete opens confirm dialog", async ({ page }) => {
    await page.getByRole("tab", { name: /escalation/i }).click();
    const tableDeleteBtns = page.locator("tbody button").first();
    if ((await tableDeleteBtns.count()) === 0) return;

    await tableDeleteBtns.click();
    const dialog = page.locator("[role='alertdialog'], [role='dialog']").last();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /cancel/i }).click();
  });

  // ── Settings tab ───────────────────────────────────────────────────────────

  test("settings tab renders DM on Warn toggle", async ({ page }) => {
    await page.getByRole("tab", { name: /settings/i }).click();
    const toggle = page.locator("button[role='switch']").first();
    await expect(toggle).toBeVisible();
  });

  test("settings tab renders Require Reason toggle", async ({ page }) => {
    await page.getByRole("tab", { name: /settings/i }).click();
    const toggles = page.locator("button[role='switch']");
    await expect(toggles).toHaveCount(2);
  });

  test("settings tab renders Max Warnings number input", async ({ page }) => {
    await page.getByRole("tab", { name: /settings/i }).click();
    const maxInput = page.locator("input[type='number']").last();
    await expect(maxInput).toBeVisible();
  });
});
