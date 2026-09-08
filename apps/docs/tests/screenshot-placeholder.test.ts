// tsc rejects a `.tsx`-suffixed import specifier here (TS5097 — the
// project does not set `allowImportingTsExtensions`), so this import must
// be extensionless. The docs-path-guard hook's existsSync check is
// literal and does not do TypeScript module resolution, so it cannot see
// that "../components/ScreenshotPlaceholder" resolves to the real,
// existing ScreenshotPlaceholder.tsx.
// <!-- docs-path-guard: allow ../components/ScreenshotPlaceholder reason: "real file at apps/docs/components/ScreenshotPlaceholder.tsx; tsc forbids the .tsx-suffixed import specifier (TS5097) that would satisfy the guard's literal existsSync check" -->
import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decideScreenshotRender, humanizeRoute, screenshotFileExists } from "../components/ScreenshotPlaceholder";

describe("humanizeRoute — no router pattern reaches reader-visible prose", () => {
  it("names the page from the last non-parameter segment", () => {
    expect(humanizeRoute("/guild/$guildId/moderation")).toBe("Moderation");
  });

  it("never echoes a $-prefixed parameter, whatever its position", () => {
    expect(humanizeRoute("/guild/$guildId/cases/$caseId")).toBe("Cases");
    expect(humanizeRoute("/$guildId")).toBe("dashboard");
  });

  it("splits kebab-case and camelCase segments into words", () => {
    expect(humanizeRoute("/guild/$guildId/role-panels")).toBe("Role Panels");
    expect(humanizeRoute("/guild/$guildId/tempVoice")).toBe("Temp Voice");
  });

  it("falls back to a generic word rather than the raw pattern", () => {
    expect(humanizeRoute("/")).toBe("dashboard");
    expect(humanizeRoute("")).toBe("dashboard");
  });
});

describe("screenshotFileExists", () => {
  it("returns true when the file exists under the given public dir", () => {
    const dir = mkdtempSync(join(tmpdir(), "fc-screenshots-"));
    try {
      mkdirSync(join(dir, "screenshots"), { recursive: true });
      writeFileSync(join(dir, "screenshots", "commands.png"), "fake-png-bytes");
      expect(screenshotFileExists("/screenshots/commands.png", dir)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns false when the file does not exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "fc-screenshots-"));
    try {
      expect(screenshotFileExists("/screenshots/missing.png", dir)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("decideScreenshotRender — the component's two branches", () => {
  it("decides to render the real image when the file exists at build time", () => {
    const dir = mkdtempSync(join(tmpdir(), "fc-screenshots-"));
    try {
      mkdirSync(join(dir, "screenshots"), { recursive: true });
      writeFileSync(join(dir, "screenshots", "commands.png"), "fake-png-bytes");
      const decision = decideScreenshotRender(
        {
          src: "/screenshots/commands.png",
          alt: "Commands page",
          route: "/guild/$guildId/commands",
        },
        dir,
      );
      expect(decision).toEqual({
        kind: "image",
        src: "/screenshots/commands.png",
        alt: "Commands page",
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("decides to render the placeholder, captioned with the route, when the file is absent", () => {
    const dir = mkdtempSync(join(tmpdir(), "fc-screenshots-"));
    try {
      const decision = decideScreenshotRender(
        {
          src: "/screenshots/commands.png",
          alt: "Commands page",
          route: "/guild/$guildId/commands",
        },
        dir,
      );
      expect(decision).toEqual({
        kind: "placeholder",
        alt: "Commands page",
        route: "/guild/$guildId/commands",
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
