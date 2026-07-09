import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: [".ts", ".js", ".tsx", ".jsx", ".json"],
    alias: {
      // Tests live in tests/ and import from ../../src/server/...
      // This alias ensures .js → .ts resolution works
    },
  },
  test: {
    globals: true,
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    alias: {
      "../../src/server/": resolve(__dirname, "src/server") + "/",
    },
    coverage: {
      provider: "v8",
      include: ["src/server/**/*.ts", "src/client/shared/ui/variable-field/**/*.{ts,tsx}"],
      exclude: ["src/server/index.ts"],
    },
  },
});
