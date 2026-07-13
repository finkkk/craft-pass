# syntax=docker/dockerfile:1
FROM node:22.12.0-bookworm-slim AS base

# Prisma needs OpenSSL at build time and while applying migrations at startup.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS build

# Keep builds predictable on small servers. The limit can be overridden with:
# docker compose build --build-arg NODE_MAX_OLD_SPACE_SIZE=1536 app
ARG NODE_MAX_OLD_SPACE_SIZE=768
ENV NODE_OPTIONS=--max-old-space-size=${NODE_MAX_OLD_SPACE_SIZE} \
    npm_config_audit=false \
    npm_config_fund=false \
    npm_config_jobs=1 \
    MAKEFLAGS=-j1

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./frontend/
COPY backend/package.json backend/package-lock.json ./backend/
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
  npm --prefix frontend ci --no-audit --no-fund \
  && npm --prefix backend ci --no-audit --no-fund

COPY package.json ./package.json
COPY frontend ./frontend
COPY backend ./backend
RUN npm --prefix frontend run build && npm --prefix backend run build
RUN npm --prefix backend prune --omit=dev

FROM base AS runtime

ENV NODE_ENV=production \
    PORT=47821 \
    PORT_LOCKED=true \
    DATABASE_URL=file:./data/craft-pass.db \
    RUNTIME_DATA_DIR=/app/backend/data

WORKDIR /app

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/backend/package.json /app/backend/package-lock.json ./backend/
COPY --from=build --chown=node:node /app/backend/node_modules ./backend/node_modules
COPY --from=build --chown=node:node /app/backend/dist ./backend/dist
COPY --from=build --chown=node:node /app/backend/prisma ./backend/prisma
COPY --from=build --chown=node:node /app/backend/prisma.config.ts ./backend/prisma.config.ts
COPY --from=build --chown=node:node /app/frontend/dist ./frontend/dist
COPY --chown=node:node scripts/container-entrypoint.mjs ./scripts/container-entrypoint.mjs

RUN mkdir -p /app/backend/data && chown node:node /app/backend/data

USER node
EXPOSE 47821
VOLUME ["/app/backend/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:47821/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "scripts/container-entrypoint.mjs"]
