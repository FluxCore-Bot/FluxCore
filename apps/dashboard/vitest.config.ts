import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    extensions: [".ts", ".js", ".tsx", ".jsx", ".json"],
    alias: {
      // Tests live in tests/ and import from ../../src/server/...
      // This alias ensures .js → .ts resolution works
    },
  },
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    alias: {
      // Map .js extensions to .ts for ESM compat
      "../../src/server/": resolve(__dirname, "src/server") + "/",
    },
    coverage: {
      provider: "v8",
      include: ["src/server/**/*.ts"],
      exclude: ["src/server/index.ts"],
    },
  },
});
