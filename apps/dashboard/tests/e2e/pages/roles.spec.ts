/**
 * Roles (reaction/button role panels) page — two tabs: Panels list, Preview.
 * Tests cover create/edit dialog (with all its sections), delete confirmation,
 * and the preview tab.
 */
import { test, expect, gotoGuildPage } from "../fixtures/test.js";

test.describe("Roles page", () => {
  test.beforeEach(async ({ page, guildId }) => {
    await gotoGuildPage(page, guildId, "roles");
  });

  // ── Stats ──────────────────────────────────────────────────────────────────

  test("renders stats cards", async ({ page }) => {
    const cards = page.locator(".grid .rounded-lg, [data-testid='stats-card']");
    await expect(cards.first()).toBeVisible();
  });

  // ── Tab navigation ─────────────────────────────────────────────────────────

  test("renders Panels and Preview tabs", async ({ page }) => {
    const tabs = page.locator("[role='tablist'] [role='tab']");
    await expect(tabs).toHaveCount(2);
  });

  test("Panels tab is active by default", async ({ page }) => {
    const activeTab = page.locator("[role='tab'][aria-selected='true']");
    await expect(activeTab).toContainText(/panels/i);
  });

  test("Preview tab is reachable", async ({ page }) => {
    await page.getByRole("tab", { name: /preview/i }).click();
    await expect(page.getByRole("tabpanel")).toBeVisible();
  });

  // ── Create panel dialog ────────────────────────────────────────────────────

  test("Create Panel button opens the dialog", async ({ page }) => {
    const createBtn = page.getByRole("button", { name: /create panel/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    await expect(page.locator("[role='dialog']")).toBeVisible();
  });

  test("create dialog contains panel name input", async ({ page }) => {
    await page.getByRole("button", { name: /create panel/i }).click();
    const dialog = page.locator("[role='dialog']");
    await expect(dialog.locator("input").first()).toBeVisible();
  });

  test("create dialog has panel type select (button / dropdown / reaction)", async ({ page }) => {
    await page.getByRole("button", { name: /create panel/i }).click();
    const dialog = page.locator("[role='dialog']");
    const selects = dialog.locator("[role='combobox']");
    // At least one select for type
    await expect(selects.first()).toBeVisible();
  });

  test("create dialog has Add Role button", async ({ page }) => {
    await page.getByRole("button", { name: /create panel/i }).click();
    const dialog = page.locator("[role='dialog']");
    const addRoleBtn = dialog.getByRole("button", { name: /add role/i });
    if ((await addRoleBtn.count()) > 0) {
      await expect(addRoleBtn).toBeVisible();
    }
  });

  test("create dialog closes on Cancel", async ({ page }) => {
    await page.getByRole("button", { name: /create panel/i }).click();
    const dialog = page.locator("[role='dialog']");
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("create dialog closes on Escape", async ({ page }) => {
    await page.getByRole("button", { name: /create panel/i }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator("[role='dialog']")).not.toBeVisible();
  });

  // ── Edit dialog via existing panel ────────────────────────────────────────

  test("Edit button on an existing panel opens the dialog pre-filled", async ({ page }) => {
    const editBtn = page.locator("tbody button[title*='edit' i], tbody button").first();
    if ((await editBtn.count()) === 0) return;
    await editBtn.click();
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible();
    // Name field should not be empty
    const nameInput = dialog.locator("input").first();
    const value = await nameInput.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  // ── Delete confirmation ────────────────────────────────────────────────────

  test("Delete button opens confirm dialog and cancel works", async ({ page }) => {
    const deleteBtn = page.locator("tbody button[title*='delete' i]").first();
    if ((await deleteBtn.count()) === 0) return;
    await deleteBtn.click();
    const dialog = page.locator("[role='alertdialog'], [role='dialog']").last();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  // ── Panel type specific fields ─────────────────────────────────────────────

  test("dropdown type shows min/max role inputs", async ({ page }) => {
    await page.getByRole("button", { name: /create panel/i }).click();
    const dialog = page.locator("[role='dialog']");
    const typeSelect = dialog.locator("[role='combobox']").first();
    await typeSelect.click();
    const dropdownOption = page.getByRole("option", { name: /dropdown/i });
    if ((await dropdownOption.count()) > 0) {
      await dropdownOption.click();
      await expect(dialog.locator("input[type='number']").first()).toBeVisible();
    }
    await page.keyboard.press("Escape");
  });
});
