# ── Build frontend ───────────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod && npm install -g tsx
COPY server.ts ./
COPY lib/ ./lib/
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["tsx", "server.ts"]
