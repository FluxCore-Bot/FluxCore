#!/usr/bin/env node
/**
 * Guard: documentation coverage must be complete in BOTH directions —
 * every user-facing feature in the manifest has a guide page, and every
 * guide page corresponds to a real manifest entry. An orphan page (one
 * nobody can reach from the manifest) is as much a defect as a feature
 * nobody documented; both make "is the documentation complete?" require
 * reading ~70 files by hand instead of running one command.
 *
 * --- Manifest shape note -----------------------------------------------
 *
 * The real manifest at apps/docs/_manifest.json (built by
 * apps/docs/scripts/manifest/build.mjs, Task 4) does NOT carry a
 * `userGuidePage` field on its features — only `id`, `status`, `audience`,
 * and `evidence`. `findCoverageGaps` below still takes a manifest shaped
 * with `userGuidePage` per feature (that contract is fixed by its tests
 * and by downstream callers), so `deriveUserGuidePage` / `toCoverageManifest`
 * bridge the real manifest into that shape before comparison.
 *
 * The derivation is `guide/features/<id>.mdx` for every feature whose
 * `audience` is `"user"`. Features with `audience: "developer"` (`auth`,
 * `guilds`, `discord`, `queue` today) are documented in the developer
 * section only and must never be required to have a user-guide page —
 * `toCoverageManifest` drops them entirely rather than deriving a null
 * page for them, so `findCoverageGaps` (which does a plain `!==` /
 * `.includes` comparison, not a null-aware one) never treats their
 * absence as a gap.
 *
 * --- Page discovery ------------------------------------------------------
 *
 * <!-- docs-path-guard: allow apps/docs/content/guide/features, apps/docs/content/guide/features/ reason: "directory intentionally does not exist yet; check-coverage.mjs must treat this as zero pages rather than crash, per task-6-brief.md" -->
 * `listFeaturePages` walks apps/docs/content/guide/features/
 * **non-recursively**: one `.mdx` file per feature, named `<id>.mdx`,
 * matching how `deriveUserGuidePage` derives the expected path. That
 * directory does not exist yet in this repo — only one feature page gets
 * written in a later task in this plan, the rest later still. A missing
 * directory means "no pages exist yet", which is a legitimate (if
 * currently guaranteed-failing, since shipped user-facing features still
 * expect pages) state, not a crash. `listFeaturePages` returns `[]` for it
 * via an explicit ENOENT check; any other read error still propagates, so
 * a real failure (e.g. permissions) is never silently swallowed into
 * "nothing missing".
 *
 * --- CLI -------------------------------------------------------------
 *
 * Wired as the `check-coverage` package script (see apps/docs/package.json,
 * run from apps/docs). Reads the manifest and features directory from
 * `CHECK_COVERAGE_MANIFEST_PATH` / `CHECK_COVERAGE_FEATURES_DIR` when set
 * (used by tests to construct exact scenarios without depending on the
 * real repo's current, evolving documentation state), defaulting to the
 * real apps/docs/_manifest.json and apps/docs/content/guide/features.
 * Prints both gap lists and sets `process.exitCode = 1` if either is
 * non-empty — never `0` — so a caller that trusts the exit code (CI, a
 * pre-commit hook) actually gets blocked instead of silently passing. See
 * verify-doc-paths.mjs (same directory) for the same fail-closed shape and
 * the incident that made it non-negotiable here.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DOCS_ROOT = resolve(__dirname, "..");
const DEFAULT_MANIFEST_PATH = join(DOCS_ROOT, "_manifest.json");
const DEFAULT_FEATURES_DIR = join(DOCS_ROOT, "content/guide/features");

/**
 * Derive the expected user-guide page path for a feature, or `null` when
 * that feature has no user-guide page to begin with.
 *
 * `audience: "developer"` features (auth, guilds, discord, queue) are
 * documented in the developer section only — they must never require a
 * user-guide page, so this returns `null` for them rather than a path that
 * will never exist.
 * @param {{ id: string, audience: string }} feature
 * @returns {string | null}
 */
export function deriveUserGuidePage(feature) {
  if (feature.audience !== "user") return null;
  return `guide/features/${feature.id}.mdx`;
}

/**
 * Bridge a real manifest (features carrying `audience`, no `userGuidePage`)
 * into the shape `findCoverageGaps` expects: only `audience: "user"`
 * features, each with its derived (always non-null) `userGuidePage`.
 *
 * Developer-audience features are dropped here, not mapped to a null page —
 * `findCoverageGaps` does a plain equality/`.includes` comparison and has
 * no concept of "null means exempt", so leaving them in with a null page
 * would make them appear as a permanently missing page.
 * @param {{ features: { id: string, audience: string }[] }} manifest
 * @returns {{ features: { id: string, audience: string, userGuidePage: string }[] }}
 */
export function toCoverageManifest(manifest) {
  return {
    features: manifest.features
      .filter((feature) => feature.audience === "user")
      .map((feature) => ({
        ...feature,
        userGuidePage: /** @type {string} */ (deriveUserGuidePage(feature)),
      })),
  };
}

/**
 * Compare a manifest's expected user-guide pages against the pages that
 * actually exist, in both directions.
 * @param {{ features: { userGuidePage: string }[] }} manifest
 * @param {string[]} pagePaths
 * @returns {{ missingPages: string[], orphanPages: string[] }}
 */
export function findCoverageGaps(manifest, pagePaths) {
  const expected = manifest.features.map((f) => f.userGuidePage);
  const actual = new Set(pagePaths);
  return {
    missingPages: expected.filter((p) => !actual.has(p)),
    orphanPages: pagePaths.filter((p) => !expected.includes(p)),
  };
}

/** @param {unknown} error @returns {error is NodeJS.ErrnoException} */
function isErrnoException(error) {
  return error instanceof Error && "code" in error;
}

/**
 * List every feature guide page under `featuresDir`, as
 * `guide/features/<file>.mdx`, sorted. `featuresDir` is walked
 * non-recursively — one `.mdx` file per feature is expected directly
 * inside it, matching `deriveUserGuidePage`'s `guide/features/<id>.mdx`
 * shape.
 *
 * A `featuresDir` that does not exist yet is "no pages yet", not an error:
 * returns `[]` rather than throwing. Any other read failure (permissions,
 * etc.) still propagates — only ENOENT is treated as empty, so a real
 * failure is never mistaken for "nothing missing".
 * @param {string} featuresDir
 * @returns {string[]}
 */
export function listFeaturePages(featuresDir) {
  /** @type {import("node:fs").Dirent[]} */
  let entries;
  try {
    entries = readdirSync(featuresDir, { withFileTypes: true });
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
    .map((entry) => `guide/features/${entry.name}`)
    .sort();
}

/**
 * @param {string} manifestPath
 * @returns {{ features: { id: string, audience: string }[] }}
 */
function readManifest(manifestPath) {
  return JSON.parse(readFileSync(manifestPath, "utf-8"));
}

function main() {
  const manifestPath = process.env.CHECK_COVERAGE_MANIFEST_PATH ?? DEFAULT_MANIFEST_PATH;
  const featuresDir = process.env.CHECK_COVERAGE_FEATURES_DIR ?? DEFAULT_FEATURES_DIR;

  const manifest = readManifest(manifestPath);
  const coverageManifest = toCoverageManifest(manifest);
  const pagePaths = listFeaturePages(featuresDir);
  const { missingPages, orphanPages } = findCoverageGaps(coverageManifest, pagePaths);

  if (missingPages.length === 0 && orphanPages.length === 0) {
    console.log(
      `✓ Documentation coverage check passed (${pagePaths.length} feature page(s), ` +
        `${coverageManifest.features.length} user-facing feature(s)).`,
    );
    return;
  }

  console.error("\n✗ Documentation coverage check failed:\n");
  if (missingPages.length > 0) {
    console.error("  Manifest entries with no page:");
    for (const page of missingPages) console.error(`    - ${page}`);
  }
  if (orphanPages.length > 0) {
    console.error("  Pages with no manifest entry:");
    for (const page of orphanPages) console.error(`    - ${page}`);
  }
  console.error("");
  // Never leave this as the default 0 — a caller that trusts the exit code
  // (CI, a pre-commit hook) must actually be blocked. See the file header.
  process.exitCode = 1;
}

// Only run the CLI when this file is executed directly, not when imported
// by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
