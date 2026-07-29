import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import {
  extractRepoPaths,
  findMissingPaths,
  extractAllowedPaths,
} from "../scripts/verify-doc-paths.mjs";

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
        extractRepoPaths(
          "see `apps/bot/src/index.ts` and `apps/docs/content/guide/<feature>.mdx`",
        ),
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
    const docsDir = resolve(repoRoot, "apps/docs");

    it("flags a fabricated ./-prefixed path", () => {
      expect(
        findMissingPaths(["./scripts/totally-fake-nonexistent-file.mjs"], repoRoot, docsDir),
      ).toEqual(["./scripts/totally-fake-nonexistent-file.mjs"]);
    });

    it("passes a real ./-prefixed path resolved against the edited file's directory", () => {
      // apps/docs/scripts/check-coverage.mjs is real; apps/docs is repoRoot's
      // idea of "scripts/check-coverage.mjs" is NOT (that's the whole bug).
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
  });

  describe("bare relative paths (no ./ prefix)", () => {
    const docsDir = resolve(repoRoot, "apps/docs");

    it("resolves a bare path against docDir first, honestly matching how pnpm scripts actually run", () => {
      // "scripts" is also a recognized repo-root top-level directory, so
      // this path is ambiguous on its face. Package.json "scripts" entries
      // are always shell-CWD-relative (the package directory), never
      // repo-root-relative, so checking the local directory first is the
      // behavior that matches reality.
      expect(findMissingPaths(["scripts/check-coverage.mjs"], repoRoot, docsDir)).toEqual([]);
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

/** Run the real CLI with a --doc-dir flag, exactly as the hook invokes it. */
function runCliWithDocDir(content: string, docDir: string): { stdout: string; status: number } {
  return runCliRaw(["--stdin", "--doc-dir", docDir], content);
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
      'see `apps/bot/src/commands/moderation/ban.ts` and `apps/docs/.env.local`\n' +
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
      const result = runCliWithDocDir(
        "run `./scripts/totally-fake-nonexistent-file.mjs`",
        docsDir,
      );
      expect(result.stdout.trim().split("\n")).toEqual([
        "./scripts/totally-fake-nonexistent-file.mjs",
      ]);
    });

    it("passes the real workspace-relative path that motivated this fix", () => {
      // This is the exact content that used to force the ./ workaround:
      // "scripts/check-coverage.mjs" bare, checked against apps/docs.
      const result = runCliWithDocDir('"check-coverage": "node scripts/check-coverage.mjs"', docsDir);
      expect(result.stdout.trim()).toBe("");
    });

    it("passes the ./ form of the same real path", () => {
      const result = runCliWithDocDir(
        '"check-coverage": "node ./scripts/check-coverage.mjs"',
        docsDir,
      );
      expect(result.stdout.trim()).toBe("");
    });
  });
});
