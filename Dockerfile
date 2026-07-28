# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY index.html dice-box-frame.html tsconfig*.json vite.config.ts eslint.config.js ./
COPY public ./public
COPY shared ./shared
COPY scripts ./scripts
COPY src ./src

RUN npm run build

FROM node:22-alpine AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:22-alpine AS runtime
WORKDIR /app

ARG STARS_BUILD_ID=docker

ENV NODE_ENV=production \
    STARS_SECURITY_MODE=production \
    STARS_SHARED_ROOT=/data \
    STARS_BUILD_ID=${STARS_BUILD_ID} \
    PORT=8080

LABEL org.opencontainers.image.title="DNDSTARS-5E" \
      org.opencontainers.image.description="D&D 5e 2014 SRD virtual tabletop and authoritative Headless server" \
      org.opencontainers.image.source="https://github.com/xmxftxdl/DNDSTARS-5E" \
      org.opencontainers.image.documentation="https://astraltracevtt.com/" \
      org.opencontainers.image.version="${STARS_BUILD_ID}"

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/scripts/static-server.mjs ./scripts/static-server.mjs
COPY --from=build --chown=node:node /app/scripts/server-observability.mjs ./scripts/server-observability.mjs
COPY --from=build --chown=node:node /app/scripts/shared-server-core.mjs ./scripts/shared-server-core.mjs
COPY --from=build --chown=node:node /app/scripts/account-storage-sqlite.mjs ./scripts/account-storage-sqlite.mjs
COPY --from=build --chown=node:node /app/scripts/postgres-storage.mjs ./scripts/postgres-storage.mjs
COPY --from=build --chown=node:node /app/scripts/migrate-json-indexes-to-sqlite.mjs ./scripts/migrate-json-indexes-to-sqlite.mjs
COPY --from=build --chown=node:node /app/scripts/migrate-storage-to-postgres.mjs ./scripts/migrate-storage-to-postgres.mjs
COPY --from=build --chown=node:node /app/scripts/tencent-verification-provider.mjs ./scripts/tencent-verification-provider.mjs
COPY --from=build --chown=node:node /app/shared ./shared
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules

RUN mkdir -p /data && chown -R node:node /data

USER node
EXPOSE 8080
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/readyz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

STOPSIGNAL SIGTERM

CMD ["node", "scripts/static-server.mjs", "--host", "0.0.0.0", "--port", "8080", "--root", "dist"]
