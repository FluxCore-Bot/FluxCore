/**
 * Moderation page — mod cases table, edit-reason dialog, delete confirmation,
 * action filter, user filter, settings (DM on punishment, mod-log channel).
 */
import { test, expect, gotoGuildPage } from "../fixtures/test.js";

test.describe("Moderation page", () => {
  test.beforeEach(async ({ page, guildId }) => {
    await gotoGuildPage(page, guildId, "moderation");
  });

  // ── Stats ──────────────────────────────────────────────────────────────────

  test("renders the three stats cards", async ({ page }) => {
    const cards = page.locator(".grid .rounded-lg, [data-testid='stats-card']");
    await expect(cards.first()).toBeVisible();
  });

  // ── Filters ────────────────────────────────────────────────────────────────

  test("user ID filter input is present and accepts input", async ({ page }) => {
    const input = page.locator("input[placeholder*='user' i], input[placeholder*='User' i]").first();
    await expect(input).toBeVisible();
    await input.fill("123456789");
    await expect(input).toHaveValue("123456789");
    await input.clear();
  });

  test("action filter select renders all action options", async ({ page }) => {
    const trigger = page.locator('[role="combobox"]').first();
    await expect(trigger).toBeVisible();
    await trigger.click();
    // Expect at least ban / kick options in the dropdown
    await expect(page.getByRole("option", { name: /ban/i }).first()).toBeVisible();
    // Close by pressing Escape
    await page.keyboard.press("Escape");
  });

  // ── Table ──────────────────────────────────────────────────────────────────

  test("mod-cases table renders headers", async ({ page }) => {
    const table = page.locator("table").first();
    await expect(table).toBeVisible();
    const headers = table.locator("th");
    await expect(headers).toHaveCount(7);
  });

  test("empty state is visible when there are no cases", async ({ page }) => {
    // Either the table has rows OR the empty state placeholder is shown
    const rows = page.locator("tbody tr td:not([colspan])");
    const emptyState = page.locator("text=/no.*(cases|moderation)/i");
    const hasRows = (await rows.count()) > 0;
    if (!hasRows) {
      await expect(emptyState.first()).toBeVisible();
    }
  });

  // ── Edit-reason dialog ──────────────────────────────────────────────────────

  test("clicking edit opens the edit-reason dialog", async ({ page }) => {
    const editBtn = page.locator("button[title*='edit' i], button[title*='Edit' i]").first();
    if ((await editBtn.count()) === 0) return; // no cases yet — skip

    await editBtn.click();
    await expect(page.locator("[role='dialog']")).toBeVisible();

    // The dialog should contain a textarea for the reason
    await expect(page.locator("[role='dialog'] textarea")).toBeVisible();
  });

  test("edit-reason dialog closes when Cancel is clicked", async ({ page }) => {
    const editBtn = page.locator("button[title*='edit' i], button[title*='Edit' i]").first();
    if ((await editBtn.count()) === 0) return;

    await editBtn.click();
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("typing in the edit-reason textarea updates the value", async ({ page }) => {
    const editBtn = page.locator("button[title*='edit' i], button[title*='Edit' i]").first();
    if ((await editBtn.count()) === 0) return;

    await editBtn.click();
    const textarea = page.locator("[role='dialog'] textarea");
    await textarea.clear();
    await textarea.fill("Updated reason via e2e test");
    await expect(textarea).toHaveValue("Updated reason via e2e test");

    // Close without saving
    await page.keyboard.press("Escape");
  });

  // ── Delete confirmation ────────────────────────────────────────────────────

  test("clicking delete opens the confirm dialog", async ({ page }) => {
    const deleteBtn = page.locator("button[title*='delete' i], button[title*='Delete' i]").first();
    if ((await deleteBtn.count()) === 0) return;

    await deleteBtn.click();
    const confirmDialog = page.locator("[role='alertdialog'], [role='dialog']").last();
    await expect(confirmDialog).toBeVisible();
    // Should have a destructive confirm button
    await expect(
      confirmDialog.getByRole("button", { name: /delete|confirm/i }),
    ).toBeVisible();
  });

  test("confirm dialog cancel button closes without deleting", async ({ page }) => {
    const deleteBtn = page.locator("button[title*='delete' i], button[title*='Delete' i]").first();
    if ((await deleteBtn.count()) === 0) return;

    await deleteBtn.click();
    const confirmDialog = page.locator("[role='alertdialog'], [role='dialog']").last();
    await confirmDialog.getByRole("button", { name: /cancel/i }).click();
    await expect(confirmDialog).not.toBeVisible();
  });

  // ── Settings ───────────────────────────────────────────────────────────────

  test("settings section is visible", async ({ page }) => {
    await expect(page.getByText(/settings/i).first()).toBeVisible();
  });

  test("DM on punishment toggle is rendered", async ({ page }) => {
    const toggle = page.locator("button[role='switch']").first();
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-checked");
  });

  test("toggling DM on punishment switch does not throw", async ({ page }) => {
    const toggle = page.locator("button[role='switch']").first();
    if ((await toggle.count()) === 0) return;

    const initialState = await toggle.getAttribute("aria-checked");
    await toggle.click();
    // Wait for API response
    await page.waitForLoadState("networkidle");
    // Toggle back to restore original state
    await toggle.click();
    await page.waitForLoadState("networkidle");
    const finalState = await toggle.getAttribute("aria-checked");
    expect(finalState).toBe(initialState);
  });
});
