# ---- Base ----
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

# ============================================
# Development (full workspace for volume mounts)
# ============================================

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/database/package.json ./packages/database/
COPY packages/systems/package.json ./packages/systems/
COPY packages/i18n/package.json ./packages/i18n/
COPY apps/bot/package.json ./apps/bot/
COPY apps/dashboard/package.json ./apps/dashboard/
COPY packages/database/prisma ./packages/database/prisma/
COPY packages/database/prisma.config.ts ./packages/database/
RUN pnpm install --frozen-lockfile \
 && chown -R node:node /app

FROM deps AS development
COPY --chown=node:node . .
USER node
CMD ["pnpm", "dev"]

FROM deps AS test
COPY --chown=node:node . .
USER node
CMD ["pnpm", "test"]

# ============================================
# Production (turbo prune for optimized builds)
# ============================================

FROM base AS pruner
RUN npm install -g turbo@2
COPY . .

# ---- Bot Pipeline ----

FROM pruner AS prune-bot
RUN turbo prune @fluxcore/bot --docker

FROM base AS bot-installer
COPY --from=prune-bot /app/out/json/ .
RUN pnpm install --frozen-lockfile

FROM bot-installer AS bot-builder
COPY --from=prune-bot /app/out/full/ .
# turbo prune omits root tsconfig files that package tsconfigs extend.
COPY tsconfig.base.json tsconfig.json ./
RUN pnpm turbo run build --filter=@fluxcore/bot...

FROM base AS production-bot
ENV NODE_ENV=production
COPY --from=prune-bot /app/out/json/ .
COPY --from=bot-builder /app/packages/database/prisma ./packages/database/prisma/
COPY --from=bot-builder /app/packages/database/prisma.config.ts ./packages/database/
RUN pnpm install --frozen-lockfile --prod && \
    npm install -g prisma@7
COPY --from=bot-builder /app/packages/config/dist ./packages/config/dist
COPY --from=bot-builder /app/packages/types/dist ./packages/types/dist
COPY --from=bot-builder /app/packages/utils/dist ./packages/utils/dist
COPY --from=bot-builder /app/packages/database/dist ./packages/database/dist
COPY --from=bot-builder /app/packages/systems/dist ./packages/systems/dist
COPY --from=bot-builder /app/apps/bot/dist ./apps/bot/dist
USER node
CMD ["sh", "-c", "cd packages/database && prisma migrate deploy && cd /app && node apps/bot/dist/index.js"]

# ---- Dashboard Pipeline ----

FROM pruner AS prune-dashboard
RUN turbo prune @fluxcore/dashboard --docker

FROM base AS dashboard-installer
COPY --from=prune-dashboard /app/out/json/ .
RUN pnpm install --frozen-lockfile

FROM dashboard-installer AS dashboard-builder
COPY --from=prune-dashboard /app/out/full/ .
# turbo prune omits root tsconfig files that package tsconfigs extend.
COPY tsconfig.base.json tsconfig.json ./
RUN pnpm turbo run build --filter=@fluxcore/dashboard...

FROM base AS production-dashboard
ENV NODE_ENV=production
COPY --from=prune-dashboard /app/out/json/ .
COPY --from=dashboard-builder /app/packages/database/prisma ./packages/database/prisma/
COPY --from=dashboard-builder /app/packages/database/prisma.config.ts ./packages/database/
RUN pnpm install --frozen-lockfile --prod && \
    npm install -g prisma@7
COPY --from=dashboard-builder /app/packages/config/dist ./packages/config/dist
COPY --from=dashboard-builder /app/packages/utils/dist ./packages/utils/dist
COPY --from=dashboard-builder /app/packages/database/dist ./packages/database/dist
COPY --from=dashboard-builder /app/packages/systems/dist ./packages/systems/dist
COPY --from=dashboard-builder /app/apps/dashboard/dist ./apps/dashboard/dist
USER node
CMD ["sh", "-c", "cd packages/database && prisma migrate deploy && cd /app && node apps/dashboard/dist/server/index.js"]
