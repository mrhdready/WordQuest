# syntax=docker/dockerfile:1
# Build-Kontext ist das Repository-Wurzelverzeichnis:
#   docker build -f backend/Dockerfile .

FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

# Erst nur die Projektdateien kopieren, damit das Restore-Ergebnis
# gecacht wird, solange sich keine Abhaengigkeit aendert.
COPY backend/Directory.Build.props backend/Directory.Packages.props backend/WordQuest.slnx ./
COPY backend/src/WordQuest.Shared.Kernel/*.csproj        src/WordQuest.Shared.Kernel/
COPY backend/src/WordQuest.Modules.Identity/*.csproj     src/WordQuest.Modules.Identity/
COPY backend/src/WordQuest.Modules.Content/*.csproj      src/WordQuest.Modules.Content/
COPY backend/src/WordQuest.Modules.Learning/*.csproj     src/WordQuest.Modules.Learning/
COPY backend/src/WordQuest.Modules.Gamification/*.csproj src/WordQuest.Modules.Gamification/
COPY backend/src/WordQuest.Infrastructure/*.csproj       src/WordQuest.Infrastructure/
COPY backend/src/WordQuest.Api/*.csproj                  src/WordQuest.Api/

RUN dotnet restore src/WordQuest.Api/WordQuest.Api.csproj

COPY backend/src/ src/
RUN dotnet publish src/WordQuest.Api/WordQuest.Api.csproj \
    -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
WORKDIR /app

# Zeitzonendaten: ohne sie findet TimeZoneInfo "Europe/Berlin" nicht und die
# Faelligkeiten landen in UTC. wget wird vom Healthcheck gebraucht.
RUN apk add --no-cache tzdata wget icu-libs \
    && addgroup -S wordquest && adduser -S -G wordquest wordquest

COPY --from=build /app/publish .

ENV ASPNETCORE_HTTP_PORTS=8080 \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false \
    TZ=Europe/Berlin

USER wordquest
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:8080/health/live || exit 1

ENTRYPOINT ["dotnet", "WordQuest.Api.dll"]
