/**
 * CLI: assembles every scanner's output plus `deriveStatus` into
 * `apps/docs/_manifest.json`, the single source that drives every
 * documentation page.
 *
 * Run: pnpm --filter @fluxcore/docs manifest
 *  or: pnpm manifest   (from the apps/docs package directory)
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  scanCommands,
  scanEnvVars,
  scanDashboardPages,
  scanBotFeatures,
  scanEvents,
  scanDashboardServerFeatures,
  scanDashboardClientFeatures,
  scanSystems,
  scanSharedPackages,
  scanPrismaModels,
  scanSpecs,
} from "./scan.mjs";
import { deriveStatus } from "./status.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const defaultRepoRoot = resolve(__dirname, "../../../..");

// --- Canonical feature-id correlation ---------------------------------
//
// packages/systems/src, apps/bot/src/features, apps/dashboard/src/server
// /features, apps/dashboard/src/client/features, docs/features, and the
// dashboard route filenames each name the same product feature slightly
// differently. These tables are the single place that reconciles them
// into one canonical feature id. Every entry below was verified against
// source on 2026-07-29 — this is not derived from CLAUDE.md or
// docs/implementation-plan.md, which are the documents this manifest
// exists to correct.

/** packages/systems/src/<dir> -> canonical id */
const SYSTEM_ID_ALIASES = {
  "scheduled-messages": "scheduled",
  actions: "automation",
};

/**
 * Top-level packages/<name> (excluding packages/systems, scanned
 * per-feature above) -> canonical id, for packages that as a WHOLE back
 * exactly one documented feature. This is deliberately an allowlist, not a
 * blanket "every package is a feature" mapping — audited against source
 * 2026-07-29:
 *  - packages/i18n backs docs/features/i18n-accessibility.md: react-i18next
 *    setup, 48 locale directories under packages/i18n/src/locales, consumed
 *    across the dashboard client and server.
 *  - packages/config, packages/database, packages/types, packages/utils are
 *    cross-cutting infrastructure consumed by every feature, not evidence
 *    for any single one, so they are deliberately absent from this table —
 *    see task-4-report.md for the audit that ruled each one out.
 */
const SHARED_PACKAGE_ALIASES = {
  i18n: "i18n-accessibility",
};

/**
 * Shared alias table for every source keyed by a bare directory-style name:
 * apps/bot/src/features/<dir>, apps/dashboard/src/server/features/<dir>,
 * apps/dashboard/src/client/features/<dir>, and scanDashboardPages()
 * featureId (already passed through scan.mjs's ROUTE_FEATURE_OVERRIDES for
 * rules->automation / logs->logging). These four sources share one naming
 * space, so one table covers all of them — including the `tempvoice` ->
 * `tempVoice` casing mismatch against packages/systems/src/tempVoice.
 */
const FEATURE_DIR_ALIASES = {
  actions: "automation",
  commands: "customCommands",
  roles: "rolePanel",
  security: "antiraid",
  tempvoice: "tempVoice",
};

/** docs/features/<file>.md (id = filename without extension) -> canonical id */
const SPEC_ID_ALIASES = {
  "anti-raid": "antiraid",
  "custom-commands": "customCommands",
  "dashboard-permissions": "permissions",
  "reaction-roles": "rolePanel",
  "scheduled-messages": "scheduled",
  "warn-system": "warnings",
  "welcome-farewell": "welcome",
};

/**
 * Commands that live inside a shared/catch-all bot module (general,
 * moderation) but drive a different canonical feature than their module.
 * Verified per-command against source — see task-4-report.md.
 */
const COMMAND_FEATURE_OVERRIDES = {
  actions: "automation", // apps/bot/src/features/general/commands/actions.ts drives the automation/actions system
  welcome: "welcome",
  rolepanel: "rolePanel",
  warn: "warnings",
  warnings: "warnings",
  clearwarnings: "warnings",
};

/**
 * Feature ids with a spec doc but genuinely no discoverable source, after
 * someone has actually searched and can say so. This must stay empty
 * unless a real search happened — it is not a place to silence the guard
 * below. See task-4-report.md for the audit trail behind any entry added
 * here.
 *
 * Why this exists: a feature with a spec and NO evidence at all is
 * ambiguous between two very different explanations — "genuinely
 * unbuilt" and "the evidence-gathering scanners never looked in the
 * right place" (packages/i18n was the latter: real source, zero
 * evidence, silently reported "planned"). Defaulting to "planned" for
 * that ambiguous case is exactly the failure this manifest exists to
 * eliminate. Requiring an explicit declaration here turns "nobody looked"
 * into a fact someone has to assert, instead of a silent default.
 * @type {string[]}
 */
export const KNOWN_UNBUILT = [];

/**
 * True if `evidence` has nothing beyond (at most) a spec doc — no system,
 * bot feature, server feature, dashboard route, or command was found for
 * it by any scanner.
 * @param {ReturnType<typeof makeEmptyEvidence>} evidence
 */
function hasNoSourceEvidence(evidence) {
  return !(
    evidence.system ||
    evidence.botFeature ||
    evidence.serverFeature ||
    evidence.clientRoute ||
    (evidence.commands ?? []).length > 0
  );
}

/**
 * The guard for the class of bug this file exists to prevent: a feature
 * with a spec doc and zero source evidence, not declared in
 * `KNOWN_UNBUILT`. Exported as a pure function (rather than inlined in
 * `buildManifest`) so it can be unit-tested against synthetic input,
 * independent of the real repo's current scan results.
 * @param {{ id: string, evidence: ReturnType<typeof makeEmptyEvidence> }[]} features
 * @param {string[]} knownUnbuilt
 */
export function findUnexplainedPlanned(features, knownUnbuilt) {
  return features.filter(
    (f) => Boolean(f.evidence.spec) && hasNoSourceEvidence(f.evidence) && !knownUnbuilt.includes(f.id),
  );
}

// --- Screenshot capture checklist --------------------------------------
//
// Deliberately no Playwright capture pipeline: a real dashboard capture
// contains real guild names, member names, avatars, and moderation case
// details, and this is a public site. Placeholders (see
// `../../components/ScreenshotPlaceholder.tsx`) remove any dependency on a
// running stack or a real Discord guild from documentation generation.
// Instead, this emits a checklist a human works through manually, later,
// against a demo guild.

/**
 * The line this whole file exists to guarantee gets read: it must be the
 * very first thing in `SCREENSHOTS.md`, before any heading or preamble.
 */
const SCREENSHOT_PRIVACY_WARNING =
  "> **Before capturing:** these screenshots go on a public site. Capture " +
  "against a demo guild with synthetic members, or scrub guild names, " +
  "member names, avatars, and moderation case details before committing. " +
  "Real member data must never reach `apps/docs/public/`.";

/**
 * Derive a target screenshot filename from a dashboard route's final path
 * segment, e.g. `/guild/$guildId/commands` -> `commands.png`. Routes are
 * already unique per dashboard page (one file per `.tsx` route), so this
 * is collision-free by construction.
 * @param {string} route
 */
function screenshotFilename(route) {
  const stem = route.split("/").filter(Boolean).pop() ?? route;
  return `${stem}.png`;
}

/**
 * Build the manual capture checklist for every dashboard page as Markdown,
 * opening with `SCREENSHOT_PRIVACY_WARNING`. One row per page: target
 * filename, route to visit, what the frame should show, viewport, theme,
 * and the source route file for reference.
 * @param {{ route: string, featureId: string, file: string }[]} dashboardPages
 * @returns {string}
 */
export function buildScreenshotChecklist(dashboardPages) {
  const rows = dashboardPages.map((page) => {
    const filename = screenshotFilename(page.route);
    const frame =
      `Full ${page.featureId} page — sidebar expanded, populated with ` +
      "realistic but synthetic demo data (no real member names, avatars, or case details).";
    return `| \`${filename}\` | \`${page.route}\` | ${frame} | 1440×900 | dark | \`${page.file}\` |`;
  });

  return [
    SCREENSHOT_PRIVACY_WARNING,
    "",
    "# Screenshot Capture Checklist",
    "",
    "One row per dashboard page. Save each capture to " +
      "`apps/docs/public/screenshots/` under the target filename in the " +
      "first column, then reference it from a `<ScreenshotPlaceholder>` " +
      "with a matching `src`.",
    "",
    "| Target filename | Route | What the frame should show | Viewport | Theme | Source |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}

/** @returns {import("./status.mjs").Evidence} */
function makeEmptyEvidence() {
  return {
    system: null,
    botFeature: null,
    serverFeature: null,
    clientRoute: null,
    commands: [],
    spec: null,
  };
}

/**
 * Assemble the full documentation manifest from source.
 * @param {string} repoRoot
 */
export function buildManifest(repoRoot) {
  const commands = scanCommands(repoRoot);
  const envVars = scanEnvVars(repoRoot);
  const dashboardPages = scanDashboardPages(repoRoot);
  const botFeatures = scanBotFeatures(repoRoot);
  const events = scanEvents(repoRoot);
  const serverFeatures = scanDashboardServerFeatures(repoRoot);
  const clientFeatures = scanDashboardClientFeatures(repoRoot);
  const systems = scanSystems(repoRoot);
  const sharedPackages = scanSharedPackages(repoRoot);
  const prismaModels = scanPrismaModels(repoRoot);
  const specs = scanSpecs(repoRoot);

  /** @type {Map<string, ReturnType<typeof makeEmptyEvidence>>} */
  const registry = new Map();
  const entryFor = (id) => {
    if (!registry.has(id)) registry.set(id, makeEmptyEvidence());
    return registry.get(id);
  };

  for (const system of systems) {
    const id = SYSTEM_ID_ALIASES[system.id] ?? system.id;
    entryFor(id).system = system.dir;
  }

  for (const pkg of sharedPackages) {
    const id = SHARED_PACKAGE_ALIASES[pkg.id];
    if (!id) continue; // cross-cutting infrastructure, not feature evidence — see SHARED_PACKAGE_ALIASES
    entryFor(id).system = pkg.dir;
  }

  for (const feature of botFeatures) {
    const id = FEATURE_DIR_ALIASES[feature.id] ?? feature.id;
    entryFor(id).botFeature = feature.dir;
  }

  for (const feature of serverFeatures) {
    const id = FEATURE_DIR_ALIASES[feature.id] ?? feature.id;
    entryFor(id).serverFeature = feature.dir;
  }

  for (const page of dashboardPages) {
    const id = FEATURE_DIR_ALIASES[page.featureId] ?? page.featureId;
    entryFor(id).clientRoute = page.route;
  }

  for (const spec of specs) {
    const id = SPEC_ID_ALIASES[spec.id] ?? spec.id;
    entryFor(id).spec = spec.file;
  }

  for (const command of commands) {
    const rawId = COMMAND_FEATURE_OVERRIDES[command.name] ?? command.module;
    const id = FEATURE_DIR_ALIASES[rawId] ?? rawId;
    const e = entryFor(id);
    e.commands = [...(e.commands ?? []), command.name];
  }

  const features = [...registry.entries()]
    .map(([id, evidence]) => {
      const isReachable = (evidence.commands ?? []).length > 0 || Boolean(evidence.clientRoute);
      return {
        id,
        status: deriveStatus(evidence),
        // Derived, not hand-maintained: anything with no user-facing surface
        // (no commands, no dashboard route) is internal/infrastructure and
        // belongs in the developer section only, never the user guide.
        audience: isReachable ? "user" : "developer",
        evidence,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  // Hard-fail rather than silently write a manifest that reports "planned"
  // for a feature nobody actually confirmed is unbuilt. See KNOWN_UNBUILT
  // and findUnexplainedPlanned above.
  const unexplainedPlanned = findUnexplainedPlanned(features, KNOWN_UNBUILT);
  if (unexplainedPlanned.length > 0) {
    const ids = unexplainedPlanned.map((f) => f.id).join(", ");
    throw new Error(
      `buildManifest: ${unexplainedPlanned.length} feature(s) have a spec doc but zero source ` +
        `evidence (no system, botFeature, serverFeature, clientRoute, or commands found), and ` +
        `are not declared in KNOWN_UNBUILT: ${ids}. Either a scanner failed to find real source ` +
        `for this feature (fix the scanner — this is what happened with packages/i18n), or it is ` +
        `genuinely unbuilt, in which case add it to KNOWN_UNBUILT in build.mjs after you've ` +
        `actually searched and can say so.`,
    );
  }

  // Best-effort: some environments this runs in (e.g. the Docker test
  // container used by `pnpm --filter @fluxcore/docs test`) have neither a
  // git binary nor a mounted .git directory. Losing the commit stamp
  // shouldn't crash the whole manifest build — every other field is still
  // valid and worth having. But losing it silently is its own hazard: a
  // later freshness/staleness check reads this field, and a null value
  // must not look like "nothing to compare" — so warn loudly on stderr
  // every time the lookup fails, in every environment, so a real
  // generation run where git genuinely should have worked doesn't rot
  // undetected.
  let generatedFromCommit = null;
  try {
    generatedFromCommit = execSync("git rev-parse HEAD", {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch (error) {
    generatedFromCommit = null;
    process.stderr.write(
      `[manifest] WARNING: could not determine generatedFromCommit via "git rev-parse HEAD" in ` +
        `${repoRoot} (${error instanceof Error ? error.message : String(error)}). Writing the ` +
        `manifest with generatedFromCommit: null. Any freshness/staleness check reading this ` +
        `field must treat null as "always stale", never as "nothing to compare".\n`,
    );
  }

  return {
    generatedFromCommit,
    generatedAt: new Date().toISOString(),
    features,
    commands,
    envVars,
    dashboardPages,
    botFeatures,
    events,
    serverFeatures,
    clientFeatures,
    systems,
    sharedPackages,
    prismaModels,
    specs,
  };
}

const isMainModule = process.argv[1] === __filename;
if (isMainModule) {
  const manifest = buildManifest(defaultRepoRoot);
  const outPath = join(defaultRepoRoot, "apps/docs/_manifest.json");
  writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
  // eslint-disable-next-line no-console
  console.log(`Wrote ${outPath}`);
  // eslint-disable-next-line no-console
  console.log(`  commit:   ${manifest.generatedFromCommit}`);
  // eslint-disable-next-line no-console
  console.log(`  features: ${manifest.features.length}`);
  // eslint-disable-next-line no-console
  console.log(`  commands: ${manifest.commands.length}`);

  const screenshotsChecklist = buildScreenshotChecklist(manifest.dashboardPages);
  const screenshotsPath = join(defaultRepoRoot, "apps/docs/SCREENSHOTS.md");
  writeFileSync(screenshotsPath, screenshotsChecklist);
  // eslint-disable-next-line no-console
  console.log(`Wrote ${screenshotsPath}`);
  // eslint-disable-next-line no-console
  console.log(`  dashboard pages: ${manifest.dashboardPages.length}`);
}
