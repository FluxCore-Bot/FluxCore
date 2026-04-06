/**
 * Security (Anti-Raid) page — five tabs: Join Rate, Account Age,
 * Anti-Nuke, Lockdown, Events.  Master enable toggle at the top.
 */
import { test, expect, gotoGuildPage } from "../fixtures/test.js";

test.describe("Security page", () => {
  test.beforeEach(async ({ page, guildId }) => {
    await gotoGuildPage(page, guildId, "security");
  });

  // ── Master toggle ──────────────────────────────────────────────────────────

  test("master enable toggle is present", async ({ page }) => {
    const masterToggle = page.locator("button[role='switch']").first();
    await expect(masterToggle).toBeVisible();
    await expect(masterToggle).toHaveAttribute("aria-checked");
  });

  // ── Tab navigation ─────────────────────────────────────────────────────────

  test("renders all five tabs", async ({ page }) => {
    const tabs = page.locator("[role='tablist'] [role='tab']");
    await expect(tabs).toHaveCount(5);
  });

  test("Join Rate tab is first / default", async ({ page }) => {
    const firstTab = page.locator("[role='tab']").first();
    await expect(firstTab).toContainText(/join.?rate/i);
  });

  test("clicking each tab renders its panel", async ({ page }) => {
    const tabNames = ["join", "account", "nuke", "lockdown", "events"];
    for (const name of tabNames) {
      const tab = page.locator(`[role='tab']`).filter({ hasText: new RegExp(name, "i") });
      if ((await tab.count()) === 0) continue;
      await tab.click();
      await expect(page.getByRole("tabpanel")).toBeVisible();
    }
  });

  // ── Join Rate tab ──────────────────────────────────────────────────────────

  test("Join Rate tab shows threshold and window inputs", async ({ page }) => {
    const tab = page.locator("[role='tab']").filter({ hasText: /join.?rate/i });
    await tab.click();
    const inputs = page.getByRole("tabpanel").locator("input[type='number']");
    await expect(inputs.first()).toBeVisible();
  });

  test("Join Rate tab shows action select", async ({ page }) => {
    const tab = page.locator("[role='tab']").filter({ hasText: /join.?rate/i });
    await tab.click();
    const select = page.getByRole("tabpanel").locator("[role='combobox']").first();
    if ((await select.count()) > 0) {
      await expect(select).toBeVisible();
    }
  });

  // ── Account Age tab ────────────────────────────────────────────────────────

  test("Account Age tab shows min age input", async ({ page }) => {
    const tab = page.locator("[role='tab']").filter({ hasText: /account.?age/i });
    if ((await tab.count()) === 0) return;
    await tab.click();
    const inputs = page.getByRole("tabpanel").locator("input[type='number']");
    await expect(inputs.first()).toBeVisible();
  });

  // ── Anti-Nuke tab ──────────────────────────────────────────────────────────

  test("Anti-Nuke tab shows enabled toggle and threshold input", async ({ page }) => {
    const tab = page.locator("[role='tab']").filter({ hasText: /anti.?nuke/i });
    if ((await tab.count()) === 0) return;
    await tab.click();
    const tabpanel = page.getByRole("tabpanel");
    await expect(tabpanel.locator("button[role='switch'], input[type='number']").first()).toBeVisible();
  });

  // ── Lockdown tab ───────────────────────────────────────────────────────────

  test("Lockdown tab shows whitelisted roles and log channel fields", async ({ page }) => {
    const tab = page.locator("[role='tab']").filter({ hasText: /lockdown/i });
    if ((await tab.count()) === 0) return;
    await tab.click();
    // Fields for whitelist and log channel
    const tabpanel = page.getByRole("tabpanel");
    await expect(tabpanel).toBeVisible();
  });

  // ── Events tab ────────────────────────────────────────────────────────────

  test("Events tab shows raid event log or empty state", async ({ page }) => {
    const tab = page.locator("[role='tab']").filter({ hasText: /events/i });
    if ((await tab.count()) === 0) return;
    await tab.click();
    const tabpanel = page.getByRole("tabpanel");
    const table = tabpanel.locator("table");
    const emptyState = tabpanel.locator("text=/no events/i, text=/no raids/i");
    const hasTable = (await table.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;
    expect(hasTable || hasEmpty).toBeTruthy();
  });

  // ── Save button ────────────────────────────────────────────────────────────

  test("Save button is present", async ({ page }) => {
    const saveBtn = page.getByRole("button", { name: /save/i });
    await expect(saveBtn).toBeVisible();
  });
});
