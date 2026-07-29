#!/usr/bin/env node
/**
 * Guard: documentation must never cite a repo path that does not exist.
 *
 * Fabricated paths are the primary failure mode of generated documentation —
 * CLAUDE.md itself still cites a stale pre-refactor command path that has
 * not existed since the move to a feature-sliced layout. This script
 * extracts every path a doc page cites (backticked inline code and markdown
 * link targets) and checks each one against the real filesystem, never
 * against another doc file.
 *
 * How a cited path is resolved — one rule, stated once, enforced everywhere:
 *
 *   1. A path that starts with `./` or `../` is explicitly file-relative and
 *      is resolved against the directory of the file being edited.
 *   2. A bare path (no `./` prefix) is a REPO-ROOT claim and is resolved
 *      against the repo root — with exactly one exception:
 *   3. In the workspace manifest apps/docs/package.json, and in no other
 *      file, a bare path is resolved against the package directory first and
 *      the repo root second, because npm/pnpm run a script's arguments with
 *      the package directory as CWD. That is the case, and the only case,
 *      that motivates a local-first fallback.
 *   4. A `../` chain that resolves outside the repo root is always treated
 *      as missing, whatever exists at that location on the host.
 *
 * Rule 3 used to apply to every bare path in every file, which turned a name
 * collision into a laundry service: a page could write a repo-root path that
 * does not exist and pass because a same-named file happened to sit beside
 * the page. A guard that can be satisfied by an unrelated local file is not
 * checking the claim the page actually makes. Narrowing it to "a file called
 * package.json" was not enough either — see `PACKAGE_CWD_RELATIVE_FILES`.
 *
 * Used two ways:
 *   - As a module: `extractRepoPaths` / `findMissingPaths` / `extractAllowedPaths`
 *     are imported directly by tests and by any other script that wants to
 *     verify paths.
 *   - As a CLI: `node verify-doc-paths.mjs --stdin [--doc-dir <dir>] [--doc-file <path>]`
 *     reads content from stdin and prints one missing path per line (used by
 *     the docs-path-guard.sh PreToolUse hook). `--doc-dir` is the anchor a
 *     file-relative path resolves against; `--doc-file` is the file being
 *     edited, whose identity decides which bare-path convention applies.
 *     They are separate flags because they answer separate questions, and
 *     either can be supplied alone (`--doc-dir` is derived from `--doc-file`
 *     when only the latter is given). Exits non-zero — and prints nothing to
 *     stdout — if it cannot run as expected (wrong invocation, an uncaught
 *     exception). The caller must treat a non-zero exit as "verification did
 *     not happen," never as "nothing missing": the two are not the same
 *     thing, and conflating them is how a guard fails open silently.
 */

import { existsSync } from "node:fs";
import { join, resolve, relative, isAbsolute, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Matches either:
//   - a repo-root-relative path starting with one of the known top-level
//     directories (`apps/...`, `packages/...`, `docs/...`, `scripts/...`), or
//   - a file-relative path starting with a run of `./` or `../` segments.
// preceded by start-of-string, whitespace, a backtick, or an opening
// bracket/paren (the contexts `extractRepoPaths` cares about: inline code
// and markdown link targets). We deliberately do NOT add `.` to that LEAD
// character class — that would treat prose periods as path starts and flag
// every sentence-adjacent word as a fabricated relative path. Instead, the
// dotted alternative below matches the dot as part of the PATH itself, only
// once it's already preceded by a legitimate lead character.
//
// Excludes trailing punctuation that closes a markdown construct or ends a
// sentence (`)`, `]`, `.`, `,`, backtick are not in the character class), so
// ``` `apps/bot/src/index.ts`. ``` and `[text](apps/bot/src/index.ts)` don't
// pull in the closer. Neither alternative's character class includes `<`,
// `[`, or `{` (also markdown/link/template delimiters) — see
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
// prefix that isn't the concrete path the author wrote, but also isn't
// nothing: see `shallowTemplatePrefix`.
const TEMPLATE_PLACEHOLDER_LEAD = new Set(["<", "[", "{"]);

// The exhaustive list of files whose bare paths are package-directory-
// relative rather than repo-root-relative, written as repo-root-relative
// paths. See rule 3 in the module docblock.
//
// This is an IDENTITY check, not a property check: "is this file THE
// apps/docs manifest", never "does this file look like a manifest". Keying
// it on the basename let any nested package.json inherit npm semantics it
// had no claim to — an example manifest sitting in a documentation page's
// own directory, which documentation about a monorepo will certainly
// contain — and with a same-named sibling on disk that re-opened the
// laundering hole one layer up. Every hole this guard has had was a
// permissive branch reached from a shape nobody anticipated, so the
// permissive branch now has exactly one key. Widening it is a one-line
// edit, visible in review, and each entry is covered by a test.
const PACKAGE_CWD_RELATIVE_FILES = new Set(["apps/docs/package.json"]);

/**
 * Whether bare paths written inside `docFile` are package-directory-relative
 * rather than repo-root claims.
 *
 * The only way to answer yes is to name a file listed in
 * `PACKAGE_CWD_RELATIVE_FILES`. An absolute path is made repo-relative
 * first; anything that does not identify one of those files — a bare
 * basename, an absent argument, a path outside the repo — answers no, so
 * the strict repo-root reading is always what happens by default.
 * @param {string} repoRoot
 * @param {string} [docFile]
 * @returns {boolean}
 */
function usesPackageCwdSemantics(repoRoot, docFile) {
  if (docFile === undefined) return false;
  const rel = isAbsolute(docFile) ? relative(repoRoot, docFile) : docFile;
  return PACKAGE_CWD_RELATIVE_FILES.has(rel);
}

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
 * (the wrong-app-name mistake this guard exists to catch; a placeholder
 * later in the path doesn't make the app name any less fabricated). So a
 * templated path is reduced to its two-segment static prefix — see
 * `shallowTemplatePrefix` — and that prefix is checked instead of the full
 * path.
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
 * which exists, even though the content subtree does not). When the
 * placeholder IS the second segment (`packages/<name>/src/index.ts`, where
 * `raw` is just `packages/`), there's only one real segment to check, and
 * checking `packages` alone is exactly the fallback: still deep enough to
 * confirm `packages` is a real top-level directory. The same logic applies
 * to a file-relative templated path, which reduces to a bare `.` or `..` —
 * see `isRelativeSpecifier`, which recognizes those as relative too.
 *
 * <!-- docs-path-guard: allow apps/nonexistent-app reason: "a deliberately fabricated app name, quoted here to show what the reduction is meant to catch" -->
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
 * Whether `p` is an explicitly file-relative specifier — it starts with a
 * `./` or `../` segment, or is a bare `.`/`..` left behind by reducing a
 * templated relative path.
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
 * Filter `paths` down to the ones that do not exist, applying the four
 * resolution rules stated in the module docblock.
 *
 * `docDir` is the directory of the file being edited — the anchor an
 * explicitly file-relative path resolves against, NOT the repo root, since
 * a dotted path written inside apps/docs/package.json means a sibling of
 * that file. Without it a file-relative path cannot be resolved at all and
 * is treated as missing (fail safe, consistent with how this guard treats
 * every other "couldn't verify" state).
 *
 * `docFile` is the path of the file being edited, absolute or
 * repo-root-relative. It selects the bare-path convention and nothing else,
 * via `usesPackageCwdSemantics`: bare paths are repo-root claims everywhere
 * except in the one manifest whose script entries npm/pnpm run with the
 * package directory as CWD. Anything that fails to identify that exact file
 * — including an absent argument — gets the strict reading, never the
 * permissive one.
 * @param {string[]} paths
 * @param {string} repoRoot
 * @param {string} [docDir]
 * @param {string} [docFile]
 * @returns {string[]}
 */
export function findMissingPaths(paths, repoRoot, docDir, docFile) {
  const bareResolvesLocally = usesPackageCwdSemantics(repoRoot, docFile);
  return paths.filter((p) => {
    if (isRelativeSpecifier(p)) {
      if (!docDir) return true;
      const resolved = resolve(docDir, p);
      if (!isWithinRepo(resolved, repoRoot)) return true;
      return !existsSync(resolved);
    }
    if (bareResolvesLocally && docDir) {
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
 * markers out of `content`. Each marker names one or more paths that are
 * deliberately not real (a self-hosting instruction to create a file, an
 * illustrative example, a fixture in this guard's own tests) and exempts
 * them from the missing-path check.
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
    const docFileArg = getFlagValue(process.argv, "--doc-file");
    const docDirArg = getFlagValue(process.argv, "--doc-dir");
    const docDir = docDirArg
      ? resolve(docDirArg)
      : docFileArg
        ? dirname(resolve(docFileArg))
        : undefined;
    const docFile = docFileArg ? resolve(docFileArg) : undefined;
    const paths = extractRepoPaths(content);
    const allowed = extractAllowedPaths(content);
    const toCheck = paths.filter((p) => !allowed.has(p));
    const missing = findMissingPaths(toCheck, repoRoot, docDir, docFile);
    for (const path of missing) {
      console.log(path);
    }
    return;
  }

  console.error("Usage: verify-doc-paths.mjs --stdin [--doc-dir <dir>] [--doc-file <path>]");
  process.exitCode = 1;
}

// Only run the CLI when this file is executed directly, not when imported
// by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
