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
// <!-- docs-path-guard: allow apps/docs/content/guide/features/, apps/nonexistent-app, ./x, ../x, ./-prefixed, ../-prefixed, ./scripts/check-coverage.mjs, ./check-coverage.mjs, ./scripts/totally-fake-nonexistent-file.mjs, ../bot/src/index.ts, apps/bot/src/commands/moderation/ban.ts, scripts/check-coverage.mjs, scripts/manifest/build.mjs, apps/dashboard/src/client/(auth), apps/dashboard/src/client/(auth)/FAKE.tsx, apps/dashboard/src/client/(auth)/page.tsx, packages/database/@fluxcore/FAKE.ts, packages/database/@fluxcore/index.ts reason: "deliberately unreal, or intentionally repo-root-absent, fixture paths for the path guard's own test suite" -->

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

  // Round 6. PATH_PATTERN truncated at any character outside its class, and
  // the surviving prefix was then checked AS THE WHOLE CLAIM — so a deep
  // prefix that happens to exist swallowed the fabricated remainder:
  // `apps/dashboard/src/client/(auth)/FAKE.tsx` was checked as
  // `apps/dashboard/src/client/`, which exists, and allowed. Next.js route
  // groups and npm scope directories are exactly what this monorepo's pages
  // will cite, so `(`, `)` and `@` are path characters now and the whole
  // path gets checked. Markdown's own closing paren is stripped by paren
  // balance, not by treating `)` as a terminator.
  describe("route groups and scoped package names", () => {
    it("extracts a route-group path in full instead of truncating at the paren", () => {
      expect(extractRepoPaths("see `apps/dashboard/src/client/(auth)/FAKE.tsx`")).toEqual([
        "apps/dashboard/src/client/(auth)/FAKE.tsx",
      ]);
    });

    it("extracts a scoped-package path in full instead of truncating at the @", () => {
      expect(extractRepoPaths("see `packages/database/@fluxcore/FAKE.ts`")).toEqual([
        "packages/database/@fluxcore/FAKE.ts",
      ]);
    });

    it("still strips a markdown link's own closing paren", () => {
      expect(extractRepoPaths("[the schema](packages/database/prisma/schema.prisma)")).toEqual([
        "packages/database/prisma/schema.prisma",
      ]);
    });

    it("keeps a balanced route group inside a markdown link target", () => {
      // Two closers, one opener: the unbalanced one belongs to the link.
      expect(
        extractRepoPaths("[the page](apps/dashboard/src/client/(auth)/page.tsx)"),
      ).toEqual(["apps/dashboard/src/client/(auth)/page.tsx"]);
    });

    it("strips a sentence period after a closing route group", () => {
      expect(extractRepoPaths("it lives in apps/dashboard/src/client/(auth).")).toEqual([
        "apps/dashboard/src/client/(auth)",
      ]);
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

// Round 6, the checking half. A truncated match used to be checked as if it
// were the whole claim, so a deep prefix that exists absorbed whatever was
// fabricated after it. No route-group or scoped directory is tracked
// anywhere in this repo today, so the legitimate shapes are built as real
// files in a throwaway repo — the closest equivalent available, and the only
// way to prove the fix does not simply deny both shapes outright.
describe("truncation must not launder a fabricated remainder", () => {
  it("flags a fabricated path behind a route group", () => {
    const paths = extractRepoPaths("see `apps/dashboard/src/client/(auth)/FAKE.tsx`");
    expect(findMissingPaths(paths, repoRoot)).toEqual([
      "apps/dashboard/src/client/(auth)/FAKE.tsx",
    ]);
  });

  it("flags a fabricated path behind a scoped package directory", () => {
    const paths = extractRepoPaths("see `packages/database/@fluxcore/FAKE.ts`");
    expect(findMissingPaths(paths, repoRoot)).toEqual(["packages/database/@fluxcore/FAKE.ts"]);
  });

  describe("against a throwaway repo where both shapes are real", () => {
    let tmpRoot = "";

    beforeAll(() => {
      tmpRoot = mkdtempSync(join(tmpdir(), "docs-path-guard-shapes-"));
      const routeGroup = join(tmpRoot, "apps", "dashboard", "src", "client", "(auth)");
      mkdirSync(routeGroup, { recursive: true });
      writeFileSync(join(routeGroup, "page.tsx"), "");
      const scoped = join(tmpRoot, "packages", "database", "@fluxcore");
      mkdirSync(scoped, { recursive: true });
      writeFileSync(join(scoped, "index.ts"), "");
    });

    afterAll(() => {
      if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
    });

    it("passes a real route-group path", () => {
      const paths = extractRepoPaths("see `apps/dashboard/src/client/(auth)/page.tsx`");
      expect(paths).toEqual(["apps/dashboard/src/client/(auth)/page.tsx"]);
      expect(findMissingPaths(paths, tmpRoot)).toEqual([]);
    });

    it("passes a real scoped-package path", () => {
      const paths = extractRepoPaths("see `packages/database/@fluxcore/index.ts`");
      expect(paths).toEqual(["packages/database/@fluxcore/index.ts"]);
      expect(findMissingPaths(paths, tmpRoot)).toEqual([]);
    });

    it("still flags a fabricated file inside a route group that really exists", () => {
      // The sharpest form: the truncation prefix exists in this very repo,
      // so the old code allowed it; only checking the whole path catches it.
      const paths = extractRepoPaths("see `apps/dashboard/src/client/(auth)/FAKE.tsx`");
      expect(findMissingPaths(paths, tmpRoot)).toEqual([
        "apps/dashboard/src/client/(auth)/FAKE.tsx",
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

  // Whole-branch review, F2. The hook reads only the edit hunk, so an allow
  // marker sitting elsewhere in the file was invisible and any Edit to such a
  // file was blocked. `--allow-from` lets the caller name a second source of
  // markers — the file on disk — whose markers are UNIONED with the hunk's.
  describe("--allow-from (allow markers that live outside the edit hunk)", () => {
    let scratchDir = "";
    let onDiskFile = "";

    beforeAll(() => {
      scratchDir = mkdtempSync(join(tmpdir(), "docs-allow-from-"));
      onDiskFile = join(scratchDir, "page.mdx");
    });

    afterAll(() => {
      rmSync(scratchDir, { recursive: true, force: true });
    });

    it("honors a marker that exists only in the on-disk file, not in the hunk", () => {
      writeFileSync(
        onDiskFile,
        '<!-- docs-path-guard: allow apps/docs/on-disk-marker-page.mdx reason: "written elsewhere in the same page" -->\n',
        "utf-8",
      );
      const result = runCliRaw(
        ["--stdin", "--doc-dir", scratchDir, "--allow-from", onDiskFile],
        "see `apps/docs/on-disk-marker-page.mdx`",
      );
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe("");
    });

    it("unions on-disk markers with the hunk's own markers rather than replacing them", () => {
      writeFileSync(
        onDiskFile,
        '<!-- docs-path-guard: allow apps/docs/on-disk-marker-page.mdx reason: "written elsewhere in the same page" -->\n',
        "utf-8",
      );
      const result = runCliRaw(
        ["--stdin", "--doc-dir", scratchDir, "--allow-from", onDiskFile],
        "see `apps/docs/on-disk-marker-page.mdx` and `docker/FAKE.sh`\n" +
          '<!-- docs-path-guard: allow docker/FAKE.sh reason: "introduced by this very hunk" -->',
      );
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe("");
    });

    it("still requires a non-empty reason on an on-disk marker", () => {
      writeFileSync(
        onDiskFile,
        '<!-- docs-path-guard: allow apps/docs/on-disk-marker-page.mdx reason: "" -->\n',
        "utf-8",
      );
      const result = runCliRaw(
        ["--stdin", "--doc-dir", scratchDir, "--allow-from", onDiskFile],
        "see `apps/docs/on-disk-marker-page.mdx`",
      );
      expect(result.stdout.trim()).toBe("apps/docs/on-disk-marker-page.mdx");
    });

    it("treats an absent --allow-from file as contributing no markers, without failing", () => {
      // A Write of a brand-new page: the hook passes the target path, which
      // does not exist yet. That must not read as "the verifier could not
      // run" — it simply means there are no pre-existing markers.
      const result = runCliRaw(
        ["--stdin", "--doc-dir", scratchDir, "--allow-from", join(scratchDir, "absent.mdx")],
        "see `apps/docs/on-disk-marker-page.mdx`",
      );
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe("apps/docs/on-disk-marker-page.mdx");
    });
  });
});

// ---------------------------------------------------------------------------
// Whole-branch review, F1 — fenced code blocks are not path claims.
// ---------------------------------------------------------------------------
// Verified live on the branch: `../lib/foo`, `./helpers` and a bare
// `packages/database/src/client` written inside a ```ts block were all
// reported missing, which blocks the write. Those are lines of the EXAMPLE's
// own source — a relative specifier there resolves against the example's
// directory, not the doc page's — so checking them against this repo's tree
// asks a question the text never posed. Every developer page and most
// self-hosting pages show code, so this fires on nearly all of them.
//
// The fix strips fenced blocks before extraction. It deliberately NARROWS the
// guard: a fabricated path written inside a fence is no longer checked. That
// is the accepted trade for unblocking every page that shows code. Inline
// `code` spans — how real citations are written — are untouched.
//
// <!-- docs-path-guard: allow ../lib/foo, ./helpers, packages/database/src/client, apps/nonexistent-app, apps/nonexistent-app/FAKE.ts, docker/FAKE.sh, .github/workflows/FAKE.yml, docker-compose.FAKE.yml, turbo.json.bak, .claude/hooks/FAKE.sh, apps/docs/on-disk-marker-page.mdx, ./check-coverage.mjs, scripts/manifest/build.mjs reason: "fixtures for this suite: example-source specifiers quoted inside code fences, and deliberately fabricated top-level paths the new top-level coverage must flag" -->
describe("fenced code blocks", () => {
  it("ignores every path inside a ``` fence", () => {
    const content = [
      "Prose citing `apps/bot/src/index.ts`.",
      "",
      "```ts",
      'import { foo } from "../lib/foo";',
      'import { helpers } from "./helpers";',
      'import { prisma } from "packages/database/src/client";',
      "```",
    ].join("\n");
    expect(extractRepoPaths(content)).toEqual(["apps/bot/src/index.ts"]);
  });

  it("ignores every path inside a ~~~ fence", () => {
    const content = ["~~~bash", "node apps/nonexistent-app/FAKE.ts", "~~~"].join("\n");
    expect(extractRepoPaths(content)).toEqual([]);
  });

  it("resumes checking prose after the fence closes", () => {
    const content = [
      "```ts",
      'import { foo } from "../lib/foo";',
      "```",
      "",
      "Back in prose: `apps/bot/src/index.ts`.",
    ].join("\n");
    expect(extractRepoPaths(content)).toEqual(["apps/bot/src/index.ts"]);
  });

  it("keeps checking inline code spans, which is how a real citation is written", () => {
    expect(extractRepoPaths("the file `apps/nonexistent-app/FAKE.ts` is cited inline")).toEqual([
      "apps/nonexistent-app/FAKE.ts",
    ]);
  });

  it("does not let a shorter run of backticks close a longer fence", () => {
    const content = [
      "````md",
      "```ts",
      'import { foo } from "../lib/foo";',
      "```",
      "````",
    ].join("\n");
    expect(extractRepoPaths(content)).toEqual([]);
  });

  it("does not treat a tilde run as closing a backtick fence", () => {
    const content = ["```ts", "~~~", 'import { foo } from "../lib/foo";', "```"].join("\n");
    expect(extractRepoPaths(content)).toEqual([]);
  });

  it("treats an unterminated fence as running to the end of the document", () => {
    const content = ["```ts", 'import { foo } from "../lib/foo";'].join("\n");
    expect(extractRepoPaths(content)).toEqual([]);
  });

  it("does not mistake an inline triple-backtick span for a fence opener", () => {
    // Not at the start of a line, so it never opens a block.
    expect(extractRepoPaths("prose ```x``` then `apps/bot/src/index.ts`")).toEqual([
      "apps/bot/src/index.ts",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Whole-branch review, F5 — the guard could not see most of the repo.
// ---------------------------------------------------------------------------
// PATH_PATTERN recognised four top-level prefixes (apps, packages, docs,
// scripts), so the entire self-hosting surface — docker-compose files, the
// Dockerfile, .env.example, turbo.json, docker/, .github/workflows/ and the
// .claude/ hook and agent definitions — was invisible: not merely
// under-checked, but never checked at all. A page could fabricate any of them
// and pass.
describe("repo top-level files and directories", () => {
  it("extracts a path under docker/", () => {
    // Extraction only, deliberately. `docker/` is listed in .dockerignore,
    // so the container this suite runs in has no copy of it and an existence
    // assertion here would be testing the test environment rather than the
    // guard. The hook itself runs on the host, where docker/Caddyfile and
    // docker/backup.sh both exist; what matters for that is that the prefix
    // is recognised at all, which is what this asserts.
    expect(extractRepoPaths("see `docker/Caddyfile` and `docker/backup.sh`")).toEqual([
      "docker/Caddyfile",
      "docker/backup.sh",
    ]);
  });

  it("flags a fabricated path under docker/", () => {
    const paths = extractRepoPaths("run `docker/FAKE.sh`");
    expect(paths).toEqual(["docker/FAKE.sh"]);
    expect(findMissingPaths(paths, repoRoot)).toEqual(["docker/FAKE.sh"]);
  });

  it("checks a path under .github/", () => {
    const paths = extractRepoPaths("see `.github/workflows/security.yml`");
    expect(paths).toEqual([".github/workflows/security.yml"]);
    expect(findMissingPaths(paths, repoRoot)).toEqual([]);
  });

  it("flags a fabricated workflow file", () => {
    const paths = extractRepoPaths("see `.github/workflows/FAKE.yml`");
    expect(paths).toEqual([".github/workflows/FAKE.yml"]);
    expect(findMissingPaths(paths, repoRoot)).toEqual([".github/workflows/FAKE.yml"]);
  });

  it("checks a path under .claude/", () => {
    const paths = extractRepoPaths("the hook is `.claude/hooks/docs-path-guard.sh`");
    expect(paths).toEqual([".claude/hooks/docs-path-guard.sh"]);
    expect(findMissingPaths(paths, repoRoot)).toEqual([]);
  });

  it("flags a fabricated hook file", () => {
    const paths = extractRepoPaths("the hook is `.claude/hooks/FAKE.sh`");
    expect(findMissingPaths(paths, repoRoot)).toEqual([".claude/hooks/FAKE.sh"]);
  });

  it("checks the real top-level config files a self-hosting page will cite", () => {
    const paths = extractRepoPaths(
      "copy `.env.example`, then read `docker-compose.yml`, `docker-compose.prod.yml`, " +
        "`Dockerfile`, `turbo.json`, `pnpm-workspace.yaml` and `tsconfig.base.json`",
    );
    expect(paths).toEqual([
      ".env.example",
      "docker-compose.yml",
      "docker-compose.prod.yml",
      "Dockerfile",
      "turbo.json",
      "pnpm-workspace.yaml",
      "tsconfig.base.json",
    ]);
    expect(findMissingPaths(paths, repoRoot)).toEqual([]);
  });

  it("flags a fabricated member of the docker-compose family", () => {
    const paths = extractRepoPaths("run `docker-compose.FAKE.yml`");
    expect(paths).toEqual(["docker-compose.FAKE.yml"]);
    expect(findMissingPaths(paths, repoRoot)).toEqual(["docker-compose.FAKE.yml"]);
  });

  it("checks a fabricated sibling rather than truncating to the real file name", () => {
    // The truncation-laundering shape the branch fought repeatedly: a match
    // that stops early is checked AS THE WHOLE CLAIM, so the real prefix
    // would absorb the fabricated remainder.
    const paths = extractRepoPaths("see `turbo.json.bak`");
    expect(paths).toEqual(["turbo.json.bak"]);
    expect(findMissingPaths(paths, repoRoot)).toEqual(["turbo.json.bak"]);
  });

  it("does not flag a prose word that merely begins with a top-level file name", () => {
    // `Dockerfiles` and `Dockerfile-based` are English, not paths. Both
    // reduce to the real `Dockerfile`, which exists, so neither is reported.
    const paths = extractRepoPaths("our Dockerfiles are Dockerfile-based");
    expect(findMissingPaths(paths, repoRoot)).toEqual([]);
  });

  it("does not treat a bare `docker-compose` command mention as a path", () => {
    expect(extractRepoPaths("run `docker-compose` from the repo root")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Second fix wave, R1 — an Edit hunk is not a whole document.
// ---------------------------------------------------------------------------
// The hook hands the verifier only `new_string`. Read on its own, a hunk that
// BEGINS inside a fenced code block has inverted fence parity, and the guard
// then breaks in both directions at once: the fenced lines it should exempt
// are extracted and flagged, while the prose after the hunk's closing fence —
// real citations, the ones that actually matter — is treated as fenced and
// never checked. Ordinary editing reaches this; no adversarial input needed.
//
// The fix seeds the scanner's state from the file on disk, which the verifier
// already reads for `--allow-from`. Where in that file the hunk starts is
// answered by `old_string`, passed through `--hunk-anchor-file`, because Edit
// requires old_string to appear in the file; the piped content is tried as a
// second locator (a Write, or an Edit whose new text is already present).
// When neither can be located the scanner falls back to the whole-document
// assumption — which over-checks rather than under-checks, and is never a
// silent skip.
//
// <!-- docs-path-guard: allow apps/FAKE-inside/x.ts, apps/FAKE-after/y.ts, docker-compose.NOPE.yml, apps/FAKE-quoted/z.ts, apps/FAKE-after/RENAMED.ts reason: "fixtures for the hunk-fence-parity repro: one fenced path that must stay exempt, fabricated prose citations that must be flagged, and the mirror case where the hunk opens on the real fence's CLOSER" -->
describe("fence state seeded from the on-disk file (Edit hunks)", () => {
  let scratchDir = "";
  let pageFile = "";

  // Line indices matter here: the fence opens on line 2 and closes on line 5,
  // so a hunk starting at line 4 begins INSIDE it.
  const onDiskPage = [
    "Intro prose.",
    "",
    "```ts",
    'import { foo } from "./helpers";',
    "`apps/FAKE-inside/x.ts`",
    "```",
    "",
    "Then prose citing `apps/FAKE-after/y.ts` and `docker-compose.NOPE.yml`.",
    "",
  ].join("\n");

  beforeAll(() => {
    scratchDir = mkdtempSync(join(tmpdir(), "docs-hunk-fence-"));
    pageFile = join(scratchDir, "page.mdx");
    writeFileSync(pageFile, onDiskPage, "utf-8");
  });

  afterAll(() => {
    rmSync(scratchDir, { recursive: true, force: true });
  });

  it("locates an unchanged hunk in the file and inherits the fence it starts inside", () => {
    // The reviewer's live repro. Without seeding this reports the fenced
    // apps/FAKE-inside/x.ts and stays silent on both prose citations.
    const hunk = [
      "`apps/FAKE-inside/x.ts`",
      "```",
      "",
      "Then prose citing `apps/FAKE-after/y.ts` and `docker-compose.NOPE.yml`.",
    ].join("\n");
    const result = runCliRaw(
      ["--stdin", "--doc-dir", scratchDir, "--doc-file", pageFile, "--allow-from", pageFile],
      hunk,
    );
    expect(result.status).toBe(0);
    expect(result.stdout.trim().split("\n").sort()).toEqual([
      "apps/FAKE-after/y.ts",
      "docker-compose.NOPE.yml",
    ]);
  });

  it("uses old_string as the anchor when the new text is not in the file yet", () => {
    // The shape every real Edit has: new_string differs from what is on disk,
    // so only old_string can say where the hunk begins.
    const anchorFile = join(scratchDir, "anchor.txt");
    writeFileSync(anchorFile, 'import { foo } from "./helpers";', "utf-8");
    const hunk = [
      'import { bar } from "./helpers";',
      "`apps/FAKE-inside/x.ts`",
      "```",
      "",
      "Then prose citing `apps/FAKE-after/y.ts` and `docker-compose.NOPE.yml`.",
    ].join("\n");
    const result = runCliRaw(
      [
        "--stdin",
        "--doc-dir",
        scratchDir,
        "--doc-file",
        pageFile,
        "--allow-from",
        pageFile,
        "--hunk-anchor-file",
        anchorFile,
      ],
      hunk,
    );
    expect(result.status).toBe(0);
    expect(result.stdout.trim().split("\n").sort()).toEqual([
      "apps/FAKE-after/y.ts",
      "docker-compose.NOPE.yml",
    ]);
  });

  it("keeps checking a hunk that begins in prose, outside any fence", () => {
    const hunk = ["Intro prose.", "", "```ts", "`apps/FAKE-inside/x.ts`"].join("\n");
    const result = runCliRaw(
      ["--stdin", "--doc-dir", scratchDir, "--doc-file", pageFile, "--allow-from", pageFile],
      hunk,
    );
    expect(result.status).toBe(0);
    // The hunk opens its own fence at line 2, so the path after it is fenced.
    expect(result.stdout.trim()).toBe("");
  });

  it("falls back to the whole-document assumption when the hunk cannot be located, and still checks", () => {
    // A Write of a brand-new page. "Could not locate" must never become
    // "skip the check" — the fallback over-checks, which is the safe error.
    const result = runCliRaw(
      [
        "--stdin",
        "--doc-dir",
        scratchDir,
        "--doc-file",
        join(scratchDir, "brand-new.mdx"),
        "--allow-from",
        join(scratchDir, "brand-new.mdx"),
      ],
      "prose citing `apps/FAKE-quoted/z.ts`",
    );
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("apps/FAKE-quoted/z.ts");
  });

  it("still checks prose when the hunk opens on the real fence's CLOSER and both locators fail (reviewer repro)", () => {
    // The mirror case of the first test in this block. There, the hunk BEGAN
    // inside the fence that opens at onDiskPage's line 2. Here the hunk
    // begins with that fence's real CLOSER instead — the anchor cannot be
    // placed (it names text absent from the file) and the hunk's own text
    // isn't on disk either (it's new), so both locators fail and `seed`
    // stays null. A fresh, isolated scan of this bare hunk then sees "```"
    // as its FIRST line and, with no prior context, cannot tell a closer
    // from an opener. Reading it as an opener silently swallows everything
    // after it — including the renamed citation — which is exactly the
    // "zero output" the review reported.
    const anchorFile = join(scratchDir, "unlocatable-anchor.txt");
    writeFileSync(anchorFile, "this text does not appear anywhere in page.mdx", "utf-8");
    const hunk = ["```", "", "Then prose citing `apps/FAKE-after/RENAMED.ts`."].join("\n");
    const result = runCliRaw(
      [
        "--stdin",
        "--doc-dir",
        scratchDir,
        "--doc-file",
        pageFile,
        "--allow-from",
        pageFile,
        "--hunk-anchor-file",
        anchorFile,
      ],
      hunk,
    );
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("apps/FAKE-after/RENAMED.ts");
  });
});

// ---------------------------------------------------------------------------
// Second fix wave, R2 — a fence is not always at the left margin.
// ---------------------------------------------------------------------------
// Two shapes were not recognised as fence openers, so F1's exemption did not
// reach them and their example source was still extracted and still blocked:
// a fence inside a blockquote (`> ```ts`) and a fence indented four or more
// spaces, which is how every fenced block nested in a list step is written.
//
// CommonMark treats up to three spaces of indentation as part of the fence and
// four or more as an INDENTED code block — also example source, also not a
// claim about this repository, and so also exempt. The paragraph-interruption
// rule keeps that narrow: an indented line can only start a code block after a
// blank line, so an indented continuation of a prose paragraph is still read
// as prose and still checked.
describe("fences that are not at the left margin", () => {
  it("treats a blockquoted fence as a fence", () => {
    const content = ["> ```ts", '> import { foo } from "../lib/foo";', "> ```"].join("\n");
    expect(extractRepoPaths(content)).toEqual([]);
  });

  it("resumes checking prose after a blockquoted fence closes", () => {
    const content = [
      "> ```ts",
      '> import { foo } from "../lib/foo";',
      "> ```",
      "",
      "Back in prose: `apps/bot/src/index.ts`.",
    ].join("\n");
    expect(extractRepoPaths(content)).toEqual(["apps/bot/src/index.ts"]);
  });

  it("treats a fence indented four spaces (a nested list step) as a fence", () => {
    const content = [
      "1. Run the importer:",
      "",
      "    ```ts",
      '    import { foo } from "../lib/foo";',
      "    ```",
      "",
      "Back in prose: `apps/bot/src/index.ts`.",
    ].join("\n");
    expect(extractRepoPaths(content)).toEqual(["apps/bot/src/index.ts"]);
  });

  it("exempts an indented code block, which is example source too", () => {
    const content = [
      "For example:",
      "",
      '    import { foo } from "../lib/foo";',
      "",
      "Back in prose: `apps/bot/src/index.ts`.",
    ].join("\n");
    expect(extractRepoPaths(content)).toEqual(["apps/bot/src/index.ts"]);
  });

  it("still checks an indented line that merely continues a paragraph", () => {
    // No blank line before it, so per CommonMark it cannot open an indented
    // code block — it is wrapped prose, and a citation in it is a real claim.
    const content = [
      "This paragraph wraps onto a second, deeply indented line",
      "        which still cites `apps/nonexistent-app/FAKE.ts` as prose.",
    ].join("\n");
    expect(extractRepoPaths(content)).toEqual(["apps/nonexistent-app/FAKE.ts"]);
  });

  it("ends an indented code block at the first non-blank line back at the margin", () => {
    const content = [
      "Example:",
      "",
      '    import { foo } from "../lib/foo";',
      "",
      "    still code, after a blank line",
      "",
      "Prose again: `apps/nonexistent-app/FAKE.ts`.",
    ].join("\n");
    expect(extractRepoPaths(content)).toEqual(["apps/nonexistent-app/FAKE.ts"]);
  });
});

// ---------------------------------------------------------------------------
// Second fix wave, R3 — an allow marker inside a fenced example is not live.
// ---------------------------------------------------------------------------
// Markers were parsed from RAW content while paths were extracted from
// fence-stripped content, so the two disagreed about what a fence means. A
// page that documents the marker syntax — this system's own reference page
// will — silently exempted whatever paths its example named, for the whole
// page, with no reviewer able to see that it had. The marker parse now
// ignores the same code regions the path extraction does.
describe("allow markers inside code regions", () => {
  it("ignores a marker shown inside a fenced example", () => {
    const content = [
      "To exempt a path, write:",
      "",
      "```md",
      '<!-- docs-path-guard: allow apps/nonexistent-app/FAKE.ts reason: "illustrative" -->',
      "```",
    ].join("\n");
    expect(extractAllowedPaths(content).size).toBe(0);
  });

  it("ignores a marker shown inside an indented code block", () => {
    const content = [
      "To exempt a path, write:",
      "",
      '    <!-- docs-path-guard: allow apps/nonexistent-app/FAKE.ts reason: "illustrative" -->',
    ].join("\n");
    expect(extractAllowedPaths(content).size).toBe(0);
  });

  it("still honours a marker written in prose", () => {
    const content = [
      "```md",
      '<!-- docs-path-guard: allow apps/nonexistent-app/FAKE.ts reason: "illustrative" -->',
      "```",
      "",
      '<!-- docs-path-guard: allow apps/FAKE-quoted/z.ts reason: "really exempt" -->',
    ].join("\n");
    const allowed = extractAllowedPaths(content);
    expect(allowed.has("apps/FAKE-quoted/z.ts")).toBe(true);
    expect(allowed.has("apps/nonexistent-app/FAKE.ts")).toBe(false);
  });

  it("does not exempt a path a fenced example names, end to end", () => {
    const content = [
      "Write the marker like this:",
      "",
      "```md",
      '<!-- docs-path-guard: allow apps/FAKE-quoted/z.ts reason: "illustrative" -->',
      "```",
      "",
      "The page itself really cites `apps/FAKE-quoted/z.ts`.",
    ].join("\n");
    const result = runCli(content);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("apps/FAKE-quoted/z.ts");
  });
});
