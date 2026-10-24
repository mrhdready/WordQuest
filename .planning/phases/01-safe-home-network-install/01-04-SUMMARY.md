---
phase: 01-safe-home-network-install
plan: 04
subsystem: ui
tags: [liquid-glass, pin-keypad, keyboard, axe-core, playwright, fix-07, design-migration, wcag22]
status: complete

requires:
  - 01-01 (Token-Pipeline, glass-flat*-Utilities, checkPage, Teststack wordquest-e2e)
  - 01-03 (checkPage scrollt ans Seitenende, Fallback-Messung mit abgeschlossenen Uebergaengen, globalSetup)
provides:
  - Kinder-Anmeldung mit 4 bis 6 Ziffern, Tastatur (Ziffern, Ruecktaste, Enter) und Taste "Los geht’s"
  - Lern-Startseite und Lernsitzung im Token-Design (card-quiz, Sheet, Senden rund)
  - e2e/learn.spec.ts (Tastatur, Ziffernfeld-Grenzen, Klickpfad, axe auf allen Kinderseiten, FIX-07 ohne Secure Context)
  - Deutscher 429-Text "Zu viele Versuche. Bitte in einer Minute nochmal probieren." in api()
  - Abgeschlossene Design-Migration: kein Uebergangsblock, --color/--text/--font-weight/--radius-* geleert
affects: [01-06, 01-07, 01-08]

actuals:
  tokens: 10700
  tasks: 3
  commits: 5
plan_head_before: 7eb658dd0b8f034a097c4033506e15129addb707
plan_head_after: 033dbb45aeb9ca7cd2074ea4a562a92e41affcae

tech-stack:
  added: []
  patterns:
    - "Tasten in Formularen immer mit explizitem type, nur die Absende-Taste ist type=\"submit\""
    - "Emoji nie allein im Textknoten: Template-String statt JSX-Fragmenten (axe nonBmp)"
    - "Status-Flaechen (surface-success/-warn) ohne glass-Klasse, damit der deckende Fallback sie nicht weiss macht"
    - "Browser-Optionen (launchOptions) in Playwright nur auf Dateiebene; baseURL je describe"

key-files:
  created:
    - frontend/e2e/learn.spec.ts
  modified:
    - frontend/src/features/auth/ProfilePickerPage.tsx
    - frontend/src/features/learn/LearnHomePage.tsx
    - frontend/src/features/learn/SessionPage.tsx
    - frontend/src/index.css
    - frontend/src/lib/api.ts
    - frontend/src/lib/api.test.ts

key-decisions:
  - "429 wird in api() zentral auf einen deutschen Wartehinweis gemappt (Wortlaut wie die PIN-Sperre im AuthService), nicht nur auf der Kinder-Anmeldung"
  - "Texte direkt auf dem Backdrop (Unterzeile, Abschnittsueberschrift, \"Hallo,\") in text-ink statt text-ink-soft: ink-soft auf backdrop-blue liegt bei 4,14:1"
  - "Zurueck zur Profilwahl als runder Knopf oben (DESIGN.md button-round) statt Zelle im Ziffernfeld; die Zelle links unten bleibt leer"
  - "Lernauswahl als Glas-Kapseln mit aria-pressed und Haken, damit der Zustand nicht nur an der Flaeche haengt"

patterns-established:
  - "Rate-Budget je Spec: Aufrufe unter /api/v1/auth/ zaehlen, 429 als eigene Assertion (\"Rate-Limit auth erreicht\")"

requirements-completed: [FIX-08]

coverage:
  - id: D1
    description: "Kind meldet sich nur per Tastatur an; nach der vierten Ziffer 0, nach Enter genau 1 Anfrage an learner-login"
    requirement: FIX-08
    verification:
      - kind: e2e
        ref: "frontend/e2e/learn.spec.ts#Anmeldung per Tastatur"
        status: pass
  - id: D2
    description: "Ziffernfeld 4 bis 6 Ziffern, siebte ignoriert, Ruecktaste, unter 4 kein Absenden, Klickpfad sendet erst mit Los geht’s und genau einmal, falsche PIN leert die Eingabe"
    requirement: PAR-02
    verification:
      - kind: e2e
        ref: "frontend/e2e/learn.spec.ts#Ziffernfeld-Grenzen und falsche PIN"
        status: pass
  - id: D3
    description: "checkPage 0 Verstoesse auf Profilwahl, Ziffernfeld (glass-flat-clear im deckenden Fallback), Lern-Start, Frage und Rueckmeldung"
    requirement: DESIGN-01
    verification:
      - kind: e2e
        ref: "frontend/e2e/learn.spec.ts#Anmeldung per Tastatur; #ohne Secure Context › Lernen über HTTP"
        status: pass
  - id: D4
    description: "Lernantwort ueber HTTP ohne Secure Context per Enter und per Button angenommen (HTTP 200, Rueckmeldung sichtbar)"
    requirement: FIX-07
    verification:
      - kind: e2e
        ref: "frontend/e2e/learn.spec.ts#ohne Secure Context › Lernen über HTTP"
        status: pass
  - id: D5
    description: "Design-Migration abgeschlossen: design:classes ueber ganz src Exit 0, login/manage/learn im selben Stack gruen"
    requirement: DESIGN-01
    verification:
      - kind: other
        ref: "npm --prefix frontend run design:classes; e2e login.spec manage.spec learn.spec (13 passed)"
        status: pass
  - id: D6
    description: "429 ergibt den Hinweis, eine Minute zu warten"
    verification:
      - kind: unit
        ref: "frontend/src/lib/api.test.ts#429 ergibt den Hinweis, eine Minute zu warten"
        status: pass
  - id: D7
    description: "Ziffernfeld auf dem Tablet, 200 % Zoom auf den Kinderseiten"
    requirement: DESIGN-01
    verification:
      - kind: manual_procedural
        ref: "01-VALIDATION.md Manual-Only Verifications (end-of-phase)"
        status: unknown

duration: 25min
completed: 2026-10-16
---

# Phase 1 Plan 04: Kinderbereich im Token-Design, Ziffernfeld 4–6 und Abschluss der Design-Migration Summary

**Kinder melden sich mit 4 bis 6 Ziffern per Tippen oder Tastatur an. Erst Enter oder „Los geht’s“ sendet, und zwar genau einmal. Profilwahl, Ziffernfeld, Lern-Start, Frage und Rückmeldung bestehen `checkPage`. Eine Lernantwort über HTTP ohne Secure Context geht per Enter und per Button durch. Der Übergangsblock aus 01-01 ist entfernt, und die Default-Namensräume von Tailwind sind geleert.**

## Task Commits

1. **Task 1: Tracer Kinder-Anmeldung:** `7fc4d84` (feat)
2. **Offener Punkt aus 01-03, 429-Text:** `c63c52c` (fix)
3. **Task 2: Lern-Startseite, axe auf Profilwahl, Ziffernfeld und Lern-Start:** `2264179` (feat)
4. **Task 3, Schritt 0–2: Lernsitzung, FIX-07 ohne Secure Context:** `729f50e` (feat, Trailer `A11y-Check`)
5. **Task 3, Schritt 3: Design-Migration abschließen:** `033dbb4` (refactor)

## Läufe vor der Umsetzung (Test zuerst)

- **Task 1, Schritt 1** (`learn.spec.ts` gegen den Stack mit dem alten Ziffernfeld): `2 failed`. „Anmeldung per Tastatur“ scheiterte an `getByRole('status').filter({ hasText: 'eingegeben' })`, Erwartet „4 Ziffern eingegeben“, `element(s) not found` (learn.spec.ts:57). Die Tastatur wirkte nicht, und es gab kein Statusfeld. „Ziffernfeld-Grenzen und falsche PIN“ scheiterte an `getByTestId('ziffern-punkte')`, `Expected: 4, Received: 0`.
- **429-Text** (`vitest run src/lib/api.test.ts` vor dem Fix): `Tests 1 failed | 5 passed (6)`. Erwartet „Zu viele Versuche. Bitte in einer Minute nochmal probieren.“, erhalten „Das hat nicht geklappt. Versuche es noch einmal.“
- **Task 2, Schritt 1** (drei `checkPage`-Läufe gegen die alte Lern-Startseite): `1 failed | 1 passed`. Profilwahl und Ziffernfeld waren grün, auf der Lern-Startseite schlug `color-contrast auf backdrop-base` fehl: die Serie in `text-warn`, `#d9a514` auf `#eff4fe`, 2,03:1 (learn.spec.ts:67).
- **Task 3, Schritt 0** (Test „Lernen über HTTP“ gegen die alte Lernsitzung): `1 failed | 2 passed`. `window.isSecureContext === false` war belegt. Danach schlug `checkPage` auf der ersten Frage fehl: `color-contrast auf backdrop-blue`, „1 von 5“ in `text-ink-soft`, `#3b4253` auf `#75a6ff`, 4,14:1 (learn.spec.ts:152). Der Antwortpfad wurde in diesem Lauf deshalb nicht erreicht. Belegt ist er erst nach der Umstellung, er stammt aber unverändert aus Quick 261006-r7l: `clientAnswerId: payload.itemId` und der Submit-Handler sind gleich geblieben.

## Verify-Ergebnisse (beobachtet)

- **Task 1** `<automated>` (design:classes auth → lint → typecheck → build → e2e:stack → e2e learn.spec): **Exit 0**, `keine alten Klassen`, `2 passed`. Acceptance-Greps OK, `grep -c 'type="button"'` = 5.
- **Task 2** `<automated>`: **Exit 0**, `keine alten Klassen`, `2 passed`, `grep -c 'checkPage(page)'` = 3, `label=` vorhanden.
- **Task 3** `<automated>` (design:check → design:classes über ganz `src` → lint → typecheck → build → e2e:stack → e2e login manage learn): **Exit 0**, `errors: 0, warnings: 0`, `keine alten Klassen`, `13 passed` (3 learn, 2 login, 8 manage). Alle Acceptance-Greps OK. Im gebauten CSS gibt es kein `.bg-brand`, `.text-sm`, `.bg-white`, `.font-bold` oder `.rounded-2xl`.
- **Plan-Verification Frontend:** `npm ci`, `lint`, `typecheck` und `build` jeweils Exit 0. `vitest run`: `Test Files 6 passed (6)`, `Tests 24 passed (24)`.
- **Backend-Gate** (nicht berührt, nach Hausregel gemessen): Die Prüfung lief im SDK-Container gegen einen eigenen Container `wq-0104-db` im Netz `wq-0104-tests`. `dotnet build -c Release /warnaserror` ergab `0 Warning(s), 0 Error(s)`. Learning.Tests: `Passed 104/104`. Api.Tests: `Passed 40/40`. Container und Netz sind entfernt.
- Teststack mit `docker compose -f frontend/e2e/docker-compose.e2e.yml down -v` entfernt.

## Übergaben aus den Reviews

- **(a) 429 an der PIN-Eingabe:** Das Rate-Limit antwortet mit 429 ohne Körper. `api()` machte daraus den allgemeinen Text „… Versuche es noch einmal.“ Jetzt kommt zentral in `readError` „Zu viele Versuche. Bitte in einer Minute nochmal probieren.“ (Wortlaut wie die PIN-Sperre in `AuthService`). Das gilt für jeden Aufrufer, unter dem Limit stehen nur die `/auth`-Endpunkte. Vitest-Fall in `api.test.ts`.
- **(b) axe auf /lernen aus Quick 261006-r7l:** abgedeckt durch `checkPage` auf Frage und Rückmeldung im Test „Lernen über HTTP“.
- **(c) vierter Tab bei 320 px:** In diesem Plan kommt kein Tab dazu. Die Tab-Leiste in `ManageLayout.tsx` ist unverändert, der Punkt bleibt für 01-06 bis 01-08.
- **Übergangsschuld 01-01:** Der doppelte Innenabstand (`CardContent pt-5/py-10`) ist auf Lern-Start, Quiz und Zusammenfassung entfernt, `CardContent` wird in `src/features/learn` nicht mehr genutzt. Die Ziffern-Tasten sind `glass-flat-clear` statt `Button` mit Blur. Die Erfolgskarte auf der Lern-Startseite ist eine Status-Fläche ohne `glass` und bleibt bei reduzierter Transparenz grün. In `checkPage` laufen auf diesen Seiten `glass`, `glass-clear`, `glass-selected`, `glass-sheet` und `glass-flat-clear` durch den Fallback, `glass-flat` über das Antwortfeld.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `launchOptions` geht in Playwright nicht in einem `describe`**
- **Found during:** Task 3, Schritt 0
- **Issue:** `Cannot use({ launchOptions }) in a describe group, because it forces a new worker.`
- **Fix:** `--host-resolver-rules` als `test.use` auf Dateiebene, `baseURL: 'http://wordquest.test:18080'` im `describe`. Die Weiche betrifft nur `wordquest.test`, die übrigen Tests laufen weiter gegen `localhost`.
- **Files modified:** frontend/e2e/learn.spec.ts
- **Commit:** 729f50e

**2. [Rule 1 - Bug] Kontrast von `ink-soft` direkt auf dem Backdrop**
- **Found during:** Task 3, Schritt 0, und schon im Bestand der Picker-Seite
- **Issue:** Laut Plan sollte `text-ink-soft` für die Abschnittsüberschrift „Was möchtest du üben?“ stehen. Sie steht direkt auf dem Backdrop, wo `ink-soft` auf `backdrop-blue` nur 4,14:1 erreicht.
- **Fix:** Text ohne Glas darunter ist `text-ink`: Abschnittsüberschrift, „Hallo,“, Unterzeile „Gib deine Zahlen ein.“, Hinweis ohne Profile. Auf Glas bleibt `text-ink-soft`. 01-01 und 01-03 haben das genauso entschieden.
- **Commit:** 7fc4d84, 2264179

**3. [Rule 1 - Bug] Münzen in der Zusammenfassung ohne deckende Fläche**
- **Issue:** `text-coin` direkt auf Glas über `backdrop-blue` liegt nach eigener Rechnung unter 4,5:1. axe hat das nicht belegt, weil die Zusammenfassung im e2e nicht erreicht wird.
- **Fix:** Wie auf der Lern-Startseite steht `text-coin` als coin-label auf `bg-glass-opaque`.
- **Commit:** 729f50e

### Sonstige Abweichungen

- **Ein Commit pro Task statt einem pro Plan (D-02):** Der Orchestrator verlangt atomare Task-Commits. Task 3 ist in Markup (`729f50e`) und Migration (`033dbb4`) geteilt, der 429-Fix hat einen eigenen Commit.
- **Neue Bedienelemente laut DESIGN.md „Quiz“:** Ein runder Knopf „Schließen“ oben in der Lernsitzung führt zurück zu `/`. Ihn gab es vorher nicht. Der Senden-Button heißt jetzt „Antwort senden“ statt „Antworten“, das Antwortfeld hat `aria-label="Deine Antwort"`.
- **„Los geht’s“ auf der Lern-Startseite** schwebt jetzt `sticky bottom-float-bottom`, so wie auf der Anmeldung. Der Text bleibt „Los geht's“ mit geradem Apostroph wie im Bestand („Texte unverändert“).
- **Statusfeld:** Bei genau einer Ziffer steht „1 Ziffer eingegeben“, sonst „{n} Ziffern eingegeben“.
- **`data-testid="ziffern-punkte"`** an der Punktgruppe (`aria-hidden`), damit der Test die Punkte zählen kann. Bisher gibt es in `src` keine Test-IDs.
- **Profilwahl mit `<main>`:** Profilwahl, Lern-Start und Lernsitzung haben jetzt ein `main`-Landmark. Vorher gab es im Kinderbereich keins.

## Issues Encountered

- **Rate-Limit beim Zwischenlauf:** Einmal hat `learn.spec` ohne Neustart des Stacks direkt nach einem vollen Lauf im selben Minutenfenster 429 bekommen. Die Assertion „Rate-Limit auth erreicht“ hat sofort abgebrochen, wie vorgesehen. Je Lauf zählen globalSetup 1 und learn.spec 6. Der Lauf ist nach `e2e:stack` (setzt den In-Memory-Limiter zurück) wiederholt worden. Der Abschlusslauf liegt mit 8 Aufrufen unter dem Limit.
- **Nur ein Kinderprofil im Demo-Seed (Max):** Die Schleife „jedes Profil beginnt bei 4 Punkten“ (T-01-13) läuft deshalb nur über Max, und zwar nach fünf eingegebenen Ziffern und der Rückkehr zur Profilwahl. Mit mehreren Profilen prüft sie jedes einzeln.

## Offene Punkte

- **Review durch Subagent (AGENTS.md „Review“, Plan-Verification) nicht erfolgt.** Diesem Executor steht kein Subagent-Werkzeug zur Verfügung. Der Orchestrator muss das Review gegen D-09, FIX-07, FIX-08, DESIGN-01, die Prohibitions und den Diff `7eb658d..033dbb4` anstoßen.
- **Prohibitions (Selbstcheck, kein Review):** Neue Kindertexte enthalten nicht „PIN“: „Gib deine Zahlen ein.“, „{n} Ziffern eingegeben“, „Zurück zur Profilwahl“, „Los geht’s“, „Einen Moment …“ und der 429-Text. Der Servertext „Die PIN stimmt nicht.“ bleibt wie geplant. „Fast!“ steht auf `bg-surface-warn` in `text-warn-text`, ohne `role="alert"` und ohne `danger` in `SessionPage.tsx` (grep 0). Die Punktanzeige beginnt immer bei 4 und ruft keine PIN-Länge ab.
- **Abnahme am Ende der Phase:** Ziffernfeld auf dem Tablet und 200 % Zoom auf den Kinderseiten. Die Zusammenfassung am Ende einer Lernrunde und der Zustand „alles erledigt“ sind im e2e nicht erreicht, axe hat sie also nicht geprüft.
- **DESIGN-01 und PAR-02** sind nur zum Teil erfüllt. Konto- und Kinderseiten fehlen noch (01-06 bis 01-08), die PIN-Regel auf dem Server kommt mit 01-08. Deshalb steht in `requirements-completed` nur FIX-08.

## Next Phase Readiness

- `npm run design:classes` ist über ganz `src` grün und gehört jetzt ohne Pfadangabe ins Gate. Jede alte Tailwind-Farbe, -Schriftstufe, jedes alte -Gewicht und jeder alte -Radius erzeugt kein CSS mehr.
- `learn.spec.ts` braucht 6 Aufrufe der Policy `auth`. Wer weitere Specs mit Anmeldungen ergänzt, muss das Budget von 10 pro Minute (inkl. globalSetup) mitrechnen oder den Stack zwischen den Läufen neu starten.

## Self-Check: PASSED

- FOUND: frontend/e2e/learn.spec.ts, frontend/src/features/auth/ProfilePickerPage.tsx, frontend/src/features/learn/LearnHomePage.tsx, frontend/src/features/learn/SessionPage.tsx, frontend/src/index.css, frontend/src/lib/api.ts
- FOUND: 7fc4d84, c63c52c, 2264179, 729f50e, 033dbb4 (Vorfahren von HEAD)

## Review (Subagent, 2026-10-16) und Nachbesserung

**Urteil des Reviews: NACHBESSERN.** Ein Befund war MAJOR (WCAG 4.1.3, Rückmeldung wird nicht angesagt). Dazu kamen Fokus und Doppelansage nach falscher PIN, Lücken im e2e (Rundenende, „alles erledigt“, Rückmeldungstext), der uneinheitliche Apostroph in „Los geht’s“ und ein Flackern bei der letzten Karte. Offen war außerdem, was „Schließen“ mit einer angefangenen Runde macht.

**Entscheidung von Dennis zu „Schließen“ (2026-10-16):** Ist mindestens eine Karte beantwortet, schließt „Schließen“ die Runde ab wie am Ende. Die Serie zählt, den Bonus berechnet der Server, danach geht es zur Startseite. Ohne beantwortete Karte wird nur navigiert.

**Vorab geprüft (Backend, nur gelesen):** `LearningService.CompleteSessionAsync` (`LearningService.cs:259-307`) und `POST /sessions/{id}/complete` (`SessionEndpoints.cs:75-90`) prüfen nicht, ob die Runde vollständig ist. Ein Abschluss mitten in der Runde wird mit 200 angenommen. Der Bonus kommt aus `XpRules.ForSessionCompletion(answered, correct)` und zählt nur beantwortete Karten. Bei `answered == 0` gibt es keinen Bonus und keine Serie, ein zweiter Abschluss bleibt wegen `CompletedAt` folgenlos. Am Backend wurde nichts geändert.

### Behoben

| Befund | Fix | Commit |
|---|---|---|
| Fokus nach falscher PIN, Doppelansage „0 Ziffern eingegeben“ | Nach einem Fehler springt der Fokus auf die Taste „1“. Das Statusfeld bleibt leer, solange der Fehler steht und noch keine Ziffer eingegeben ist. e2e: vorher rot (`toBeFocused`, `Received: inactive`) | `ecfee7b` |
| „Los geht’s“ uneinheitlich | Lern-Startseite schreibt jetzt `’`. Die Anmeldung hatte es schon. Ein gemeinsamer Locator im e2e | `27e3397` |
| MAJOR WCAG 4.1.3: Rückmeldung wird nicht angesagt | Container `id="rueckmeldung"`, „Weiter“ mit `aria-describedby`, kein `role="alert"`. `answer()` prüft den Fokus, den angezeigten Text gegen die Serverantwort („Richtig!“/„Fast!“, „Es heißt: …“) und die Accessible Description. Vorher rot (`Received string: ""`) | `0f7bb6a` |
| „Schließen“ in einer angefangenen Runde, Flackern bei der letzten Karte | `close()`: nach mindestens einer Antwort `finish(true)` (Complete, dann `/`), sonst nur `navigate('/')`. Während eine Antwort unterwegs ist, ist „Schließen“ gesperrt. Die neue Phase `finishing` zeigt einen Spinner statt des Antwortfelds und verhindert ein doppeltes „Weiter“. e2e mit gemockten Sitzungs-Endpunkten: ohne Antwort 0 Complete-Requests, nach einer Antwort genau 1. Vorher rot (`Expected 1, Received 0`) | `37fe76e` |
| e2e erreicht weder Rundenende noch „alles erledigt“ | „Lernen über HTTP“ spielt die Runde zu Ende. `checkPage` läuft auf der Zusammenfassung, auf der Startseite mit „alles erledigt“ und auf der leeren Runde. Den Fehlerzustand (POST /sessions → 500) stellt `page.route` her. `checkPage` wartet jetzt auf endliche Animationen: auf der Zusammenfassung hatte axe mitten in `animate-pop` 2,51:1 gemessen (`#b29273` auf `#f0efe8`) | `3de0c3c` |

### Gate (beobachtet)

- `npm run lint`, `typecheck`, `npx vitest run` (`Test Files 7 passed (7)`, `Tests 35 passed (35)`), `build`, `design:check` (`errors: 0, warnings: 0`), `design:classes` (`keine alten Klassen`): Exit 0.
- e2e, Durchgang 1 (`npm run e2e:stack`, alle Specs): `14 passed`, `2 failed`. Beide Fehlschläge in learn.spec kamen von „Rate-Limit auth erreicht“ (429), weil das Budget von 10/min nach account, login und manage aufgebraucht war.
- e2e, Durchgang 2 (API neu gestartet, `learn.spec.ts`): `4 passed`. Der erste Versuch scheiterte im globalSetup, weil die API nach dem Neustart noch nicht bereit war. Danach wurde auf `healthy` gewartet.
- Backend nicht berührt, deshalb kein dotnet-Lauf. Teststack mit `down -v` entfernt.
- axe (WCAG 2.2 AA über `checkPage`): 0 Verstöße auf Zusammenfassung und Startseite mit „alles erledigt“. Auf der leeren Runde und dem Fehlerzustand laufen axe, Kontrast und Reflow ohne den Fallback-Teil, weil diese Seiten kein Glas haben.

### Offen

- **429-Text „in einer Minute“** dupliziert `Window = 1 min` aus `Program.cs`. Er hängt an FIX-01 (Forwarded Headers): ohne sie teilen sich alle Geräte im Heimnetz einen Topf. Wird mit 01-08 behoben.
- **`refreshAccessToken` meldet bei 429 ab** (Bestand, `api.ts` ~96-98).
- **Verwaiste neue Karten (Backend, Bestand, durch „Schließen“ häufiger):** `StartSessionAsync` legt beim Start für jede neue Karte einen `ReviewState` im Zustand `New` an (`DueAt = now`). Unbeantwortete Karten wählt keine Runde mehr aus, denn `Compose` nimmt nur Relearning, Review und ungesehene Karten. Die Übersicht zählt sie aber in `dueToday` (`LearnerEndpoints.cs:160-163`). Nach einer abgebrochenen Runde zeigt die Startseite also „N Karten fällig“, und die Runde ist trotzdem leer. Nicht geändert, Entscheidung nötig.
- **Perfekt-Bonus bei Teilrunden:** `ForSessionCompletion` vergibt `XpPerfectSessionBonus`, sobald alle *beantworteten* Karten richtig sind, also auch bei 1 von 5. Das entspricht der Serverregel und Dennis' Vorgabe („Bonus wie vom Server berechnet“). Ausnutzen lässt es sich kaum, weil das Tagesbudget neuer Karten schon beim Start verbraucht wird.
- **Mitten-in-der-Runde-Abschluss gegen den echten Server** ist nur durch Lesen des Codes belegt, das e2e mockt die Sitzungs-Endpunkte. Grund: Das Tagesbudget von 5 neuen Karten reicht für genau eine echte Runde, und die braucht „Lernen über HTTP“.
- **Review dieser Nachbesserung** durch einen Subagenten (AGENTS.md „Review“) steht aus. Ebenso offen sind Tastatur-Durchgang und 200 % Zoom auf Zusammenfassung und Fehlerseite (D7, Abnahme am Ende der Phase).
