import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Source-level assertion that the server's CSP config has been hardened
// (runtime assertion is omitted because the full server boot pulls in
// discord.js and other heavy modules that aren't test-friendly).
describe("dashboard CSP", () => {
  it("server index.ts CSP config does not contain 'unsafe-inline' in styleSrc", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      resolve(here, "../../src/server/index.ts"),
      "utf8",
    );
    const match = /styleSrc:\s*\[([\s\S]*?)\]/.exec(src);
    expect(match, "styleSrc directive missing").toBeTruthy();
    expect(match![1]).not.toContain("'unsafe-inline'");
  });

  it("server index.ts enables CSP nonces", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      resolve(here, "../../src/server/index.ts"),
      "utf8",
    );
    expect(src).toContain("enableCSPNonces: true");
  });
});
