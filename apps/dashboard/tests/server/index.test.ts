import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Source-level assertion that the server's CSP config has been hardened.
// The helmet options live in shared/security.ts (see security.test.ts for the
// runtime behavior — nonces injected, no unsafe-inline, /api/* serves 200).
describe("dashboard CSP", () => {
  const readSecuritySrc = () => {
    const here = dirname(fileURLToPath(import.meta.url));
    return readFileSync(
      resolve(here, "../../src/server/shared/security.ts"),
      "utf8",
    );
  };

  it("CSP config does not contain 'unsafe-inline' in styleSrc", () => {
    const src = readSecuritySrc();
    const match = /styleSrc:\s*\[([\s\S]*?)\]/.exec(src);
    expect(match, "styleSrc directive missing").toBeTruthy();
    expect(match![1]).not.toContain("'unsafe-inline'");
  });

  it("enables CSP nonces", () => {
    expect(readSecuritySrc()).toContain("enableCSPNonces: true");
  });
});
