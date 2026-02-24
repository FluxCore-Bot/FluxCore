import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Fallback allows `prisma generate` to run without DATABASE_URL (e.g. during Docker build).
    // The real URL is required at runtime and for migrations.
    url: process.env.DATABASE_URL ?? "",
  },
});
