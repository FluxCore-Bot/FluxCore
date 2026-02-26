# ---- Base ----
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/database/package.json ./packages/database/
COPY packages/systems/package.json ./packages/systems/
COPY apps/bot/package.json ./apps/bot/
COPY apps/dashboard/package.json ./apps/dashboard/
COPY packages/database/prisma ./packages/database/prisma/
COPY packages/database/prisma.config.ts ./packages/database/
RUN pnpm install --frozen-lockfile

# ---- Development ----
FROM deps AS development
COPY . .
CMD ["pnpm", "dev"]

# ---- Build ----
FROM deps AS build
COPY . .
RUN pnpm turbo run build

# ---- Test ----
FROM deps AS test
COPY . .
CMD ["pnpm", "test"]

# ---- Production ----
FROM base AS production
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/database/package.json ./packages/database/
COPY packages/systems/package.json ./packages/systems/
COPY apps/bot/package.json ./apps/bot/
COPY apps/dashboard/package.json ./apps/dashboard/
COPY packages/database/prisma ./packages/database/prisma/
COPY packages/database/prisma.config.ts ./packages/database/
RUN pnpm install --frozen-lockfile --prod
# Copy built output from all packages and apps
COPY --from=build /app/packages/config/dist ./packages/config/dist
COPY --from=build /app/packages/types/dist ./packages/types/dist
COPY --from=build /app/packages/utils/dist ./packages/utils/dist
COPY --from=build /app/packages/database/dist ./packages/database/dist
COPY --from=build /app/packages/systems/dist ./packages/systems/dist
COPY --from=build /app/apps/bot/dist ./apps/bot/dist
COPY --from=build /app/apps/dashboard/dist ./apps/dashboard/dist
USER node
CMD ["sh", "-c", "cd packages/database && npx prisma migrate deploy && cd /app && node apps/bot/dist/index.js"]
