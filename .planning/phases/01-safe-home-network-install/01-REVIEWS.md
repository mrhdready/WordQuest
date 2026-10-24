---
phase: 01
reviewers: [codex]
reviewed_at: 2026-10-16T12:58:00+02:00
plans_reviewed: [01-01, 01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08]
models:
  codex: "gpt-6.1-sol (reasoning=high)"
---

# Cross-AI Plan Review — Phase 1

## Prüfung der Befunde durch Claude (vor Übernahme)

Stichproben am Code bestätigt:
- `PasswordHasher.Hash` wirft bei reinem Whitespace (`backend/src/WordQuest.Modules.Identity/Services/PasswordHasher.cs:18`) → 01-06 HIGH gilt.
- `Button` setzt kein `type` (`frontend/src/components/ui/button.tsx:37`) → 01-04 HIGH gilt.
- `Progress` klemmt auf 0–1 (`frontend/src/components/ui/misc.tsx:15`) → 01-01 MEDIUM gilt.
- Auth-Rate-Limit 10/min je IP über alle Auth-Routen (`backend/src/WordQuest.Api/Program.cs:75`) → 01-08 HIGH gilt.
- Explizite `ConnectionStrings:Default` wird ungeprüft übernommen (`backend/src/WordQuest.Api/Program.cs:174`) → 01-05 HIGH gilt.
- Image-Tag-Default `:master` (`docker-compose.quick.yml:38`) → 01-02 HIGH / 01-05 MEDIUM gelten.
- 01-03 und 01-04 beide `wave: 2`, `depends_on: [01-01]` → paralleler E2E-Stack-Konflikt gilt.

Übernahme: alle Befunde. 01-07 „Logik im Endpoint“: nur die neuen Regeln (PIN, Namensgrenze) gehören in eine reine Domänenregel bzw. einen kleinen Service; der vorhandene Endpoint-Bestand wird nicht ungefragt umgebaut.

## Codex Review

## 01-01

**Zusammenfassung:** Die Design-Pipeline ist nachvollziehbar. Der Schnitt hinterlässt jedoch beschädigte Zwischenstände.

**Stärken:** Export, Drift-Prüfung und zusätzliche Kontrastläufe adressieren konkrete Risiken des vorhandenen Themes. Farben und Schriftstufen sind bereits zentral definiert (`DESIGN.md:7`, `DESIGN.md:34`); der Plan verbindet sie mit Build und Browserprüfung (`.planning/phases/01-safe-home-network-install/01-01-PLAN.md:156`, `:225`).

**Bedenken:**

- **HIGH — Globale Umstellung vor den Verbrauchern.** Der Plan entfernt die alten Theme-Namensräume sofort (`.planning/phases/01-safe-home-network-install/01-01-PLAN.md:166`). Noch nicht umgestellte Seiten verwenden weiterhin beispielsweise `bg-brand`, `text-white` und `rounded-2xl` (`frontend/src/features/manage/ManageLayout.tsx:35`, `frontend/src/features/auth/ProfilePickerPage.tsx:78`). Der Login-Test deckt diese Regressionen nicht ab.
- **MEDIUM — Unklarer Wertevertrag für `Progress`.** Geplant sind Prozentwerte mit `max=100`, während Aufrufer unverändert bleiben (`.planning/phases/01-safe-home-network-install/01-01-PLAN.md:221`). Der bestehende Baustein erwartet Werte von 0 bis 1 und multipliziert mit 100 (`frontend/src/components/ui/misc.tsx:15`); die Sitzung übergibt ausdrücklich `index / total` (`frontend/src/features/learn/SessionPage.tsx:147`). Ohne festgelegte Umrechnung kann ein halber Fortschritt als 0,5 % erscheinen.

**Vorschläge:** Alte Tokens erst nach Umstellung aller Verbraucher entfernen oder die Design-Migration als zusammenhängende Einheit abschließen. Den öffentlichen `Progress`-Vertrag bei 0–1 belassen und intern umrechnen; 0, 0,5 und 1 prüfen.

**Risiko: HIGH.**

## 01-02

**Zusammenfassung:** Der Installationsweg passt zum Heimnetz-Ziel. Build-Nachweis und Testisolation brauchen Korrekturen.

**Stärken:** Passwortübergabe über stdin und Wiederverwendung von `PasswordHasher` vermeiden einen zusätzlichen HTTP-Einrichtungsweg und ein zweites Hashverfahren (`.planning/phases/01-safe-home-network-install/01-02-PLAN.md:151`, `:161`; `backend/src/WordQuest.Modules.Identity/Services/PasswordHasher.cs:16`). Der ausschließlich für Wartung gedachte `SystemTenantContext` passt zum CLI-Pfad (`backend/src/WordQuest.Infrastructure/SystemTenantContext.cs:5`).

**Bedenken:**

- **HIGH — Der Smoke erzwingt keinen Build des aktuellen Arbeitsbaums.** Vorgesehen sind `pull --ignore-buildable` und anschließend `up -d` (`.planning/phases/01-safe-home-network-install/01-02-PLAN.md:159`). Das Overlay ergänzt lediglich `build`, entfernt aber die expliziten Image-Tags nicht (`docker-compose.build.yml:9`, `docker-compose.quick.yml:38`). Ein vorhandenes älteres Image kann damit den vermeintlichen Quellcode-Smoke bedienen.
- **MEDIUM — CLI-Datenbankzugriff ohne festgelegten DI-Scope.** `RunAsync` erhält den Root-Provider und löst daraus die Datenbankoptionen auf (`.planning/phases/01-safe-home-network-install/01-02-PLAN.md:152`, `:208`). Der bestehende Startcode öffnet dafür ausdrücklich einen `AsyncServiceScope` (`backend/src/WordQuest.Api/Program.cs:136`). Diese Lebensdauer sollte der CLI-Pfad übernehmen.
- **MEDIUM — Gemeinsame Testdaten widersprechen den erwarteten Ergebnissen.** Eine Factory wird je Klasse geteilt; gleichzeitig soll `CreateOwnerAsync` zuerst `AlreadyExists` prüfen (`.planning/phases/01-safe-home-network-install/01-02-PLAN.md:151`, `:208`). Nach erfolgreicher Kontoanlage liefern spätere Tests ungültiger Eingaben deshalb Exit 3 statt des erwarteten Exit 2. „Leere Fälle zuerst“ ist keine belastbare Isolation.

**Vorschläge:** Den Smoke explizit mit lokal gebauten Images ausführen. Im CLI einen Scope öffnen. Kontoszenarien durch Datenbank-Reset oder getrennte Fixtures unabhängig machen.

**Risiko: HIGH.**

## 01-03

**Zusammenfassung:** Die gemeinsamen Formularbausteine sind sinnvoll. Der Browsernachweis erfasst zu wenige Zustände.

**Stärken:** `ApiError.errors` schließt eine belegte Lücke: Der bestehende Client liest ausschließlich `detail` und `title`, nicht die Feldfehler (`frontend/src/lib/api.ts:134`). Die geplante Zuordnung über `Field` ist dafür eine passende kleine Erweiterung (`.planning/phases/01-safe-home-network-install/01-03-PLAN.md:209`, `:212`).

**Bedenken:**

- **HIGH — Parallele Pläne zerstören denselben Teststack.** Dieser Plan und 01-04 liegen unabhängig in Wave 2 (`.planning/phases/01-safe-home-network-install/01-03-PLAN.md:5`; `.planning/phases/01-safe-home-network-install/01-04-PLAN.md:5`). Beide verwenden `e2e:stack`, das denselben Stack zuerst mit `down -v` entfernt (`.planning/phases/01-safe-home-network-install/01-01-PLAN.md:160`). `workers: 1` schützt nur einen Playwright-Prozess, nicht zwei Plan-Ausführungen.
- **MEDIUM — CSV-Import und Formularzustände bleiben ungeprüft.** Der Plan baut den Import um, öffnet beim vorgesehenen Set-Detail-Test aber nur die Seite (`.planning/phases/01-safe-home-network-install/01-03-PLAN.md:173`, `:175`). Der Import wird erst nach Interaktion gerendert und besitzt weitere Eingaben sowie Vorschau- und Fehlerzustände (`frontend/src/features/manage/SetDetailPage.tsx:89`, `:164`). Der Seitenaufruf prüft diese Oberfläche nicht.

**Vorschläge:** E2E-Ausführung zwischen den Plänen serialisieren oder getrennte Projekte und Ports verwenden. Import geöffnet, Vorschau und Fehlermeldungen ausdrücklich prüfen; für die geänderten Formulare die verlangten Eingabematrizen ergänzen.

**Risiko: MEDIUM**, mit einem blockierenden Ausführungsproblem bei parallelen Waves.

## 01-04

**Zusammenfassung:** Der HTTP-Nachweis trifft das Kernziel. Beim neuen PIN-Formular fehlen entscheidende Details zum Absenden.

**Stärken:** Der Test verlangt ausdrücklich `isSecureContext === false` und Antworten über Enter sowie Button (`.planning/phases/01-safe-home-network-install/01-04-PLAN.md:183`). Das schützt den vorhandenen HTTP-Fix, dessen Antwort-ID bereits stabil aus der Item-ID stammt (`frontend/src/features/learn/SessionPage.tsx:69`).

**Bedenken:**

- **HIGH — Zifferntasten können unbeabsichtigt absenden.** Das Ziffernfeld wird in ein Formular gelegt; nur für „Los geht’s“ ist der Button-Typ festgelegt (`.planning/phases/01-safe-home-network-install/01-04-PLAN.md:122`). Die vorhandenen Ziffern-Buttons besitzen kein `type` (`frontend/src/features/auth/ProfilePickerPage.tsx:129`), und der gemeinsame `Button` ergänzt keinen Standardwert (`frontend/src/components/ui/button.tsx:37`). Innerhalb des Formulars werden sie dadurch Submit-Buttons. Der ausschließlich mit Tastatur ausgeführte Tracer erkennt den Klickpfad nicht.
- **MEDIUM — Der Pflicht-Fallback fehlt am Ziffernfeld.** Geplant ist `bg-glass-clear` ohne Glas-Utility (`.planning/phases/01-safe-home-network-install/01-04-PLAN.md:126`). Die Fallback-Regeln liegen dagegen in `glass*`-Utilities (`.planning/phases/01-safe-home-network-install/01-01-PLAN.md:169`). Die Tasten bleiben damit transparent, obwohl alle entsprechenden Glasflächen deckend werden müssen (`DESIGN.md:281`).

**Vorschläge:** Ziffern-, Löschen- und Zurück-Tasten ausdrücklich als `type="button"` festlegen. Einen Klicktest ergänzen: vierte Ziffer sendet nicht, „Los geht’s“ sendet genau einmal. Den deckenden Fallback auch für Glasflächen ohne Blur definieren und prüfen.

**Risiko: HIGH.**

## 01-05

**Zusammenfassung:** Backup und Reset verwenden vorhandene Mechanismen. Secret-Prüfung und Sitzungsversprechen sind unvollständig.

**Stärken:** Der Backup-Dienst wird aus dem vorhandenen Betriebsstack übernommen, einschließlich Zeitplan und Aufbewahrung (`docker-compose.yml:98`; `.planning/phases/01-safe-home-network-install/01-05-PLAN.md:187`). Das vermeidet einen zweiten Sicherungsmechanismus.

**Bedenken:**

- **HIGH — Explizite Connection-Strings umgehen SETUP-05.** Bei `ConnectionStrings:Default` lässt der Plan die DB-Passwortprüfung aus (`.planning/phases/01-safe-home-network-install/01-05-PLAN.md:159`). Der vorhandene Code übernimmt diesen String unverändert (`backend/src/WordQuest.Api/Program.cs:176`). `Password=devpassword` bleibt damit außerhalb Development zulässig. Das widerspricht der uneingeschränkten Anforderung.
- **MEDIUM — Refresh-Widerruf beendet bestehende Access-Tokens nicht.** Der Plan widerruft Refresh-Tokens, erklärt danach aber alte Sitzungen für ungültig (`.planning/phases/01-safe-home-network-install/01-05-PLAN.md:124`, `:140`). Access-Tokens werden allein anhand Signatur und Ablauf geprüft (`backend/src/WordQuest.Api/Auth/JwtTokenService.cs:45`); ihre konfigurierte Laufzeit beträgt 15 Minuten (`backend/src/WordQuest.Api/appsettings.json:13`).
- **MEDIUM — Falscher Image-Bezug im Start-Smoke.** Verwendet wird `wq-smoke-api` ohne Tag (`.planning/phases/01-safe-home-network-install/01-05-PLAN.md:161`). Die ausgeführte Compose-Auflösung mit Präfix `wq-smoke` ergibt dagegen **`wq-smoke-api:master`**, entsprechend `docker-compose.quick.yml:38`. Der Smoke würde implizit `:latest` verwenden.

**Vorschläge:** Das tatsächlich verwendete DB-Passwort auch aus expliziten Connection-Strings prüfen. Beim Reset entweder den begrenzten Weiterbestand von Access-Tokens korrekt dokumentieren oder sofortige Ungültigkeit ausdrücklich implementieren und testen. Den Smoke auf die tatsächliche Image-ID des API-Dienstes beziehen.

**Risiko: HIGH.**

## 01-06

**Zusammenfassung:** Der Passwortwechsel ist fachlich gut beschrieben. Eine vorhandene Hash-Vorbedingung verursacht jedoch einen unbehandelten Fehlerpfad.

**Stärken:** Falsches aktuelles Passwort wird als feldbezogener 400 beantwortet (`.planning/phases/01-safe-home-network-install/01-06-PLAN.md:138`). Das passt zum bestehenden Client: Ein 401 würde einen Refresh-Versuch auslösen (`frontend/src/lib/api.ts:122`).

**Bedenken:**

- **HIGH — Acht Leerzeichen bestehen die neue Regel, scheitern aber beim Hashen.** `AccountRules.IsValidPassword` soll ausschließlich null und Mindestlänge prüfen (`.planning/phases/01-safe-home-network-install/01-02-PLAN.md:150`). Der Passwortwechsel ruft danach `PasswordHasher.Hash` auf (`.planning/phases/01-safe-home-network-install/01-06-PLAN.md:136`). Dieser wirft bei ausschließlich Leerzeichen eine Ausnahme (`backend/src/WordQuest.Modules.Identity/Services/PasswordHasher.cs:18`). Ergebnis wäre ein 500; derselbe Konflikt betrifft `create-owner`.
- **MEDIUM — Die Testhilfe reicht für spätere Parameterrouten nicht aus.** Vorgesehen sind lediglich `MemoryRouter` und `initialEntries` (`.planning/phases/01-safe-home-network-install/01-06-PLAN.md:212`). Die Bearbeiten-Seite soll ihre ID über `useParams` beziehen (`.planning/phases/01-safe-home-network-install/01-08-PLAN.md:135`). Dafür muss die Testhilfe auch eine passende Route rendern; eine URL allein stellt den Parameter nicht bereit.

**Vorschläge:** Passwortregel und Hasher-Vorbedingung konsistent machen, ohne Passwörter still zu trimmen. Den Leerzeichenfall über API und CLI prüfen. Für Bearbeiten-Tests eine echte Route mit konkreter Learner-ID rendern.

**Risiko: HIGH.**

## 01-07

**Zusammenfassung:** Grenzen und PIN-Regeln sind ausführlich abgedeckt. Architektur und Erstinstallationsnachweis bleiben offen.

**Stärken:** Die Namensgrenze behandelt einen tatsächlichen Persistenzkonflikt: Die Datenbank erlaubt höchstens 100 Zeichen (`backend/src/WordQuest.Infrastructure/Configurations/IdentityConfigurations.cs:25`), während der Endpoint bislang nur einen leeren Namen abweist (`backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs:48`). Der Plan ergänzt die passende 400-Antwort und Grenztests (`.planning/phases/01-safe-home-network-install/01-07-PLAN.md:149`, `:179`).

**Bedenken:**

- **MEDIUM — Neue Geschäftslogik bleibt im Endpoint.** Der Plan erweitert `CreateAsync` um fachliche Regeln und Tageslimitbehandlung (`.planning/phases/01-safe-home-network-install/01-07-PLAN.md:149`). Der Endpoint erstellt bereits User, Lernprofil und Gamification-Profil (`backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs:58`). Diese Erweiterung widerspricht der ausdrücklichen Service-Regel (`AGENTS.md:142`).
- **MEDIUM — Das erste Kind auf einer frischen Installation wird nicht durchgängig belegt.** Der Browserstack wird mit Demo-Daten gestartet (`.planning/phases/01-safe-home-network-install/01-01-PLAN.md:184`); der Seeder erzeugt bereits Kind und Vokabelset (`backend/src/WordQuest.Infrastructure/Seed/DemoDataSeeder.cs:51`, `:69`). Der Anlege-Test auf diesem Stack beweist deshalb nicht den behaupteten Weg von einer leeren Installation zum ersten lernenden Kind.

**Vorschläge:** Anlage und Änderung in einen kleinen Infrastructure-Service verlagern, ohne zusätzliche Repository-Abstraktion. Einen Browserdurchlauf an den seedfreien Install-Smoke anschließen: eigenes Elternkonto → erstes Kind → eigenes Set → Anmeldung und Lernantwort.

**Risiko: MEDIUM.**

## 01-08

**Zusammenfassung:** PATCH-Invarianten und Mandantentrennung sind sinnvoll geplant. Der Abschlussnachweis ist noch nicht belastbar.

**Stärken:** Prüfungen vor Zuweisungen, gemeinsame PIN-Regel und ein expliziter Fremdmandanten-Test passen zum vorhandenen Query-Filter (`.planning/phases/01-safe-home-network-install/01-08-PLAN.md:131`, `:163`; `backend/src/WordQuest.Infrastructure/WordQuestDbContext.cs:45`). Das vorhandene Zurücksetzen der PIN-Sperre wird gezielt abgesichert (`backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs:117`).

**Bedenken:**

- **HIGH — Das Gesamtgate ist abhängig von der Laufzeit.** Die Budgets gelten je Spec, der Server zählt jedoch pro IP über sämtliche Auth-Routen gemeinsam (`backend/src/WordQuest.Api/Program.cs:77`; `backend/src/WordQuest.Api/Endpoints/AuthEndpoints.cs:13`). Der Plan ersetzt einen eventuell roten Gesamtlauf durch Einzelaufrufe mit Wartezeit (`.planning/phases/01-safe-home-network-install/01-08-PLAN.md:249`). Das macht den dokumentierten Gate-Befehl nicht zuverlässig grün.
- **MEDIUM — Anzahl unveränderter ReviewStates beweist keinen unveränderten Lernstand.** Geprüft werden nur Anzahl, XP und Streak (`.planning/phases/01-safe-home-network-install/01-08-PLAN.md:165`). Änderungen an `EaseFactor`, Intervall, Wiederholungen oder Fälligkeit blieben unentdeckt (`backend/src/WordQuest.Modules.Learning/Entities/ReviewState.cs:33`).
- **MEDIUM — Ladefehler und unbekannte ID sind nicht getrennt.** Die geplante Seite unterscheidet Laden und „ID nicht in Liste“, aber keinen fehlgeschlagenen GET (`.planning/phases/01-safe-home-network-install/01-08-PLAN.md:135`). Ein Netzfehler kann so als nicht existentes Kind erscheinen. Der API-Client kann diesen Fehler bereits gesondert darstellen (`.planning/phases/01-safe-home-network-install/01-03-PLAN.md:210`).

**Vorschläge:** E2E-Aufrufe kontrolliert über frische Serverinstanzen oder einen festgelegten Ablauf isolieren, ohne das Produktionslimit pauschal auszuschalten. Repräsentative ReviewState-Feldwerte vor und nach PATCH vergleichen. Ladefehler vor der Prüfung auf unbekannte ID behandeln.

**Risiko: HIGH** für den Phasenabschluss.

## Gesamtbewertung

**Vor Ausführung überarbeiten.** Die Anforderungen sind breit abgedeckt; die größten Risiken liegen in der Reihenfolge und in Nachweisen, die weniger prüfen als behauptet.

Priorität haben:

1. Design-Umstellung ohne beschädigte Zwischenstände.
2. Smoke garantiert gegen aktuelle Images.
3. Konsistente Passwort- und Secret-Prüfung.
4. Explizite Submit-Typen am Ziffernfeld.
5. Isolierte, reproduzierbare Testläufe.
6. Ein seedfreier Durchlauf vom Installer bis zur ersten Lernantwort.

Zusätzlich ist die Testreihenfolge anzupassen: Mehrere Tracer implementieren zunächst den Code und ergänzen Regressionstests erst danach, etwa 01-06 Task 1 vor Task 2 (`.planning/phases/01-safe-home-network-install/01-06-PLAN.md:134`, `:161`). Das erfüllt den projektseitigen Ablauf „Spec → Test → Code“ nicht (`AGENTS.md:129`).

Geprüft wurden Quelltext, Planverknüpfungen und die Compose-Auflösung. Keine Dateien geändert. **Nicht ausgeführt:** Build, Tests, Browser- und Hardwareprüfungen; deren tatsächliche Ergebnisse sind **UNBEKANNT**.
