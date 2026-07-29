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
 *   - As a CLI: `node verify-doc-paths.mjs --stdin [--doc-dir <dir>]
 *     [--doc-file <path>] [--allow-from <path>]` reads content from stdin
 *     and prints one missing path per line (used by the docs-path-guard.sh
 *     PreToolUse hook). `--doc-dir` is the anchor a
 *     file-relative path resolves against; `--doc-file` is the file being
 *     edited, whose identity decides which bare-path convention applies.
 *     They are separate flags because they answer separate questions, and
 *     either can be supplied alone (`--doc-dir` is derived from `--doc-file`
 *     when only the latter is given). `--allow-from` names a file whose
 *     allow markers are unioned with the ones in the piped content, so a
 *     marker written elsewhere in a page still exempts a path in an edit
 *     hunk that does not itself contain it. Exits non-zero — and prints nothing to
 *     stdout — if it cannot run as expected (wrong invocation, an uncaught
 *     exception). The caller must treat a non-zero exit as "verification did
 *     not happen," never as "nothing missing": the two are not the same
 *     thing, and conflating them is how a guard fails open silently.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve, relative, isAbsolute, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// The set of characters that really occur in this monorepo's paths.
//
// This class must be as wide as reality, because a match that stops early is
// then checked AS THE WHOLE CLAIM — and a deep prefix that happens to exist
// will silently absorb whatever was fabricated after it. That is why `(`,
// `)` and `@` are here: Next.js route-group directories and npm scope
// directories are exactly the shapes these pages will cite, and truncating
// at them left the surviving prefix (`apps/dashboard/src/client/`, say) to
// pass on its own. Adding a character here is always safer than letting a
// path be cut at it. Markdown's own closing paren is removed afterwards by
// paren balance, in `trimTrailingNoise` — not by refusing to match `)`.
//
// Still excluded, and deliberately: `<`, `[`, `{` (template placeholder
// delimiters — see `shallowTemplatePrefix` for how those reduce) and the
// characters that genuinely close a citation (backtick, whitespace, `,`,
// `;`, `:`).
const PATH_CHARS = String.raw`[\w.$/@()-]`;

// Top-level DIRECTORIES whose contents this guard checks. A path is
// recognised only if it starts with one of these, so anything omitted here
// is not merely under-checked — it is invisible, and a page may fabricate it
// freely.
//
// The original four (`apps`, `packages`, `docs`, `scripts`) covered the
// application code and nothing else. `docker`, `.github` and `.claude` were
// added because the self-hosting and developer sections are largely ABOUT
// those trees: the Caddy config and backup script, the CI workflow, and this
// documentation system's own hooks, agents and settings. Every entry is a
// real directory at the root of this repository.
const TOP_LEVEL_DIRS = ["apps", "packages", "docs", "scripts", "docker", ".github", ".claude"];

// Top-level FILES, matched by their exact name. Same reasoning: a
// self-hosting page that cites the Dockerfile or turbo.json was previously
// making an unverifiable claim.
//
// Deliberately absent: `.env.dev` (gitignored and machine-local, so its
// existence proves nothing about a reader's checkout) and a bare `.env`
// (which correctly does not exist — self-hosting pages tell the reader to
// CREATE it, and flagging that on every page would be noise, not safety).
const TOP_LEVEL_FILES = [
  ".dockerignore",
  ".env.example",
  ".gitleaks.toml",
  ".trivyignore",
  "CLAUDE.md",
  "Dockerfile",
  "README.md",
  "design.md",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  "tsconfig.json",
  "turbo.json",
];

// Families of top-level files whose real members share a stem, written as
// patterns rather than literals so that a plausible-but-fabricated member is
// CHECKED and denied rather than matching nothing and going unchecked. This
// repo has five compose files and pages will name them constantly; a literal
// list would recognise exactly the five that exist and stay silent about a
// sixth that does not. The `\.ya?ml` tail is required, so the bare
// `docker-compose` command name in prose is not mistaken for a path.
//
// <!-- docs-path-guard: allow docker-compose.NOT-REAL.yml reason: "a deliberately fabricated compose file named to show what this family pattern is for" -->
const TOP_LEVEL_FILE_FAMILIES = [String.raw`docker-compose(?:\.[\w-]+)*\.ya?ml`];

/**
 * Escape a literal so it can be embedded in a regular expression. The
 * top-level names are full of `.`, and an unescaped one would match any
 * character — turning `turbo.json` into a pattern that also accepts
 * `turboXjson`.
 * @param {string} literal
 * @returns {string}
 */
function escapeForRegex(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Matches one of:
//   - a repo-root-relative path under a known top-level DIRECTORY,
//   - a known top-level FILE, optionally continued,
//   - a file-relative path starting with a run of `./` or `../` segments,
// preceded by start-of-string, whitespace, a backtick, or an opening
// bracket/paren (the contexts `extractRepoPaths` cares about: inline code
// and markdown link targets). We deliberately do NOT add `.` to that LEAD
// character class — that would treat prose periods as path starts and flag
// every sentence-adjacent word as a fabricated relative path. Instead, the
// dotted alternatives match the dot as part of the PATH itself, only once
// it's already preceded by a legitimate lead character.
//
// The directory and relative alternatives use `*` rather than `+` on the
// trailing class so a placeholder sitting directly in the second segment
// (`packages/<name>/...`, with zero real characters between the slash and
// the placeholder) still produces a match to reduce, instead of not matching
// at all and going unchecked.
//
// The file alternative's continuation is `(?:[./]PATH_CHARS*)?` — a
// remainder is accepted only when it is introduced by `.` or `/`. That is
// what keeps the truncation-laundering shape closed (a fabricated sibling
// like `turbo.json.bak` is matched IN FULL and denied, instead of stopping
// at the real `turbo.json` and passing) while leaving ordinary English
// alone: `Dockerfiles` and `Dockerfile-based` reduce to the real
// `Dockerfile`, which exists, so neither is reported.
//
// <!-- docs-path-guard: allow turbo.json.bak reason: "a deliberately fabricated sibling, named here to explain what the continuation rule catches" -->
const PATH_PATTERN = new RegExp(
  "(?:^|[\\s`(\"[])(" +
    [
      `(?:${TOP_LEVEL_DIRS.map(escapeForRegex).join("|")})\\/${PATH_CHARS}*`,
      `(?:${[
        ...TOP_LEVEL_FILE_FAMILIES,
        // Longest first, so a name that is a prefix of another cannot claim
        // the match before the longer one is tried.
        ...[...TOP_LEVEL_FILES].sort((a, b) => b.length - a.length).map(escapeForRegex),
      ].join("|")})(?:[./]${PATH_CHARS}*)?`,
      `(?:\\.\\.?\\/)+${PATH_CHARS}*`,
    ].join("|") +
    ")",
  "g",
);

// A fenced code block opener: up to three spaces of indentation, then a run
// of at least three backticks or tildes, then an info string. Per CommonMark,
// a BACKTICK fence's info string may not itself contain a backtick — that is
// exactly what stops an inline ``code`` span from being read as a block
// opener — while a tilde fence's may.
const FENCE_OPEN_PATTERN = /^ {0,3}(`{3,}|~{3,})(.*)$/;

// A closer is a run of the same character, at least as long as the opener,
// with nothing after it but whitespace.
const FENCE_CLOSE_PATTERN = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

/**
 * Blank out every fenced code block in `content`, preserving line structure.
 *
 * A fence holds the EXAMPLE's source, not a claim about this repository's
 * layout. A relative import specifier inside a fenced TypeScript block
 * resolves against the example's own directory, and a bare module path
 * inside it is a module specifier rather than a repo path; checking either
 * against this tree answers a question the page never asked. Before this,
 * every developer page and most self-hosting pages — anything that shows
 * code — was blocked on content it had every right to write.
 *
 * This NARROWS the guard on purpose: a fabricated path written inside a
 * fence is no longer checked at all. That is the accepted trade. Inline
 * `code` spans, which is how a real citation is written in these pages, are
 * untouched and still checked.
 *
 * Lines are replaced with empty strings rather than removed so that text on
 * either side of a fence can never be joined into a single line and made to
 * match across the gap.
 * @param {string} content
 * @returns {string}
 */
function stripFencedCodeBlocks(content) {
  const lines = content.split("\n");
  /** @type {string[]} */
  const out = [];
  /** @type {{ char: string, length: number } | null} */
  let openFence = null;

  for (const line of lines) {
    if (openFence === null) {
      const opener = FENCE_OPEN_PATTERN.exec(line);
      if (opener && !(opener[1].startsWith("`") && opener[2].includes("`"))) {
        openFence = { char: opener[1][0], length: opener[1].length };
        out.push("");
        continue;
      }
      out.push(line);
      continue;
    }

    const closer = FENCE_CLOSE_PATTERN.exec(line);
    if (closer && closer[1][0] === openFence.char && closer[1].length >= openFence.length) {
      openFence = null;
    }
    out.push("");
  }

  // An unterminated fence runs to the end of the document, per CommonMark.
  return out.join("\n");
}

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
 * and in first-seen order. Fenced code blocks are removed first (see
 * `stripFencedCodeBlocks`: their contents belong to the example, not to this
 * repo), then URLs, so a path-shaped URL segment (e.g.
 * `https://example.com/apps/bot/src/x.ts`) is never mistaken for a repo
 * path.
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
  const withoutUrls = stripFencedCodeBlocks(content).replace(/https?:\/\/\S+/g, "");
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
    found.add(trimTrailingNoise(raw));
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
 * @param {string} haystack
 * @param {string} character
 * @returns {number}
 */
function countCharacter(haystack, character) {
  let total = 0;
  for (const ch of haystack) {
    if (ch === character) total += 1;
  }
  return total;
}

/**
 * Strip trailing characters that the path regex picks up as part of the
 * match but that are really prose or markdown syntax closing around the
 * path:
 *   - a trailing sentence-ending period (`see apps/bot/src/index.ts.`)
 *   - a trailing comma, semicolon or colon in a list
 *   - an UNBALANCED closing paren, which belongs to the markdown link that
 *     wraps the path (`[text](packages/database/prisma/schema.prisma)`)
 *     rather than to the path itself
 *
 * Paren balance is what lets `)` be a path character (needed so a route
 * group is not truncated at `(`) without breaking markdown link targets: a
 * route group contributes a matched pair and survives, while a link's
 * closer is unmatched and is removed. The two rules alternate until neither
 * applies, so `...schema.prisma).` unwinds correctly in either order.
 *
 * A single trailing slash on an otherwise-valid directory reference (e.g.
 * `packages/systems/src/`) is intentionally preserved — `findMissingPaths`
 * checks it with `existsSync`, which resolves a trailing-slash directory
 * path just fine.
 * @param {string} path
 * @returns {string}
 */
function trimTrailingNoise(path) {
  let out = path;
  for (;;) {
    const withoutPunctuation = out.replace(/[.,;:]+$/, "");
    if (withoutPunctuation !== out) {
      out = withoutPunctuation;
      continue;
    }
    if (out.endsWith(")") && countCharacter(out, ")") > countCharacter(out, "(")) {
      out = out.slice(0, -1);
      continue;
    }
    return out;
  }
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

/**
 * Allow markers already present in the file at `filePath` on disk.
 *
 * The PreToolUse hook only ever sees the EDIT HUNK, so a marker written
 * anywhere else in the same page was invisible and the edit was blocked —
 * which would have recurred on every page whose marker sits at the top and
 * whose later sections are edited one at a time. The caller passes the file
 * being written here, and its markers are unioned with the hunk's.
 *
 * A file that does not exist yet — the Write of a brand-new page — simply
 * contributes no markers. That is "there were none", not "verification could
 * not run", and it must not be confused with the non-zero exit that means
 * the latter. A file that exists but cannot be read still throws, and so
 * still lands on the fail-closed path.
 * @param {string} filePath
 * @returns {Set<string>}
 */
function readAllowMarkersOnDisk(filePath) {
  if (!existsSync(filePath)) return new Set();
  return extractAllowedPaths(readFileSync(filePath, "utf-8"));
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
    const allowFromArg = getFlagValue(process.argv, "--allow-from");
    const paths = extractRepoPaths(content);
    const allowed = extractAllowedPaths(content);
    if (allowFromArg) {
      for (const allowedPath of readAllowMarkersOnDisk(resolve(allowFromArg))) {
        allowed.add(allowedPath);
      }
    }
    const toCheck = paths.filter((p) => !allowed.has(p));
    const missing = findMissingPaths(toCheck, repoRoot, docDir, docFile);
    for (const path of missing) {
      console.log(path);
    }
    return;
  }

  console.error(
    "Usage: verify-doc-paths.mjs --stdin [--doc-dir <dir>] [--doc-file <path>] [--allow-from <path>]",
  );
  process.exitCode = 1;
}

// Only run the CLI when this file is executed directly, not when imported
// by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
