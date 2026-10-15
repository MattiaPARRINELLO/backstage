# syntax=docker/dockerfile:1
#
# Image auto-hébergeable : build standalone Next.js puis exécution Node.
# Le dossier data/ (utilisateurs, config, caches) est un volume : il survit aux
# mises à jour de l'image.
#
#   docker compose up -d --build

# ── Dépendances ────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── Build ──────────────────────────────────────────────────────────────
FROM deps AS build
WORKDIR /app
COPY . .
# La clé VAPID publique est inlinée dans le bundle client : à passer au build
# si vous voulez les notifications push (même valeur que VAPID_PUBLIC_KEY).
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
RUN bun run build

# ── Runtime ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# Sortie standalone de Next (.next/standalone) + assets statiques + public.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

# Données persistantes (gitignorées : créées à l'exécution si absentes).
RUN mkdir -p /app/data && chown -R node:node /app/data
VOLUME ["/app/data"]

# Healthcheck : /login est public (renvoie 200 sans session).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/login || exit 1

USER node
EXPOSE 3000
CMD ["node", "server.js"]
