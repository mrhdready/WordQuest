---
phase: quick-261024-vnx
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/features/manage/ProgressPage.tsx
  - frontend/src/features/manage/ProgressPage.test.tsx
  - frontend/e2e/manage.spec.ts
  - setup.sh
  - .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh
  - Documentation/Installation.md
  - Documentation/WordQuest_Konzept_und_Architektur.md
  - README.md
  - .env.example
  - docker-compose.quick.yml
  - docker-compose.yml
  - .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh
autonomous: true
requirements: [DESIGN-01, SETUP-01, REL-03, REL-04]

estimate:
  tokens: 150000
  raw_tokens: 150000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "1: Auf /verwalten/fortschritt traegt bei zwei oder mehr Kindern genau die gedrueckte Kapsel (aria-pressed=true) ein Haken-Icon (lucide Check, aria-hidden); jede nicht gedrueckte Kapsel hat keins. Die Auswahl ist damit ohne Farbe erkennbar (WCAG 2.2 SC 1.4.1), auch in Graustufen und bei prefers-reduced-transparency. vitest rot vor dem Fix, gruen danach."
    - "2: Ist beim Heimnetz-Betrieb (docker-compose.quick.yml) der Port belegt, bricht setup.sh mit 'Der Port <port> ist schon belegt. Trage in .env eine Zeile WQ_PORT=9000 ein (oder ändere die vorhandene Zeile WQ_PORT=) und starte ./setup.sh noch einmal.' ab; Dockers eigene Ausgabe bleibt sichtbar; andere Startfehler verhalten sich wie bisher. Belegt im Install-Smoke."
    - "3: Installation.md sagt Laien, wie die WQ_PORT-Zeile angehaengt wird, dass .env versteckt ist (ls -a), wie der zweite setup.sh-Lauf aussieht, welche Adresse aus hostname -I gilt, wie die STATUS-Spalte aussieht und dass curl | tar xz nichts ausgibt. Jede zitierte setup.sh-Zeile steht woertlich in setup.sh."
    - "4: README Variante B sagt 'ändern' statt 'eintragen'; jede dort genannte Variable steht schon in .env.example. Kein Schritt erzeugt doppelte Zeilen in .env."
    - "5: Die Version ist ueberall 1.0.1: .env.example WQ_VERSION, beide Standardwerte je api und web in beiden Compose-Dateien, Installation.md, Konzept; release-package.sh unveraendert und akzeptiert den Tag v1.0.1; Release-Smoke erwartet 1.0.1 und ist gruen."
    - "6: Volles Projekt-Gate gruen (Backend im SDK-Container, Frontend im node:22-Container), e2e mit axe 0 Verstoessen inkl. Fortschritt mit zwei Kindern, Install-Smoke SMOKE OK, Release-Smoke RELEASE-SMOKE OK; Review durch Subagent, Befunde behoben oder begruendet."
  artifacts:
    - path: frontend/src/features/manage/ProgressPage.tsx
      provides: "Check-Icon in der aktiven Kind-Kapsel"
      contains: "Check"
    - path: frontend/src/features/manage/ProgressPage.test.tsx
      provides: "Test: gedrueckte Kapsel mit svg, ungedrueckte ohne, Wechsel per Klick"
    - path: frontend/e2e/manage.spec.ts
      provides: "e2e: Fortschritt mit zwei Kindern, Haken nur an der Auswahl, axe 0"
    - path: setup.sh
      provides: "Deutscher Port-Hinweis bei belegtem Port (nur Heimnetz-Variante)"
      contains: "ist schon belegt"
    - path: .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh
      provides: "Abschnitt Port belegt mit PORT-HINWEIS OK"
      contains: "PORT-HINWEIS OK"
    - path: .env.example
      provides: "WQ_VERSION=1.0.1"
      contains: "WQ_VERSION=1.0.1"
  key_links:
    - from: setup.sh
      to: Documentation/Installation.md
      via: "Port-Hinweis und Zeilen des zweiten Laufs woertlich gleich"
      pattern: "ist schon belegt"
    - from: .env.example
      to: .github/release-package.sh
      via: "Tag v1.0.1 == 'v' + WQ_VERSION"
      pattern: "^WQ_VERSION=1\\.0\\.1$"
    - from: .env.example
      to: .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh
      via: "EXPECTED_VERSION gleich WQ_VERSION"
      pattern: "EXPECTED_VERSION=1\\.0\\.1"
    - from: Documentation/Installation.md
      to: .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh
      via: "Seitenabgleich: jeder bash-Block-Befehl laeuft oder steht in HANDGRIFFE, jede text-Block-Zeile steht in einem Log, kein 0.0.0.0 auf der Seite"
      pattern: "page_lines"
---

<objective>
Release 1.0.1 lokal vorbereiten: Befunde aus der UAT vom 2026-10-24 und aus dem
Anfaenger-Installationstest (Debian arm64, Installation.md woertlich befolgt) beheben
und die Version auf 1.0.1 heben. Kein Push, kein Tag (macht der Orchestrator danach).

Purpose: WordQuest 1.0.0 ist veroeffentlicht (Tag v1.0.0 auf 8f3c6ab). 1.0.1 behebt
einen WCAG-1.4.1-Verstoss auf der Fortschritt-Seite, eine falsche Anleitung in README
Variante B, eine englische Docker-Meldung ohne Ausweg bei belegtem Port und mehrere
Stolperstellen auf der Installationsseite.

Output: drei atomare Commits (Fortschritt, Setup/Doku, Release 1.0.1), volles Gate,
beide Smokes, e2e mit axe, Subagent-Review, SUMMARY.

Zuschnitt: Drei unabhaengige Fixes ohne gemeinsamen Pfad durch Schichten. Statt eines
Tracers bringt jeder Task seinen eigenen End-to-End-Beleg mit (Task 1: vitest + echter
Browser mit axe; Task 2: Install-Smoke gegen echten Docker-Stack; Task 3: Release-Smoke
aus dem gebauten Paket).

Nicht im Scope (Koordinator, nicht umsetzen): fester Compose-Projektname
`name: wordquest` fuer die Installation, Anleitung zur Docker-Installation.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@DESIGN.md

Belegte Fundstellen aus der Planung (Stand 07e2b28):
- frontend/src/features/manage/ProgressPage.tsx:66-85 Kapselreihe, nur bei mehr als einem Kind; aktiv = `glass-selected text-primary`, sonst `glass text-ink`; `aria-pressed` gesetzt.
- frontend/src/features/learn/LearnHomePage.tsx:2 importiert `Check` aus `lucide-react`; :171 `{active ? <Check className="size-6 shrink-0" aria-hidden /> : null}` als Vorbild.
- Icons neben Fliesstext in Buttons nutzen `size-5` (ManageLayout.tsx:57, SetDetailPage.tsx:118); `size-5` und `size-6` sind beide token-konform (`npm run design:classes`).
- Bestehende Icon-Tests fragen `element.querySelector('svg')` ab (LearnHomePage.test.tsx:94/102); `@testing-library/user-event` ist installiert (AccountPage.test.tsx u. a.).
- frontend/e2e/manage.spec.ts:717-760 `test.describe` mit `serviceWorkers: 'block'` und Helfer `rewrite(page, url, change)`; Test „Reflow bei 320 px …“ haengt per `rewrite(page, /\/api\/v1\/learners$/, …)` ein zweites Kind an — gleiches Muster verwenden. Demo-Daten haben nur ein Kind („Max“), deshalb deckt „Fortschritt: axe 0“ (Zeile 706) die Kapseln heute nicht ab.
- setup.sh:11-13 Helfer `say`/`warn`/`die`; :16 `env_value`; :94 `docker compose up -d </dev/null` ohne Pruefung (set -e beendet mit Dockers englischer Meldung); :159-169 Abschluss berechnet `compose_file` und `port` (Traefik-Variante = `compose_file` leer oder `docker-compose.yml*`).
- setup.sh:61 „✓ .env existiert bereits — unverändert.“, Elternkonto-Zweig „✓ Elternkonto ist schon angelegt — unverändert.“, Abschluss ohne neue E-Mail „Fertig. WordQuest läuft unter: ${url} — Melde dich dort mit deinem Elternkonto an.“
- docker-compose.quick.yml:20 `name: wordquest`, :72 Port `"${WQ_PORT:-8080}:8080"`; docker-compose.yml:99-100 feste Ports 80/443 (WQ_PORT wirkt dort nicht).
- setup-smoke.sh exportiert COMPOSE_PROJECT_NAME=wq-smoke, WQ_PORT=18081, COMPOSE_FILE=docker-compose.quick.yml:docker-compose.build.yml; Abschnitt „== Lauf 2“ ca. Zeile 92; startet in „PAR-05“ Playwright auf dem Host (`npm --prefix "$ROOT/frontend" run e2e -- first-run.spec.ts`).
- release-smoke.sh:247-275 und :1085-1114 Seitenabgleich der Installation.md: jede Zeile eines ```bash-Blocks muss im Smoke laufen (`page_cmd`) oder in `HANDGRIFFE` stehen; jedes feste Stueck einer ```text-Zeile muss in einem `.smoke/*.log` vorkommen; `0.0.0.0` darf nicht auf der Seite stehen; nur bash/text-Bloecke erlaubt. Prosa und Inline-Code werden nicht abgeglichen.
- release-smoke.sh:34 `EXPECTED_VERSION=1.0.0` (prueft .env.example und .env dagegen), Kommentare :6, :194, :291 nennen 1.0.0; :865 `serve_pkg '1.0.0|x'` ist ein absichtlich ungueltiger Versionswert.
- Versionsstellen: .env.example:18; docker-compose.quick.yml:42/:70; docker-compose.yml:31/:60; Documentation/Installation.md:55; Documentation/WordQuest_Konzept_und_Architektur.md:660. setup.sh, upgrade.sh (liest WQ_VERSION aus .env.example), restore.sh und setup-smoke.sh (eigener Tag smoke-…) haben keine feste Version.
- .github/release-package.sh:18-20 bricht ab, wenn Tag != "v" + WQ_VERSION aus .env.example; :8 Kommentar „(CI: v1.0.0)“ ist ein Beispiel. Skript nicht aendern.
- README.md:49-55 Variante B „In `.env` von Hand eintragen: …“; :69-75 Block „Dafür in `.env`:“ mit WQ_HOST, WQ_ACME_DNS_PROVIDER, CF_DNS_API_TOKEN. .env.example enthaelt bereits COMPOSE_FILE, WQ_IMAGE_PREFIX, WQ_VERSION, WQ_HOST, WQ_TIMEZONE, WQ_SEED_DEMO_DATA, WQ_ACME_EMAIL, WQ_ACME_DNS_PROVIDER, CF_DNS_API_TOKEN; WQ_RELEASE_URL und WQ_PORT stehen nicht darin (Anhaengen ist dort richtig).
- Playwright 1.64.0 erwartet ~/Library/Caches/ms-playwright/chromium-1248, chromium_headless_shell-1248, ffmpeg-1013; installiert sind nur bis Build 1243 (chromium-1243, chromium_headless_shell-1243, ffmpeg-1011). Es gibt keine Umgebungsvariable fuer einen eigenen Browserpfad; `PLAYWRIGHT_BROWSERS_PATH` wirkt. e2e (learn.spec.ts:348 `http://wordquest.test:18080`) und Service-Worker-Tests brauchen den Host-Port 18080 und localhost als sicheren Kontext.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Fortschritt — Haken an der gewaehlten Kind-Kapsel (WCAG 1.4.1)</name>
  <files>frontend/src/features/manage/ProgressPage.test.tsx, frontend/src/features/manage/ProgressPage.tsx, frontend/e2e/manage.spec.ts</files>
  <behavior>
    - Zwei Kinder (Mia kind-1, Ben kind-2): Button „Mia“ mit pressed=true enthaelt ein svg; Button „Ben“ mit pressed=false enthaelt keins.
    - Nach Klick auf „Ben“: „Ben“ pressed=true mit svg, „Mia“ pressed=false ohne svg.
    - Barrierefreier Name der Kapsel bleibt der Kindername (Icon und Avatar sind aria-hidden).
  </behavior>
  <action>
    Zuerst rot: In ProgressPage.test.tsx einen Test „Gewaehltes Kind traegt einen Haken, nicht nur eine Farbe (WCAG 1.4.1)“ ergaenzen. fetch per vi.stubGlobal stubben wie die vorhandenen Helfer: `/learners` liefert zwei Kinder (`{ id: 'kind-1', displayName: 'Mia', avatarKey: 'fox' }`, `{ id: 'kind-2', displayName: 'Ben', avatarKey: 'fox' }`), `/overview` die Kennzahlen wie in stubOverview, `/traffic-light` ein leeres Array (URL-Abgleich per endsWith wie im Bestand). Abfragen per `screen.findByRole('button', { name: 'Mia', pressed: true })` bzw. `getByRole('button', { name: 'Ben', pressed: false })` und `.querySelector('svg')` (Muster LearnHomePage.test.tsx:94/102). Danach mit `userEvent.setup()` auf „Ben“ klicken und die Umkehrung pruefen. Test im node:22-Container laufen lassen und den roten Lauf (Anzahl Fehlschlaege, Ursache) fuer das SUMMARY festhalten.

    Dann gruen: In ProgressPage.tsx `Check` aus `lucide-react` importieren und in der Kapsel nach dem Namens-span nur fuer `learner.id === learnerId` rendern, mit `className="size-5 shrink-0"` und `aria-hidden` (Muster LearnHomePage.tsx:171; size-5 statt size-6, weil die Kapsel type-body-md-strong traegt wie die Navigation in ManageLayout.tsx:57). Farbklassen und aria-pressed bleiben unveraendert. Keine Inline-Styles, kein Hex, keine Einzelfall-px (DESIGN.md, AGENTS.md).

    e2e: In frontend/e2e/manage.spec.ts innerhalb des vorhandenen `test.describe` mit `serviceWorkers: 'block'` einen Test „Fortschritt mit zwei Kindern: Haken nur an der Auswahl, axe 0“ ergaenzen. Per `rewrite(page, /\/api\/v1\/learners$/, …)` ein zweites Kind `{ ...items[0], id: '00000000-0000-0000-0000-000000000002', displayName: 'Lena' }` anhaengen (Muster Reflow-Test), `/verwalten/fortschritt` oeffnen, auf `Level <n>` warten, pruefen: genau ein Button mit pressed=true, dessen `locator('svg')` Anzahl 1 hat; Button „Lena“ pressed=false mit `locator('svg')` Anzahl 0; danach `checkPage(page)`. Nicht auf „Lena“ klicken (die Fantasie-ID haette keine Uebersicht).

    Commit (nur diese drei Pfade explizit): `fix: Fortschritt zeigt das gewaehlte Kind mit Haken statt nur per Farbe` mit Trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  </action>
  <verify>
    <automated>docker run --rm -v "$PWD":/repo -v /repo/frontend/node_modules -w /repo/frontend node:22 bash -c 'npm ci --no-audit --no-fund >/dev/null && npx vitest run src/features/manage/ProgressPage.test.tsx && npm run design:classes'</automated>
  </verify>
  <done>Der neue vitest-Fall war vor dem Fix rot (Anzahl und Ursache im SUMMARY) und ist danach gruen; alle Faelle in ProgressPage.test.tsx gruen; design:classes ohne Treffer; der e2e-Test existiert und laeuft im Abschluss-Gate gruen mit axe 0.</done>
</task>

<task type="auto">
  <name>Task 2: Setup — deutscher Hinweis bei belegtem Port, Installationsseite fuer Anfaenger, README Variante B</name>
  <files>setup.sh, .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh, Documentation/Installation.md, Documentation/WordQuest_Konzept_und_Architektur.md, README.md</files>
  <action>
    (A) setup.sh: Die Zeile mit `compose_file` samt ihrem Kommentar und die Zuweisung `port="${WQ_PORT:-$(env_value WQ_PORT)}"` aus dem Abschluss-Block nach oben direkt vor `say "Starte WordQuest …"` verschieben; der Abschluss nutzt die Variablen unveraendert weiter (keine doppelte Berechnung). Die bare Zeile `docker compose up -d </dev/null` ersetzen: kombinierte Ausgabe in eine Variable fangen (`up_log="$(docker compose up -d </dev/null 2>&1)"` mit `||`-Zweig, damit set -e nicht vorher abbricht). Erfolg: Ausgabe unveraendert auf stdout ausgeben. Fehler: Ausgabe unveraendert auf stderr ausgeben; ist es die Heimnetz-Variante (gleiche Bedingung wie der else-Zweig im Abschluss: `compose_file` nicht leer und nicht `docker-compose.yml*`) und enthaelt die Ausgabe `port is already allocated` oder `address already in use` (grep -qE auf einen Here-String, Bash 3.2), dann `die` mit genau: `Der Port ${port:-8080} ist schon belegt. Trage in .env eine Zeile WQ_PORT=9000 ein (oder ändere die vorhandene Zeile WQ_PORT=) und starte ./setup.sh noch einmal.` Sonst `exit 1` ohne neuen Text (bisheriges Verhalten). Kurzer deutscher Kommentar mit ae/oe/ue zum Warum: Dockers englische Meldung laesst Laien ohne Ausweg; die Traefik-Variante hat feste Ports 80/443, dort hilft WQ_PORT nicht. Keine weiteren Aenderungen an setup.sh.

    (A) setup-smoke.sh: Direkt nach dem Abschnitt „== Lauf 2“ einen Abschnitt „== Port belegt (Setup-Hinweis)“ einfuegen. Der Stack wq-smoke haelt dann 18081. setup.sh im selben Arbeitsverzeichnis mit `COMPOSE_PROJECT_NAME=wq-smoke-port` und `</dev/null` aufrufen, Ausgabe nach `port.log`; erwartet: Exit ungleich 0, `grep -qF "Der Port ${WQ_PORT} ist schon belegt." port.log`, `grep -qF 'WQ_PORT=9000' port.log`, und Dockers Ausgabe steht noch darin (`grep -qE 'port is already allocated|address already in use' port.log`). Danach `COMPOSE_PROJECT_NAME=wq-smoke-port docker compose down -v --remove-orphans </dev/null` und pruefen, dass der wq-smoke-Stack weiter antwortet (HTTP 200 auf `http://localhost:${WQ_PORT}/`); `echo "PORT-HINWEIS OK"`. Die Funktion `cleanup` raeumt zusaetzlich das Projekt wq-smoke-port ab (fuer Abbrueche mittendrin). In „Lauf 1“ eine Zeile ergaenzen: run1.log enthaelt nicht „ist schon belegt“. Nur Bash-3.2-Mittel.

    (B) Documentation/Installation.md — nur Prosa und Inline-Code, keine neuen ```bash- oder ```text-Bloecke (sonst greift der Seitenabgleich des Release-Smokes), keine Wildcard-Adresse fuer alle Interfaces (T-03-16-Pruefung im Release-Smoke, siehe release-smoke.sh:1092):
    1. Nach dem Block mit `curl … | tar xz` und `cd wordquest`: Der Download gibt nichts aus, das ist normal; danach gibt es den Ordner `wordquest`.
    2. Nach dem text-Block mit den Abschlusszeilen: Beim zweiten Lauf steht statt „✓ .env angelegt.“ die Zeile „✓ .env existiert bereits — unverändert.“, statt „✓ Elternkonto angelegt.“ die Zeile „✓ Elternkonto ist schon angelegt — unverändert.“, und die Zeile „Fertig.“ endet mit „Melde dich dort mit deinem Elternkonto an.“ Jede zitierte Zeile vorher in setup.sh per grep -F gegenpruefen.
    3. Beim Absatz zu `hostname -I`: Der Befehl zeigt oft mehrere Eintraege; die Adresse im Heimnetz beginnt meist mit `192.168.`, die anderen Eintraege kannst du ignorieren. Weil setup.sh den ersten Eintrag nimmt: Beginnt die Adresse in der Zeile „Fertig.“ nicht mit `192.168.`, nimm die aus `hostname -I`, die damit beginnt.
    4. Absatz Port 8080 (aktuell Zeile 77): setup.sh bricht dann mit „Der Port 8080 ist schon belegt. …“ ab; die Zeile haengst du mit `echo "WQ_PORT=9000" >> .env` an; `.env` beginnt mit einem Punkt und ist versteckt, `ls` zeigt sie nicht, `ls -a` schon.
    5. Satz zu `docker compose ps` (aktuell Zeile 85): Die Liste zeigt die vier Dienste `api`, `backup`, `db` und `web`; in der Spalte `STATUS` beginnt jeder Eintrag mit `Up`; `(health: starting)` dahinter ist in der ersten Minute normal.
    6. „Hilfe bei Problemen“ → „Der Port ist belegt.“: wie die Nachbareintraege die Meldung als Zitat (`> Der Port 8080 ist schon belegt. Trage in .env eine Zeile WQ_PORT=9000 ein (oder ändere die vorhandene Zeile WQ_PORT=) und starte ./setup.sh noch einmal.`), Hinweis auf den frueheren Schnelltest behalten, `echo "WQ_PORT=9000" >> .env` nennen. Dockers Originalmeldung nicht zitieren (enthaelt die verbotene Adresse).

    Konzept (Documentation/WordQuest_Konzept_und_Architektur.md, Absatz „Zielbild Erstinstallation“, Satz „Heute erzeugt `setup.sh` …“): nach „startet den Stack“ einen Halbsatz ergaenzen, dass setup.sh bei belegtem Port in der Heimnetz-Variante mit einem deutschen Hinweis auf `WQ_PORT` abbricht.

    README.md Variante B (Zeilen 49-55): den ersten Satz („In `.env` … : `COMPOSE_FILE=docker-compose.yml`, …“) ersetzen durch eine Anweisung, die vorhandenen Zeilen zu aendern statt neue anzuhaengen (sonst stehen sie doppelt da): `COMPOSE_FILE` auf `docker-compose.yml`, `WQ_HOST`, `WQ_ACME_EMAIL` sowie `WQ_ACME_DNS_PROVIDER` und das Token des DNS-Anbieters (siehe unten); `WQ_IMAGE_PREFIX` nur aendern, wer eigene Images baut. Rest des Absatzes (setup.sh laesst .env unveraendert usw.) bleibt. Block „Dafür in `.env`:“ (Zeile 69) → „Dafür in `.env` diese Zeilen ändern:“, Block unveraendert. Den Fork-Satz mit `WQ_RELEASE_URL` und den Satz zu anderen DNS-Anbietern nicht aendern (Variablen stehen nicht in .env.example, Anhaengen ist dort richtig). Jede im Variante-B-Text genannte Variable gegen .env.example pruefen.

    Commits (explizite Pfade, Trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`): `fix: setup.sh nennt bei belegtem Port den Ausweg ueber WQ_PORT` (setup.sh, setup-smoke.sh, Installation.md, Konzept) und `docs: README Variante B aendert vorhandene .env-Zeilen statt sie anzuhaengen` (README.md).
  </action>
  <!-- planner-region-allow: 0.0.0.0 -->
  <verify>
    <automated>bash -n setup.sh && bash -n .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh && grep -qF 'ist schon belegt. Trage in .env eine Zeile WQ_PORT=9000 ein (oder ändere die vorhandene Zeile WQ_PORT=) und starte ./setup.sh noch einmal.' setup.sh && grep -qF 'ist schon belegt. Trage in .env eine Zeile WQ_PORT=9000 ein (oder ändere die vorhandene Zeile WQ_PORT=) und starte ./setup.sh noch einmal.' Documentation/Installation.md && grep -qF 'PORT-HINWEIS OK' .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh && grep -qF '✓ .env existiert bereits — unverändert.' setup.sh && grep -qF '✓ .env existiert bereits — unverändert.' Documentation/Installation.md && grep -qF 'Melde dich dort mit deinem Elternkonto an.' Documentation/Installation.md && grep -qF 'ls -a' Documentation/Installation.md && grep -qF '192.168.' Documentation/Installation.md && grep -qF '(health: starting)' Documentation/Installation.md && ! grep -qF '0.0.0.0' Documentation/Installation.md && ! grep -qF 'von Hand eintragen' README.md && echo TASK2-OK</automated>
  </verify>
  <done>setup.sh und setup-smoke.sh syntaktisch gueltig; Port-Hinweis woertlich gleich in setup.sh und Installation.md; die fuenf Anfaenger-Punkte stehen auf der Seite; README Variante B ohne „von Hand eintragen“; Install-Smoke im Abschluss-Gate mit PORT-HINWEIS OK und SMOKE OK.</done>
</task>

<task type="auto">
  <name>Task 3: Version 1.0.1 an allen Stellen, Release-Smoke folgt</name>
  <files>.env.example, docker-compose.quick.yml, docker-compose.yml, Documentation/Installation.md, Documentation/WordQuest_Konzept_und_Architektur.md, .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh</files>
  <action>
    Sechs Stellen derselben Versionsnummer (mechanisch, deshalb ein Task trotz sechs Dateien):
    - .env.example: `WQ_VERSION=1.0.1`.
    - docker-compose.quick.yml (api und web) und docker-compose.yml (api und web): Standardwert in `${WQ_VERSION:-…}` auf 1.0.1.
    - Documentation/Installation.md Zeile ~55: „in der Version 1.0.1“.
    - Documentation/WordQuest_Konzept_und_Architektur.md Zeile ~660: Standard-Tag auf `${WQ_VERSION:-1.0.1}`; den Satz zum semver-Tag neutral fassen: aus einem Tag `vX.Y.Z` entsteht das Image-Tag `X.Y.Z` (`type=semver`).
    - release-smoke.sh: `EXPECTED_VERSION=1.0.1`. Die Kommentare in Zeile 6, 194 und 291 neutral fassen (Tag aus EXPECTED_VERSION statt einer Zahl), damit der naechste Release nur EXPECTED_VERSION aendert. `serve_pkg '1.0.0|x'` (Zeile ~865) bleibt: absichtlich ungueltiger Wert fuer den Fall „ungueltige Zielversion“. `OLD_VERSION=0.0.0-smoke` bleibt.
    .github/release-package.sh nicht aendern. Danach `git grep -n '1\.0\.0' -- . ':!.planning' ':!**/package-lock.json'` laufen lassen und jede verbleibende Fundstelle mit Grund im SUMMARY auflisten; erwartet ist nur .github/release-package.sh:8 (Kommentar-Beispiel, Skript bleibt unveraendert). Zusaetzlich festhalten: setup.sh, upgrade.sh, restore.sh, setup-smoke.sh haben keine feste Version (upgrade.sh liest WQ_VERSION aus .env.example; setup-smoke.sh nutzt `smoke-<zeit>-<pid>`).

    Commit (explizite Pfade, Trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`): `chore: Version 1.0.1`.
  </action>
  <verify>
    <automated>grep -qx 'WQ_VERSION=1.0.1' .env.example && [ "$(grep -oF 'WQ_VERSION:-1.0.1}' docker-compose.quick.yml | wc -l | tr -d ' ')" = 2 ] && [ "$(grep -oF 'WQ_VERSION:-1.0.1}' docker-compose.yml | wc -l | tr -d ' ')" = 2 ] && ! git grep -qF 'WQ_VERSION:-1.0.0' -- . ':!.planning' && grep -qF 'in der Version 1.0.1' Documentation/Installation.md && grep -qx 'EXPECTED_VERSION=1.0.1' .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh && git diff --quiet HEAD -- .github/release-package.sh && TAG=v1.0.1 bash -c 'v="$(sed -n "s/^WQ_VERSION=//p" .env.example | tail -n 1)"; [ "$TAG" = "v$v" ]' && echo TASK3-OK</automated>
  </verify>
  <done>Alle sechs Stellen nennen 1.0.1; release-package.sh unveraendert und Tag v1.0.1 passt zu .env.example; Liste der bewusst verbleibenden 1.0.0-Fundstellen im SUMMARY; Release-Smoke im Abschluss-Gate RELEASE-SMOKE OK.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Docker-Ausgabe → Terminal der Eltern | setup.sh gibt die gefangene Ausgabe von `docker compose up` wieder aus |
| Anleitung → .env der Eltern | Doku-Befehle schreiben in die Konfigurationsdatei |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261024-vnx-01 | Information Disclosure | setup.sh, Ausgabe von `docker compose up` | low | accept | Die Ausgabe enthaelt Container-, Netz- und Portnamen, keine Secrets (Secrets kommen als Dateien, nicht als Argumente); sie wurde bisher genauso angezeigt. |
| T-261024-vnx-02 | Tampering | Installation.md, Anhaengen an .env | low | mitigate | Nur `WQ_PORT` wird angehaengt (steht nicht in .env.example); README Variante B sagt „ändern“ statt anhaengen, damit keine doppelten Zeilen entstehen. |
| T-261024-vnx-03 | Information Disclosure | Installation.md Empfehlungen | medium | mitigate | Keine Empfehlung, die alle Interfaces nennt; `! grep -qF '0.0.0.0'` in Task 2 und die T-03-16-Pruefung im Release-Smoke. |
| T-261024-vnx-SC | Tampering | npm/pip/cargo installs | high | mitigate | Dieser Plan installiert nichts (npm ci nur aus dem bestehenden Lockfile im Container). Ein Browser-Download fuer Playwright braucht vorher die Freigabe von Dennis (siehe verification, Schritt 4). |
</threat_model>

<verification>
Nach Task 3, auf dem Stand des letzten Commits, alles aus dem Repo-Root. Jede Zahl (Tests, passed/skipped, axe-Befunde, Exit-Codes) ins SUMMARY.

Verbote: Ports 8080, 18090, 18091, 18092 und die Docker-Projekte wq-preview, wq-mig, wq-traefik, wordquest nicht anfassen. Kein `docker compose` im Repo-Root ohne `-f`/eigenen Projektnamen (docker-compose.quick.yml traegt `name: wordquest`). Die untracked Dateien .planning/milestone.lock, .planning/state.json, .planning/phases/03.1.1-vocabulary-pictures/.gitkeep nie committen oder loeschen; nie `git add -A`/`git add .`. Kein Push, kein Tag.

1. Backend: `bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh` (Build mit /warnaserror und Tests im SDK-Container).
2. Frontend im node:22-Container (lokales Node 26 hat Fehler verdeckt; anonymes Volume schuetzt die darwin-node_modules des Hosts fuer Playwright): `docker run --rm -v "$PWD":/repo -v /repo/frontend/node_modules -w /repo/frontend node:22 bash -c 'npm ci && npm run lint && npm run typecheck && npm run build && npm test && npm run design:check && npm run design:classes'`. design:check-Ausgabe lesen; Kontrast-Warnungen gelten als blockierend.
3. Playwright-Browser: `ls ~/Library/Caches/ms-playwright`. Fehlt chromium_headless_shell-1248, ohne Installation versuchen: Verzeichnis im Scratchpad anlegen, darin Symlinks `chromium-1248`, `chromium_headless_shell-1248`, `ffmpeg-1013` auf die neuesten vorhandenen Builds (1243 bzw. ffmpeg-1011), und `PLAYWRIGHT_BROWSERS_PATH` darauf fuer Schritt 4 und 5 exportieren. Den gewaehlten Weg und seine Grenze (aelterer Browser-Build als von 1.64 erwartet) im SUMMARY nennen. Scheitert das an Protokoll- oder Startfehlern des Browsers (nicht an Testbefunden): anhalten und melden, mit dem Vorschlag `npx playwright install chromium` (stellt nur den fest gepinnten Build 1248 wieder her) zur Freigabe durch Dennis. Kein Repo-Code fuer den Workaround, keine neue Dependency.
4. e2e mit axe: `cd frontend && npm run e2e:stack && npx playwright test`; danach immer `docker compose -f e2e/docker-compose.e2e.yml down -v` (aus frontend/). Erwartet: alle gruen ausser dem bekannten skip `first-run`, darunter „Fortschritt: axe 0“ und „Fortschritt mit zwei Kindern: Haken nur an der Auswahl, axe 0“ mit 0 Verstoessen. Im e2e-API-Log kein `fail:`.
5. Install-Smoke: `bash .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh` → enthaelt PORT-HINWEIS OK und endet mit SMOKE OK.
6. Release-Smoke: `bash .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh` → RELEASE-SMOKE OK, inkl. SEITE OK (Seitenabgleich der geaenderten Installation.md).
7. A11y bei interaktiver Aenderung: Kapselreihe per Tastatur (Tab erreicht jede Kapsel, sichtbarer Fokus, Enter/Leertaste waehlt, Haken wandert) und 200 % Zoom ohne Verlust im laufenden e2e-Stack pruefen (mit dem zweiten Kind per Route-Umschreibung wie im e2e-Test oder einem echt angelegten zweiten Kind) und mit Befund festhalten.
8. Review: Ein Subagent prueft den Gesamtdiff seit Planbeginn (`git diff 07e2b28..HEAD -- . ':!.planning/quick'`) gegen die must_haves dieses Plans: Korrektheit, Sicherheit (setup.sh-Ausgabe, .env-Hinweise), AGENTS.md-Regeln (Einfachheit, Konventionen, Doku = Code, DESIGN.md-Tokens), Tests, Barrierefreiheit. Befunde beheben (eigener Commit, Gate-Schritte, die der Fix beruehrt, erneut) oder begruendet zurueckweisen; beides ins SUMMARY.
9. Formatter/Linter nur auf die eigenen Dateien: lint laeuft in Schritt 2; fuer die Shell-Skripte reicht `bash -n` (kein neues Werkzeug einfuehren).
</verification>

<success_criteria>
- Fortschritt: Haken nur an der gewaehlten Kapsel, vitest rot→gruen belegt, e2e mit zwei Kindern axe 0, Tastatur und 200 % belegt.
- setup.sh: deutscher Port-Hinweis in der Heimnetz-Variante, im Install-Smoke mit PORT-HINWEIS OK belegt; andere Startfehler unveraendert.
- Installation.md: fuenf Anfaenger-Punkte und neuer Port-Hinweis, woertlich zu setup.sh passend; Release-Smoke SEITE OK.
- README Variante B: „ändern“, jede Variable in .env.example vorhanden.
- Version 1.0.1 an allen sechs Stellen; release-package.sh unveraendert; Liste bewusst verbliebener 1.0.0-Fundstellen.
- Volles Gate, e2e, beide Smokes gruen; Review-Befunde behoben oder begruendet; vier Commits (fix Fortschritt, fix Setup, docs README, chore Version) plus ggf. Review-Fixes; kein Push, kein Tag.
</success_criteria>

<output>
Create `.planning/quick/261024-vnx-release-1-0-1-kinderwahl-auf-fortschritt/261024-vnx-SUMMARY.md` when done: Commits (Hash, Message), roter und gruener vitest-Lauf, Gate-Tabelle (Befehl, Stand, Exit, Ergebnis), A11y-Beleg (axe-Version, Seiten, Befunde, Tastatur, 200 %), Playwright-Weg aus Schritt 3, Liste der bewusst verbliebenen 1.0.0-Fundstellen mit Grund, Review-Befunde mit Entscheidung.
</output>
