# syntax=docker/dockerfile:1
# Builds the Next.js app; the tRPC backend is bundled into it (served at /api/trpc).
#   docker build -t student-management .          -> production image (runner)
#   docker build -t student-management-migrate --target migrate .

# Keep in sync with .nvmrc
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base
ENV CI=true NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
# Install the exact pnpm version pinned in package.json "packageManager"
COPY package.json ./
RUN npm install -g "$(node -p 'require("./package.json").packageManager.split("+")[0]')"

# Download all packages; this layer is reused until the lockfile changes
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch

FROM deps AS source
COPY . .
RUN pnpm install --offline --frozen-lockfile

FROM source AS build
RUN pnpm --filter web build

# One-shot job: applies drizzle migrations to DATABASE_URL, then exits
FROM source AS migrate
WORKDIR /app/packages/database
USER node
CMD ["node_modules/.bin/drizzle-kit", "migrate"]

FROM node:${NODE_VERSION}-alpine AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
# App files stay root-owned (read-only for the app user); only Next's cache dir is writable
RUN mkdir -p apps/web/.next/cache && chown node:node apps/web/.next/cache
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/login || exit 1
CMD ["node", "apps/web/server.js"]
