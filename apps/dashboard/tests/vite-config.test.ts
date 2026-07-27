import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Source-level assertions on vite.config.ts. We can't load the config at
// runtime inside vitest (esbuild rejects the cache-busting query string),
// so we pin the host-binding logic by inspecting the source text.
const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(here, "../vite.config.ts"), "utf8");

describe("vite.config server.host", () => {
  it("defaults host to 127.0.0.1 (does NOT default to 0.0.0.0)", () => {
    // Must reference VITE_HOST
    expect(src).toContain("VITE_HOST");
    // Must have 127.0.0.1 as the fallback
    expect(src).toMatch(/VITE_HOST[^}]*127\.0\.0\.1/);
    // Must NOT have 0.0.0.0 as a hardcoded default (only via env var)
    expect(src).not.toMatch(/host:\s*["']0\.0\.0\.0["']/);
  });

  it("reads host from process.env.VITE_HOST", () => {
    expect(src).toContain("process.env.VITE_HOST");
  });
});

describe("vite.config server.proxy", () => {
  // The welcome-image preview fetches fonts (/fonts) and uploaded
  // backgrounds (/uploads) that only Fastify serves. If either prefix drops
  // out of the proxy, dev previews silently render with OS-fallback fonts /
  // missing backgrounds — the exact client/server drift the shared renderer
  // exists to remove.
  it.each(["/auth", "/api", "/fonts", "/uploads"])(
    "forwards %s to the dashboard server",
    (prefix) => {
      const entry = new RegExp(`"${prefix}":\\s*\\{\\s*target: "http://localhost:3000"`);
      expect(src).toMatch(entry);
    },
  );
});
