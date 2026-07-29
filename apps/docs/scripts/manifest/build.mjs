/**
 * CLI: assembles every scanner's output plus `deriveStatus` into
 * `apps/docs/_manifest.json`, the single source that drives every
 * documentation page.
 *
 * Run: node scripts/manifest/build.mjs   (from apps/docs)
 *  or: pnpm --filter @fluxcore/docs manifest
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
    .map(([id, evidence]) => ({ id, status: deriveStatus(evidence), evidence }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const generatedFromCommit = execSync("git rev-parse HEAD", { cwd: repoRoot })
    .toString()
    .trim();

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
}
