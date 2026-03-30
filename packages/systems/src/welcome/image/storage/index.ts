import type { StorageAdapter } from "../types.js";
import { LocalStorageAdapter } from "./local.js";

export type { StorageAdapter } from "../types.js";
export { LocalStorageAdapter } from "./local.js";
export type { LocalStorageConfig } from "./local.js";

export interface StorageConfig {
  /** Storage backend: "local" (default), add more adapters as needed */
  backend: "local";
  /** Local storage config */
  local?: {
    basePath: string;
    urlPrefix: string;
  };
}

const DEFAULT_LOCAL_CONFIG = {
  basePath: "/data/uploads/welcome",
  urlPrefix: "/uploads/welcome",
};

/**
 * Factory to create a storage adapter based on config.
 * Follows the adapter pattern — add new backends (S3, R2, GCS) by
 * implementing StorageAdapter and adding a case here.
 */
export function createStorageAdapter(config?: Partial<StorageConfig>): StorageAdapter {
  const backend = config?.backend ?? "local";

  switch (backend) {
    case "local":
      return new LocalStorageAdapter(config?.local ?? DEFAULT_LOCAL_CONFIG);
    default:
      throw new Error(`Unknown storage backend: ${backend}`);
  }
}
