import { describe, it, expect, vi } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    logLevel: "info",
  },
}));

import { getFiles } from "@fluxcore/utils";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dirname = fileURLToPath(new URL(".", import.meta.url));

describe("getFiles", () => {
  it("recursively finds .ts files in a directory", async () => {
    const srcDir = join(dirname, "..", "..", "src", "events");
    const files = await getFiles(srcDir);

    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => f.endsWith(".ts") || f.endsWith(".js"))).toBe(
      true,
    );
  });

  it("finds files in subdirectories", async () => {
    const featuresDir = join(dirname, "..", "..", "src", "features");
    const files = await getFiles(featuresDir);

    // Should find files in general/, moderation/, utility/, tempvoice/, automation/
    expect(files.length).toBeGreaterThanOrEqual(10);
    expect(files.some((f) => f.includes("general"))).toBe(true);
    expect(files.some((f) => f.includes("moderation"))).toBe(true);
    expect(files.some((f) => f.includes("utility"))).toBe(true);
  });

  it("throws for non-existent directory", async () => {
    await expect(getFiles("/nonexistent/path")).rejects.toThrow();
  });
});
