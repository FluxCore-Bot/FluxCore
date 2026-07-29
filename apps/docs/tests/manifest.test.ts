import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { buildManifest } from "../scripts/manifest/build.mjs";
import { scanSpecs } from "../scripts/manifest/scan.mjs";

const repoRoot = resolve(__dirname, "../../..");

describe("buildManifest — evidence-gathering regression guards", () => {
  it("never marks a feature planned when a spec doc AND real source both exist for it", () => {
    // Regression guard for the class of bug where the evidence-gathering
    // layer only ever looked at packages/systems/src: a real source
    // location living elsewhere (packages/i18n) went undiscovered, so the
    // i18n-accessibility spec landed on "planned" despite shipping. This
    // asserts the general invariant, not just the one instance: if a spec
    // doc exists AND at least one other evidence field is populated, the
    // feature must not be reported as unbuilt.
    const manifest = buildManifest(repoRoot);
    const offenders = manifest.features.filter(
      (f) =>
        f.status === "planned" &&
        Boolean(f.evidence.spec) &&
        Boolean(
          f.evidence.system ||
            f.evidence.botFeature ||
            f.evidence.serverFeature ||
            f.evidence.clientRoute,
        ),
    );
    expect(offenders).toEqual([]);
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
