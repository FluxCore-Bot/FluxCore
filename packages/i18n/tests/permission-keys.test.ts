import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const LOCALES_DIR = join(__dirname, "../src/locales");

const REQUIRED_MODULES = [
  "dashboard", "moderation", "actions", "logging", "welcome", "leveling",
  "tickets", "giveaways", "starboard", "suggestions", "roles", "tempvoice",
  "security", "scheduled", "commands",
];

const REQUIRED_RESOURCES = [
  "roles", "audit", "settings", "lookups", "cases", "warnings", "punishments",
  "rules", "analytics", "entries", "config", "test", "leaderboard", "users",
  "rewards", "list", "panels", "messages", "events",
];

const REQUIRED_ACTIONS = ["view", "manage", "execute", "purge"];

interface PermissionsFile {
  permissionCategories?: Record<string, string>;
  resources?: Record<string, string>;
  permissionActions?: Record<string, string>;
  roleEditor?: Record<string, string>;
}

function readPermissions(lang: string): PermissionsFile {
  const raw = readFileSync(join(LOCALES_DIR, lang, "permissions.json"), "utf8");
  return JSON.parse(raw) as PermissionsFile;
}

describe("permission registry i18n", () => {
  const languages = readdirSync(LOCALES_DIR);

  it("covers all 48 locales", () => {
    expect(languages).toHaveLength(48);
  });

  it.each(languages)("%s has every module, resource, and action label", (lang) => {
    const perms = readPermissions(lang);

    for (const key of REQUIRED_MODULES) {
      expect(perms.permissionCategories?.[key], `${lang} permissionCategories.${key}`).toBeTruthy();
    }
    for (const key of REQUIRED_RESOURCES) {
      expect(perms.resources?.[key], `${lang} resources.${key}`).toBeTruthy();
    }
    for (const key of REQUIRED_ACTIONS) {
      expect(perms.permissionActions?.[key], `${lang} permissionActions.${key}`).toBeTruthy();
    }
  });

  it.each(languages)("%s has roleEditor.permissionLabel with both placeholders", (lang) => {
    const perms = readPermissions(lang);
    const label = perms.roleEditor?.permissionLabel;

    expect(label, `${lang} roleEditor.permissionLabel`).toBeTruthy();
    expect(label).toContain("{{action}}");
    expect(label).toContain("{{resource}}");
  });

  it.each(languages)("%s has roleEditor.registryError and registryEmpty", (lang) => {
    const perms = readPermissions(lang);

    expect(perms.roleEditor?.registryError, `${lang} roleEditor.registryError`).toBeTruthy();
    expect(perms.roleEditor?.registryEmpty, `${lang} roleEditor.registryEmpty`).toBeTruthy();
  });
});
