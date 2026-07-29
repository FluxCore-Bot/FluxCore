#!/usr/bin/env node
/**
 * Guard: every stylesheet must reach the page through exactly one CSS
 * `@import` graph rooted at `app/global.css`.
 *
 * Why this exists (see task-2-report.md in
 * .superpowers/sdd/2026-07-29-documentation-system/ for the full story):
 * Tailwind 4 only fully reconciles duplicate `@theme` keys (e.g. the
 * built-in `--font-mono`) within the single CSS module graph reachable via
 * `@import 'tailwindcss'`. A second, independent stylesheet pulled in via a
 * plain JS/TSX `import './something.css'` gets processed as its own,
 * separate graph — any theme key it redeclares that collides with one
 * already set upstream is silently dropped, with *no build error*. This bit
 * us once already: `--font-mono` vanished from the compiled output the
 * first time `obsidian.css` was imported directly from `layout.tsx` instead
 * of chained in from `global.css`.
 *
 * This script enforces the fix mechanically instead of relying on a code
 * comment surviving contact with ~70 future documentation pages:
 *
 *   1. No `.ts`/`.tsx` file may `import` a `.css` file directly, except the
 *      one sanctioned entry point (`app/global.css`).
 *   2. Every `.css` file under `apps/docs` (other than `global.css` itself)
 *      must be transitively reachable from `global.css` via CSS `@import`
 *      statements — an unreferenced stylesheet (written but never wired in)
 *      fails the same way a wrongly-wired one does.
 *
 * Run as part of `docs:build` so a violation fails the build, not just a
 * lint pass that's easy to ignore.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GLOBAL_CSS = resolve(ROOT, 'app/global.css');

/** Directories we never want to walk into while scanning source files. */
const SKIP_DIRS = new Set(['node_modules', '.next', 'out', '.source', '.turbo']);

/** @param {string} dir @param {(path: string) => boolean} predicate @returns {string[]} */
function walk(dir, predicate) {
  /** @type {string[]} */
  const found = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      found.push(...walk(full, predicate));
    } else if (predicate(full)) {
      found.push(full);
    }
  }
  return found;
}

const sourceFiles = walk(ROOT, (path) => ['.ts', '.tsx'].includes(extname(path)));
const cssFiles = walk(ROOT, (path) => extname(path) === '.css');

/** @type {string[]} */
const violations = [];

// --- Check 1: no direct JS/TSX import of a .css file other than global.css ---

const JS_CSS_IMPORT = /(?:import|from)\s+['"](\.[^'"]+\.css)['"]/g;

for (const file of sourceFiles) {
  const content = readFileSync(file, 'utf8');
  for (const match of content.matchAll(JS_CSS_IMPORT)) {
    const specifier = match[1];
    const resolved = resolve(dirname(file), specifier);
    if (resolved !== GLOBAL_CSS) {
      violations.push(
        `${relative(ROOT, file)}: imports "${specifier}" directly.\n` +
          `  Only app/global.css may be imported from a .ts/.tsx file. Chain new stylesheets\n` +
          `  in via a CSS @import inside global.css (or a file global.css already imports)\n` +
          `  instead — a second, independently-imported stylesheet silently drops any\n` +
          `  colliding Tailwind @theme key (this happened to --font-mono; see\n` +
          `  .superpowers/sdd/2026-07-29-documentation-system/task-2-report.md).`,
      );
    }
  }
}

// --- Check 2: every .css file is transitively @import-reachable from global.css ---

const CSS_IMPORT = /@import\s+['"](\.[^'"]+)['"]/g;

/** @param {string} cssFile @returns {Set<string>} */
function reachableFrom(cssFile) {
  const visited = new Set([cssFile]);
  const queue = [cssFile];
  while (queue.length > 0) {
    const current = queue.pop();
    if (current === undefined) break;
    let content;
    try {
      content = readFileSync(current, 'utf8');
    } catch {
      continue; // Points outside apps/docs (e.g. a package import) — not ours to check.
    }
    for (const match of content.matchAll(CSS_IMPORT)) {
      const resolved = resolve(dirname(current), match[1]);
      if (!visited.has(resolved)) {
        visited.add(resolved);
        queue.push(resolved);
      }
    }
  }
  return visited;
}

const reachable = reachableFrom(GLOBAL_CSS);

for (const file of cssFiles) {
  if (file === GLOBAL_CSS) continue;
  if (!reachable.has(file)) {
    const fromGlobalCss = relative(dirname(GLOBAL_CSS), file);
    const specifier = fromGlobalCss.startsWith('.') ? fromGlobalCss : `./${fromGlobalCss}`;
    violations.push(
      `${relative(ROOT, file)}: not reachable via @import from app/global.css.\n` +
        `  A stylesheet that's written but never imported anywhere never reaches the page.\n` +
        `  Add \`@import '${specifier}';\` to app/global.css (directly, or via a file it\n` +
        `  already imports).`,
    );
  }
}

if (violations.length > 0) {
  console.error('\n✗ CSS import graph check failed:\n');
  for (const violation of violations) {
    console.error(`  - ${violation}\n`);
  }
  process.exit(1);
}

console.log(
  `✓ CSS import graph check passed (${sourceFiles.length} source files, ${cssFiles.length} stylesheets, all reachable from app/global.css).`,
);
