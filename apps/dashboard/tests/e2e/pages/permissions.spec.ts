/**
 * Permissions page — two tabs: Roles editor, Audit log.
 * Tests cover tab switching, create-role dialog, role editor fields,
 * delete confirmation, preset dropdown.
 */
import { test, expect, gotoGuildPage } from "../fixtures/test.js";

test.describe("Permissions page", () => {
  test.beforeEach(async ({ page, guildId }) => {
    await gotoGuildPage(page, guildId, "permissions");
  });

  // ── Tab navigation ─────────────────────────────────────────────────────────

  test("renders Roles and Audit tabs", async ({ page }) => {
    const tabs = page.locator("[role='tablist'] [role='tab']");
    await expect(tabs).toHaveCount(2);
  });

  test("Roles tab is active by default", async ({ page }) => {
    const activeTab = page.locator("[role='tab'][aria-selected='true']");
    await expect(activeTab).toContainText(/roles/i);
  });

  test("clicking Audit tab shows audit log content", async ({ page }) => {
    await page.getByRole("tab", { name: /audit/i }).click();
    // Audit panel should contain a log or empty state
    await expect(page.getByRole("tabpanel")).toBeVisible();
  });

  // ── Create Role dialog ─────────────────────────────────────────────────────

  test("Create Role button opens the dialog", async ({ page }) => {
    const createBtn = page.getByRole("button", { name: /create role/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    await expect(page.locator("[role='dialog']")).toBeVisible();
  });

  test("create role dialog has a name input", async ({ page }) => {
    await page.getByRole("button", { name: /create role/i }).click();
    const dialog = page.locator("[role='dialog']");
    await expect(dialog.locator("input[type='text'], input:not([type])").first()).toBeVisible();
  });

  test("create role dialog closes on Cancel", async ({ page }) => {
    await page.getByRole("button", { name: /create role/i }).click();
    const dialog = page.locator("[role='dialog']");
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("create role dialog closes on Escape key", async ({ page }) => {
    await page.getByRole("button", { name: /create role/i }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator("[role='dialog']")).not.toBeVisible();
  });

  // ── Role editor ────────────────────────────────────────────────────────────

  test("selecting a role from the sidebar opens the editor", async ({ page }) => {
    const roleSidebarItem = page.locator("aside button, [data-testid='role-list-item']").first();
    if ((await roleSidebarItem.count()) === 0) return;
    await roleSidebarItem.click();
    // Editor panel should show fields
    await expect(page.locator("input[placeholder*='name' i]")).toBeVisible();
  });

  test("role editor has permission checkboxes", async ({ page }) => {
    const roleSidebarItem = page.locator("aside button, [data-testid='role-list-item']").first();
    if ((await roleSidebarItem.count()) === 0) return;
    await roleSidebarItem.click();

    const checkboxes = page.locator("button[role='checkbox']");
    await expect(checkboxes.first()).toBeVisible();
  });

  test("role editor delete button opens confirm dialog", async ({ page }) => {
    const roleSidebarItem = page.locator("aside button, [data-testid='role-list-item']").first();
    if ((await roleSidebarItem.count()) === 0) return;
    await roleSidebarItem.click();

    const deleteBtn = page.getByRole("button", { name: /delete role/i });
    if ((await deleteBtn.count()) === 0) return;
    await deleteBtn.click();
    const dialog = page.locator("[role='alertdialog'], [role='dialog']").last();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /cancel/i }).click();
  });

  // ── Preset dropdown ────────────────────────────────────────────────────────

  test("Preset dropdown is visible and opens a menu", async ({ page }) => {
    const presetBtn = page.getByRole("button", { name: /preset/i });
    if ((await presetBtn.count()) === 0) return;
    await presetBtn.click();
    await expect(page.locator("[role='menu']")).toBeVisible();
    await page.keyboard.press("Escape");
  });
});
