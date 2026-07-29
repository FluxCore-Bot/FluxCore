#!/usr/bin/env node
/**
 * Guard: documentation must never cite a repo path that does not exist.
 *
 * Fabricated paths are the primary failure mode of generated documentation —
 * CLAUDE.md itself still cites a stale pre-refactor command path that has
 * not existed since the move to a feature-sliced layout. This script
 * extracts every path a doc page cites (backticked inline code and markdown
 * link targets) — both repo-root-relative (`apps/...`) and file-relative
 * (`./...`, `../...`) — and checks each one against the real filesystem,
 * never against another doc file.
 *
 * Used two ways:
 *   - As a module: `extractRepoPaths` / `findMissingPaths` / `extractAllowedPaths`
 *     are imported directly by tests and by any other script that wants to
 *     verify paths.
 *   - As a CLI: `node verify-doc-paths.mjs --stdin [--doc-dir <dir>]` reads
 *     content from stdin and prints one missing path per line (used by the
 *     docs-path-guard.sh PreToolUse hook). `--doc-dir` is the directory of
 *     the file being edited, needed to resolve `./`/`../` paths correctly —
 *     see `findMissingPaths` for why that anchor matters. Exits non-zero —
 *     and prints nothing to stdout — if it cannot run as expected (wrong
 *     invocation, an uncaught exception). The caller must treat a non-zero
 *     exit as "verification did not happen," never as "nothing missing":
 *     the two are not the same thing, and conflating them is how a guard
 *     fails open silently.
 */

import { existsSync } from "node:fs";
import { join, resolve, relative, isAbsolute, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Matches either:
//   - a repo-root-relative path starting with one of the known top-level
//     directories (`apps/...`, `packages/...`, `docs/...`, `scripts/...`), or
//   - a file-relative path starting with `./` or `../` (one or more
//     `../`/`./` segments, e.g. `../../foo/bar.ts`).
// preceded by start-of-string, whitespace, a backtick, or an opening
// bracket/paren (the contexts `extractRepoPaths` cares about: inline code
// and markdown link targets). We deliberately do NOT add `.` to that LEAD
// character class — that would treat prose periods as path starts and flag
// every sentence-adjacent word as a fabricated relative path. Instead, the
// `./`/`../` alternative below matches the dot as part of the PATH itself,
// only once it's already preceded by a legitimate lead character.
//
// Excludes trailing punctuation that closes a markdown construct or ends a
// sentence (`)`, `]`, `.`, `,`, backtick are not in the character class), so
// ``` `apps/bot/src/index.ts`. ``` and `[text](apps/foo/bar.ts)` don't pull
// in the closer. Neither alternative's character class includes `<`, `[`,
// or `{` (also markdown/link/template delimiters) — see
// `shallowTemplatePrefix` below for how a match immediately followed by one
// of those is handled. Both alternatives use `*` rather than `+` on the
// trailing class so a placeholder sitting directly in the second segment
// (`packages/<name>/...`, with zero real characters between the slash and
// the placeholder) still produces a match to reduce, instead of not
// matching at all and going unchecked.
const PATH_PATTERN =
  /(?:^|[\s`("[])((?:apps|packages|docs|scripts)\/[\w.$/-]*|(?:\.\.?\/)+[\w.$/-]*)/g;

// Characters that open a template placeholder segment (`<feature>`,
// `[locale]`, `{slug}`). None of them are in PATH_PATTERN's character
// class, so a templated path like
// `apps/docs/content/guide/features/<feature>.mdx` doesn't fail to match —
// it matches short, truncated at the boundary, producing a directory-shaped
// prefix (`apps/docs/content/guide/features/`) that isn't the concrete path
// the author wrote, but also isn't nothing: see `shallowTemplatePrefix`.
const TEMPLATE_PLACEHOLDER_LEAD = new Set(["<", "[", "{"]);

/**
 * Extract every path cited in `content` (backticked inline code, markdown
 * link targets) — both repo-root-relative and file-relative — deduplicated
 * and in first-seen order. URLs are stripped first so a path-shaped URL
 * segment (e.g. `https://example.com/apps/bot/src/x.ts`) is never mistaken
 * for a repo path.
 *
 * A path immediately followed by a template placeholder delimiter (`<`,
 * `[`, `{`) is a templated path, not a concrete one — but a placeholder
 * appearing deep in a path must not launder a fabricated top-level segment
 * (`apps/nonexistent-app/<feature>/thing.ts` is exactly the wrong-app-name
 * mistake this guard exists to catch; the placeholder later in the path
 * doesn't make the app name any less fabricated). So a templated path is
 * reduced to its two-segment static prefix — see `shallowTemplatePrefix` —
 * and that prefix is checked instead of the full path.
 * @param {string} content
 * @returns {string[]}
 */
export function extractRepoPaths(content) {
  const withoutUrls = content.replace(/https?:\/\/\S+/g, "");
  const found = new Set();
  for (const match of withoutUrls.matchAll(PATH_PATTERN)) {
    const raw = match[1];
    const pathStart = match.index + match[0].length - raw.length;
    const nextChar = withoutUrls[pathStart + raw.length];
    if (nextChar !== undefined && TEMPLATE_PLACEHOLDER_LEAD.has(nextChar)) {
      const prefix = shallowTemplatePrefix(raw);
      if (prefix) found.add(prefix);
      continue;
    }
    found.add(trimTrailingPunctuation(raw));
  }
  return [...found];
}

/**
 * Reduce a templated path's static prefix (`raw` — the portion matched
 * before the placeholder) to its first two path segments.
 *
 * Two segments is a deliberate depth: deep enough to catch a wrong
 * app/package name (`apps/nonexistent-app/<feature>/thing.ts` reduces to
 * `apps/nonexistent-app`, which is checked and found missing), shallow
 * enough that a real app's not-yet-created content directory still passes
 * (`apps/docs/content/guide/features/<feature>.mdx` reduces to `apps/docs`,
 * which exists, even though `content/guide/features` does not). When the
 * placeholder IS the second segment (`packages/<name>/src/index.ts`, where
 * `raw` is just `packages/`), there's only one real segment to check, and
 * checking `packages` alone is exactly the fallback: still deep enough to
 * confirm `packages` is a real top-level directory. The same logic applies
 * to a file-relative templated path (`./<feature>.mdx` reduces to `.`,
 * `../<feature>/thing.ts` reduces to `..`) — see `isRelativeSpecifier`,
 * which recognizes a bare `.`/`..` as relative too.
 * @param {string} raw
 * @returns {string | null}
 */
function shallowTemplatePrefix(raw) {
  const segments = raw.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  return segments.slice(0, 2).join("/");
}

/**
 * Strip punctuation that the path regex can pick up as part of the match
 * but that is actually prose/markdown syntax closing around the path, not
 * part of the path itself:
 *   - a trailing sentence-ending period (`see apps/bot/src/index.ts.`)
 *   - a trailing comma or semicolon in a list
 * A single trailing slash on an otherwise-valid directory reference (e.g.
 * `packages/systems/src/`) is intentionally preserved — `findMissingPaths`
 * checks it with `existsSync`, which resolves a trailing-slash directory
 * path just fine.
 * @param {string} path
 * @returns {string}
 */
function trimTrailingPunctuation(path) {
  return path.replace(/[.,;:]+$/, "");
}

/**
 * Whether `p` is a file-relative specifier (`.`, `..`, `./...`, `../...`)
 * rather than a repo-root-relative one.
 * @param {string} p
 * @returns {boolean}
 */
function isRelativeSpecifier(p) {
  return p === "." || p === ".." || p.startsWith("./") || p.startsWith("../");
}

/**
 * Whether the absolute path `candidate` is inside `repoRoot` (or is
 * `repoRoot` itself). Used to stop a `../` chain from resolving outside the
 * repo — see `findMissingPaths`.
 * @param {string} candidate
 * @param {string} repoRoot
 * @returns {boolean}
 */
function isWithinRepo(candidate, repoRoot) {
  const rel = relative(repoRoot, candidate);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/**
 * Filter `paths` down to the ones that do not exist.
 *
 * Resolution depends on the shape of each path:
 *   - A file-relative path (`./x`, `../x`, or bare `.`/`..`) is resolved
 *     against `docDir` — the directory of the file being edited, NOT
 *     `repoRoot`. `./x` written inside `apps/docs/package.json` means
 *     `apps/docs/x`, not `<repo-root>/x`. If `docDir` isn't supplied, a
 *     file-relative path can't be resolved at all and is treated as
 *     missing (fail safe, consistent with how this guard treats any other
 *     "couldn't verify" state). A `../` chain that resolves outside
 *     `repoRoot` entirely is ALSO treated as missing, even if the resolved
 *     path happens to exist on the host filesystem — this guard verifies
 *     REPO paths, not arbitrary filesystem paths, and a doc that "passes"
 *     by pointing at `/etc/passwd` is a worse outcome than a doc that gets
 *     blocked. A `../` chain that stays inside the repo (e.g. reaching from
 *     `apps/docs` into `apps/bot`) is legitimate and checked normally.
 *   - A bare path with no `./`/`../` prefix (including one that happens to
 *     start with a recognized top-level directory name like `scripts/`) is
 *     tried against `docDir` first, falling back to `repoRoot`. This is
 *     what makes `"node scripts/check-coverage.mjs"` inside
 *     `apps/docs/package.json` resolve honestly to
 *     `apps/docs/scripts/check-coverage.mjs` (how npm/pnpm actually runs
 *     that command — relative to the package directory, not the repo
 *     root) while still matching the existing, established convention that
 *     documentation prose writes `apps/bot/src/index.ts` to mean the
 *     repo-root path. If `docDir` isn't supplied, this falls back to the
 *     original repo-root-only behavior.
 * @param {string[]} paths
 * @param {string} repoRoot
 * @param {string} [docDir]
 * @returns {string[]}
 */
export function findMissingPaths(paths, repoRoot, docDir) {
  return paths.filter((p) => {
    if (isRelativeSpecifier(p)) {
      if (!docDir) return true;
      const resolved = resolve(docDir, p);
      if (!isWithinRepo(resolved, repoRoot)) return true;
      return !existsSync(resolved);
    }
    if (docDir) {
      const local = resolve(docDir, p);
      if (isWithinRepo(local, repoRoot) && existsSync(local)) return false;
    }
    return !existsSync(join(repoRoot, p));
  });
}

// Matches `<!-- docs-path-guard: allow <path>[, <path>...] reason: "<why>" -->`.
// Deliberately requires the `reason:` field to be present with a quoted
// value — an empty reason ("") exempts nothing (see extractAllowedPaths).
const ALLOW_MARKER_PATTERN =
  /<!--\s*docs-path-guard:\s*allow\s+([^\n]*?)\s+reason:\s*"([^"]*)"\s*-->/g;

/**
 * Parse `<!-- docs-path-guard: allow <path>[, <path>...] reason: "<why>" -->`
 * markers out of `content`. Each marker names one or more repo-relative
 * paths that are deliberately not real (a self-hosting instruction to
 * create a file, an illustrative example) and exempts them from the
 * missing-path check.
 *
 * A reason is mandatory: a marker with an empty reason exempts nothing.
 * The point of the marker is that skipping the check is a visible,
 * reviewable, justified choice recorded directly in the page — not a
 * silent escape hatch a future edit can widen by accident.
 * @param {string} content
 * @returns {Set<string>}
 */
export function extractAllowedPaths(content) {
  const allowed = new Set();
  for (const match of content.matchAll(ALLOW_MARKER_PATTERN)) {
    const reason = match[2].trim();
    if (!reason) continue;
    for (const rawPath of match[1].split(",")) {
      const trimmed = rawPath.trim();
      if (trimmed) allowed.add(trimmed);
    }
  }
  return allowed;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * @param {string[]} argv
 * @param {string} flag
 * @returns {string | undefined}
 */
function getFlagValue(argv, flag) {
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= argv.length) return undefined;
  return argv[idx + 1];
}

async function main() {
  if (process.argv.includes("--stdin")) {
    const content = await readStdin();
    const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    const docDirArg = getFlagValue(process.argv, "--doc-dir");
    const docDir = docDirArg ? resolve(docDirArg) : undefined;
    const paths = extractRepoPaths(content);
    const allowed = extractAllowedPaths(content);
    const toCheck = paths.filter((p) => !allowed.has(p));
    const missing = findMissingPaths(toCheck, repoRoot, docDir);
    for (const path of missing) {
      console.log(path);
    }
    return;
  }

  console.error("Usage: verify-doc-paths.mjs --stdin [--doc-dir <dir>]");
  process.exitCode = 1;
}

// Only run the CLI when this file is executed directly, not when imported
// by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
