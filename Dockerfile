# ---- Base ----
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- Development ----
FROM deps AS development
COPY . .
CMD ["pnpm", "dev"]

# ---- Build ----
FROM deps AS build
COPY . .
RUN pnpm build

# ---- Test ----
FROM deps AS test
COPY . .
CMD ["pnpm", "test"]

# ---- Production ----
FROM base AS production
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "dist/index.js"]