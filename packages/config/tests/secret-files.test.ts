import { describe, it, expect, beforeEach } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveSecretFiles } from "../src/secret-files";

describe("resolveSecretFiles", () => {
  beforeEach(() => {
    delete process.env.DISCORD_TOKEN;
    delete process.env.DISCORD_TOKEN_FILE;
  });

  it("loads value from a *_FILE path into the base var", () => {
    const dir = mkdtempSync(join(tmpdir(), "sec-"));
    const path = join(dir, "token");
    writeFileSync(path, "abc123\n");
    process.env.DISCORD_TOKEN_FILE = path;
    resolveSecretFiles(["DISCORD_TOKEN"]);
    expect(process.env.DISCORD_TOKEN).toBe("abc123");
  });

  it("leaves base var alone if no *_FILE present", () => {
    process.env.DISCORD_TOKEN = "literal";
    resolveSecretFiles(["DISCORD_TOKEN"]);
    expect(process.env.DISCORD_TOKEN).toBe("literal");
  });

  it("throws when both are set", () => {
    process.env.DISCORD_TOKEN = "literal";
    process.env.DISCORD_TOKEN_FILE = "/nope";
    expect(() => resolveSecretFiles(["DISCORD_TOKEN"])).toThrow(/both/i);
  });
});
