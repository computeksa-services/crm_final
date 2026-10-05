# ---------- Etapa 1: compilar ----------
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Valores por defecto para que el build nunca falle por falta de variables.
# Los valores reales se inyectan en tiempo de arranque (ver docker-entrypoint.sh),
# asi la misma imagen sirve para cualquier entorno.
ARG VITE_WEBHOOK_URL=""
ARG VITE_GOOGLE_CLIENT_ID=""
ARG VITE_MICROSOFT_CLIENT_ID=""
ARG VITE_REDIRECT_URI=""

ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm run build

# ---------- Etapa 2: servir ----------
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh

# La regla de no-cache para /config.js ya esta en nginx.conf, dentro del bloque server.

RUN chmod +x /docker-entrypoint.sh

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]