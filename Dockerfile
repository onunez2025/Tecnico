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
COPY server/ ./server/
COPY --from=builder /app/dist ./dist

# Valores por defecto del entorno. NODE_ENV va AQUI, no en el panel de Dokploy: las otras diez
# apps del ecosistema ya lo fijan en su Dockerfile, y Technical era la unica que no. Esa
# ausencia fue la causa del incidente del SSO en QA (la cookie compartida dependia de esta
# variable y no se escribia nunca). Una variable de despliegue que puede olvidarse no debe
# decidir comportamiento; en el Dockerfile viaja con la imagen y esta versionada.
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["tsx", "server/index.ts"]
