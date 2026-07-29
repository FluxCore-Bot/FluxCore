// apps/docs/content/guide/features does not exist yet as of this task — only
// one feature page gets written in a later task in this plan. Tests below
// deliberately exercise that not-yet-created directory (see
// "listFeaturePages" and the "nodir" CLI cases).
// <!-- docs-path-guard: allow apps/docs/content/guide/features reason: "directory intentionally does not exist yet; check-coverage.mjs must treat this as zero pages rather than crash, per task-6-brief.md" -->

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  findCoverageGaps,
  deriveUserGuidePage,
  toCoverageManifest,
  listFeaturePages,
} from "../scripts/check-coverage.mjs";

const cliScript = resolve(__dirname, "../scripts/check-coverage.mjs");

// --- Step 1 tests, verbatim from the brief ---------------------------------

const manifest = {
  features: [
    { id: "moderation", status: "shipped", userGuidePage: "guide/features/moderation.mdx" },
    { id: "leveling", status: "shipped", userGuidePage: "guide/features/leveling.mdx" },
  ],
};

describe("findCoverageGaps", () => {
  it("reports nothing when every feature has its page and no extras exist", () => {
    expect(
      findCoverageGaps(manifest, [
        "guide/features/moderation.mdx",
        "guide/features/leveling.mdx",
      ]),
    ).toEqual({ missingPages: [], orphanPages: [] });
  });

  it("reports a manifest entry with no page", () => {
    expect(findCoverageGaps(manifest, ["guide/features/moderation.mdx"]).missingPages).toEqual([
      "guide/features/leveling.mdx",
    ]);
  });

  it("reports a page with no manifest entry", () => {
    expect(
      findCoverageGaps(manifest, [
        "guide/features/moderation.mdx",
        "guide/features/leveling.mdx",
        "guide/features/economy.mdx",
      ]).orphanPages,
    ).toEqual(["guide/features/economy.mdx"]);
  });
});

// --- deriveUserGuidePage -----------------------------------------------
//
// The real _manifest.json (Task 4's output) has no `userGuidePage` field at
// all — only `id`, `status`, `audience`, `evidence`. This is a deliberate
// deviation from the brief's illustrative example manifest above, which
// hardcodes `userGuidePage` on synthetic test fixtures. `deriveUserGuidePage`
// is how the real CLI reconstructs the field the pure `findCoverageGaps`
// function expects.

describe("deriveUserGuidePage", () => {
  it("derives guide/features/<id>.mdx for a user-audience feature", () => {
    expect(deriveUserGuidePage({ id: "moderation", audience: "user" })).toBe(
      "guide/features/moderation.mdx",
    );
  });

  it("returns null for a developer-audience feature — it must never require a user-guide page", () => {
    // auth, guilds, discord, queue are documented in the developer section
    // only. Deriving a page path for them would make findCoverageGaps
    // permanently report them as missing, since no user-guide page for them
    // is ever meant to exist.
    expect(deriveUserGuidePage({ id: "auth", audience: "developer" })).toBeNull();
    expect(deriveUserGuidePage({ id: "guilds", audience: "developer" })).toBeNull();
    expect(deriveUserGuidePage({ id: "discord", audience: "developer" })).toBeNull();
    expect(deriveUserGuidePage({ id: "queue", audience: "developer" })).toBeNull();
  });
});

// --- toCoverageManifest --------------------------------------------------

describe("toCoverageManifest", () => {
  it("excludes developer-audience features entirely, rather than including them with a null page", () => {
    const raw = {
      features: [
        { id: "moderation", status: "shipped", audience: "user" },
        { id: "auth", status: "partial", audience: "developer" },
        { id: "queue", status: "partial", audience: "developer" },
      ],
    };
    const coverage = toCoverageManifest(raw);
    expect(coverage.features.map((f) => f.id)).toEqual(["moderation"]);
    expect(coverage.features[0]?.userGuidePage).toBe("guide/features/moderation.mdx");
  });

  it("produces a manifest that findCoverageGaps never flags as missing for developer-only input", () => {
    // End-to-end proof of the "permanent false failure" risk named in the
    // task: a manifest containing only developer-audience features, run
    // through the real pipeline, must report zero missing pages even when
    // pagePaths is empty.
    const raw = {
      features: [
        { id: "auth", status: "partial", audience: "developer" },
        { id: "guilds", status: "partial", audience: "developer" },
        { id: "discord", status: "partial", audience: "developer" },
        { id: "queue", status: "partial", audience: "developer" },
      ],
    };
    expect(findCoverageGaps(toCoverageManifest(raw), [])).toEqual({
      missingPages: [],
      orphanPages: [],
    });
  });
});

// --- listFeaturePages -----------------------------------------------------

describe("listFeaturePages", () => {
  it("returns [] when the features directory does not exist yet, instead of throwing", () => {
    // apps/docs/content/guide/features doesn't exist at this point in the
    // plan — only one feature page gets written in a later task. A missing
    // directory means "no pages yet", not a crash.
    const nonexistent = join(tmpdir(), "check-coverage-test-does-not-exist-xyz");
    expect(() => listFeaturePages(nonexistent)).not.toThrow();
    expect(listFeaturePages(nonexistent)).toEqual([]);
  });

  it("lists .mdx files in an existing directory as guide/features/<name>.mdx, sorted", () => {
    const dir = mkdtempSync(join(tmpdir(), "check-coverage-test-"));
    try {
      writeFileSync(join(dir, "leveling.mdx"), "# leveling");
      writeFileSync(join(dir, "moderation.mdx"), "# moderation");
      writeFileSync(join(dir, "README.md"), "not a feature page");
      expect(listFeaturePages(dir)).toEqual([
        "guide/features/leveling.mdx",
        "guide/features/moderation.mdx",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not crash on an existing-but-empty directory, and reports no pages", () => {
    const dir = mkdtempSync(join(tmpdir(), "check-coverage-test-empty-"));
    try {
      expect(listFeaturePages(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// --- CLI --------------------------------------------------------------
//
// The CLI reads its manifest and features directory from
// CHECK_COVERAGE_MANIFEST_PATH / CHECK_COVERAGE_FEATURES_DIR when set,
// defaulting to the real apps/docs/_manifest.json and
// apps/docs/content/guide/features. Overriding both lets these tests
// construct exact pass/fail scenarios deterministically, instead of
// depending on the real repo's current (evolving) documentation state.

interface ExecFailure {
  status?: number | null;
  stdout?: string;
  stderr?: string;
}

function isExecFailure(err: unknown): err is ExecFailure {
  return typeof err === "object" && err !== null && "status" in err;
}

function runCli(
  manifestPath: string,
  featuresDir: string,
): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync(process.execPath, [cliScript], {
      encoding: "utf-8",
      env: {
        ...process.env,
        CHECK_COVERAGE_MANIFEST_PATH: manifestPath,
        CHECK_COVERAGE_FEATURES_DIR: featuresDir,
      },
    });
    return { stdout, stderr: "", status: 0 };
  } catch (err) {
    if (!isExecFailure(err)) throw err;
    return { stdout: err.stdout ?? "", stderr: err.stderr ?? "", status: err.status ?? 1 };
  }
}

function writeManifest(dir: string, features: unknown[]): string {
  const path = join(dir, "_manifest.json");
  writeFileSync(path, JSON.stringify({ features }));
  return path;
}

describe("CLI (check-coverage.mjs)", () => {
  it("exits 0 and reports success when every user-facing feature has its page and there are no orphans", () => {
    const workDir = mkdtempSync(join(tmpdir(), "check-coverage-cli-pass-"));
    try {
      const manifestPath = writeManifest(workDir, [
        { id: "moderation", status: "shipped", audience: "user" },
        { id: "leveling", status: "shipped", audience: "user" },
        { id: "auth", status: "partial", audience: "developer" },
      ]);
      const featuresDir = join(workDir, "features");
      mkdirSync(featuresDir);
      writeFileSync(join(featuresDir, "moderation.mdx"), "# moderation");
      writeFileSync(join(featuresDir, "leveling.mdx"), "# leveling");

      const result = runCli(manifestPath, featuresDir);
      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  it("exits non-zero and lists the missing page when a shipped user-facing feature has no page", () => {
    const workDir = mkdtempSync(join(tmpdir(), "check-coverage-cli-missing-"));
    try {
      const manifestPath = writeManifest(workDir, [
        { id: "moderation", status: "shipped", audience: "user" },
      ]);
      const featuresDir = join(workDir, "features");
      mkdirSync(featuresDir);
      // moderation.mdx deliberately not written.

      const result = runCli(manifestPath, featuresDir);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("guide/features/moderation.mdx");
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  it("exits non-zero and lists the orphan page when a page has no manifest entry", () => {
    const workDir = mkdtempSync(join(tmpdir(), "check-coverage-cli-orphan-"));
    try {
      const manifestPath = writeManifest(workDir, [
        { id: "moderation", status: "shipped", audience: "user" },
      ]);
      const featuresDir = join(workDir, "features");
      mkdirSync(featuresDir);
      writeFileSync(join(featuresDir, "moderation.mdx"), "# moderation");
      writeFileSync(join(featuresDir, "economy.mdx"), "# economy — not in the manifest");

      const result = runCli(manifestPath, featuresDir);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("guide/features/economy.mdx");
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  it("treats a not-yet-created features directory as zero pages (exit 0) rather than crashing, when nothing is expected either", () => {
    const workDir = mkdtempSync(join(tmpdir(), "check-coverage-cli-nodir-pass-"));
    try {
      const manifestPath = writeManifest(workDir, [
        { id: "auth", status: "partial", audience: "developer" },
      ]);
      const featuresDir = join(workDir, "features-does-not-exist");

      const result = runCli(manifestPath, featuresDir);
      expect(result.status).toBe(0);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  it("treats a not-yet-created features directory as zero pages without masking a real failure", () => {
    // Same missing-directory situation as above, but this time a
    // user-facing feature genuinely does expect a page. The missing
    // directory must not be silently swallowed into a false "all good".
    const workDir = mkdtempSync(join(tmpdir(), "check-coverage-cli-nodir-fail-"));
    try {
      const manifestPath = writeManifest(workDir, [
        { id: "moderation", status: "shipped", audience: "user" },
      ]);
      const featuresDir = join(workDir, "features-does-not-exist");

      const result = runCli(manifestPath, featuresDir);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("guide/features/moderation.mdx");
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });
});
