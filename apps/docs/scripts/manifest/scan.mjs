/**
 * Source-tree scanners that feed the documentation manifest.
 *
 * These read the real repo directly — never CLAUDE.md, docs/PROJECT_INDEX.md,
 * or docs/implementation-plan.md — because those files document a pre-refactor
 * layout and mark shipped modules "Not Started". This file is the source of
 * truth instead.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, basename } from "node:path";

/**
 * @typedef {Object} CommandOption
 * @property {string} type
 * @property {string} name
 * @property {string | null} description
 * @property {boolean} required
 */

/**
 * @typedef {Object} Subcommand
 * @property {string} name
 * @property {string | null} description
 * @property {CommandOption[]} options
 */

/**
 * @typedef {Object} ScannedCommand
 * @property {string} name
 * @property {string | null} description
 * @property {string} module
 * @property {string} file - repo-relative path
 * @property {string | null} defaultMemberPermissions
 * @property {CommandOption[]} options
 * @property {Subcommand[]} subcommands
 */

/**
 * @typedef {Object} ScannedEnvVar
 * @property {string} name
 * @property {string | null} defaultValue
 * @property {string | null} description
 */

/**
 * @typedef {Object} ScannedDashboardPage
 * @property {string} route
 * @property {string} featureId
 * @property {string} file - repo-relative path
 */

// Client route filenames do not always match feature directory names.
// This is not derivable from the filename alone — encode the known
// mismatches explicitly. (Verified against source 2026-07-29; only these two.)
const ROUTE_FEATURE_OVERRIDES = {
  rules: "automation",
  logs: "logging",
};

const OPTION_METHOD_PATTERN = /^add([A-Za-z]+)Option$/;

/** Recursively list files under `dir` matching `predicate`, skipping node_modules/.git. */
function walk(dir, predicate, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, predicate, out);
    } else if (entry.isFile() && predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

function listDirs(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

/**
 * Find the index of the matching closing paren for the '(' at `openIndex`,
 * respecting string literals (so a description like "Days to delete (0-7)"
 * doesn't throw off the depth count).
 * @param {string} text
 * @param {number} openIndex
 * @returns {number} index of the matching ')', or -1
 */
function findMatchingParen(text, openIndex) {
  let depth = 0;
  let inString = null;
  let escaped = false;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === inString) {
        inString = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Parse a `.method(args).method(args)...` chain starting at `pos`.
 * @param {string} text
 * @param {number} pos
 * @returns {{ method: string, argsText: string }[]}
 */
function parseChain(text, pos) {
  const calls = [];
  let i = pos;
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i])) i++;
    if (text[i] !== ".") break;
    i++;
    const nameMatch = /^[A-Za-z_$][\w$]*/.exec(text.slice(i));
    if (!nameMatch) break;
    const method = nameMatch[0];
    i += method.length;
    while (i < text.length && /\s/.test(text[i])) i++;
    if (text[i] !== "(") break;
    const close = findMatchingParen(text, i);
    if (close === -1) break;
    const argsText = text.slice(i + 1, close);
    calls.push({ method, argsText });
    i = close + 1;
  }
  return calls;
}

/** Extract the first quoted string literal from `text`, or null. */
function firstStringLiteral(text) {
  const match = /["'`]((?:\\.|[^"'`\\])*)["'`]/.exec(text);
  return match ? match[1] : null;
}

/**
 * Given the args text of an `addSubcommand(...)` / `addXOption(...)` call —
 * an arrow function like `(sub) => sub.setName(...).setDescription(...)` —
 * parse the inner method chain.
 * @param {string} argsText
 * @returns {{ method: string, argsText: string }[]}
 */
function parseArrowBodyChain(argsText) {
  const arrowMatch = /=>\s*([A-Za-z_$][\w$]*)/.exec(argsText);
  if (!arrowMatch) return [];
  const chainStart = arrowMatch.index + arrowMatch[0].length;
  return parseChain(argsText, chainStart);
}

/** @param {{ method: string, argsText: string }[]} calls */
function parseOption(method, argsText) {
  const typeMatch = OPTION_METHOD_PATTERN.exec(method);
  const type = typeMatch ? typeMatch[1].charAt(0).toLowerCase() + typeMatch[1].slice(1) : method;
  const inner = parseArrowBodyChain(argsText);
  const nameCall = inner.find((c) => c.method === "setName");
  const descCall = inner.find((c) => c.method === "setDescription");
  const requiredCall = inner.find((c) => c.method === "setRequired");
  return {
    type,
    name: nameCall ? firstStringLiteral(nameCall.argsText) ?? "" : "",
    description: descCall ? firstStringLiteral(descCall.argsText) : null,
    required: requiredCall ? requiredCall.argsText.trim() === "true" : false,
  };
}

/** @param {{ method: string, argsText: string }[]} calls */
function parseSubcommand(argsText) {
  const inner = parseArrowBodyChain(argsText);
  const nameCall = inner.find((c) => c.method === "setName");
  const descCall = inner.find((c) => c.method === "setDescription");
  const options = inner
    .filter((c) => OPTION_METHOD_PATTERN.test(c.method))
    .map((c) => parseOption(c.method, c.argsText));
  return {
    name: nameCall ? firstStringLiteral(nameCall.argsText) ?? "" : "",
    description: descCall ? firstStringLiteral(descCall.argsText) : null,
    options,
  };
}

/**
 * Scan every slash command file in the feature-sliced bot layout.
 * @param {string} repoRoot
 * @returns {ScannedCommand[]}
 */
export function scanCommands(repoRoot) {
  const featuresDir = join(repoRoot, "apps/bot/src/features");
  const moduleNames = listDirs(featuresDir);
  const results = [];

  for (const moduleName of moduleNames) {
    const commandsDir = join(featuresDir, moduleName, "commands");
    const files = walk(commandsDir, (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    for (const file of files.sort()) {
      const content = readFileSync(file, "utf-8");
      const ctorMatch = /new\s+SlashCommandBuilder\s*\(\s*\)/.exec(content);
      if (!ctorMatch) continue;

      const calls = parseChain(content, ctorMatch.index + ctorMatch[0].length);
      const nameCall = calls.find((c) => c.method === "setName");
      if (!nameCall) continue;
      const descCall = calls.find((c) => c.method === "setDescription");
      const permCall = calls.find((c) => c.method === "setDefaultMemberPermissions");

      let defaultMemberPermissions = null;
      if (permCall) {
        const perms = [...permCall.argsText.matchAll(/PermissionFlagsBits\.(\w+)/g)].map(
          (m) => m[1],
        );
        defaultMemberPermissions = perms.length > 0 ? perms.join(" | ") : null;
      }

      const options = calls
        .filter((c) => OPTION_METHOD_PATTERN.test(c.method))
        .map((c) => parseOption(c.method, c.argsText));

      const subcommands = calls
        .filter((c) => c.method === "addSubcommand")
        .map((c) => parseSubcommand(c.argsText));

      results.push({
        name: firstStringLiteral(nameCall.argsText) ?? "",
        description: descCall ? firstStringLiteral(descCall.argsText) : null,
        module: moduleName,
        file: relative(repoRoot, file),
        defaultMemberPermissions,
        options,
        subcommands,
      });
    }
  }

  return results;
}

/**
 * Parse `.env.example` for declared variables. The comment line immediately
 * preceding a `NAME=value` line (if any) is captured as its description.
 * Never reads `.env` itself.
 * @param {string} repoRoot
 * @returns {ScannedEnvVar[]}
 */
export function scanEnvVars(repoRoot) {
  const filePath = join(repoRoot, ".env.example");
  const lines = readFileSync(filePath, "utf-8").split("\n");
  const varPattern = /^([A-Z_0-9]+)=(.*)$/;
  const results = [];

  for (let i = 0; i < lines.length; i++) {
    const match = varPattern.exec(lines[i]);
    if (!match) continue;

    const [, name, value] = match;
    let description = null;
    const prevLine = i > 0 ? lines[i - 1].trim() : "";
    if (prevLine.startsWith("#")) {
      description = prevLine.replace(/^#\s?/, "").trim();
    }

    results.push({
      name,
      defaultValue: value.trim() === "" ? null : value.trim(),
      description,
    });
  }

  return results;
}

/**
 * Scan dashboard guild page routes and map each to its owning feature id.
 * @param {string} repoRoot
 * @returns {ScannedDashboardPage[]}
 */
export function scanDashboardPages(repoRoot) {
  const routesDir = join(repoRoot, "apps/dashboard/src/client/routes/guild/$guildId");
  let entries;
  try {
    entries = readdirSync(routesDir, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".tsx"))
    .map((e) => {
      const stem = basename(e.name, ".tsx");
      const featureId = ROUTE_FEATURE_OVERRIDES[stem] ?? stem;
      return {
        route: `/guild/$guildId/${stem}`,
        featureId,
        file: relative(repoRoot, join(routesDir, e.name)),
      };
    })
    .sort((a, b) => a.route.localeCompare(b.route));
}

/**
 * Scan `apps/bot/src/features/*` module directories.
 * @param {string} repoRoot
 * @returns {{ id: string, dir: string }[]}
 */
export function scanBotFeatures(repoRoot) {
  const dir = join(repoRoot, "apps/bot/src/features");
  return listDirs(dir)
    .sort()
    .map((name) => ({ id: name, dir: relative(repoRoot, join(dir, name)) }));
}

/**
 * Scan `apps/bot/src/events/*.ts` gateway event handlers.
 * @param {string} repoRoot
 * @returns {{ name: string, file: string }[]}
 */
export function scanEvents(repoRoot) {
  const dir = join(repoRoot, "apps/bot/src/events");
  const files = walk(dir, (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
  return files
    .sort()
    .map((file) => ({ name: basename(file, ".ts"), file: relative(repoRoot, file) }));
}

/**
 * Scan `apps/dashboard/src/server/features/*` directories.
 * @param {string} repoRoot
 * @returns {{ id: string, dir: string }[]}
 */
export function scanDashboardServerFeatures(repoRoot) {
  const dir = join(repoRoot, "apps/dashboard/src/server/features");
  return listDirs(dir)
    .sort()
    .map((name) => ({ id: name, dir: relative(repoRoot, join(dir, name)) }));
}

/**
 * Scan `apps/dashboard/src/client/features/*` directories.
 * @param {string} repoRoot
 * @returns {{ id: string, dir: string }[]}
 */
export function scanDashboardClientFeatures(repoRoot) {
  const dir = join(repoRoot, "apps/dashboard/src/client/features");
  return listDirs(dir)
    .sort()
    .map((name) => ({ id: name, dir: relative(repoRoot, join(dir, name)) }));
}

/**
 * Scan shared systems in `packages/systems/src/*` (directories only —
 * this intentionally includes `queue`, which is infrastructure, not a
 * user-facing feature).
 * @param {string} repoRoot
 * @returns {{ id: string, dir: string }[]}
 */
export function scanSystems(repoRoot) {
  const dir = join(repoRoot, "packages/systems/src");
  return listDirs(dir)
    .sort()
    .map((name) => ({ id: name, dir: relative(repoRoot, join(dir, name)) }));
}

/**
 * Scan top-level `packages/*` directories, excluding `packages/systems`
 * (already scanned per-feature by scanSystems() above). `packages/systems`
 * is not the only place shared source can live — e.g. `packages/i18n` is a
 * whole package that backs one feature (internationalization) rather than
 * a per-feature subdirectory. Most of what this returns (config, database,
 * types, utils) is cross-cutting infrastructure consumed by every feature,
 * not evidence for any single one — callers must apply an explicit,
 * verified alias before treating an entry here as feature evidence; do not
 * assume every result maps to a feature.
 * @param {string} repoRoot
 * @returns {{ id: string, dir: string }[]}
 */
export function scanSharedPackages(repoRoot) {
  const dir = join(repoRoot, "packages");
  return listDirs(dir)
    .filter((name) => name !== "systems")
    .sort()
    .map((name) => ({ id: name, dir: relative(repoRoot, join(dir, name)) }));
}

/**
 * Scan Prisma model declarations.
 * @param {string} repoRoot
 * @returns {string[]}
 */
export function scanPrismaModels(repoRoot) {
  const filePath = join(repoRoot, "packages/database/prisma/schema.prisma");
  const content = readFileSync(filePath, "utf-8");
  return [...content.matchAll(/^model\s+(\w+)/gm)].map((m) => m[1]);
}

/**
 * Scan feature spec docs under `docs/features/*.md`.
 * @param {string} repoRoot
 * @returns {{ id: string, file: string }[]}
 */
export function scanSpecs(repoRoot) {
  const dir = join(repoRoot, "docs/features");
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => ({
      id: basename(e.name, ".md"),
      file: relative(repoRoot, join(dir, e.name)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export { ROUTE_FEATURE_OVERRIDES };
