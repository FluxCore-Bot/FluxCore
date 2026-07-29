import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  extractRepoPaths,
  findMissingPaths,
  extractAllowedPaths,
} from "../scripts/verify-doc-paths.mjs";

// This suite is the path guard's own fixture set, so it deliberately cites
// paths that are not real (fabricated app names, truncated template
// fragments, ./ and ../ forms quoted in prose) plus two bare paths that exist
// only under apps/docs and are the exact laundering case under test. They are
// exempted explicitly, via the guard's own escape hatch, rather than by
// contorting the fixtures into something that no longer reproduces the bugs:
// <!-- docs-path-guard: allow apps/docs/content/guide/features/, apps/nonexistent-app, ./x, ../x, ./-prefixed, ../-prefixed, ./scripts/check-coverage.mjs, ./check-coverage.mjs, ./scripts/totally-fake-nonexistent-file.mjs, ../bot/src/index.ts, apps/bot/src/commands/moderation/ban.ts, scripts/check-coverage.mjs, scripts/manifest/build.mjs reason: "deliberately unreal, or intentionally repo-root-absent, fixture paths for the path guard's own test suite" -->

const repoRoot = resolve(__dirname, "../../..");
const cliScript = resolve(__dirname, "../scripts/verify-doc-paths.mjs");

describe("extractRepoPaths", () => {
  it("extracts backticked repo paths", () => {
    expect(extractRepoPaths("See `apps/bot/src/index.ts` for details")).toEqual([
      "apps/bot/src/index.ts",
    ]);
  });

  it("extracts markdown link targets", () => {
    expect(extractRepoPaths("[the schema](packages/database/prisma/schema.prisma)")).toEqual([
      "packages/database/prisma/schema.prisma",
    ]);
  });

  it("ignores URLs", () => {
    expect(extractRepoPaths("see https://example.com/apps/bot/src/x.ts")).toEqual([]);
  });

  it("deduplicates repeated paths", () => {
    expect(extractRepoPaths("`apps/bot/src/index.ts` and `apps/bot/src/index.ts`")).toEqual([
      "apps/bot/src/index.ts",
    ]);
  });

  // Regression test for a bug found mid-implementation: the character class
  // in PATH_PATTERN includes `.`, so an un-backticked path mention that ends
  // a sentence swallowed the sentence-ending period into the match, and the
  // resulting "apps/bot/src/index.ts." was flagged as missing even though
  // the real path exists.
  it("strips a trailing sentence period from an unbackticked path mention", () => {
    expect(extractRepoPaths("as documented in apps/bot/src/index.ts.")).toEqual([
      "apps/bot/src/index.ts",
    ]);
  });

  it("preserves a trailing slash on a directory reference", () => {
    expect(extractRepoPaths("see packages/systems/src/ for the code")).toEqual([
      "packages/systems/src/",
    ]);
  });

  // Regression coverage for the placeholder-segment bug: PATH_PATTERN's
  // character class can't include `<`, `[`, or `{` (they're markdown/link
  // delimiters), so a template path like
  // `apps/docs/content/guide/features/<feature>.mdx` gets truncated at the
  // placeholder boundary into a directory-looking fragment
  // (`apps/docs/content/guide/features/`).
  //
  // A first attempt skipped a templated path entirely rather than check the
  // truncated fragment. That laundered a fabricated top-level path: an
  // agent-authored path like `apps/nonexistent-app/<feature>/thing.ts` has
  // the exact wrong-app-name failure this guard exists to catch, and a
  // placeholder anywhere later in the path made it invisible. The fix
  // checks the STATIC prefix before the first placeholder, limited to its
  // first two path segments — deep enough to catch a wrong app/package
  // name, shallow enough that a not-yet-created content directory still
  // passes.
  describe("template placeholders", () => {
    it("still catches a fabricated top-level path even though a placeholder appears later (the laundering case)", () => {
      const paths = extractRepoPaths("see `apps/nonexistent-app/<feature>/thing.ts`");
      expect(paths).toEqual(["apps/nonexistent-app"]);
      expect(findMissingPaths(paths, repoRoot)).toEqual(["apps/nonexistent-app"]);
    });

    it("reduces a deep templated path to its two-segment static prefix and passes when that prefix exists", () => {
      // The original false positive this feature exists to avoid: apps/docs
      // exists, even though content/guide/features does not.
      const paths = extractRepoPaths(
        "see `apps/docs/content/guide/features/<feature>.mdx` for the template",
      );
      expect(paths).toEqual(["apps/docs"]);
      expect(findMissingPaths(paths, repoRoot)).toEqual([]);
    });

    it("falls back to checking only the first segment when the placeholder IS the second segment", () => {
      const paths = extractRepoPaths("see `packages/<name>/src/index.ts` for the template");
      expect(paths).toEqual(["packages"]);
      expect(findMissingPaths(paths, repoRoot)).toEqual([]);
    });

    it("reduces a [placeholder]-delimited path to its static prefix", () => {
      expect(
        extractRepoPaths("see `apps/docs/content/guide/[locale]/index.mdx` for the template"),
      ).toEqual(["apps/docs"]);
    });

    it("reduces a {placeholder}-delimited path to its static prefix", () => {
      expect(extractRepoPaths("see `apps/docs/content/guide/{slug}.mdx` for the template")).toEqual(
        ["apps/docs"],
      );
    });

    it("still extracts a real path elsewhere in the same content, alongside a templated path's static prefix", () => {
      expect(
        extractRepoPaths("see `apps/bot/src/index.ts` and `apps/docs/content/guide/<feature>.mdx`"),
      ).toEqual(["apps/bot/src/index.ts", "apps/docs"]);
    });
  });

  // Regression coverage for a blind spot found by a later task's review:
  // the LEAD character class allows whitespace/backtick/paren/quote/bracket
  // but not `.`, so a file-relative path (`./x`, `../x`) never matched
  // PATH_PATTERN at all and was completely invisible to the guard. This
  // surfaced when a doc author wrote `node ./scripts/check-coverage.mjs` in
  // apps/docs/package.json to work around the guard blocking the honest
  // `node scripts/check-coverage.mjs` form (which the guard checked against
  // the WRONG anchor — repo root instead of apps/docs). Adding `.` to the
  // lead-char class was explicitly ruled out (it would flag every
  // legitimate workspace-relative path as missing); instead, `./`/`../` is
  // matched as part of the path itself, only once a legitimate lead
  // character already precedes it.
  describe("relative paths", () => {
    it("extracts a ./-prefixed path", () => {
      expect(extractRepoPaths("run `./scripts/check-coverage.mjs`")).toEqual([
        "./scripts/check-coverage.mjs",
      ]);
    });

    it("extracts a ../-prefixed path", () => {
      expect(extractRepoPaths("see `../bot/src/index.ts` for details")).toEqual([
        "../bot/src/index.ts",
      ]);
    });

    it("does not false-positive on prose punctuation that merely resembles a relative path", () => {
      expect(extractRepoPaths("Node.js version 1.2.3/release notes")).toEqual([]);
      expect(extractRepoPaths("an ellipsis case .../scripts/foo.ts")).toEqual([]);
    });
  });
});

describe("findMissingPaths", () => {
  const docsDir = resolve(repoRoot, "apps/docs");
  const docsManifest = resolve(docsDir, "package.json");

  it("returns nothing when every path exists", () => {
    expect(findMissingPaths(["apps/bot/src/index.ts"], repoRoot)).toEqual([]);
  });

  it("flags the stale pre-refactor command path", () => {
    // The exact error CLAUDE.md still contains.
    expect(findMissingPaths(["apps/bot/src/commands/moderation/ban.ts"], repoRoot)).toEqual([
      "apps/bot/src/commands/moderation/ban.ts",
    ]);
  });

  it("accepts directory paths", () => {
    expect(findMissingPaths(["packages/systems/src/"], repoRoot)).toEqual([]);
  });

  describe("relative paths (resolved against docDir, not repoRoot)", () => {
    it("flags a fabricated ./-prefixed path", () => {
      expect(
        findMissingPaths(["./scripts/totally-fake-nonexistent-file.mjs"], repoRoot, docsDir),
      ).toEqual(["./scripts/totally-fake-nonexistent-file.mjs"]);
    });

    it("passes a real ./-prefixed path resolved against the edited file's directory", () => {
      // apps/docs/scripts/check-coverage.mjs is real; repoRoot's idea of
      // "scripts/check-coverage.mjs" is NOT (that's the whole bug).
      expect(findMissingPaths(["./scripts/check-coverage.mjs"], repoRoot, docsDir)).toEqual([]);
    });

    it("treats an unresolvable relative path (no docDir given) as missing rather than silently passing", () => {
      expect(findMissingPaths(["./scripts/check-coverage.mjs"], repoRoot)).toEqual([
        "./scripts/check-coverage.mjs",
      ]);
    });

    it("passes a ../ traversal that stays within the repo", () => {
      // From apps/docs, ../bot/src/index.ts reaches a real file in a
      // different package — still inside the repo, so it's legitimate.
      expect(findMissingPaths(["../bot/src/index.ts"], repoRoot, docsDir)).toEqual([]);
    });

    it("flags a ../ traversal that resolves outside the repo, even if the target happens to exist on the host", () => {
      // This guard verifies REPO paths, not arbitrary filesystem paths. A
      // deep enough ../ chain from apps/docs escapes repoRoot entirely; even
      // though the resolved absolute path (something like /etc/passwd) may
      // exist on the machine running the check, it is not a repo path and
      // must not "pass".
      const escaping = "../".repeat(20) + "etc/passwd";
      expect(findMissingPaths([escaping], repoRoot, docsDir)).toEqual([escaping]);
    });

    it("resolves an explicit ./ against docDir no matter which file is being edited", () => {
      // The bare-path convention below is file-specific; the ./ convention is
      // not. An explicit ./ means "next to me" in the workspace manifest and
      // in a prose page alike.
      expect(
        findMissingPaths(["./scripts/check-coverage.mjs"], repoRoot, docsDir, docsManifest),
      ).toEqual([]);
      expect(
        findMissingPaths(
          ["./scripts/check-coverage.mjs"],
          repoRoot,
          docsDir,
          resolve(docsDir, "index.mdx"),
        ),
      ).toEqual([]);
    });
  });

  // A bare path (no ./ prefix) is a REPO-ROOT claim everywhere except in the
  // workspace manifest, whose script entries npm/pnpm run with the package
  // directory as CWD. The earlier "try docDir first, everywhere" rule was
  // wrong in only one direction, but wrong badly: a page could write
  // `scripts/manifest/build.mjs` — a claim about the repo root, where only
  // migrate-encrypt-session-tokens.ts lives — and have it silently pass
  // because apps/docs/scripts/manifest/build.mjs happens to exist. A false
  // repo-root claim laundering through a name collision with a local file is
  // exactly the fabrication this guard exists to catch.
  describe("bare paths (no ./ prefix)", () => {
    it("treats a bare path in a prose page as a repo-root claim, even when a same-named file sits beside the page", () => {
      // apps/docs/scripts/manifest/build.mjs exists; <repo-root>/scripts does
      // not contain manifest/build.mjs. The page is making a repo-root claim
      // and the claim is false.
      expect(
        findMissingPaths(
          ["scripts/manifest/build.mjs"],
          repoRoot,
          docsDir,
          resolve(docsDir, "index.mdx"),
        ),
      ).toEqual(["scripts/manifest/build.mjs"]);
    });

    it("resolves a bare path against docDir first inside the workspace manifest (npm/pnpm script semantics)", () => {
      // "check-coverage": "node scripts/check-coverage.mjs" runs with the
      // package directory as CWD, so this is an honest local reference.
      expect(
        findMissingPaths(["scripts/check-coverage.mjs"], repoRoot, docsDir, docsManifest),
      ).toEqual([]);
    });

    it("still falls back to repoRoot inside the manifest when there is no local match", () => {
      expect(findMissingPaths(["apps/bot/src/index.ts"], repoRoot, docsDir, docsManifest)).toEqual(
        [],
      );
    });

    it("flags a fabricated repo-root path cited from the manifest too", () => {
      expect(
        findMissingPaths(
          ["apps/bot/src/commands/moderation/ban.ts"],
          repoRoot,
          docsDir,
          docsManifest,
        ),
      ).toEqual(["apps/bot/src/commands/moderation/ban.ts"]);
    });

    it("treats a bare path as a repo-root claim when the edited file is unknown", () => {
      // No docFile means no evidence that the manifest exception applies,
      // and the guard's default must be the strict reading, never the
      // permissive one.
      expect(findMissingPaths(["scripts/check-coverage.mjs"], repoRoot, docsDir)).toEqual([
        "scripts/check-coverage.mjs",
      ]);
    });

    it("falls back to repoRoot when there is no local match, unchanged from the original behavior", () => {
      expect(
        findMissingPaths(["apps/bot/src/commands/moderation/ban.ts"], repoRoot, docsDir),
      ).toEqual(["apps/bot/src/commands/moderation/ban.ts"]);
    });

    it("still checks repoRoot only when docDir is omitted (backward compatible)", () => {
      expect(findMissingPaths(["scripts/check-coverage.mjs"], repoRoot)).toEqual([
        "scripts/check-coverage.mjs",
      ]);
    });
  });

  // Round 5. The manifest exception used to match on basename alone, so ANY
  // file called package.json under apps/docs inherited npm semantics it had
  // no claim to — including an example manifest nested inside doc content,
  // which is a shape documentation about a monorepo will certainly contain.
  // With a junk sibling next to it, that re-opened the very laundering hole
  // the bare-path rule had just closed, one layer up.
  //
  // The exception is now keyed on the file's IDENTITY — its repo-relative
  // path, matched against an explicit set — not on a property it merely
  // exhibits. These fixtures build a throwaway repo in tmpdir so the nested
  // manifest and its colliding sibling are real files on disk, which is the
  // only way the permissive branch can actually be reached.
  describe("the manifest exception is scoped to the real workspace manifest", () => {
    let tmpRoot = "";
    const nestedParts = ["apps", "docs", "content", "fake-nested"];
    const collidingBarePath = "scripts/manifest/build.mjs";
    const manifestLocalScript = "scripts/check-coverage.mjs";

    beforeAll(() => {
      tmpRoot = mkdtempSync(join(tmpdir(), "docs-path-guard-"));
      // An example manifest nested inside doc content, with a junk sibling
      // that collides by name with the bare path the page cites.
      const nested = join(tmpRoot, ...nestedParts);
      mkdirSync(join(nested, "scripts", "manifest"), { recursive: true });
      writeFileSync(join(nested, "package.json"), "{}\n");
      writeFileSync(join(nested, "scripts", "manifest", "build.mjs"), "");
      // The real workspace manifest, with its real local script beside it.
      const real = join(tmpRoot, "apps", "docs");
      mkdirSync(join(real, "scripts"), { recursive: true });
      writeFileSync(join(real, "package.json"), "{}\n");
      writeFileSync(join(real, "scripts", "check-coverage.mjs"), "");
    });

    afterAll(() => {
      if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
    });

    it("denies the exception to a nested package.json, even with a colliding local file", () => {
      const nested = join(tmpRoot, ...nestedParts);
      expect(
        findMissingPaths([collidingBarePath], tmpRoot, nested, join(nested, "package.json")),
      ).toEqual([collidingBarePath]);
    });

    it("still grants the exception to the workspace manifest itself", () => {
      const real = join(tmpRoot, "apps", "docs");
      expect(
        findMissingPaths([manifestLocalScript], tmpRoot, real, join(real, "package.json")),
      ).toEqual([]);
    });

    it("refuses the exception to a bare basename, which identifies no particular file", () => {
      const real = join(tmpRoot, "apps", "docs");
      expect(findMissingPaths([manifestLocalScript], tmpRoot, real, "package.json")).toEqual([
        manifestLocalScript,
      ]);
    });

    it("refuses the exception to a manifest outside the repo root entirely", () => {
      const outside = mkdtempSync(join(tmpdir(), "docs-path-guard-outside-"));
      try {
        mkdirSync(join(outside, "scripts"), { recursive: true });
        writeFileSync(join(outside, "scripts", "check-coverage.mjs"), "");
        writeFileSync(join(outside, "package.json"), "{}\n");
        expect(
          findMissingPaths([manifestLocalScript], tmpRoot, outside, join(outside, "package.json")),
        ).toEqual([manifestLocalScript]);
      } finally {
        rmSync(outside, { recursive: true, force: true });
      }
    });

    it("keeps the real repo's own manifest working — the friction that started this", () => {
      expect(
        findMissingPaths(["scripts/check-coverage.mjs"], repoRoot, docsDir, docsManifest),
      ).toEqual([]);
    });
  });
});

// The escape hatch: a doc page that deliberately cites a path that isn't
// real yet (a self-hosting instruction to create a file, a template example)
// can exempt it with an explicit, reviewable marker that requires a reason.
describe("extractAllowedPaths", () => {
  it("exempts a path named in an allow marker with a reason", () => {
    const content =
      'create the file.\n<!-- docs-path-guard: allow apps/docs/.env.local reason: "guide instructs the reader to create this file; it does not exist in the repo" -->';
    expect(extractAllowedPaths(content).has("apps/docs/.env.local")).toBe(true);
  });

  it("exempts nothing when the marker has an empty reason", () => {
    const content = '<!-- docs-path-guard: allow apps/docs/.env.local reason: "" -->';
    expect(extractAllowedPaths(content).has("apps/docs/.env.local")).toBe(false);
  });

  it("exempts nothing when there is no marker at all", () => {
    expect(extractAllowedPaths("just `apps/bot/src/index.ts`, nothing else").size).toBe(0);
  });

  it("supports multiple comma-separated paths in one marker", () => {
    const content =
      '<!-- docs-path-guard: allow apps/docs/.env.local, apps/docs/.env.production reason: "self-hosting instructions" -->';
    const allowed = extractAllowedPaths(content);
    expect(allowed.has("apps/docs/.env.local")).toBe(true);
    expect(allowed.has("apps/docs/.env.production")).toBe(true);
  });
});

interface ExecFailure {
  status?: number | null;
  stdout?: string;
}

function isExecFailure(err: unknown): err is ExecFailure {
  return typeof err === "object" && err !== null && "status" in err;
}

/** Run the real CLI with the given `args` and `input` piped to stdin. */
function runCliRaw(args: string[], input: string): { stdout: string; status: number } {
  try {
    const stdout = execFileSync(process.execPath, [cliScript, ...args], {
      input,
      encoding: "utf-8",
    });
    return { stdout, status: 0 };
  } catch (err) {
    if (!isExecFailure(err)) throw err;
    return { stdout: err.stdout ?? "", status: err.status ?? 1 };
  }
}

/** Run the real CLI (`verify-doc-paths.mjs --stdin`) with `content` piped in. */
function runCli(content: string): { stdout: string; status: number } {
  return runCliRaw(["--stdin"], content);
}

/** Run the real CLI with only the resolution anchor, and no edited-file identity. */
function runCliWithDocDir(content: string, docDir: string): { stdout: string; status: number } {
  return runCliRaw(["--stdin", "--doc-dir", docDir], content);
}

/**
 * Run the real CLI exactly as `.claude/hooks/docs-path-guard.sh` invokes it:
 * the anchor directory AND the edited file, since the two answer different
 * questions (where a ./ path points, and whose bare-path convention applies).
 */
function runCliAsFile(content: string, docFile: string): { stdout: string; status: number } {
  return runCliRaw(["--stdin", "--doc-dir", dirname(docFile), "--doc-file", docFile], content);
}

describe("CLI (--stdin)", () => {
  it("prints one missing path per line", () => {
    const result = runCli("see `apps/bot/src/commands/moderation/ban.ts`");
    expect(result.status).toBe(0);
    expect(result.stdout.trim().split("\n")).toEqual(["apps/bot/src/commands/moderation/ban.ts"]);
  });

  it("prints nothing when every cited path exists", () => {
    const result = runCli("see `apps/bot/src/index.ts`");
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("");
  });

  it("honors an allow marker end to end, excluding the exempted path from the report", () => {
    const content =
      "see `apps/bot/src/commands/moderation/ban.ts` and `apps/docs/.env.local`\n" +
      '<!-- docs-path-guard: allow apps/docs/.env.local reason: "reader creates this file" -->';
    const result = runCli(content);
    expect(result.stdout.trim().split("\n")).toEqual(["apps/bot/src/commands/moderation/ban.ts"]);
  });

  it("signals failure via a non-zero exit code when invoked without --stdin, rather than silently reporting nothing missing", () => {
    // This is the documented "did not run correctly" path, and it is the
    // contract the hook's fail-closed handling depends on: an internal
    // failure must be observable via the exit code, never indistinguishable
    // from "the verifier ran and found nothing".
    const result = runCliRaw([], "");
    expect(result.status).not.toBe(0);
    expect(result.stdout.trim()).toBe("");
  });

  describe("--doc-dir (relative path resolution, end to end)", () => {
    const docsDir = resolve(repoRoot, "apps/docs");

    it("flags a fabricated ./-prefixed path", () => {
      const result = runCliWithDocDir("run `./scripts/totally-fake-nonexistent-file.mjs`", docsDir);
      expect(result.stdout.trim().split("\n")).toEqual([
        "./scripts/totally-fake-nonexistent-file.mjs",
      ]);
    });

    it("passes the ./ form of a real workspace-relative path", () => {
      const result = runCliWithDocDir(
        '"check-coverage": "node ./scripts/check-coverage.mjs"',
        docsDir,
      );
      expect(result.stdout.trim()).toBe("");
    });
  });

  describe("--doc-file (whose bare-path convention applies, end to end)", () => {
    const docsDir = resolve(repoRoot, "apps/docs");

    it("passes a bare pnpm script path cited from the workspace manifest", () => {
      // Verbatim from the real apps/docs/package.json.
      const result = runCliAsFile(
        '"check-coverage": "node scripts/check-coverage.mjs"',
        resolve(docsDir, "package.json"),
      );
      expect(result.stdout.trim()).toBe("");
    });

    it("flags a false repo-root claim in a prose page that collides with a local file name", () => {
      // The reviewer's repro, verbatim: a page sitting directly in apps/docs,
      // whose sibling apps/docs/scripts/manifest/build.mjs exists, while the
      // repo-root path the page actually claims does not. The page need not
      // exist yet — this is a Write of a new page, which is precisely when
      // fabricated paths get introduced.
      const result = runCliAsFile(
        "see `scripts/manifest/build.mjs` at the repo root",
        resolve(docsDir, "some-top-level-page.mdx"),
      );
      expect(result.stdout.trim().split("\n")).toEqual(["scripts/manifest/build.mjs"]);
    });

    it("flags the same claim from a package.json nested in doc content", () => {
      // Round 5's hole: the exception used to key off the basename, so an
      // example manifest inside content/ collected npm semantics it had no
      // claim to. The colliding sibling does not exist in the real repo, so
      // this asserts the wiring — the CLI hands the file's real identity
      // through — while the collision itself is proven hermetically against
      // findMissingPaths above.
      const result = runCliAsFile(
        "see `scripts/manifest/build.mjs` at the repo root",
        resolve(docsDir, "content/fake-nested/package.json"),
      );
      expect(result.stdout.trim().split("\n")).toEqual(["scripts/manifest/build.mjs"]);
    });

    it("anchors ./ at the edited file's own directory, not at the package root", () => {
      const result = runCliAsFile(
        "run `./check-coverage.mjs` from here",
        resolve(docsDir, "scripts/manifest/build.mjs"),
      );
      // apps/docs/scripts/check-coverage.mjs is real, but ./ from
      // apps/docs/scripts/manifest is not it.
      expect(result.stdout.trim()).toBe("./check-coverage.mjs");
    });
  });
});
