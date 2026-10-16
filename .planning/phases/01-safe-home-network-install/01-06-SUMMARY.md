---
phase: 01-safe-home-network-install
plan: 06
subsystem: auth
tags: [password-change, account, edge-case-matrix, vitest, playwright, axe-core, ci, wcag22]
status: complete

requires:
  - 01-02 (AccountRules, AccountService, ApiFactory mit eigener DB je Instanz)
  - 01-03 (Field, ApiError.errors, renderWithProviders, Tab-Leiste, checkPage, globalSetup)
  - 01-04 (429-Text in readError, Design-Migration abgeschlossen)
  - 01-05 (reset-password nennt "Konto")
provides:
  - POST /api/v1/account/password (Guardian, Rate-Limit auth) mit 204/400/404, nie 401
  - AccountService.ChangePasswordAsync und Enum PasswordChange (NewPasswordBlank = 4)
  - Konto-Seite /verwalten/konto mit Tab "Konto" (KeyRound), SuccessNote in misc.tsx
  - Frontend-Gate in CI und AGENTS.md um npm test, design:check, design:classes
affects: [01-07, 01-08]

estimate:
  tokens: 150000
actuals:
  tokens: 11400
  tasks: 3
  commits: 3
plan_head_before: a79ac9a3b242f5adf25f6d331fc583c22add1a5c
plan_head_after: 59e651a1184df897d4e720f925ad319ebc443e32

tech-stack:
  added: []
  patterns:
    - "Formular mit Client-Pruefung beim Absenden: validate() liefert alle Feldfehler, Fokus aufs erste, Ref-Sperre plus disabled gegen Doppel-Absenden"
    - "Freiraum unter der schwebenden Tab-Leiste haengt an --wq-tab-bar-clearance; unter sm fuer zwei Zeilen"
    - "body als grid mit min-height: 100%, damit seine Box den Inhalt immer umschliesst (axe elmPartiallyObscured)"

key-files:
  created:
    - backend/src/WordQuest.Api/Endpoints/AccountEndpoints.cs
    - backend/src/WordQuest.Infrastructure/PasswordChange.cs
    - backend/tests/WordQuest.Api.Tests/AccountEndpointTests.cs
    - frontend/src/features/manage/AccountPage.tsx
    - frontend/src/features/manage/AccountPage.test.tsx
    - frontend/e2e/account.spec.ts
  modified:
    - backend/src/WordQuest.Api/Contracts/Contracts.cs
    - backend/src/WordQuest.Api/Program.cs
    - backend/src/WordQuest.Infrastructure/AccountService.cs
    - frontend/src/App.tsx
    - frontend/src/components/ui/misc.tsx
    - frontend/src/features/manage/ManageLayout.tsx
    - frontend/src/index.css
    - frontend/src/types.ts
    - .github/workflows/ci.yml
    - AGENTS.md
    - Documentation/WordQuest_Konzept_und_Architektur.md
    - README.md
    - DESIGN.md

key-decisions:
  - "Pruefreihenfolge im Service: Konto → neues Passwort leer/Leerraum → zu kurz → aktuelles Passwort; Hash ueber die unveraenderte Eingabe, keine Sitzungen widerrufen"
  - "Abweichende Wiederholung wird nur gemeldet, wenn das neue Passwort selbst gueltig ist: je Fall genau ein Fehler"
  - "Tab-Leiste bricht bei 320 px neben dem \"+\" in zwei Zeilen um; der Freiraum darunter waechst unter sm um eine Zeile (Tailwind-Stufe 15)"
  - "body waechst mit dem Inhalt (display: grid, min-height: 100%) statt fester Hoehe 100 %"

requirements-completed: []

coverage:
  - id: D1
    description: "Passwort aendern: 401 ohne Token, 403 Kind, falsches aktuelles 400 currentPassword, 7 Zeichen 400, acht Leerzeichen 400 (Hash unveraendert), 8 Zeichen 204 und Login neu 200/alt 401, Leerzeichen am Rand bleiben, nur das Konto aus dem Token aendert sich"
    requirement: SETUP-03
    verification:
      - kind: integration
        ref: "backend/tests/WordQuest.Api.Tests/AccountEndpointTests.cs (8/8 gegen PostgreSQL)"
        status: pass
      - kind: e2e
        ref: "frontend/e2e/account.spec.ts#Passwort ändern"
        status: pass
    human_judgment: false
  - id: D2
    description: "Edge-Case-Matrix Passwortformular: 11 Faelle, Enter-Pfad, Doppelklick, Happy Path zuletzt"
    requirement: QUAL-02
    verification:
      - kind: unit
        ref: "frontend/src/features/manage/AccountPage.test.tsx (11/11)"
        status: pass
    human_judgment: false
  - id: D3
    description: "/verwalten/konto: checkPage 0 Verstoesse ohne und mit Feldfehlern, aria-describedby je Feld, Tab-Reihenfolge, kein Ziel unter der Leiste bei 320 px, Fokus am Button nach Erfolg"
    requirement: QUAL-02
    verification:
      - kind: e2e
        ref: "frontend/e2e/account.spec.ts#Konto barrierefrei; #Passwort ändern (Klickpfad)"
        status: pass
    human_judgment: false
  - id: D4
    description: "200 % Zoom und Tastatur-Durchgang mit sichtbarem Fokus auf /verwalten/konto"
    requirement: QUAL-02
    verification:
      - kind: manual_procedural
        ref: "01-VALIDATION.md Manual-Only Verifications (end-of-phase)"
        status: unknown
    human_judgment: true

duration: 23min
completed: 2026-10-16
---

# Phase 1 Plan 06: Passwort ändern mit Edge-Case-Matrix und Frontend-Gate Summary

**Ein Elternteil ändert unter `/verwalten/konto` sein Passwort über `POST /api/v1/account/password` (Guardian, Rate-Limit `auth`). Falsche oder leere Eingaben ergeben 400 mit deutschem Feldtext, nie 401 oder 500. Das Formular besteht eine Matrix mit 11 Fällen, `checkPage` mit und ohne Feldfehler und den Tab-Durchgang bei 320 px. CI und das AGENTS.md-Gate führen jetzt `npm test`, `design:check` und `design:classes` aus.**

## Task Commits

1. **Task 1 (Tracer): Passwort ändern Ende-zu-Ende, Tab „Konto“:** `90811a1` (feat)
2. **Task 2: Matrix, Client-Prüfung, Fokus, Doppel-Absenden, Fehlerzustände:** `a8a850d` (feat)
3. **Task 3: Konto barrierefrei, Frontend-Gate in CI und AGENTS.md, Doku:** `59e651a` (feat, Trailer `A11y-Check: @axe-core/playwright 4.13.0 0 violations /verwalten/konto`)

`commits: 3`, gemessen mit `git rev-list --count a79ac9a..HEAD`.

## Rote Läufe vor der Umsetzung (Test zuerst)

- **Task 1, Schritt 1** (`dotnet test --filter AccountEndpointTests`, Endpoint fehlt): `Failed!  - Failed: 8, Passed: 0, Skipped: 0, Total: 8`. Jeder Fall scheiterte an `Assert.Equal() Failure: Values differ`, weil die Route 404 lieferte (auch der 401-Fall).
- **Task 1, Schritt 2** (`account.spec.ts` gegen den Stack ohne Seite): `1 failed`. `getByRole('heading', { name: 'Passwort ändern' })` → `element(s) not found` (account.spec.ts:30).
- **Task 2, Schritt 1** (`vitest run AccountPage.test.tsx` gegen den Rundweg aus Task 1): `Tests 9 failed | 2 passed (11)`. Fälle 1 und 3 bis 7: Fehlertext nicht gefunden. Fall 2: Fokus auf dem Button statt im Feld. Fall 8: kein `role="alert"`. Fall 10: `expected 'Passwort ändern' to be 'Einen Moment …'`. Grün waren schon Fall 9 (Enter) und 11 (Happy Path), weil der Rundweg aus Task 1 sie trägt.
- **Task 3, Schritt 1** (erster Lauf „Konto barrierefrei“): rot. `nicht gemessener Kontrast auf backdrop-base` mit `elmPartiallyObscured` an `a[href$="verwalten"]`, `a[href$="fortschritt"]` und `.glass-selected` (axe.ts:44). Ursache und Fix unter Abweichung 2. Im zweiten Lauf stimmte die Tab-Reihenfolge nicht (`Neues Passwort | … | Aktuelles Passwort`). Grund war der Teststart per `blur()`: Chrome behält den Startpunkt der Tab-Navigation am geblurten Feld. Jetzt startet der Durchgang am Button „Abmelden“.

## Verify-Ergebnisse (beobachtet)

- **Task 1:** Backend im SDK-Container gegen den eigenen Container `wq-0106-db` (Netz `wq-0106`): `dotnet build -c Release /warnaserror` ergab `0 Warning(s)`, `0 Error(s)`. Learning.Tests `Passed: 104, Total: 104`, Api.Tests `Passed: 48, Total: 48` (40 Bestand plus 8 AccountEndpointTests). Frontend: lint, typecheck und build mit Exit 0, `e2e:stack` Exit 0, `e2e account.spec.ts` `1 passed`. Danach `manage.spec.ts` mit `9 passed`, nach Abweichung 1. Alle Acceptance-Greps OK. Tracer-Gate (interaktiv, end-of-phase, rein automatischer Verify): grün, kein Checkpoint.
- **Task 2:** `npm run test` ergab `Test Files 7 passed (7)`, `Tests 35 passed (35)`, AccountPage 11/11. `design:classes -- src/features/manage/AccountPage.tsx` meldete `keine alten Klassen`, lint und typecheck Exit 0. Greps auf `renderWithProviders` und `Einen Moment` OK.
- **Task 3:** test `35 passed`, design:check `errors: 0, warnings: 0` mit leerem Export-Diff, design:classes über ganz `src` `keine alten Klassen`. lint, typecheck und build Exit 0. `e2e:stack` Exit 0. `e2e account.spec.ts manage.spec.ts login.spec.ts` ergab `12 passed`, nach Neustart der API (Rate-Limit-Fenster) `learn.spec.ts` `3 passed`. Das sind 15 von 15 e2e-Tests, alle `checkPage`-Läufe mit 0 axe-Verstößen.
- **Plan-Verification Frontend** (nach dem letzten Commit): `npm ci`, lint, typecheck, build, test (`35 passed`), design:check (`errors: 0, warnings: 0`) und design:classes, jeweils Exit 0.
- **DESIGN.md:** `npx @google/design.md@0.4.0 diff` gegen den Stand vor dem Plan ergab `"regression": false` ohne Token-Änderungen. Geändert ist nur der Prosa-Satz zur Eltern-Navigation.
- Aufgeräumt: Teststack mit `docker compose -f frontend/e2e/docker-compose.e2e.yml down -v`, dazu Container `wq-0106-db`, Netz `wq-0106` und Volume `wq-0106-nuget`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dritter Tab lässt die Leiste bei 320 px umbrechen, Fokus unter der Leiste**
- **Found during:** Task 1, `manage.spec.ts` nach dem neuen Tab
- **Issue:** Auf `/verwalten` steht das „+“ (64 px) neben der Leiste. Bei 320 px bleiben für die Leiste 216 px, und drei Tabs passen nicht hinein. Sie bricht in zwei Zeilen um, die Leiste ist dann 128 px statt 68 px hoch. Der Freiraum `--wq-tab-bar-clearance` (112 px) reichte nicht mehr, `Fokus nicht verdeckt bei 320 px` scheiterte: `"Unit 1 — Around the house32 Vokabeln · DE → EN" unter der Tab-Leiste`.
- **Fix:** Unter `sm` (40rem) wächst der Freiraum um eine Zeile (Tab 52 px plus Abstand 8 px, Tailwind-Stufe 15) auf 172 px. Gleiche Variable für `pb` an `<main>` und `scroll-padding-bottom`. Die Prüfung selbst ist unverändert.
- **Files modified:** frontend/src/index.css
- **Commit:** 90811a1

**2. [Rule 1 - Bug] body-Box endete mitten in der Tab-Leiste, axe konnte den Kontrast nicht messen**
- **Found during:** Task 3, erster Lauf „Konto barrierefrei“
- **Issue:** `html, body, #root { height: 100% }`. Die Konto-Seite ist bei 1280 × 720 genau 770 px hoch. Nach dem Scroll ans Ende (checkPage) lag die Unterkante von `body` bei 670 px im Viewport, die Tabs reichten von 628 bis 680 px. Mit der einfarbigen Backdrop-Farbe auf `body` wertet axe den Body als teilweise verdeckende Fläche: `elmPartiallyObscured` an allen drei Tabs. Das trifft jede Seite, die 32 bis 100 px höher ist als der Bildschirm. Es ist eine Folge des Layouts, nicht der Prüfung.
- **Fix:** `body { display: grid; min-height: 100% }`, `html` und `#root` behalten `height: 100%`. Gemessen: Kurze Seiten füllen weiter 720 px (`/verwalten`, `/verwalten/fortschritt`, `/login` mit zentrierter Karte bei 183 px). Die Konto-Seite hat jetzt `body` = `#root` = 770 px. login, manage und learn bleiben grün.
- **Files modified:** frontend/src/index.css
- **Commit:** 59e651a

### Sonstige Abweichungen

- **Abweichende Wiederholung nur bei gültigem neuem Passwort:** Sonst hätten die Fälle „neu leer“ und „neu zu kurz“ zwei Fehler, obwohl genau ein Feld falsch ist. Der Test prüft je Clientfall genau ein `[id$="-fehler"]`.
- **Ref-Sperre zusätzlich zu `disabled`:** Ein zweiter Klick kann ankommen, bevor React neu gerendert hat. Fall 10 belegt genau eine Anfrage.
- **Fokus nach Erfolg:** Chrome nimmt einem deaktivierten Button den Fokus. Ein Effekt setzt ihn nach dem Speichern zurück, wenn er auf `body` gelandet ist. Belegt ist das im echten Browser durch den Rücksetz-Schritt per Klick in `account.spec.ts` (`toBeFocused`).
- **Eigene Test-Datenbank** statt `host.docker.internal:5432` aus dem Plan-Verify, weil Port 5432 belegt ist: Container `wq-0106-db` im eigenen Netz, SDK-Container im selben Netz.
- **Dateien außerhalb `files_modified`:** README („Damit anmelden und das Passwort danach unter „Konto“ ändern.“, offener Punkt aus 01-05, vom Orchestrator verlangt). DESIGN.md: Prosa zur Eltern-Navigation nennt jetzt Konto und den Umbruch bei 320 px, Diff ohne Regression. Konzept §12: API-Liste und Rate-Limit um `/account/password` ergänzt.
- **Acceptance `! grep -q 'GSD:' AGENTS.md` nicht erfüllbar:** AGENTS.md:220 enthielt schon vor diesem Plan den Satz über `<!-- GSD:…-start -->`-Marker (`git show a79ac9a:AGENTS.md | grep -c 'GSD:'` = 1). Das ist eine Erwähnung, kein Marker. `grep -cE '<!-- GSD:[a-z-]+-start -->' AGENTS.md` = 0. Die Zeile bleibt unverändert, weil sie nicht zum Auftrag gehört.
- **Ein Commit pro Task statt einem pro Plan (D-02):** Auftrag des Orchestrators, wie in 01-04 und 01-05.

## Issues Encountered

- Rate-Limit `auth`: Alle e2e-Specs in einem Lauf kämen auf 11 Aufrufe (globalSetup 1, login 1, account 3, learn 6) und damit über das Limit von 10 pro Minute. Deshalb liefen sie in zwei Läufen, dazwischen wurde die API neu gestartet. Jeder Lauf für sich bleibt unter dem Limit.

## Offene Punkte

- **Review durch Subagent** (AGENTS.md „Review“, Plan-Verification): Dieser Executor hat kein Subagent-Werkzeug. Laut Orchestrator läuft ein Reviewer parallel, Prüfgegenstand ist der Diff `a79ac9a..59e651a`.
- **Manuell am Ende der Phase:** `/verwalten/konto` per Tastatur durchgehen (sichtbarer Fokus, Enter) und bei 200 % Browser-Zoom bedienen. Automatisiert angenähert ist das über den 320-px-Reflow und den Tab-Durchgang bei 320 × 568.
- **01-08 (Tab „Kinder“):** Mit vier Tabs bleibt die Leiste neben dem „+“ bei 320 px zweizeilig: Vokabeln und Fortschritt passen in 200 px Innenbreite, Konto und Kinder kommen in die zweite Zeile. Der Freiraum unter `sm` reicht dafür. Ohne „+“ passen bei 272 px Innenbreite drei Tabs knapp in eine Zeile. Das ist geschätzt, nicht gemessen; `Fokus nicht verdeckt` in 01-08 belegt es.
- **D-18:** Neue Passwörter werden nicht gegen Listen häufiger Passwörter geprüft. Als bekannte Lücke im Konzept §15 eingetragen.
- `REQUIREMENTS.md` ist nicht angefasst (Vorgabe des Orchestrators). SETUP-03 ist aus App-Sicht erfüllt. QUAL-02 deckt in 01-08 noch das Kind-Formular ab.

## Self-Check: PASSED

- Dateien vorhanden: AccountEndpoints.cs, PasswordChange.cs, AccountEndpointTests.cs, AccountPage.tsx, AccountPage.test.tsx, account.spec.ts
- Commits in HEAD: 90811a1, a8a850d, 59e651a
