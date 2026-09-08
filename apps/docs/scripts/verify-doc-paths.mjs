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
 *     [--doc-file <path>] [--allow-from <path>] [--hunk-anchor-file <path>]`
 *     reads content from stdin and prints one missing path per line (used by
 *     the docs-path-guard.sh PreToolUse hook). `--doc-dir` is the anchor a
 *     file-relative path resolves against; `--doc-file` is the file being
 *     edited, whose identity decides which bare-path convention applies.
 *     They are separate flags because they answer separate questions, and
 *     either can be supplied alone (`--doc-dir` is derived from `--doc-file`
 *     when only the latter is given). `--allow-from` names the file being
 *     written AS IT STANDS ON DISK, and it does two jobs: its allow markers
 *     are unioned with the ones in the piped content, so a marker written
 *     elsewhere in a page still exempts a path in an edit hunk that does not
 *     itself contain it; and its text supplies the code-fence state the hunk
 *     begins in, because the piped content is only a HUNK and reading it as
 *     a whole document inverts fence parity for any hunk that starts inside
 *     a fence. `--hunk-anchor-file` names a file holding the edit's
 *     `old_string`, which is where in the on-disk file the hunk begins; see
 *     `seedScanStateFor`. Exits non-zero — and prints nothing to
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

// One level of blockquote marker: up to three spaces, `>`, and an optional
// single space of padding. Applied repeatedly, so a nested `> > ` quote
// reduces too. A fence written inside a blockquote — which is how a callout
// or an admonition quotes a command — is a fence, and its contents are the
// example's source exactly as they would be at the margin.
const BLOCKQUOTE_PREFIX_PATTERN = /^ {0,3}>[ \t]?/;

// A fenced code block opener: indentation, then a run of at least three
// backticks or tildes, then an info string. Per CommonMark, a BACKTICK
// fence's info string may not itself contain a backtick — that is exactly
// what stops an inline ``code`` span from being read as a block opener —
// while a tilde fence's may.
//
// CommonMark permits at most three spaces of indentation before a fence at
// the top level; a fence nested inside a list step is indented to the list's
// content column, four or more, and is still a fence there. Rather than
// track list contexts, this accepts any indentation: over-recognising a
// fence only ever exempts more example source, never admits a false claim,
// and an indented run of backticks is not a shape prose produces by
// accident.
const FENCE_OPEN_PATTERN = /^[ \t]*(`{3,}|~{3,})(.*)$/;

// A closer is a run of the same character, at least as long as the opener,
// with nothing after it but whitespace.
const FENCE_CLOSE_PATTERN = /^[ \t]*(`{3,}|~{3,})[ \t]*$/;

// The indentation, in columns, at which a line becomes an INDENTED code
// block — CommonMark's other way of writing example source, and the reason
// the fence rule above cannot simply reject four-space indentation.
const INDENTED_CODE_COLUMNS = 4;

/**
 * How the line scanner reads a document. `fence` is the fence currently open
 * (null when none is); `inIndentedCode` is whether an indented code block is
 * running; `prevBlank` is whether the previous line was blank, which is what
 * decides whether an indented line may OPEN a code block — per CommonMark an
 * indented code block cannot interrupt a paragraph, so a wrapped prose line
 * that happens to sit past column four is still prose, and a citation in it
 * is still a real claim.
 * @typedef {{ char: string, length: number }} OpenFence
 * @typedef {{ fence: OpenFence | null, inIndentedCode: boolean, prevBlank: boolean }} ScanState
 */

/**
 * The state a whole document starts in: nothing open, and "the previous line
 * was blank", since a document may open with an indented code block.
 * @returns {ScanState}
 */
function freshScanState() {
  return { fence: null, inIndentedCode: false, prevBlank: true };
}

/**
 * @param {ScanState} state
 * @returns {ScanState}
 */
function cloneScanState(state) {
  return {
    fence: state.fence === null ? null : { char: state.fence.char, length: state.fence.length },
    inIndentedCode: state.inIndentedCode,
    prevBlank: state.prevBlank,
  };
}

/**
 * @param {ScanState} a
 * @param {ScanState} b
 * @returns {boolean}
 */
function sameScanState(a, b) {
  if (a.inIndentedCode !== b.inIndentedCode || a.prevBlank !== b.prevBlank) return false;
  if (a.fence === null || b.fence === null) return a.fence === b.fence;
  return a.fence.char === b.fence.char && a.fence.length === b.fence.length;
}

/**
 * Remove every leading blockquote marker from `line`.
 * @param {string} line
 * @returns {string}
 */
function stripBlockquoteMarkers(line) {
  let out = line;
  for (;;) {
    const next = out.replace(BLOCKQUOTE_PREFIX_PATTERN, "");
    if (next === out) return out;
    out = next;
  }
}

/**
 * The indentation of `line` in columns, counting a tab as four.
 * @param {string} line
 * @returns {number}
 */
function indentColumns(line) {
  let columns = 0;
  for (const ch of line) {
    if (ch === " ") columns += 1;
    else if (ch === "\t") columns += 4;
    else break;
  }
  return columns;
}

/**
 * Advance `state` across one line, mutating it. Returns true when the line
 * belongs to a code region and must therefore not be scanned — neither for
 * cited paths nor for allow markers.
 *
 * `conservative` is true only when the caller has NO idea where this line
 * really sits in the document (see `main`'s double-unlocatable case). A bare
 * fence marker — a run of backticks/tildes with no info string — is shaped
 * exactly like BOTH an opener and a closer; `FENCE_CLOSE_PATTERN` matches it
 * too. With real context that ambiguity never matters, because the scanner
 * already knows whether a fence is open. Without it, treating the marker as
 * an opener is a guess, and a wrong guess in that direction hides every line
 * that follows — the "seventh occurrence" hole this parameter closes. So in
 * conservative mode a bare marker never opens a fence; it is left as an
 * ordinary line and still checked. An opener WITH an info string (```ts) is
 * never ambiguous — `FENCE_CLOSE_PATTERN` requires nothing but whitespace
 * after the backticks, so it can never also be a closer — and still opens
 * normally even in conservative mode.
 * @param {ScanState} state
 * @param {string} rawLine
 * @param {boolean} [conservative]
 * @returns {boolean}
 */
function stepScanState(state, rawLine, conservative) {
  const line = stripBlockquoteMarkers(rawLine);

  if (state.fence !== null) {
    const closer = FENCE_CLOSE_PATTERN.exec(line);
    if (closer && closer[1][0] === state.fence.char && closer[1].length >= state.fence.length) {
      state.fence = null;
    }
    state.prevBlank = false;
    return true;
  }

  if (line.trim() === "") {
    state.prevBlank = true;
    return true;
  }

  // Checked before the fence opener so that a run of backticks appearing
  // INSIDE an already-running indented code block cannot open a fence and
  // swallow the prose that follows the block.
  if (state.inIndentedCode) {
    if (indentColumns(line) >= INDENTED_CODE_COLUMNS) {
      state.prevBlank = false;
      return true;
    }
    state.inIndentedCode = false;
  }

  const opener = FENCE_OPEN_PATTERN.exec(line);
  if (opener && !(opener[1].startsWith("`") && opener[2].includes("`"))) {
    const isAmbiguousBareMarker = conservative && FENCE_CLOSE_PATTERN.test(line);
    if (!isAmbiguousBareMarker) {
      state.fence = { char: opener[1][0], length: opener[1].length };
      state.prevBlank = false;
      return true;
    }
  }

  if (state.prevBlank && indentColumns(line) >= INDENTED_CODE_COLUMNS) {
    state.inIndentedCode = true;
    state.prevBlank = false;
    return true;
  }

  state.prevBlank = false;
  return false;
}

/**
 * Blank out every code region in `content` — fenced blocks and indented code
 * blocks alike — preserving line structure.
 *
 * A code region holds the EXAMPLE's source, not a claim about this
 * repository's layout. A relative import specifier inside a fenced
 * TypeScript block resolves against the example's own directory, and a bare
 * module path inside it is a module specifier rather than a repo path;
 * checking either against this tree answers a question the page never asked.
 * Before this, every developer page and most self-hosting pages — anything
 * that shows code — was blocked on content it had every right to write.
 *
 * This NARROWS the guard on purpose: a fabricated path written inside a code
 * region is no longer checked at all. That is the accepted trade. Inline
 * `code` spans, which is how a real citation is written in these pages, are
 * untouched and still checked.
 *
 * `seed` is the state the scan starts in. It is null for a whole document,
 * and non-null only when the caller has established where a partial hunk sits
 * inside the file on disk — see `seedScanStateFor`.
 *
 * `conservative` is passed straight through to `stepScanState`: see its
 * docblock. It matters only when `seed` is null but the content is still a
 * fragment of a larger document whose surrounding context is unknown, not a
 * whole document in its own right — `main` is the only caller that can tell
 * the two apart, so it is the only caller that ever passes `true`.
 *
 * Lines are replaced with empty strings rather than removed so that text on
 * either side of a code region can never be joined into a single line and
 * made to match across the gap.
 * @param {string} content
 * @param {ScanState | null} [seed]
 * @param {boolean} [conservative]
 * @returns {string}
 */
function stripCodeRegions(content, seed, conservative) {
  const state = seed ? cloneScanState(seed) : freshScanState();
  // An unterminated fence runs to the end of the document, per CommonMark.
  return content
    .split("\n")
    .map((line) => (stepScanState(state, line, conservative) ? "" : line))
    .join("\n");
}

/**
 * The state a whole-document scan of `fileContent` would be in at the start
 * of the line where `needle` begins — or null when that cannot be answered
 * unambiguously.
 *
 * This is what makes an Edit hunk readable at all. The hook hands the
 * verifier only the new text, and a hunk that begins inside a fenced block
 * has inverted fence parity read on its own: the guard then flags the fenced
 * lines it should exempt AND falls silent on the prose after the hunk's
 * closing fence, which is where the real citations are. Seeding the scan with
 * the state the file is actually in at that point fixes both directions.
 *
 * Returns null — meaning "fall back to the whole-document assumption" — when
 * the needle is absent, or occurs at several places whose states disagree, or
 * occurs implausibly often. That fallback OVER-checks (it reads fenced lines
 * as prose) rather than under-checking, so an unlocatable hunk is noisy, never
 * silently unchecked.
 * @param {string} fileContent
 * @param {string} needle
 * @returns {ScanState | null}
 */
function seedScanStateFor(fileContent, needle) {
  if (!needle) return null;
  const lines = fileContent.split("\n");
  /** @type {ScanState | null} */
  let agreed = null;
  let occurrences = 0;
  let from = 0;
  for (;;) {
    const at = fileContent.indexOf(needle, from);
    if (at === -1) break;
    occurrences += 1;
    if (occurrences > MAX_ANCHOR_OCCURRENCES) return null;
    const state = freshScanState();
    const lineIndex = countCharacter(fileContent.slice(0, at), "\n");
    for (let i = 0; i < lineIndex && i < lines.length; i += 1) {
      stepScanState(state, lines[i]);
    }
    if (agreed === null) agreed = state;
    else if (!sameScanState(agreed, state)) return null;
    from = at + 1;
  }
  return agreed;
}

// A needle that matches this many times is not identifying a position; it is
// boilerplate. Give up and use the whole-document fallback rather than pay to
// rescan the file once per hit.
const MAX_ANCHOR_OCCURRENCES = 8;

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
 * and in first-seen order. Code regions are removed first (see
 * `stripCodeRegions`: their contents belong to the example, not to this
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
 *
 * `seed` is the scan state `content` begins in. It is non-null only when
 * `content` is a partial edit hunk whose position in the file on disk has
 * been established; omitting it reads `content` as a whole document.
 *
 * `conservative` — see `stepScanState` — is for the one case that is neither
 * of those: a hunk whose position could NOT be established, but which is
 * still known to be a fragment rather than a whole document. Passing it
 * keeps a bare fence marker from opening a fence it cannot actually place,
 * which would otherwise hide every line after it.
 * @param {string} content
 * @param {ScanState | null} [seed]
 * @param {boolean} [conservative]
 * @returns {string[]}
 */
export function extractRepoPaths(content, seed, conservative) {
  const withoutUrls = stripCodeRegions(content, seed, conservative).replace(
    /https?:\/\/\S+/g,
    "",
  );
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
 *
 * Markers are read from the SAME fence-stripped text the paths are, and for
 * the same reason. Parsing them from raw content instead made the two halves
 * of the guard disagree about what a code fence means: a page documenting
 * this very syntax — the reference page for this system will — would have
 * turned its own illustrative example into a live exemption covering the
 * whole page, invisibly, with nothing in review to show that it had. An
 * example of a marker is not a marker.
 *
 * `seed` carries the same meaning as in `extractRepoPaths`, and must be the
 * same value, or a hunk's markers and its paths would be read against
 * different notions of where the code regions are. `conservative` likewise
 * must match whatever was passed to `extractRepoPaths` for the same content.
 * @param {string} content
 * @param {ScanState | null} [seed]
 * @param {boolean} [conservative]
 * @returns {Set<string>}
 */
export function extractAllowedPaths(content, seed, conservative) {
  const allowed = new Set();
  for (const match of stripCodeRegions(content, seed, conservative).matchAll(
    ALLOW_MARKER_PATTERN,
  )) {
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
 * The contents of `filePath`, or undefined when it does not exist.
 *
 * The file on disk answers two questions the edit hunk cannot. It holds the
 * allow markers written elsewhere in the same page — the PreToolUse hook only
 * ever sees the hunk, so a marker at the top of a page was invisible while a
 * later section was being edited, and the edit was blocked even though the
 * exemption was already there, with a reason. And it holds the surrounding
 * text that says whether the hunk begins inside a code fence, which decides
 * whether the hunk's own lines are prose or example source.
 *
 * A file that does not exist yet — the Write of a brand-new page — simply
 * contributes neither. That is "there was nothing to read", not "verification
 * could not run", and it must not be confused with the non-zero exit that
 * means the latter. A file that exists but cannot be read still throws, and
 * so still lands on the fail-closed path.
 * @param {string | undefined} filePath
 * @returns {string | undefined}
 */
function readFileIfPresent(filePath) {
  if (filePath === undefined) return undefined;
  const abs = resolve(filePath);
  if (!existsSync(abs)) return undefined;
  return readFileSync(abs, "utf-8");
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

    // The file as it stands on disk, and where in it this hunk begins.
    //
    // `old_string` is the better locator and is tried first: Edit requires it
    // to appear in the file, whereas the NEW text usually does not yet. The
    // piped content is the fallback locator, which covers a Write and an Edit
    // whose new text is already present. If neither can be placed the seed
    // stays null, and there are two different reasons that can happen, which
    // must NOT be treated the same:
    //
    //   - `onDiskContent` is undefined (no file on disk yet — a Write of a
    //     brand-new page). Then `content` IS the whole document, not a
    //     fragment of a larger one, and reading it fresh from the top is
    //     exactly correct — there is no surrounding context to have missed.
    //
    //   - `onDiskContent` exists but neither locator could place the hunk in
    //     it. The hunk is still known to be only a FRAGMENT of that larger
    //     document, just one whose position is unknown. Scanning it fresh
    //     here is a guess about context that provably does not exist yet —
    //     and a bare fence marker at the top of the hunk is exactly as
    //     likely to be the CLOSER of a fence that opened before the hunk as
    //     it is to be an opener. Guessing "opener" hides everything after it.
    //     `conservative` (passed to `extractRepoPaths`/`extractAllowedPaths`)
    //     is what keeps that guess from ever removing a check: a bare marker
    //     in this mode never opens a fence, so nothing downstream can be
    //     hidden by one. See `stepScanState`.
    const onDiskContent = readFileIfPresent(getFlagValue(process.argv, "--allow-from"));
    const anchorContent = readFileIfPresent(getFlagValue(process.argv, "--hunk-anchor-file"));
    /** @type {ScanState | null} */
    let seed = null;
    let conservative = false;
    if (onDiskContent !== undefined) {
      if (anchorContent !== undefined) seed = seedScanStateFor(onDiskContent, anchorContent);
      if (seed === null) seed = seedScanStateFor(onDiskContent, content);
      conservative = seed === null;
    }

    const paths = extractRepoPaths(content, seed, conservative);
    // Markers deliberately do NOT get `conservative`. Paths and markers read
    // the same fence-stripped text for the same reason everywhere else in
    // this file, but conservative mode exists to bias path-checking toward
    // "check more" — and reusing it here would also bias markers toward
    // "grant more": a marker written inside what really is a bare-delimited
    // fenced example would stop being hidden the moment the fence around it
    // stops being recognised, and start exempting a real citation elsewhere
    // on the page (the exact laundering shape this guard closed once
    // already). The two directions are not symmetric: under-checking a path
    // is the danger the whole fallback exists to prevent, but under-granting
    // a marker is merely an extra denial, never a hole. So markers keep the
    // plain, unbiased scan — worst case an ambiguous bare marker reads as an
    // opener and a legitimate marker goes unrecognised, which fails closed.
    const allowed = extractAllowedPaths(content, seed);
    if (onDiskContent !== undefined) {
      for (const allowedPath of extractAllowedPaths(onDiskContent)) {
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
    "Usage: verify-doc-paths.mjs --stdin [--doc-dir <dir>] [--doc-file <path>]" +
      " [--allow-from <path>] [--hunk-anchor-file <path>]",
  );
  process.exitCode = 1;
}

// Only run the CLI when this file is executed directly, not when imported
// by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
