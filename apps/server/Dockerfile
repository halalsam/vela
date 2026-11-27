FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/server/package.json apps/server/
COPY packages/api/package.json packages/api/
COPY packages/utils/package.json packages/utils/
RUN pnpm install --frozen-lockfile --filter "@vela/server..."
COPY packages/api packages/api
COPY packages/utils packages/utils
COPY apps/server apps/server
RUN pnpm --filter @vela/server build \
 && pnpm --filter @vela/server deploy --prod --legacy /out

FROM node:22-bookworm-slim AS runtime
ARG GIT_SHA=dev
ENV NODE_ENV=production GIT_SHA=$GIT_SHA
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /repo/apps/server/dist ./dist
# Image uploads when S3 isn't used. A named volume mounted here takes this owner on first use.
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 8787
CMD ["node", "--enable-source-maps", "dist/server.js"]
