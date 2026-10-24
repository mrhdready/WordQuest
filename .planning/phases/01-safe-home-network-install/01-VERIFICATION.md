---
phase: 01-safe-home-network-install
verified: 2026-10-17T11:30:00Z
status: human_needed
score: 5/5 must-haves verified
covered_files: [".env.example",".github/workflows/ci.yml",".gitignore",".planning/phases/01-safe-home-network-install/01-01-PLAN.md",".planning/phases/01-safe-home-network-install/01-01-SUMMARY.md",".planning/phases/01-safe-home-network-install/01-02-PLAN.md",".planning/phases/01-safe-home-network-install/01-02-SUMMARY.md",".planning/phases/01-safe-home-network-install/01-03-PLAN.md",".planning/phases/01-safe-home-network-install/01-03-SUMMARY.md",".planning/phases/01-safe-home-network-install/01-04-PLAN.md",".planning/phases/01-safe-home-network-install/01-04-SUMMARY.md",".planning/phases/01-safe-home-network-install/01-05-PLAN.md",".planning/phases/01-safe-home-network-install/01-05-SUMMARY.md",".planning/phases/01-safe-home-network-install/01-06-PLAN.md",".planning/phases/01-safe-home-network-install/01-06-SUMMARY.md",".planning/phases/01-safe-home-network-install/01-07-PLAN.md",".planning/phases/01-safe-home-network-install/01-07-SUMMARY.md",".planning/phases/01-safe-home-network-install/01-08-PLAN.md",".planning/phases/01-safe-home-network-install/01-08-SUMMARY.md",".planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh","AGENTS.md","DESIGN.md","Documentation/WordQuest_Konzept_und_Architektur.md","README.md","backend/WordQuest.slnx","backend/src/WordQuest.Api/AccountCommands.cs","backend/src/WordQuest.Api/Auth/AuthService.cs","backend/src/WordQuest.Api/Contracts/Contracts.cs","backend/src/WordQuest.Api/DemoAccountCheck.cs","backend/src/WordQuest.Api/Endpoints/AccountEndpoints.cs","backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs","backend/src/WordQuest.Api/Program.cs","backend/src/WordQuest.Api/SecretCheck.cs","backend/src/WordQuest.Api/appsettings.json","backend/src/WordQuest.Infrastructure/AccountService.cs","backend/src/WordQuest.Infrastructure/OwnerCreation.cs","backend/src/WordQuest.Infrastructure/PasswordChange.cs","backend/src/WordQuest.Modules.Identity/Entities/LearnerProfile.cs","backend/src/WordQuest.Modules.Identity/Services/AccountRules.cs","backend/src/WordQuest.Modules.Identity/Services/LearnerProfileProblem.cs","backend/tests/WordQuest.Api.Tests/AccountCommandTests.cs","backend/tests/WordQuest.Api.Tests/AccountEndpointTests.cs","backend/tests/WordQuest.Api.Tests/AccountRulesTests.cs","backend/tests/WordQuest.Api.Tests/ApiFactory.cs","backend/tests/WordQuest.Api.Tests/DemoAccountCheckTests.cs","backend/tests/WordQuest.Api.Tests/LearnerEndpointTests.cs","backend/tests/WordQuest.Api.Tests/RateLimitTests.cs","backend/tests/WordQuest.Api.Tests/ResetPasswordCommandTests.cs","backend/tests/WordQuest.Api.Tests/SecretCheckTests.cs","backend/tests/WordQuest.Api.Tests/WordQuest.Api.Tests.csproj","docker-compose.quick.yml","docker-compose.yml","frontend/e2e/account.spec.ts","frontend/e2e/axe.ts","frontend/e2e/children.spec.ts","frontend/e2e/docker-compose.e2e.yml","frontend/e2e/first-run.spec.ts","frontend/e2e/global-setup.ts","frontend/e2e/keyboard-zoom.spec.ts","frontend/e2e/learn.spec.ts","frontend/e2e/login.spec.ts","frontend/e2e/manage.spec.ts","frontend/index.html","frontend/package.json","frontend/playwright.config.ts","frontend/scripts/design-classes.mjs","frontend/src/App.tsx","frontend/src/components/ui/button.tsx","frontend/src/components/ui/card.tsx","frontend/src/components/ui/field.test.tsx","frontend/src/components/ui/field.tsx","frontend/src/components/ui/input.tsx","frontend/src/components/ui/list.tsx","frontend/src/components/ui/misc.test.tsx","frontend/src/components/ui/misc.tsx","frontend/src/design-tokens.css","frontend/src/features/auth/GuardianLoginPage.tsx","frontend/src/features/auth/ProfilePickerPage.test.tsx","frontend/src/features/auth/ProfilePickerPage.tsx","frontend/src/features/learn/LearnHomePage.test.tsx","frontend/src/features/learn/LearnHomePage.tsx","frontend/src/features/learn/SessionPage.tsx","frontend/src/features/manage/AccountPage.test.tsx","frontend/src/features/manage/AccountPage.tsx","frontend/src/features/manage/ChildFormPage.test.tsx","frontend/src/features/manage/ChildFormPage.tsx","frontend/src/features/manage/ChildrenPage.test.tsx","frontend/src/features/manage/ChildrenPage.tsx","frontend/src/features/manage/ManageLayout.tsx","frontend/src/features/manage/ProgressPage.test.tsx","frontend/src/features/manage/ProgressPage.tsx","frontend/src/features/manage/SetDetailPage.test.tsx","frontend/src/features/manage/SetDetailPage.tsx","frontend/src/features/manage/SetsPage.test.tsx","frontend/src/features/manage/SetsPage.tsx","frontend/src/index.css","frontend/src/lib/api.test.ts","frontend/src/lib/api.ts","frontend/src/test/render.test.tsx","frontend/src/test/render.tsx","frontend/src/test/setup.ts","frontend/src/types.ts","frontend/tsconfig.json","frontend/vite.config.ts","setup.sh"]
covered_digest: "v3:sha256:d460b8de922c3db254d924951d01bda75036beb2f605b83a761104365cbb3712"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 4/5
  gaps_closed:
    - "Erfolgskriterium 5 (vorher UNCERTAIN): Tastatur-Durchgang und 200 % Zoom jetzt durch frontend/e2e/keyboard-zoom.spec.ts automatisiert"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Aktiver Tab der Tab-Leiste im Elternbereich ohne Farbwahrnehmung (z. B. Graustufen-Filter) bei 320 px und 640 px"
    expected: "Aktiver Tab an eigener Fläche bzw. Form erkennbar, nicht nur an der Farbe"
    why_human: "Backstop-Truth 01-03. Umbruch statt Scrollen ist jetzt automatisiert (manage.spec 320 px, keyboard-zoom.spec 640 px), aria-current ist geprüft; die visuelle Unterscheidbarkeit ohne Farbe nicht"
  - test: "Leere Zustände ansehen: frische Installation, /verwalten und /verwalten/kinder ohne Sets und Kinder, Set ohne Einträge"
    expected: "EmptyState im Token-Design, optisch stimmig"
    why_human: "Backstop-Truth 01-03. Die Texte „Noch kein Kinderprofil“ und „Noch keine Vokabelsets“ prüft first-run.spec im Install-Smoke; die Darstellung nicht"
  - test: "Liquid-Glass-Effekt auf einem echten Tablet (Safari/Chrome) und mit „Transparenz reduzieren“"
    expected: "Glasflächen lesbar, kein Ruckeln am Ziffernfeld; bei reduzierter Transparenz deckender Fallback"
    why_human: "Rendering und Performance auf echter Hardware sind nicht automatisierbar"
  - test: "Kind mit 100-Zeichen-Namen anlegen und die Anmelde-Kachel auf / ansehen, auch bei 200 % Zoom"
    expected: "Name bricht in der Kachel um, wird nie abgeschnitten, Kachel bleibt bedienbar"
    why_human: "Backstop-Truth 01-07. children.spec prüft Liste und Formular; keyboard-zoom.spec prüft auf / nur die Seitenbreite, und den langen Namen sieht es dort nur, weil children.spec zufällig vorher im selben Stack läuft. Abschneiden innerhalb der Kachel prüft kein Test"
  - test: "Raspberry Pi 5: ./setup.sh auf frischem Klon ausführen"
    expected: "Abschlusszeile nennt http://<LAN-IP>:8080 (Ausgabe von hostname -I), Login dort mit dem eingegebenen Konto klappt"
    why_human: "Smoke lief auf macOS, wo hostname -I fehlt; echte ARM64-Heimhardware nicht im Testumfeld"
  - test: "Raspberry Pi 5: Backup-Dienst über mindestens einen Tageswechsel laufen lassen"
    expected: "backups/daily/wordquest-<Datum>.sql.gz entsteht automatisch, gzip -t ok, Rotation 14/8/6 greift später"
    why_human: "Smoke belegt nur den manuellen Lauf von /backup.sh; der @daily-Zeitplan auf echter Hardware braucht Zeit"
  - test: "FIX-07: dieselbe Lernantwort zweimal senden (gleiche clientAnswerId) und Stack neu starten"
    expected: "Antwort zählt einmal; Lernstand nach docker compose restart unverändert"
    why_human: "Backstop-Truths 01-04; weiterhin kein automatisierter Test im Repo (kein Treffer für clientAnswerId in backend/tests). Doppel-Tipp-Race ist FIX-04 in Phase 2"
  - test: "Prohibitions (judgment-tier) bestätigen: PIN-Länge nie verraten; neue Kindertexte ohne „PIN“; falsche Antworten ohne Alarm-Optik; Reset-Passwort nur einmal ausgegeben, nie geloggt; Kind bearbeiten ändert keine Lerndaten; Kind anlegen fragt keine weiteren Personendaten ab"
    expected: "Alle sechs Verbote halten"
    why_human: "Nicht-autoritatives LLM-Urteil: alle sechs halten auch nach 1b78505 (neue Kindertexte „Der Server ist gerade nicht erreichbar …“, „Noch einmal“ ohne „PIN“). Kein verdrahteter Test-Gate, daher menschliche Bestätigung empfohlen"
---

# Phase 1: Safe Home-Network Install — Verifikationsbericht

**Phasenziel:** Ein Elternteil installiert WordQuest im Heimnetz über reines HTTP mit eigenem Konto, erzeugten Secrets und täglichen Sicherungen und kann das eigene Passwort sowie eine vergessene Kinder-PIN ohne Hilfe wiederherstellen.
**Verifiziert:** 2026-10-17T11:30:00Z
**Status:** human_needed
**Re-Verifikation:** Ja — nach der Nachbesserung in 1b78505 (Befunde aus 01-REVIEW.md und 01-UI-REVIEW.md)

**Hinweis MVP-Modus:** ROADMAP führt die Phase mit `Mode: mvp`, das Ziel ist aber keine User Story (`user-story.validate` → `valid: false`). Wie in der Erstverifikation wurde auf Auftrag die normale Goal-Backward-Prüfung gegen die fünf Erfolgskriterien durchgeführt. Für saubere MVP-Läufe künftig `/gsd-mvp-phase 1` oder den Modus entfernen.

**Evidenzbasis:**
- Selbst ausgeführt (2026-10-17, HEAD 5cb4a62): `npx vitest run` → 12 Dateien, 106/106 bestanden; `npm run lint` Exit 0; `npm run typecheck` Exit 0; `npx playwright test --list` → 30 Tests in 7 Dateien, davon 7 in `keyboard-zoom.spec.ts`; Code-Lektüre des Diffs `1b78505~1..1b78505`.
- Artefakt: `frontend/test-results/.last-run.json` (12:49) `"status": "passed"`, `failedTests: []`, jünger als `keyboard-zoom.spec.ts` (12:44). Passt zur Angabe 29 bestanden + 1 übersprungen (`first-run.spec` läuft nur im Install-Smoke).
- Vom nachbessernden Agenten am 2026-10-17 beobachtet und übernommen, nicht selbst wiederholt (kein lokales .NET, kein Stack gestartet): Backend-Build 0 Warnungen, Api.Tests 136/136, Learning.Tests 104/104, build/design:check/design:classes Exit 0, e2e 29 + 1 skip auf frischem Stack, Install-Smoke `SMOKE OK` inkl. `DEMO-ABBRUCH OK`. Die Testzahl ist plausibel: 130 vorher + 2 neue Fälle in `LearnerEndpointTests` + 4 in `DemoAccountCheckTests`.

## Zielerreichung

### Beobachtbare Wahrheiten (ROADMAP-Erfolgskriterien)

| # | Wahrheit | Status | Beleg |
|---|----------|--------|-------|
| 1 | Frischer Host: `setup.sh` fragt E-Mail und Passwort, erzeugt DB-Passwort und JWT-Schlüssel; danach Login unter `http://<host>:8080` mit genau diesem Konto, kein Demo-Konto | ✓ VERIFIED | Unverändert aus Erstverifikation (Smoke: neues Konto 200, Demo-Konto 401). Verschärft durch CR-01: `Program.cs` bricht außerhalb Development bei `WQ_SEED_DEMO_DATA` ab (`DemoAccountCheck.SeedProblem`, vor jedem DB-Zugriff) und nach der Migration, wenn ein Demo-Elternkonto noch das bekannte Passwort hat (`DemoAccountCheck.AccountProblemAsync`, hinter den CLI-Verben, damit `docker compose run --rm api reset-password` als Ausweg bleibt). `setup.sh` erkennt `True`/`"true"` jetzt ebenfalls. Tests `Seed_switch_on_stops_the_start`, `Demo_account_with_known_password_stops_the_start`, `Reset_password_clears_the_problem`; Smoke `DEMO-ABBRUCH OK` führt genau den Befehl aus der Meldung aus |
| 2 | Heimnetz-Stack schreibt täglich einen Dump; außerhalb Development Startabbruch mit Namen des Secrets bei fehlendem/bekanntem Wert | ✓ VERIFIED | Unverändert: `docker-compose.quick.yml` Dienst `backup` mit `@daily`, `SecretCheck` vor DB-Zugriff. Smoke `STARTABBRUCH OK` jetzt mit viertem Fall `WQ_SEED_DEMO_DATA=True`, `BACKUP OK`. Der e2e-Stack läuft seit 1b78505 als Development (braucht das Demo-Konto); die Production-Startprüfung bleibt durch den Install-Smoke abgedeckt, der e2e-Stack war nie ihr Beleg. Zeitplan auf echter Hardware → Human-Item |
| 3 | Passwort in der App ändern → nur noch neues gilt; Betreiber setzt es mit einem Befehl im Container zurück | ✓ VERIFIED | Unverändert. Refactor `AccountService.MarkRefreshTokensRevokedAsync` hält Passwort und Token-Widerruf in einem `SaveChanges`. `AccountEndpoints` mappt jetzt explizit `UnknownUser → 404`, sonst `UnreachableException` statt stillem 404 |
| 4 | Kind bearbeiten (Name, Limit, PIN), Kind meldet sich mit neuer PIN an; PIN ≠ 4–6 Ziffern vom Server lesbar abgelehnt, auch direkt per API | ✓ VERIFIED | Unverändert, plus WR-01: neue PIN widerruft die Refresh-Tokens des Kindes (`LearnerEndpoints.cs`, gleiche Scoped-`DbContext`-Instanz, ein `SaveChanges`; `LearnerProfile.Id` ist die UserId). Test `New_pin_revokes_the_childs_refresh_tokens` (Refresh danach 401). WR-02: Kind ohne PIN braucht beim Speichern eine (`pinRequired: profile.PinHash is null`), Test `Patch_on_a_child_without_pin_requires_a_pin`; Frontend `ChildFormPage` validiert analog |
| 5 | Formulare Passwort ändern und Kind bearbeiten: Edge-Case-Matrix, axe 0 Verstöße, Tastatur-Durchgang und 200 % Zoom | ✓ VERIFIED | Matrix: `AccountPage.test.tsx`, `ChildFormPage.test.tsx` (selbst ausgeführt, im 106/106-Lauf). axe: `checkPage` in `account.spec.ts`, `children.spec.ts`. **Neu:** `keyboard-zoom.spec.ts` bei Viewport 640 × 400 (= 1280 × 800 bei 200 %) auf `/login`, `/`, `/verwalten?neu=1`, `/verwalten/konto`, `/verwalten/kinder`, `/verwalten/kinder/neu`, `/verwalten/kinder/:id`. Je Seite: kein waagerechter Scrollbalken (`scrollWidth ≤ clientWidth`, WCAG 1.4.10); Tab-Durchgang bis Wiederholung/Body, jedes Ziel vollständig im Bild, Mittelpunkt nicht verdeckt (`elementFromPoint`, auch nicht von der schwebenden Tab-Leiste, 2.4.11), Outline ≠ `none`/`0px` (2.4.7; global `:focus-visible { outline: 3px solid … }` in `index.css:222`); auf `/verwalten?neu=1` liegt mindestens ein Ziel anfangs unter der Leiste (kein Trivialfall). Enter-Pfad auf Konto und Kind anlegen: Fehlertext sichtbar, Fokus aufs erste Fehlerfeld. Esc: auf diesen Seiten gibt es keine Dialoge (kein `Dialog`/`Escape` in `src/features`, `src/components`) — nicht anwendbar. Lauf grün laut `.last-run.json` und Beobachtung des nachbessernden Agenten |

**Score:** 5/5 Wahrheiten verifiziert (0 present, behavior-unverified)

**Einschränkung zu 5:** Viewport-Emulation statt echtem Browser-Zoom. Für Layout ist das gleichwertig (CSS-Viewport und Media-Queries identisch); reiner Text-Zoom ist nicht abgedeckt, verlangt aber auch das Erfolgskriterium nicht. Die Tab-*Reihenfolge* prüft `keyboard-zoom.spec` nicht, die prüfen weiterhin `account.spec`/`children.spec`/`manage.spec` bei Standardgröße.

### Plan-Must-Haves

Unverändert gegenüber der Erstverifikation: Artefakte 43/43, Key-Links 25/25 (zwei Werkzeug-Fehlalarme manuell als WIRED bestätigt). Der Backstop „Tastatur/200 %“ (01-08) ist jetzt durch `keyboard-zoom.spec` belegt; die übrigen Backstop-Truths bleiben Human-Items (Tab-Leiste ohne Farbe, Leere Zustände, FIX-07, lange Namen in der Kachel).

### Prohibitions (judgment-tier, nicht-autoritatives LLM-Urteil, Flag: unverified-prohibition — human review recommended)

| Verbot | LLM-Urteil | Beleg |
|--------|------------|-------|
| PIN-Länge nie verraten | hält | `ProfilePickerPage.tsx` `dotCount` profilunabhängig; 1b78505 ändert nur Fehlerzeile, Retry, `aria-hidden` |
| Neue Kindertexte ohne „PIN“ | hält | neue Texte „Der Server ist gerade nicht erreichbar. Prüfe die Verbindung und versuche es noch einmal.“, „Noch einmal“ |
| Falsche Antworten ohne Alarm | hält | `LearnHomePage` zeigt jetzt `ErrorNote` nur für Ladefehler, nicht für Antworten |
| Reset-Passwort einmal, nie geloggt | hält | `AccountService` weiter ohne Logger; `DemoAccountCheck` gibt nur Adresse und Befehl aus, kein Passwort |
| Kind bearbeiten ändert keine Lerndaten | hält | PATCH ergänzt nur Token-Widerruf; `Patch_leaves_learning_and_gamification_state_unchanged` |
| Kind anlegen ohne weitere Personendaten | hält | Felder Name, Neue Karten pro Tag, PIN |

### Erforderliche Artefakte (Delta)

| Artefakt | Erwartung | Status | Details |
|----------|-----------|--------|---------|
| `backend/src/WordQuest.Api/DemoAccountCheck.cs` | CR-01 Startabbruch | ✓ VERIFIED | in `Program.cs` zweimal verdrahtet (Seed-Schalter vor Build, Konto nach Migration) |
| `backend/tests/WordQuest.Api.Tests/DemoAccountCheckTests.cs` | Tests CR-01 | ✓ VERIFIED | 4 Fälle inkl. Ausweg `reset-password` |
| `frontend/e2e/keyboard-zoom.spec.ts` | Tastatur + 200 % | ✓ VERIFIED | 7 Tests, gelistet und grün (s. o.) |
| `.planning/phases/01-safe-home-network-install/smoke/setup-smoke.sh` | Install-Smoke | ✓ VERIFIED | neue Blöcke Seed-Abbruch und `DEMO-ABBRUCH` |
| Übrige Artefakte | — | ✓ VERIFIED | Regressionsprüfung: vitest/lint/typecheck selbst grün, Backend-Tests übernommen |

### Key-Link-Verifikation (Delta)

| Von | Nach | Via | Status |
|-----|------|-----|--------|
| `Program.cs` | `DemoAccountCheck.cs` | `SeedProblem` vor Build, `AccountProblemAsync` nach Migration, nur außerhalb Development | WIRED |
| `LearnerEndpoints.cs` | `AccountService.MarkRefreshTokensRevokedAsync` | DI-Parameter `AccountService accounts` | WIRED |
| `keyboard-zoom.spec.ts` | `global-setup.ts` | `guardianStorageState` (Demo-Konto, e2e-Stack als Development) | WIRED |

### Verhaltens-Stichproben

| Verhalten | Befehl | Ergebnis | Status |
|-----------|--------|----------|--------|
| Frontend-Unit-Tests inkl. Formular-Matrizen, ProfilePicker-Retry, Ladefehler | `npx vitest run` | 12 Dateien, 106/106 | ✓ PASS |
| Lint, Typecheck | `npm run lint`, `npm run typecheck` | Exit 0, Exit 0 | ✓ PASS |
| keyboard-zoom.spec vorhanden | `npx playwright test --list` | 7 von 30 Tests | ✓ PASS |
| Letzter e2e-Lauf | `cat test-results/.last-run.json` | `passed`, keine Fehler | ✓ PASS (Artefakt) |
| Backend 136/104, e2e 29+1, Smoke | — | vom nachbessernden Agenten beobachtet | ✓ PASS (übernommen) |

### Probe-Ausführung

Keine `scripts/*/tests/probe-*.sh` vorhanden und keine in PLAN/SUMMARY deklariert. Install-Smoke nicht selbst ausgeführt (startet einen Docker-Stack); `SMOKE OK` inkl. `DEMO-ABBRUCH OK` stammt vom nachbessernden Agenten.

### Anforderungsabdeckung

| Anforderung | Status | Beleg |
|-------------|--------|-------|
| DESIGN-01 | ✓ SATISFIED (Liquid Glass auf Tablet offen) | Tokens, design:classes, axe; Fokusring global |
| SETUP-01 | ✓ SATISFIED | SK 1 + 2 |
| SETUP-02 | ✓ SATISFIED | SK 1, zusätzlich CR-01-Startabbruch für Altinstallationen |
| SETUP-03 | ✓ SATISFIED | SK 3 |
| SETUP-04 | ✓ SATISFIED | SK 3; `docker compose run --rm api reset-password` als Ausweg bei Startabbruch im Smoke belegt |
| SETUP-05 | ✓ SATISFIED | SK 2 |
| SETUP-06 | ✓ SATISFIED | unverändert |
| FIX-07 | ✓ SATISFIED (Idempotenz/Neustart nur manuell belegt) | unverändert |
| FIX-08 | ✓ SATISFIED | PIN per Tastatur; `/` jetzt auch im Zoom-Tab-Durchgang |
| PAR-01 | ✓ SATISFIED | SK 4, neue PIN meldet Altgeräte ab |
| PAR-02 | ✓ SATISFIED | `AccountRules.IsValidPin`, POST + PATCH |
| PAR-05 | ✓ SATISFIED | unverändert |
| QUAL-02 | ✓ SATISFIED | SK 5 vollständig automatisiert |

Keine verwaisten Anforderungen. Info: `REQUIREMENTS.md` führt 11 der 13 IDs weiterhin als „Pending“ (Zeilen 91–113) — beim Phasenabschluss nachziehen.

### Anti-Patterns

| Datei | Zeile | Muster | Schwere | Auswirkung |
|-------|-------|--------|---------|------------|
| 26 Dateien aus 1b78505 | — | TBD/FIXME/XXX, TODO/HACK | — | keine Treffer |
| `setup.sh` | Abschluss | `hostname -I` fehlt auf macOS | ℹ️ Info | auf Linux/Pi erwartet korrekt; Human-Item 5 |
| `keyboard-zoom.spec.ts` | `Profilwahl /` | sieht das 100-Zeichen-Kind nur über die Laufreihenfolge (`workers: 1`, children.spec zuerst) | ℹ️ Info | kein Beleg für die Kachel, daher Human-Item 4 bleibt |

### Menschliche Prüfung erforderlich

Entfallen gegenüber der Erstverifikation: **Tastatur-Durchgang und 200 % Zoom** (jetzt `keyboard-zoom.spec.ts`). Eingeengt: Tab-Leiste (nur noch „aktiv ohne Farbe“), Leere Zustände (nur noch Optik).

1. **Aktiver Tab ohne Farbe** — Elternbereich in Graustufen ansehen; aktiver Tab an Fläche/Form erkennbar.
2. **Leere Zustände** — frische Installation, Elternseiten ohne Sets/Kinder ansehen; optisch stimmig.
3. **Liquid Glass auf echtem Tablet** — inkl. „Transparenz reduzieren“.
4. **100-Zeichen-Name in der Anmelde-Kachel** — bricht um, nie abgeschnitten, auch bei 200 %.
5. **Raspberry Pi: setup.sh-Abschlusszeile** — `http://<LAN-IP>:8080` aus `hostname -I`, Login dort.
6. **Raspberry Pi: täglicher Dump** — nach einem Tageswechsel liegt `backups/daily/wordquest-<Datum>.sql.gz`.
7. **FIX-07 Idempotenz und Neustart** — gleiche Antwort doppelt senden, Stack neu starten.
8. **Prohibitions bestätigen** — sechs Verbote, LLM-Urteil „hält“.

### Zusammenfassung

Keine Lücken, keine Regressionen. Die Nachbesserung 1b78505 schließt CR-01 (Startabbruch bei Demo-Seed oder Demo-Konto mit bekanntem Passwort, Ausweg per `docker compose run`), WR-01 (neue PIN meldet Geräte ab), WR-02 (Kind ohne PIN braucht beim Speichern eine), WR-03/04 (Ladefehler statt leerem Zustand, deutscher Allgemeintext) und automatisiert den Tastatur-Durchgang bei 200 % Zoom. Damit ist Erfolgskriterium 5 belegt, Score 5/5. Offen bleiben acht menschliche Prüfungen: vier visuelle (aktiver Tab, Leere Zustände, Liquid Glass, lange Namen in der Kachel), zwei auf echter Pi-Hardware, FIX-07-Idempotenz ohne automatisierten Test und die Bestätigung der sechs judgment-tier-Verbote.

---

_Verifiziert: 2026-10-17T11:30:00Z_
_Verifier: Claude (gsd-verifier)_
