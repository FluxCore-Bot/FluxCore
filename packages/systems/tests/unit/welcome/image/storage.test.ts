import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LocalStorageAdapter } from "../../../../src/welcome/image/storage/local.js";
import { createStorageAdapter } from "../../../../src/welcome/image/storage/index.js";

describe("LocalStorageAdapter", () => {
  let tempDir: string;
  let adapter: LocalStorageAdapter;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "fluxcore-test-"));
    adapter = new LocalStorageAdapter({
      basePath: tempDir,
      urlPrefix: "/uploads",
    });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("uploads and retrieves a file", async () => {
    const content = Buffer.from("test-image-data");
    await adapter.upload("test/image.png", content);

    const retrieved = await adapter.get("test/image.png");
    expect(retrieved.toString()).toBe("test-image-data");
  });

  it("checks file existence", async () => {
    expect(await adapter.exists("nonexistent.png")).toBe(false);

    await adapter.upload("exists.png", Buffer.from("data"));
    expect(await adapter.exists("exists.png")).toBe(true);
  });

  it("deletes a file", async () => {
    await adapter.upload("to-delete.png", Buffer.from("data"));
    expect(await adapter.exists("to-delete.png")).toBe(true);

    await adapter.delete("to-delete.png");
    expect(await adapter.exists("to-delete.png")).toBe(false);
  });

  it("silently handles deleting non-existent file", async () => {
    await expect(adapter.delete("nonexistent.png")).resolves.toBeUndefined();
  });

  it("returns correct URL", () => {
    expect(adapter.getUrl("backgrounds/guild-1/image.png")).toBe(
      "/uploads/backgrounds/guild-1/image.png",
    );
  });

  it("creates nested directories on upload", async () => {
    await adapter.upload("a/b/c/deep.png", Buffer.from("nested"));
    const data = await adapter.get("a/b/c/deep.png");
    expect(data.toString()).toBe("nested");
  });

  it("prevents path traversal", async () => {
    await adapter.upload("../escape.png", Buffer.from("evil"));
    // Should not write outside tempDir
    expect(await adapter.exists("escape.png")).toBe(true);
  });
});

describe("createStorageAdapter", () => {
  it("creates a local adapter by default", () => {
    const adapter = createStorageAdapter();
    expect(adapter).toBeDefined();
    expect(adapter.getUrl("test.png")).toContain("/uploads/welcome/test.png");
  });

  it("creates a local adapter with custom config", () => {
    const adapter = createStorageAdapter({
      backend: "local",
      local: { basePath: "/tmp/test", urlPrefix: "/custom" },
    });
    expect(adapter.getUrl("file.png")).toBe("/custom/file.png");
  });

  it("throws for unknown backend", () => {
    expect(() =>
      createStorageAdapter({ backend: "s3" as "local" }),
    ).toThrow("Unknown storage backend");
  });
});
