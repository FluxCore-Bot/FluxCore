import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { scanCommands, scanEnvVars, scanDashboardPages } from "../scripts/manifest/scan.mjs";

const repoRoot = resolve(__dirname, "../../..");

describe("scanCommands", () => {
  it("finds every command file in the feature-sliced layout", () => {
    const commands = scanCommands(repoRoot);
    expect(commands.length).toBe(38);
  });

  it("records the module a command belongs to", () => {
    const ban = scanCommands(repoRoot).find((c) => c.name === "ban");
    expect(ban).toBeDefined();
    expect(ban?.module).toBe("moderation");
  });

  it("records the permission gate read from source", () => {
    const ban = scanCommands(repoRoot).find((c) => c.name === "ban");
    expect(ban?.defaultMemberPermissions).toBe("BanMembers");
  });
});

describe("scanEnvVars", () => {
  it("finds every variable declared in .env.example", () => {
    expect(scanEnvVars(repoRoot).length).toBe(16);
  });

  it("includes DISCORD_TOKEN", () => {
    expect(scanEnvVars(repoRoot).map((v) => v.name)).toContain("DISCORD_TOKEN");
  });
});

describe("scanDashboardPages", () => {
  it("finds every guild page route", () => {
    expect(scanDashboardPages(repoRoot).length).toBe(18);
  });

  it("maps route filenames to feature ids where they differ", () => {
    const pages = scanDashboardPages(repoRoot);
    expect(pages.find((p) => p.route.endsWith("/rules"))?.featureId).toBe("automation");
    expect(pages.find((p) => p.route.endsWith("/logs"))?.featureId).toBe("logging");
  });
});
