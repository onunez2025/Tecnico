# El token del registro privado de Forgejo, necesario para bajar @siatc/c4c-client.
# Dokploy lo pasa como argumento de construccion; en local se toma de ~/.siatc-forgejo.env.
ARG FORGEJO_TOKEN=""

# ── Build frontend ───────────────────────────────────────────────────────────
FROM node:22-slim AS builder
ARG FORGEJO_TOKEN
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# pnpm NO expande variables en las credenciales de un .npmrc de proyecto (podria filtrar el secreto a
# un registro ajeno), asi que el token se escribe en el .npmrc del usuario y se borra en el mismo RUN.
RUN printf '//git.siatc.cloud/api/packages/MT_Ind/npm/:_authToken=%s\n' "$FORGEJO_TOKEN" > /root/.npmrc \
 && pnpm install --frozen-lockfile \
 && rm -f /root/.npmrc
COPY . .
RUN pnpm run build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime
ARG FORGEJO_TOKEN
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN printf '//git.siatc.cloud/api/packages/MT_Ind/npm/:_authToken=%s\n' "$FORGEJO_TOKEN" > /root/.npmrc \
 && pnpm install --frozen-lockfile --prod \
 && rm -f /root/.npmrc \
 && npm install -g tsx
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
