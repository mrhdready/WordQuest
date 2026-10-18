# syntax=docker/dockerfile:1
# Build-Kontext ist das Repository-Wurzelverzeichnis:
#   docker build -f frontend/Dockerfile .

# Build-Stage auf der Build-Plattform: die Ausgabe ist statisches dist/,
# unabhaengig von der Zielplattform (D-03).
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
