import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  root: resolve(__dirname, "src/client"),
  publicDir: resolve(__dirname, "public"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src/client"),
    },
  },
  build: {
    outDir: resolve(__dirname, "dist/client"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Split large third-party libraries into their own long-lived,
        // cacheable chunks so they aren't re-downloaded on app code changes.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-"))
            return "charts";
          if (id.includes("react-dom") || id.includes("scheduler")) return "react-vendor";
          if (id.includes("@tanstack")) return "tanstack";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("i18next") || id.includes("react-i18next")) return "i18n";
          if (id.includes("lucide-react")) return "icons";
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    host: process.env.VITE_HOST ?? "127.0.0.1",
    proxy: {
      "/auth": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
