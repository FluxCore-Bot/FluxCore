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
  // (`apps/docs/content/guide/features/`). Checking that fragment for
  // existence checks the wrong thing: the fragment is real or missing by
  // coincidence, but the author never wrote a concrete path at all. A
  // templated path must be skipped entirely, not truncated and checked.
  describe("template placeholders", () => {
    it("skips a path with a <placeholder> segment entirely", () => {
      expect(
        extractRepoPaths("see `apps/docs/content/guide/features/<feature>.mdx` for the template"),
      ).toEqual([]);
    });

    it("skips a path with a [placeholder] segment entirely", () => {
      expect(
        extractRepoPaths("see `apps/docs/content/guide/[locale]/index.mdx` for the template"),
      ).toEqual([]);
    });

    it("skips a path with a {placeholder} segment entirely", () => {
      expect(extractRepoPaths("see `apps/docs/content/guide/{slug}.mdx` for the template")).toEqual(
        [],
      );
    });

    it("still extracts a real path elsewhere in the same content", () => {
      expect(
        extractRepoPaths(
          "see `apps/bot/src/index.ts` and `apps/docs/content/guide/<feature>.mdx`",
        ),
      ).toEqual(["apps/bot/src/index.ts"]);
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
});
