import { mkdir, readFile, writeFile, unlink, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { StorageAdapter } from "../types.js";

export interface LocalStorageConfig {
  /** Base directory for file storage (e.g. "/data/uploads") */
  basePath: string;
  /** URL prefix for serving files (e.g. "/uploads" or "https://cdn.example.com") */
  urlPrefix: string;
}

export class LocalStorageAdapter implements StorageAdapter {
  private readonly basePath: string;
  private readonly urlPrefix: string;

  constructor(config: LocalStorageConfig) {
    this.basePath = config.basePath;
    this.urlPrefix = config.urlPrefix.replace(/\/$/, "");
  }

  async upload(key: string, buffer: Buffer): Promise<string> {
    const filePath = this.resolvePath(key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
    return key;
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    try {
      await unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  async get(key: string): Promise<Buffer> {
    const filePath = this.resolvePath(key);
    return readFile(filePath);
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.resolvePath(key);
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getUrl(key: string): string {
    return `${this.urlPrefix}/${key}`;
  }

  private resolvePath(key: string): string {
    // Prevent path traversal
    const sanitized = key.replace(/\.\./g, "").replace(/^\//, "");
    return join(this.basePath, sanitized);
  }
}
