import { describe, expect, it, vi } from "vitest";
import { resolve } from "node:path";
import {
  buildManifest,
  buildScreenshotChecklist,
  findUnexplainedPlanned,
  KNOWN_UNBUILT,
} from "../scripts/manifest/build.mjs";
import { scanDashboardPages, scanSpecs } from "../scripts/manifest/scan.mjs";

const repoRoot = resolve(__dirname, "../../..");

describe("buildManifest — evidence-gathering regression guards", () => {
  it("flags a feature with a spec doc and zero evidence as unexplained, unless declared known-unbuilt", () => {
    // This is the inverse of what the first version of this suite asserted.
    // That version checked "no feature is planned while evidence AND a
    // spec both exist" — which had nothing to fire on for the pre-fix
    // i18n bug, because i18n's evidence was entirely null except spec.
    // Fully null evidence is not proof a feature is unbuilt; it is proof
    // nobody successfully looked. This test encodes that directly using
    // only buildManifest()'s real output, with no import of anything new
    // beyond what already existed before this fix — so it fails cleanly
    // if run against the pre-fix scanners (see task-4-report.md for the
    // real command output proving that).
    const manifest = buildManifest(repoRoot);
    const stillKnownUnbuiltRightNow: string[] = []; // must be empty — nothing is declared unbuilt today
    const unexplained = manifest.features.filter((f) => {
      const hasEvidence = Boolean(
        f.evidence.system ||
          f.evidence.botFeature ||
          f.evidence.serverFeature ||
          f.evidence.clientRoute ||
          (f.evidence.commands ?? []).length > 0,
      );
      return (
        Boolean(f.evidence.spec) && !hasEvidence && !stillKnownUnbuiltRightNow.includes(f.id)
      );
    });
    expect(unexplained).toEqual([]);
  });

  it("KNOWN_UNBUILT is empty — nothing is currently declared genuinely unbuilt", () => {
    expect(KNOWN_UNBUILT).toEqual([]);
  });

  it("findUnexplainedPlanned flags a spec-only feature unless it is declared known-unbuilt", () => {
    // Unit-level proof that the guard function itself implements the
    // correct rule, independent of real repo scan results: a synthetic
    // feature shaped exactly like pre-fix i18n-accessibility (spec set,
    // every other evidence field null) must be flagged when not declared,
    // and must NOT be flagged once declared.
    const undeclaredEvidence = {
      system: null,
      botFeature: null,
      serverFeature: null,
      clientRoute: null,
      commands: [],
      spec: "docs/features/example.md",
    };
    const synthetic = [{ id: "example", evidence: undeclaredEvidence }];

    expect(findUnexplainedPlanned(synthetic, [])).toHaveLength(1);
    expect(findUnexplainedPlanned(synthetic, ["example"])).toHaveLength(0);

    // A feature with real evidence alongside its spec is never flagged,
    // regardless of the known-unbuilt list.
    const withEvidence = [
      {
        id: "example",
        evidence: { ...undeclaredEvidence, system: "packages/example" },
      },
    ];
    expect(findUnexplainedPlanned(withEvidence, [])).toHaveLength(0);
  });

  it("warns on stderr when the git commit lookup fails (e.g. this Docker test container)", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const manifest = buildManifest(repoRoot);
      if (manifest.generatedFromCommit === null) {
        const warned = stderrSpy.mock.calls.some((call) =>
          String(call[0]).includes("generatedFromCommit"),
        );
        expect(warned).toBe(true);
      }
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it("finds packages/i18n as source evidence for the i18n-accessibility spec", () => {
    const manifest = buildManifest(repoRoot);
    const i18n = manifest.features.find((f) => f.id === "i18n-accessibility");
    expect(i18n).toBeDefined();
    expect(i18n?.evidence.system).toBe("packages/i18n");
    // Real source, no dedicated command or dashboard route — the rule
    // decides "partial", not a value forced here.
    expect(i18n?.status).toBe("partial");
  });

  it("maps every docs/features spec to exactly one manifest feature entry", () => {
    // Audits the whole alias table at once: a spec that resolves to no
    // entry, or that collides with another spec's canonical id (silently
    // overwriting it so the original file matches nothing), both fail this.
    const manifest = buildManifest(repoRoot);
    const specs = scanSpecs(repoRoot);
    expect(specs.length).toBeGreaterThan(0);
    for (const spec of specs) {
      const matches = manifest.features.filter((f) => f.evidence.spec === spec.file);
      expect(matches.length).toBe(1);
    }
  });
});

describe("buildScreenshotChecklist", () => {
  const samplePages = [
    {
      route: "/guild/$guildId/commands",
      featureId: "commands",
      file: "apps/dashboard/src/client/routes/guild/$guildId/commands.tsx",
    },
    {
      route: "/guild/$guildId/giveaways",
      featureId: "giveaways",
      file: "apps/dashboard/src/client/routes/guild/$guildId/giveaways.tsx",
    },
  ];

  it("opens with the privacy warning, before anything else", () => {
    const checklist = buildScreenshotChecklist(samplePages);
    expect(checklist.startsWith("> **Before capturing:**")).toBe(true);
    expect(checklist).toContain(
      "Real member data must never reach `apps/docs/public/`.",
    );
  });

  it("emits exactly one row per dashboard page, naming its route", () => {
    const checklist = buildScreenshotChecklist(samplePages);
    const rowLines = checklist.split("\n").filter((line) => line.startsWith("| `"));
    expect(rowLines.length).toBe(samplePages.length);
    for (const page of samplePages) {
      expect(checklist).toContain(page.route);
    }
  });

  it("names the viewport and theme every capture should use", () => {
    const checklist = buildScreenshotChecklist(samplePages);
    expect(checklist).toContain("1440");
    expect(checklist).toContain("900");
    expect(checklist).toContain("dark");
  });

  it("emits one row per page for the real manifest's 18 dashboard pages", () => {
    const pages = scanDashboardPages(repoRoot);
    expect(pages.length).toBe(18);
    const checklist = buildScreenshotChecklist(pages);
    const rowLines = checklist.split("\n").filter((line) => line.startsWith("| `"));
    expect(rowLines.length).toBe(18);
  });
});
