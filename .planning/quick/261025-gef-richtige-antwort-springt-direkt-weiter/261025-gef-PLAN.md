---
phase: quick-261025-gef
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/features/learn/SessionPage.tsx
  - frontend/src/features/learn/SessionPage.test.tsx
  - frontend/e2e/learn.spec.ts
  - frontend/e2e/first-run.spec.ts
  - DESIGN.md
autonomous: true
requirements: [FIX-07, DESIGN-01]

estimate:
  tokens: 140000
  raw_tokens: 140000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "1: Text-Aufgabe richtig ohne Tippfehler: Ohne Klick erscheint sofort die naechste Aufgabe, es gibt keinen Button „Weiter“. Ueber dem Antwortfeld steht „Richtig! +N XP“ (bei xpAwarded 0 nur „Richtig!“) in einem role=status-Bereich, der schon vor der Antwort leer im DOM steht (dasselbe Element vorher und nachher). Die Bestaetigung bleibt bis zur naechsten Antwort. Das Antwortfeld ist leer und hat den Fokus, auch nach Klick auf „Antwort senden“."
    - "2: Letzte Aufgabe richtig ohne Tippfehler: direkt die Zusammenfassung („Geschafft!“ bzw. „Level n erreicht!“), genau ein POST /complete, kein „Weiter“."
    - "3: Falsch („Fast!“ + „Es heißt: …“) und richtig mit Tippfehler (message mit der richtigen Schreibweise): Rueckmeldungs-Sheet mit fokussiertem „Weiter“ wie bisher (aria-describedby=rueckmeldung), Statusbereich leer, die Aufgabe wechselt erst nach „Weiter“."
    - "4: Auswahl-Aufgabe richtig: naechste Aufgabe sofort, Bestaetigung im Statusbereich, Fokus auf der ersten Auswahl der neuen Aufgabe."
    - "5: Genau eine Antwort je Aufgabe: Doppelklick bzw. zweimal Enter waehrend der Anfrage senden einmal; Enter im leeren Feld der neuen Aufgabe sendet nichts und ueberspringt nichts; die zweite Antwort traegt itemId und clientAnswerId der neuen Aufgabe und den neu getippten Text; ein spaeter Sendeversuch mit der Item-ID einer schon gesendeten Aufgabe wird verworfen; retryItem wird wie bisher angehaengt; answerMs zaehlt ab Anzeige der neuen Aufgabe."
    - "6: Barrierefreiheit belegt: checkPage (axe 0, Glas-Kontrast, opaker Rueckfall, Reflow 320 px) auf dem neuen Zustand mit Bestaetigung; eine ganze Runde nur per Tastatur; bei 640x400 (200 %) ist das Antwortfeld fokussiert und vollstaendig im Bild, die Bestaetigung im Bild, kein waagerechtes Scrollen; Animation nur ueber animate-pop (bei prefers-reduced-motion aus); Farben nur ueber die note-success-Tokens."
    - "7: DESIGN.md beschreibt den Quiz-Ablauf wie der Code (Bestaetigung als note-success ueber dem Antwortfeld, Sheet nur bei Tippfehler und „Fast!“); design:check gruen, design diff ohne regression; keine andere Doku-Zeile beschreibt „Weiter“ nach jeder Antwort."
    - "8: Gate gruen (Backend-Skript, Frontend im node:22-Container), e2e gruen, Subagent-Review mit behobenen oder begruendet zurueckgewiesenen Befunden, ein Commit auf v1-fertig, kein Push."
  artifacts:
    - path: frontend/src/features/learn/SessionPage.tsx
      provides: "Direkt weiter bei richtiger Antwort ohne Tippfehler, dauerhafter Statusbereich, Item-ID-Riegel in send(), Fokus zurueck ins Antwortfeld"
      contains: "role=\"status\""
    - path: frontend/src/features/learn/SessionPage.test.tsx
      provides: "vitest: richtig, letzte Aufgabe, falsch, Tippfehler, Auswahl, schnelle Enter, Anfrage-Bodies"
      contains: "Richtig! +10 XP"
    - path: frontend/e2e/learn.spec.ts
      provides: "e2e: Weiter nur nach falsch/Tippfehler, neuer Zustand mit axe 0, Tastatur-Runde, 200 %"
      contains: "getByRole('status')"
    - path: frontend/e2e/first-run.spec.ts
      provides: "Install-Smoke-Runde ohne Weiter-Klicks nach richtigen Antworten"
      contains: "getByRole('status')"
    - path: DESIGN.md
      provides: "Quiz-Zeile beschreibt Bestaetigung ueber dem Antwortfeld"
      contains: "über dem Antwortfeld"
  key_links:
    - from: frontend/src/features/learn/SessionPage.tsx
      to: "next() (SessionPage.tsx:141)"
      via: "onSuccess ruft bei correct && !hadTypo next() statt die Feedback-Phase zu setzen; next() entscheidet ueber finish(false)"
      pattern: "hadTypo"
    - from: frontend/src/features/learn/SessionPage.tsx
      to: "send() (SessionPage.tsx:99)"
      via: "sending-Ref bleibt; zusaetzlicher Riegel ueber die Item-ID der zuletzt gesendeten Antwort; Bestaetigung wird beim Senden geleert"
      pattern: "sending.current"
    - from: frontend/e2e/learn.spec.ts
      to: frontend/src/features/learn/SessionPage.tsx
      via: "Statusbereich mit exaktem Text aus der Serverantwort (xpAwarded)"
      pattern: "getByRole\\('status'\\)"
---

<objective>
Wunsch von Dennis (2026-10-25, woertlich): „wenn ich ein wort eingegeben habe und es richtig ist
kann direkt das nächste angezeigt werden nochmal auf weiter zu drücken ist überflüssig. die
meldung mit den xp kann über der neuen textzeile stehen“.

Purpose: Weniger Tipps je Runde. Eine richtige Antwort ohne Tippfehler fuehrt sofort zur
naechsten Aufgabe; „Richtig! +N XP“ steht klein ueber dem Antwortfeld der neuen Aufgabe und
wird Screenreadern angesagt, ohne den Fokus zu nehmen. Falsch und Tippfehler behalten das
Sheet mit „Weiter“, weil das Kind die Korrektur sehen muss.

Output: geaenderte SessionPage mit vitest rot→gruen, angepasste e2e (learn, first-run) mit
axe/Tastatur/200 %, DESIGN.md-Quiz-Zeile, volles Gate, Subagent-Review, ein Commit, SUMMARY.

Annahmen fuer Dennis (im SUMMARY wiederholen):
- A1: Falsch („Fast!“ + „Es heißt: …“) und richtig mit Tippfehler behalten das Sheet mit
  „Weiter“. Das Kind muss die richtige Schreibweise sehen, bevor es weitergeht.
- A2: Auswahl-Aufgaben verhalten sich gleich (richtig → sofort weiter, Fokus auf der ersten
  Auswahl). Im heutigen Spiel `classic` kommen sie nicht vor (LearningService.cs:620-623
  liefert dort keine Auswahl). Grenze: Ein schneller Doppeltipp auf dieselbe Stelle wuerde
  bei Auswahl-Aufgaben die naechste Aufgabe beantworten; relevant erst mit LRN2-01, dann
  dort pruefen.
- A3: Die Bestaetigung verschwindet beim Senden der naechsten Antwort. Bei 0 XP steht nur
  „Richtig!“.
- A4: Letzte Aufgabe richtig → sofort die Zusammenfassung, ohne Zwischenbestaetigung (die
  Zusammenfassung zeigt die XP der Runde).
- A5: Das Antwortfeld bleibt dasselbe Element, damit die Tablet-Tastatur beim Absenden per
  Enter offen bleibt. Nach einem Tipp auf den Senden-Knopf bekommt das Feld den Fokus
  per Skript zurueck; iOS oeffnet die Tastatur dann eventuell nicht von selbst
  (Plattformgrenze), das Kind tippt ins Feld.
- A6: Das neue Wort wird wie heute nicht automatisch vorgelesen (der Fokus liegt auf dem
  Antwortfeld); unveraendert, nicht Teil dieses Auftrags.
- A7: Zuordnung: kein eigenes Requirement. Naechstliegend FIX-07 (Antwort per Button und
  Enter, keine doppelte Wertung) und DESIGN-01 (DESIGN.md-Quiz-Beschreibung). Direkter
  Auftrag von Dennis, deshalb nicht als v2 geparkt.
- A8: Das Zeitfenster zwischen Serverantwort und Neuzeichnen (alter Submit-Handler mit
  alter Item-ID) laesst sich im Test nicht deterministisch herstellen. Der Item-ID-Riegel
  ist logisch begruendet und wird im Review geprueft; vitest belegt, dass die zweite
  Antwort die neue Item-ID und den neuen Text traegt.
- A9: Doku: Nur DESIGN.md:317 beschreibt den Ablauf. Konzept, README und Documentation/
  haben keine Zeile zu „Weiter“ nach jeder Antwort (grep bei der Planung, Stand 619c934).

Zuschnitt: Task 1 ist der Tracer (eine Datei mit Test, ganzer Pfad Antwort → naechste
Aufgabe im gerenderten Baum). Task 2 zieht e2e und DESIGN.md nach und belegt im echten
Browser. Task 3 ist Gate, Review, Commit.

Parallel laeuft Quick 261025-fpi (HTTPS/Infra: nginx, Compose, setup/upgrade, Doku). Deren
Dateien nicht anfassen, nicht stagen, nicht reviewen.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@DESIGN.md
@frontend/src/features/learn/SessionPage.tsx
@frontend/src/features/learn/SessionPage.test.tsx

Belegte Fundstellen aus der Planung (Stand 619c934):
- SessionPage.tsx:38-42 Refs `shownAt`, `started`, `sending`; :69-96 `useMutation` mit onSuccess (setResult, setPhase('feedback'), retryItem anhaengen) und onSettled (`sending.current = false`); :99-103 `send()` mit sending-Riegel; :107-128 `finish(goHome)`; :133-139 `close()` (nach einer Antwort `index > 0` → finish(true)); :141-151 `next()` (letzte Aufgabe → finish(false), sonst setResult(null), setTyped(''), setIndex, setPhase('question'), `shownAt.current = Date.now()`); :234-281 Antwortbereich: FeedbackPanel | Auswahl-Grid (`mt-auto grid gap-4`, :237, Buttons `key={choice}`) | Formular (`mt-auto flex …`, :252) mit `<Input autoFocus …>`; :286-339 FeedbackPanel (`glass-sheet mt-auto …`, :297; „Weiter“ fokussiert, aria-describedby="rueckmeldung").
- onSuccess-Callbacks sehen `index`/`queue` des Renderns, in dem gesendet wurde; waehrend der Anfrage aendern sich beide nicht (sending-Riegel, Schliessen ist bei isPending deaktiviert).
- LearningService.cs:299 haengt eine Wiederholung nur bei `Grade.Again` an (falsche Antwort). Eine richtige Antwort hat retryItem null, `next()` rechnet also mit der richtigen Queue-Laenge.
- LearningService.cs:620-623: Spiel `classic` liefert keine Auswahl; das Frontend startet immer `gameKey: 'classic'` (SessionPage.tsx:55).
- Wiederholungen bekommen eigene SessionItem-Zeilen (LearningService.cs:301-311), Item-IDs sind also je Aufgabe eindeutig; `clientAnswerId` = itemId (SessionPage.tsx:77-80).
- `Input` (components/ui/input.tsx) reicht alle Props inkl. `ref` (React 19) an `<input>` durch.
- misc.tsx:78-82 `SuccessNote` setzt role="status" auf das bedingt gerenderte `<p>` selbst; als dauerhafter Live-Bereich ungeeignet, nur seine Klassen (note-success) wiederverwenden.
- DESIGN.md:229-234 Komponente `note-success` (surface-success, success-text, body-md, rounded sm, padding md); :317 Quiz-Zeile „Rückmeldung (richtig, Tippfehler, „Fast!“) als `sheet` von unten.“; :321 Hinweise.
- index.css:295-310 `animate-pop` (220 ms) und `@media (prefers-reduced-motion: reduce)` setzt animate-pop/animate-nudge auf none.
- SessionPage.test.tsx:55-80 `stubFetch` (Zaehler je Endpunkt; fetch-Stub ignoriert heute das zweite Argument `init`, api() sendet `init.body` als JSON-String, lib/api.ts:255); :82-88 `held()`; :121-150 und :192-202 warten nach richtiger Antwort auf „Weiter“ und muessen umgestellt werden. Kein jest-dom, Assertions ueber `textContent`/`document.activeElement`.
- learn.spec.ts:353-372 Helfer `answer()` erwartet nach jeder Antwort ein fokussiertes „Weiter“; :395-416 „Lernen über HTTP“ (neue Karten falsch, Wiederholungen richtig, Klick auf „Weiter“ vor jeder Karte und am Ende); :503-519 200 %-Muster (640x400, scrollWidth, toBeInViewport ratio 1); :528-548 Tastatur-Runde mit Enter auf „Weiter“ vor jeder Karte und am Ende. Ein Eintrag erzeugt zwei Karten (VocabularyEntry.cs:67-77), die Bild-Runde hat also zwei neue Karten und zwei Wiederholungen, davon eine automatische Weiterschaltung.
- learn.spec.ts:249-251 und children.spec.ts:111-114 antworten falsch → „Weiter“ bleibt, nicht aendern.
- first-run.spec.ts:85-101 beantwortet jede Aufgabe richtig, klickt vor jeder Karte und am Ende „Weiter“; laeuft nur im Install-Smoke (`WQ_E2E_FIRST_RUN`, setup-smoke.sh:188). `npm run typecheck` schliesst `e2e/` ein (tsconfig.json include).
- e2e-Stack: Compose-Projekt `wordquest-e2e`, Port 127.0.0.1:18080; `npm run e2e:stack` macht zuerst `down -v`. Playwright 1.64.0, Browser-Builds 1248 liegen in ~/Library/Caches/ms-playwright.
- Gate-Wege wie in Quick 261024-vnx: Backend `bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh`; Frontend im node:22-Container mit anonymem Volume fuer node_modules.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Tracer — richtige Antwort springt in der Lernrunde direkt weiter (SessionPage, vitest rot→gruen)</name>
  <files>frontend/src/features/learn/SessionPage.test.tsx, frontend/src/features/learn/SessionPage.tsx</files>
  <behavior>
    - Richtig ohne Tippfehler (Text, xpAwarded 10): ohne Klick steht „2 von 2“; kein Button „Weiter“; `getByRole('status')` hat textContent „Richtig! +10 XP“ und ist dasselbe Element wie vor der Antwort (dort textContent leer); Antwortfeld leer und `document.activeElement`.
    - Absenden per `userEvent.click` auf „Antwort senden“, richtig: Fokus danach im neuen, leeren Antwortfeld (nicht auf dem deaktivierten Senden-Button).
    - Zweite Antwort nach Weiterschaltung: Body hat itemId 'item-2', clientAnswerId 'item-2', givenAnswer = neu getippter Text; beim Senden der zweiten Antwort (held) ist der Statusbereich leer.
    - Einzige bzw. letzte Aufgabe richtig: Ueberschrift „Geschafft!“ ohne Klick, calls.complete 1, kein „Weiter“.
    - Falsch (correct false, grade 'Again', xpAwarded 0): „Fast!“, „Es heißt: Hund“, „Weiter“ fokussiert, weiter „1 von 2“, Statusbereich leer.
    - Richtig mit Tippfehler (correct true, hadTypo true, message gesetzt): message sichtbar, „Weiter“ fokussiert, weiter „1 von 2“, Statusbereich leer.
    - Auswahl-Aufgabe richtig (expectedAnswerType 'choice', choices gesetzt, xpAwarded 0): naechste Aufgabe ohne Klick, Statusbereich „Richtig!“, Fokus auf der ersten Auswahl der neuen Aufgabe.
    - Zweimal Enter waehrend der Anfrage: genau eine Antwort; danach „2 von 2“, Feld leer und fokussiert; ein weiteres Enter im leeren Feld: calls.answers bleibt 1, weiter „2 von 2“.
    - Doppelklick auf Senden: genau eine Antwort (wartet auf „2 von 2“ statt auf „Weiter“). „Schließen“ nach einer richtigen Antwort: genau ein /complete.
  </behavior>
  <action>
    Zuerst rot, nur SessionPage.test.tsx: `stubFetch` so erweitern, dass der fetch-Stub das zweite Argument `init` annimmt und bei /answers `JSON.parse(init.body)` in ein neues Feld `calls.bodies` schreibt (Zaehler bleiben). Die Tests unter :121-150 und :192-202 warten statt auf „Weiter“ auf die zweite Aufgabe („2 von 2“); ihre Absicht (eine Antwort, ein /complete) bleibt. Die neuen Faelle aus <behavior> ergaenzen (fuer Auswahl, Tippfehler, falsch und letzte Aufgabe eigene `result`-Varianten und `items` per vorhandenem Parameter von stubFetch; fuer das zweite Item gern ein anderer Prompt). Nur vorhandene Werkzeuge (vitest, RTL, user-event), keine neue Dependency. Im node:22-Container laufen lassen und den roten Lauf (Anzahl Fehlschlaege, Ursache) fuer das SUMMARY festhalten.

    Dann gruen, SessionPage.tsx (per Wunsch Dennis 2026-10-25, Annahmen A1-A5):
    1. Neuer State fuer die Bestaetigung: XP-Zahl der letzten richtigen Antwort oder null.
    2. onSuccess: retryItem wie bisher anhaengen. Bei `data.correct && !data.hadTypo` die Bestaetigung auf `data.xpAwarded` setzen und `next()` aufrufen (gleicher Weg wie „Weiter“: letzte Aufgabe → finish(false), sonst naechste Aufgabe mit `shownAt` neu). Sonst wie bisher setResult und Phase 'feedback'. Falls lint die Reihenfolge der Deklarationen bemaengelt, `next`/`finish` vor `answer` ziehen, ohne ihr Verhalten zu aendern.
    3. send(): `sending`-Ref und clientAnswerId bleiben. Zusaetzlich ein Ref mit der Item-ID der zuletzt gesendeten Antwort; ist die neue Item-ID gleich, sofort zurueck. Grund als deutscher Kommentar: onSettled gibt `sending` frei, bevor React die neue Aufgabe zeichnet; ein Enter in diesem Fenster liefe noch durch den alten Submit-Handler mit alter Item-ID und alter Eingabe. Nach den Riegeln die Bestaetigung leeren (sie steht bis zur naechsten Antwort).
    4. Fokus: Das Formular bekommt keinen key, das Input bleibt dasselbe Element (Tablet-Tastatur bleibt beim Enter-Weg offen, A5). `Input` bekommt einen Ref; `next()` ruft am Ende `focus()` darauf auf, falls vorhanden (nach Klick auf Senden wird der Button deaktiviert und der Fokus ginge verloren; kommt man aus dem Sheet, ist der Ref leer und autoFocus beim Einhaengen greift wie bisher).
    5. Auswahl-Grid bekommt `key={current.itemId}`, damit es je Aufgabe neu einhaengt; der erste Auswahl-Button bekommt autoFocus.
    6. Statusbereich: ein `<div role="status">`, das im Haupt-Return immer gerendert wird, ausserhalb der Phasen-Bedingung und ausserhalb des Formulars bzw. des gekeyten Grids, direkt ueber dem Antwortbereich. Inhalt nur bei gesetzter Bestaetigung: ein `<p>` mit den note-success-Klassen wie SuccessNote (misc.tsx:80: rounded-sm, bg-surface-success, p-4, text-success-text, Typo-Klasse aus dem Bestand), zentriert, `animate-pop`, Abstand zum Antwortfeld mit einer vorhandenen Spacing-Klasse, Text „Richtig!“ und bei XP > 0 „ +N XP“ (textContent genau „Richtig! +10 XP“ bzw. „Richtig!“). Leer nimmt der Bereich keinen Platz ein. SuccessNote selbst nicht verwenden (setzt role="status" auf das bedingt eingehaengte Element, Ansage unzuverlaessig).
    7. Layout: ein Wrapper mit `mt-auto flex flex-col` um Statusbereich und Antwortbereich; `mt-auto` an Auswahl-Grid (:237), Formular (:252) und FeedbackPanel (:297) entfernen. Sonst bleibt FeedbackPanel unveraendert.
    8. Kommentare deutsch, Umlaute im Code umschrieben (ae/oe/ue) wie im Bestand. Keine Inline-Styles, kein Hex, keine Einzelfall-px (DESIGN.md, AGENTS.md).
  </action>
  <verify>
    <automated>docker run --rm -v "$PWD":/repo -v /repo/frontend/node_modules -w /repo/frontend node:22 bash -c 'npm ci --no-audit --no-fund >/dev/null && npx vitest run src/features/learn/SessionPage.test.tsx && npm run lint && npm run typecheck && npm run design:classes'</automated>
  </verify>
  <done>Die neuen bzw. umgestellten Faelle waren vor der Aenderung an SessionPage.tsx rot (Anzahl und Ursache im SUMMARY) und sind danach gruen; alle Faelle in SessionPage.test.tsx gruen; lint, typecheck und design:classes mit Exit 0.</done>
</task>

<task type="auto">
  <name>Task 2: e2e und DESIGN.md nachziehen, im echten Browser belegen (axe, Tastatur, 200 %)</name>
  <files>frontend/e2e/learn.spec.ts, frontend/e2e/first-run.spec.ts, DESIGN.md</files>
  <action>
    learn.spec.ts, Block „ohne Secure Context“:
    - Helfer `answer()` (:353-372): „Weiter“ ist nur noch noetig, wenn `!result.correct || result.hadTypo`; dann die bisherigen Assertions unveraendert. Sonst erwarten: kein Button „Weiter“. Einen kleinen Helfer fuer den Zustand nach automatischer Weiterschaltung ergaenzen: Gibt es noch eine Aufgabe, hat `page.getByRole('status')` genau den Text „Richtig! +N XP“ (N = xpAwarded aus der Antwort, bei 0 nur „Richtig!“), das Antwortfeld ist fokussiert und leer; sonst ist die Zusammenfassung („Geschafft!“ oder „… erreicht!“) sichtbar, ohne dass etwas gedrueckt wurde.
    - „Lernen über HTTP“ (:395-416): „Weiter“ nur klicken, wenn die vorige Antwort es braucht; das abschliessende Klicken auf „Weiter“ entfaellt, wenn die letzte Antwort richtig ohne Tippfehler war. Per Flag belegen, dass mindestens eine automatische Weiterschaltung mit Bestaetigung stattfand, und dass die letzte Antwort direkt zur Zusammenfassung fuehrte.
    - „Lernen mit Bild über HTTP“ (:528-548) bleibt reine Tastatur-Runde: Enter fuer „Weiter“ nur nach falsch/Tippfehler. Bei der ersten automatischen Weiterschaltung: Viewport 640x400 (200 %, Muster :504-516), Antwortfeld fokussiert und `toBeInViewport({ ratio: 1 })`, Statusbereich `toBeInViewport()`, scrollWidth ≤ 640; Viewport zuruecksetzen; danach `checkPage(page)` auf genau diesem Zustand (axe 0 mit Bestaetigung). Per Flag belegen, dass dieser Pruefpunkt lief. Das abschliessende Enter entfaellt; die Zusammenfassung erscheint nach der letzten richtigen Antwort von selbst.
    - learn.spec.ts:249-251 und children.spec.ts nicht aendern (falsche Antwort, „Weiter“ bleibt).

    first-run.spec.ts (:85-101): Keine Klicks auf „Weiter“ mehr. Nach jeder Antwort die Serverantwort lesen; ist es nicht die letzte Aufgabe, hat `getByRole('status')` den Text „Richtig! +N XP“ bzw. „Richtig!“ und das Antwortfeld ist leer; nach der letzten erscheint die Zusammenfassung. Die bestehende Zeile, die vor jeder Karte ein leeres Feld erwartet, darf bleiben.

    DESIGN.md (normativ, AGENTS.md → Design): vorher `git show HEAD:DESIGN.md` in eine Datei im Scratchpad schreiben. In :317 nur den Satz „Rückmeldung (richtig, Tippfehler, „Fast!“) als `sheet` von unten.“ ersetzen durch: „Rückmeldung bei Tippfehler und „Fast!“ als `sheet` von unten mit „Weiter“; ist die Antwort ohne Tippfehler richtig, kommt sofort die nächste Aufgabe, und „Richtig!“ mit den XP steht als `note-success` (`role="status"`) über dem Antwortfeld bis zur nächsten Antwort.“ Keine Token-Aenderung. Danach `npx -y @google/design.md@0.4.0 diff <Scratchpad-Kopie> DESIGN.md` laufen lassen, den Key `regression` lesen (erwartet false) und festhalten.

    Doku-Abgleich (A9): `grep -rn -i "weiter\|rückmeldung\|richtig!" Documentation/*.md README.md` laufen lassen und bestaetigen, dass keine Zeile den alten Ablauf beschreibt; Treffer ohne Bezug (z. B. „leitet … weiter“) nicht anfassen. Ergebnis ins SUMMARY.

    e2e-Lauf: Vorher pruefen, dass kein fremder Lauf den Stack nutzt (`docker ps --filter label=com.docker.compose.project=wordquest-e2e -q` leer); sonst warten und nicht abreissen (`e2e:stack` macht `down -v`, das wuerde einen Lauf von 261025-fpi zerstoeren). Dann aus frontend/: `npm run e2e:stack && npx playwright test`, danach immer `docker compose -f e2e/docker-compose.e2e.yml down -v`. Erwartet: alles gruen ausser dem bekannten skip `first-run`.

    first-run.spec.ts laeuft nur im Install-Smoke. `bash .planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh` nur starten, wenn kein Compose-Projekt `wq-smoke` laeuft (`docker compose ls`); Fehler ausserhalb der Lernrunde in first-run.spec.ts gehoeren nicht zu diesem Auftrag (setup.sh u. a. aendert 261025-fpi) und werden nur gemeldet. Laeuft der Smoke nicht, im SUMMARY `UNBEKANNT: Lauf von first-run.spec.ts` mit Grund; typecheck und lint decken die Datei dann statisch ab.
  </action>
  <verify>
    <automated>docker run --rm -v "$PWD":/repo -v /repo/frontend/node_modules -w /repo/frontend node:22 bash -c 'npm ci --no-audit --no-fund >/dev/null && npm run lint && npm run typecheck && npm run design:check' && cd frontend && npm run e2e:stack && npx playwright test; status=$?; docker compose -f e2e/docker-compose.e2e.yml down -v; exit $status</automated>
  </verify>
  <done>lint, typecheck und design:check mit Exit 0 (Ausgabe gelesen, keine Kontrast-Warnung); design diff mit regression false; Playwright alles gruen ausser skip first-run, die Pruefpunkte „automatische Weiterschaltung“ (beide Tests) und „200 % + checkPage auf dem neuen Zustand“ liefen; Stack wieder abgebaut; Ergebnis von first-run.spec.ts im Install-Smoke oder UNBEKANNT mit Grund im SUMMARY.</done>
</task>

<task type="auto">
  <name>Task 3: Volles Gate, Subagent-Review, ein Commit</name>
  <files>frontend/src/features/learn/SessionPage.tsx, frontend/src/features/learn/SessionPage.test.tsx, frontend/e2e/learn.spec.ts, frontend/e2e/first-run.spec.ts, DESIGN.md</files>
  <action>
    Gate (AGENTS.md → Gate), jede Zahl ins SUMMARY:
    1. Backend (unberuehrt, Gate verlangt es): `bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh`.
    2. Frontend im node:22-Container: `docker run --rm -v "$PWD":/repo -v /repo/frontend/node_modules -w /repo/frontend node:22 bash -c 'npm ci && npm run lint && npm run typecheck && npm run build && npm test && npm run design:check && npm run design:classes'`. design:check-Ausgabe lesen; Kontrast-Warnungen sind blockierend.
    Der Arbeitsbaum kann ungestagte Aenderungen von 261025-fpi enthalten. Faellt ein Gate-Schritt wegen deren Dateien, nicht reparieren, sondern mit Datei und Fehler melden.

    Review (AGENTS.md → Review): Ein Subagent prueft `git diff -- frontend/src/features/learn/SessionPage.tsx frontend/src/features/learn/SessionPage.test.tsx frontend/e2e/learn.spec.ts frontend/e2e/first-run.spec.ts DESIGN.md` gegen die must_haves und die Annahmen A1-A9 dieses Plans, nicht gegen die Selbstbeschreibung: Korrektheit (insbesondere Doppel-Senden, Item-ID-Riegel, letzte Aufgabe, retryItem, shownAt), Sicherheit, AGENTS.md-Regeln (Einfachheit, Konventionen, DESIGN.md-Tokens, Doku = Code), Tests, Barrierefreiheit (Live-Bereich, Fokus, reduced motion, Kontrast). Gibt es kein Agent-Werkzeug, eine zweite Instanz `claude -p` mit nur lesenden Werkzeugen (wie in 261024-vnx). Befunde beheben und die beruehrten Gate-Schritte (vitest, ggf. e2e) erneut laufen lassen, oder begruendet zurueckweisen; beides ins SUMMARY.

    Commit auf v1-fertig, nur diese fuenf Pfade explizit (`git add <pfad> …`, nie `git add -A`/`git add .`; die untracked Dateien .planning/milestone.lock, .planning/state.json, .planning/phases/03.1.1-vocabulary-pictures/.gitkeep und Dateien von 261025-fpi nie stagen). Message: `feat: Richtige Antwort springt direkt zur nächsten Aufgabe`, Body kurz (Weiter nur noch bei falsch und Tippfehler, Bestaetigung mit XP ueber dem Antwortfeld als role=status), Trailer `A11y-Check: @axe-core/playwright 4.13.0 <Ergebnis> /lernen (Bestaetigung nach richtiger Antwort, 200 %, Tastatur)` und `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Kein Push. PLAN und SUMMARY committet der Quick-Orchestrator.
  </action>
  <verify>
    <automated>bash .planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh && docker run --rm -v "$PWD":/repo -v /repo/frontend/node_modules -w /repo/frontend node:22 bash -c 'npm ci && npm run lint && npm run typecheck && npm run build && npm test && npm run design:check && npm run design:classes' && c=$(git log -1 --format=%H --grep='^feat: Richtige Antwort springt direkt') && test -n "$c" && files=$(git show --name-only --format= "$c") && for f in frontend/src/features/learn/SessionPage.tsx frontend/src/features/learn/SessionPage.test.tsx frontend/e2e/learn.spec.ts frontend/e2e/first-run.spec.ts DESIGN.md; do printf '%s\n' "$files" | grep -qxF "$f" || exit 1; done</automated>
  </verify>
  <done>Backend- und Frontend-Gate mit Exit 0 (Zahlen im SUMMARY); Review-Befunde behoben oder begruendet; HEAD ist der feat-Commit mit genau den fuenf Pfaden (plus ggf. ein Review-Fix-Commit), mit A11y- und Co-Authored-By-Trailer; nichts gepusht.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser (Kind) → API /sessions/{id}/answers | Antworten werden je Aufgabe gesendet; der Server wertet und terminiert, das Frontend zeigt nur an |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261025-gef-01 | Tampering | SessionPage send(), schnelle Eingaben | medium | mitigate | `sending`-Ref und clientAnswerId = itemId bleiben; zusaetzlicher Riegel ueber die Item-ID der zuletzt gesendeten Antwort; Server antwortet bei Doppel-Antwort weiter 409 (FIX-04/FIX-07). Belegt durch vitest „Zweimal Enter“/„Doppelklick“ und Body-Pruefung der zweiten Antwort. |
| T-261025-gef-02 | Information Disclosure | Bestaetigung „Richtig! +N XP“ | low | accept | Zeigt nur Wertung und XP der eigenen, schon gegebenen Antwort; die richtige Loesung erscheint wie bisher nur im Sheet nach falsch/Tippfehler. |
| T-261025-gef-03 | Repudiation | Auto-Weiterschaltung auf der letzten Aufgabe | low | mitigate | finish(false) laeuft ueber denselben Weg wie bisher „Weiter“; vitest prueft genau ein POST /complete. |
| T-261025-gef-SC | Tampering | npm/pip/cargo installs | high | mitigate | Keine Installation: `npm ci` nur aus dem bestehenden Lockfile im Container; `npx -y @google/design.md@0.4.0` ist dieselbe gepinnte Version wie in den package.json-Skripten. Keine neue Dependency. |
</threat_model>

<verification>
Verbote: Ports 8080, 18090, 18091, 18092 und die Docker-Projekte wq-preview, wq-mig, wq-traefik, wordquest nicht anfassen; kein `docker compose` im Repo-Root ohne `-f`. Stack `wordquest-e2e` und Projekt `wq-smoke` nur nutzen, wenn kein anderer Lauf aktiv ist. Dateien von 261025-fpi (nginx, Compose, setup.sh, upgrade.sh, deren Doku) nicht aendern, nicht stagen. Kein Push, kein Tag.

1. vitest SessionPage rot vor, gruen nach der Aenderung (Task 1).
2. e2e mit axe auf dem neuen Zustand, Tastatur-Runde, 200 % (Task 2); first-run.spec.ts im Install-Smoke oder UNBEKANNT mit Grund.
3. design diff regression false; Doku-grep ohne Zeile zum alten Ablauf (Task 2).
4. Volles Gate, Review, Commit (Task 3).
</verification>

<success_criteria>
- Richtig ohne Tippfehler: sofort naechste Aufgabe, „Richtig! +N XP“ als role=status ueber dem Antwortfeld, Fokus im leeren Feld; letzte Aufgabe → Zusammenfassung.
- Falsch und Tippfehler: Sheet mit „Weiter“ unveraendert.
- Keine doppelte oder verrutschte Antwort bei schnellen Eingaben (vitest).
- axe 0 auf dem neuen Zustand, Tastatur-Runde und 200 % im e2e belegt.
- DESIGN.md-Quiz-Zeile passt zum Code; Gate gruen; Review dokumentiert; ein feat-Commit auf v1-fertig ohne Push.
</success_criteria>

<output>
Create `.planning/quick/261025-gef-richtige-antwort-springt-direkt-weiter/261025-gef-SUMMARY.md` when done: Commits (Hash, Message), roter und gruener vitest-Lauf, Gate-Tabelle (Befehl, Stand, Exit, Ergebnis), A11y-Beleg (axe-Version, Seite/Zustand, Befunde, Tastatur, 200 %), design-diff-Ergebnis, Doku-grep, Ergebnis oder UNBEKANNT fuer first-run.spec.ts, Annahmen A1-A9, Review-Befunde mit Entscheidung.
</output>
