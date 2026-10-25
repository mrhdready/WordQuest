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
# Template: Der Start des Images schreibt daraus conf.d/default.conf und setzt den
# HTTPS-Port als Ziel der Umleitung ein (nur Variablen mit Praefix WQ_).
COPY frontend/nginx.conf /etc/nginx/templates/default.conf.template
# Ausserhalb von conf.d, damit nginx die Datei nicht zusaetzlich auf http-Ebene laedt.
COPY frontend/nginx-security-headers.conf /etc/nginx/security-headers.conf

ENV WQ_HTTPS_PORT=443 NGINX_ENVSUBST_FILTER=WQ_

EXPOSE 8080 8443

# HTTP antwortet nur noch mit der Umleitung; geprueft wird die App ueber HTTPS.
# Ohne Zertifikatspruefung: Die CA liegt nicht im Image, nur der Handshake zaehlt.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --no-check-certificate -O /dev/null https://127.0.0.1:8443/ || exit 1
