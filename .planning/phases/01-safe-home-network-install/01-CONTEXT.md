# Phase 1: Safe Home-Network Install - Context

**Gathered:** 2026-10-15 (Entscheidungen von Dennis in der Session, kein discuss-phase-Lauf)
**Status:** Ready for planning

<domain>
## Phase Boundary

Ein Elternteil installiert WordQuest im Heimnetz über HTTP mit eigenem Konto, erzeugten Secrets und täglichem Backup, kann das eigene Passwort und die PIN eines Kindes ohne Hilfe zurücksetzen und ein Kind anlegen und bearbeiten. Die Oberfläche folgt `DESIGN.md` (Liquid Glass). Anforderungen: DESIGN-01, SETUP-01…06, FIX-07, PAR-01, PAR-02, PAR-05, QUAL-02. SETUP-06 und FIX-07 sind bereits erledigt (Quick 261006-r7l) und brauchen nur noch den axe-Nachweis.

</domain>

<decisions>
## Implementation Decisions

### Ablauf
- **D-01:** Plan 1 ist DESIGN-01: Tailwind-Theme aus `DESIGN.md` exportieren (`npx @google/design.md export --format css-tailwind DESIGN.md`), Bausteine in `frontend/src/components/ui/` und alle Seiten auf die Tokens umstellen (Liquid Glass, Fallback, Abstands-Skala, A1–A12). Erst danach entstehen die neuen Formulare, damit sie gleich im neuen Design gebaut werden.
- **D-02:** Autonomer Lauf auf Branch `v1-fertig`: atomare Commits pro Plan erlaubt, **kein Push**.

### Design
- **D-03:** `DESIGN.md` ist normativ (Liquid Glass für alles, deckender Fallback bei `prefers-reduced-transparency` und ohne `backdrop-filter`). Keine Inline-Styles, kein Hex im JSX, keine Einzelfall-`px`.
- **D-04:** `01-UI-SPEC.md` (Revision 2026-10-15) ist der UI-Vertrag; wo er `DESIGN.md` widerspricht, gilt `DESIGN.md`.

### Konten und Secrets
- **D-05:** Passwort-Mindestlänge 8 Zeichen (App, `setup.sh`, Reset-Befehl) (UI-SPEC Q4).
- **D-06:** Reset-Befehl erzeugt ein Passwort und gibt es genau einmal aus; kein interaktives Tippen im Container (UI-SPEC Q5).
- **D-07:** Terminal-Texte in `setup.sh` mit echten Umlauten, bestehende Zeilen einmal angleichen (UI-SPEC Q6).

### Kinder
- **D-08:** PAR-05: Kind anlegen im selben Formular wie Kind bearbeiten (Modus "Anlegen", PIN Pflicht, Button "Kind anlegen") (UI-SPEC Q3).
- **D-09:** PIN 4–6 Ziffern, serverseitig validiert; kein Auto-Absenden bei 4 Ziffern mehr, sondern Taste "Los geht’s" (UI-SPEC D9).

### Tests und Werkzeuge
- **D-10:** Freigegebene neue Dev-Dependencies im Frontend: `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `@playwright/test`, `@axe-core/playwright`. Keine weiteren ohne Rückfrage.
- **D-11:** Formular-Tests mit Edge-Case-Matrix (ein Feld falsch, rotieren; exakte Fehlertexte; Enter-Submit eigener Pfad; Happy Path zuletzt) und axe 0 Verstöße (WCAG 2.2 AA) auf jeder berührten Seite, plus Tastatur-Durchgang und 200 % Zoom.
- **D-12:** Backend-Tests wie im Bestand: Unit-Tests für Domänenlogik, Integrationstests mit `WebApplicationFactory` gegen echtes PostgreSQL. Gate läuft in Docker (`mcr.microsoft.com/dotnet/sdk:10.0`, `node:22-alpine`), weil der Host kein .NET-SDK hat.

### Nach der Recherche (2026-10-16)
- **D-13:** Zusätzlich freigegebene Dependencies: `Microsoft.AspNetCore.Mvc.Testing` (neues Integrationstest-Projekt gegen echtes PostgreSQL) und `@testing-library/dom` (Peer von `@testing-library/react`).
- **D-14:** FIX-08 (Ziffernfeld per Tastatur) wandert nach Phase 1, weil `ProfilePickerPage` für PAR-02/D9 ohnehin umgebaut wird.
- **D-15:** Kindernamen über 100 Zeichen lehnt der Server mit 400 ab (heute 500): Fehlertext "Der Name darf höchstens 100 Zeichen lang sein." Die UI-SPEC-Aussage "kein Limit" gilt damit nicht mehr.
- **D-16:** Demo-Seed bleibt als Entwickler-Option (`WQ_SEED_DEMO_DATA`), ist im Heimnetz-Betrieb aus. Kein `--domain`-Schalter in Phase 1 (TLS-Weg ist v2, OPS2-01). `setup.sh` wird per Repo-Klon genutzt.
- **D-17:** Anzeigename des Elternkontos: `setup.sh` fragt ihn nicht ab; Standard "Eltern".
- **D-18:** Prüfung neuer Passwörter gegen Listen häufiger Passwörter ist nicht Teil von v1; als bekannte Lücke dokumentieren.
- **D-19:** Glas-Kontrast wird zusätzlich zum normalen axe-Lauf mit einfarbigem Hintergrund je Backdrop-Farbe geprüft (axe stuft Verläufe als "nicht prüfbar" ein). `primary` als Text auf `glass-clear` ist verboten (3,88:1).

### Claude's Discretion
- Schnitt der Pläne nach Plan 1, Reihenfolge der Backend-Arbeiten, Form des Backup-Containers (Rahmen: einfach für Laien, keine neue Infrastruktur über Docker Compose hinaus).

</decisions>

<specifics>
## Specific Ideas

- Visuelle Referenz: Mock-Seite "Liquid Glass (DESIGN.md)" im Artifact https://claude.ai/artifact/4HUanjXphd3KXaza37Kunz (30 Screens).
- Bekannte Beobachtungen aus dem Teststack: PIN-Eingabe reagiert nicht auf die Tastatur (FIX-08, Phase 2), abgebrochener Lauf verbraucht Tageslimit (FIX-09, Phase 2).

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `AGENTS.md` — Projektregeln (Gate, Review durch Subagent, Konventionen, DESIGN.md-Gate)
- `DESIGN.md` — Design-Tokens und Regeln (Liquid Glass)
- `.planning/phases/01-safe-home-network-install/01-UI-SPEC.md` — UI-Vertrag Phase 1
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` — Anforderungen und Erfolgskriterien
- `.planning/quick/261006-r7l-installer-rechte-lesbare-docker-secrets-/` — SETUP-06 / FIX-07 Stand und Belege
- `Documentation/WordQuest_Konzept_und_Architektur.md` — Konzept

</canonical_refs>
