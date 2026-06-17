# ── Build frontend ───────────────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install -g tsx
COPY server.ts ./
COPY lib/ ./lib/
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["tsx", "server.ts"]
