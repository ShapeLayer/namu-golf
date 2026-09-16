FROM oven/bun:1.3.12 AS build
ARG APP_REVISION=unknown
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN printf '%s\n' "$APP_REVISION" > .revision
RUN bun run typecheck && bun test && bun run build

FROM oven/bun:1.3.12-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build --chown=bun:bun /app/server.ts ./server.ts
COPY --from=build --chown=bun:bun /app/package.json /app/bun.lock ./
COPY --from=build --chown=bun:bun /app/node_modules ./node_modules
COPY --from=build --chown=bun:bun /app/src/server ./src/server
COPY --from=build --chown=bun:bun /app/src/shared ./src/shared
COPY --from=build --chown=bun:bun /app/.revision ./.revision
COPY --from=build --chown=bun:bun /app/public ./public
COPY --from=build --chown=bun:bun /app/dist ./dist
USER bun
EXPOSE 3000
CMD ["bun", "run", "server.ts"]
