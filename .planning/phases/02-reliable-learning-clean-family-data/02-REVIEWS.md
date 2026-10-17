---
phase: 02
reviewers: [codex]
reviewed_at: 2026-10-17T13:49:00+02:00
plans_reviewed: [02-01, 02-02, 02-03, 02-04, 02-05, 02-06, 02-07]
models:
  codex: "gpt-6.1-sol (reasoning=high)"
---

# Cross-AI Plan Review — Phase 2

## Prüfung der Befunde durch Claude (vor Übernahme)

Stichproben am Code bestätigt:
- XP: `session.XpAwarded += xp` und `profile.Xp += xp` als Lesen-Addieren-Schreiben (`backend/src/WordQuest.Infrastructure/LearningService.cs:219-224`); ein Token nur auf `SessionItem.AnsweredAt` schützt das nicht → 02-01 HIGH gilt.
- `SetId = setId` ungeprüft beim Sitzungsstart (`LearningService.cs:94`); mit neuem FK wird eine unbekannte Set-ID zum 500er → 02-02 HIGH gilt.
- nginx hängt an (`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`, `frontend/nginx.conf:44`); Plan 02-06 setzt `ForwardLimit = 2` und vertraut `172.16.0.0/12` (`02-06-PLAN.md:140`). Im Schnellstart (eine Proxy-Stufe) würde bei LAN-Adressen in 172.16/12 ein vom Client vorangestellter Wert übernommen → 02-06 HIGH gilt. Lösungsrichtung: nginx setzt X-Forwarded-For selbst (überschreibt statt anhängen; im Traefik-Stack vorher `real_ip` aus dem Compose-Netz), API mit `ForwardLimit = 1`.
- Radix-Dialog ohne `Dialog.Trigger`: Fokusrückgabe nicht automatisch → 02-03/04/05 MEDIUM gilt (Rückgabeziel ausdrücklich verwalten).
- D-18 (Hand-SQL in der Migration) ist eine offene Annahme bis zur Bestätigung durch Dennis; das SUMMARY darf sie nicht als „freigegeben“ führen, solange sie nicht bestätigt ist.

Übernahme: alle Befunde. 02-07 LOW (CI-Optionen TRX/Coverage): als „funktional gleichwertiger lokaler Lauf“ benennen, keine Übernahme der Coverage-Sammlung.

## Codex Review


## 02-01

**Zusammenfassung:** Die Ursache der hängenden Karten wird getroffen. Der geplante Schutz gegen Nebenläufigkeit reicht jedoch nicht für die zugesicherte XP-Konsistenz.

**Stärken:**

- Der Plan erkennt die fehlende Registrierung neuer Lernstände korrekt: `CreateInitialState()` erzeugt derzeit nur ein Objekt; anschließend wird es nicht zum Kontext hinzugefügt. Ohne die ausdrücklich geplante Ergänzung ginge nach Entfernen der Anlage beim Rundenstart der Lernstand verloren. Beleg: `backend/src/WordQuest.Infrastructure/LearningService.cs:191` und `:318`.
- `AnsweredAt` ist ein passender Concurrency-Token für zwei konkurrierende Antworten auf **dieselbe Aufgabe**: Der Wert wechselt beim Antworten von `null` auf einen Zeitstempel. Beleg: `LearningService.cs:185`, `backend/src/WordQuest.Modules.Learning/Entities/LearningSession.cs:40`. EF vergleicht dabei den ursprünglich gelesenen Token beim Update. [EF-Core-Dokumentation](https://learn.microsoft.com/en-us/ef/core/saving/concurrency).

**Bedenken:**

- **HIGH — Gemeinsame XP-Zähler bleiben ungeschützt.** Verschiedene Aufgaben aktualisieren dieselbe Sitzung und dasselbe Gamification-Profil über Lesen, Addieren und Zurückschreiben. Ein Token ausschließlich auf `SessionItem.AnsweredAt` erkennt diese Konkurrenz nicht. Zwei erfolgreich gewertete Aufgaben können deshalb Protokollzeilen erzeugen, während ein XP-Zuwachs überschrieben wird. Genau diesen Fall verlangt der geplante Test mit fünf Aufgaben gleichzeitig. Beleg: `LearningService.cs:219` und `:223`; die Konfigurationen enthalten keinen entsprechenden Schutz auf Sitzung oder Profil: `Configurations/LearningConfigurations.cs:41`, `Configurations/GamificationConfigurations.cs:7`.
- **MEDIUM — Der Altbestand verletzt weiterhin FIX-09.** Heute angelegte, unbeantwortete `New`-States verbrauchen nach dem Update weiter Budget. Ältere werden beim erstmaligen Beantworten nicht als heute eingeführt gezählt. `introducedToday` verwendet ausschließlich `FirstSeenAt`; der Scheduler korrigiert diesen Wert nicht. Beleg: `LearningService.cs:67`, `backend/src/WordQuest.Modules.Learning/Services/Sm2Scheduler.cs:79`. Die Ausnahme lediglich im SUMMARY zu dokumentieren erfüllt die Anforderung nicht.
- **MEDIUM — Der deterministische Concurrency-Test prüft nicht den vollständigen HTTP-Pfad.** Ein veralteter zweiter Kontext belegt den EF-Konflikt, aber weder dessen Mapping auf 409 noch das gemeinsame Zurückrollen von Lernstand, Protokoll und XP. `Task.WhenAll` garantiert wiederum nicht, dass beide Requests vor dem ersten Speichern gelesen haben. Beleg: `.planning/phases/02-reliable-learning-clean-family-data/02-01-PLAN.md:195`.

**Vorschläge:** Gemeinsame Zähler atomar aktualisieren oder die Wertung auf Datenbankebene passend serialisieren. Einen deterministisch synchronisierten HTTP-Test ergänzen, der Status, Protokoll und XP gemeinsam prüft. Für unbeantwortete Alt-States eine explizite Korrektur der Budgetsemantik einplanen.

**Risiko: HIGH.**

## 02-02

**Zusammenfassung:** Die Kaskaden lösen die Löschprobleme am richtigen Ort. Die neue Set-Fremdschlüsselbeziehung erzeugt aber einen bislang unberücksichtigten Fehlerpfad.

**Stärken:**

- Die bestehenden Kaskaden `app_user → learner_profile` und `set → entry → card` sind vorhanden. Die geplanten Ergänzungen schließen daran an und erlauben einen einzelnen Löschbefehl. Beleg: `Configurations/IdentityConfigurations.cs:38`, `Configurations/ContentConfigurations.cs:21` und `:51`.
- Der Migrationstest lässt sich mit der vorhandenen Factory ohne normalen Hoststart aufbauen: `CreateSystemDbContext()` erzeugt einen eigenständigen Kontext; Migrationen werden separat in `InitializeAsync()` ausgeführt. Beleg: `backend/tests/WordQuest.Api.Tests/ApiFactory.cs:57` und `:77`.

**Bedenken:**

- **HIGH — Unbekannte `setId` führt nach der Migration zu einem neuen 500er.** `StartSessionAsync` übernimmt `setId` ungeprüft in `LearningSession.SetId`. Der neue FK auf `vocabulary_set` lässt einen Start mit gültigem Kind und zufälliger Set-ID beim Speichern scheitern. Die geplanten Catch-Blöcke behandeln Concurrency und Unique-Verletzungen, keine FK-Verletzung. Beleg: `LearningService.cs:94`, `:132`; geplante Beziehung: `02-02-PLAN.md:145`. Auch eine fremde, aber existierende Set-ID muss vor dem Speichern mandantengefiltert geprüft werden.
- **MEDIUM — Die Migrationsausnahme wird widersprüchlich als freigegeben behandelt.** Der Plan nennt D-18 noch als offene Annahme mit möglichem Veto, verlangt im SUMMARY aber eine „freigegebene Ausnahme“. Die geltende Regel verbietet manuelle Änderungen an Migrationen ausdrücklich. Beleg: `AGENTS.md:170`, `02-02-PLAN.md:86`. Eine Koordinatorentscheidung ersetzt hier keine dokumentierte Nutzerentscheidung.

**Vorschläge:** Vor dem Erzeugen einer Sitzung das optionale Set mandantengefiltert prüfen; unbekannte und fremde Set-ID ergeben 404. Diese Fälle in den Sessiontests nach der Migration ausführen. Die Ausnahme für das Bereinigungs-SQL vor Ausführung eindeutig entscheiden und dokumentieren.

**Risiko: HIGH.**

## 02-03

**Zusammenfassung:** Der gemeinsame Dialogbaustein ist angemessen. Fokusrückgabe und Verhalten nach einem echten 404 sind noch nicht schlüssig.

**Stärken:**

- Radix Dialog ist bereits installiert; eine neue Dependency ist unnötig. Beleg: `frontend/package.json:21`.
- Erfolgsmeldung und Leerzustand sind bereits gemeinsam darstellbar: `ChildrenPage` rendert die Meldung vor dem Leerzustand. Hier braucht es hauptsächlich den neuen Meldungstext und den Test. Beleg: `frontend/src/features/manage/ChildrenPage.tsx:25`.

**Bedenken:**

- **MEDIUM — Radix gibt den Fokus ohne registrierten Trigger nicht automatisch zurück.** Der geplante Wrapper enthält `Root`, `Portal`, `Overlay` und `Content`, aber keinen `Dialog.Trigger`. Radix speichert dessen Ref erst im Trigger und fokussiert genau diesen Ref beim Schließen. Beleg: `frontend/node_modules/@radix-ui/react-dialog/dist/index.mjs:71` und `:154`; geplanter Aufbau: `02-03-PLAN.md:137`.
- **MEDIUM — Nach 404 kann der Fehlerdialog verschwinden.** `EditChild` rendert bei fehlendem Kind unmittelbar den Leerzustand. Invalidiert der Löschfehler die Kinderliste und liefert der nächste Abruf das tatsächlich gelöschte Kind nicht mehr, wird `ChildForm` samt Dialog entfernt. Das widerspricht „Dialog bleibt offen“. Beleg: `frontend/src/features/manage/ChildFormPage.tsx:67`; geplante Invalidierung: `02-03-PLAN.md:138`.

**Vorschläge:** Den Trigger im gemeinsamen Dialogvertrag registrieren oder das Rückgabeziel ausdrücklich verwalten. Einen Test ergänzen, bei dem DELETE 404 liefert und der anschließende Listenabruf das Kind entfernt. Den gewünschten Fehlerzustand auch über diesen Abruf hinweg erhalten.

**Risiko: MEDIUM.**

## 02-04

**Zusammenfassung:** Umbenennen an Ort und Stelle und Wiederverwendung der Set-Liste sind passende Lösungen. Die Dialogprobleme aus 02-03 wirken hier weiter.

**Stärken:**

- Die Grenze von 200 Zeichen entspricht den tatsächlichen Datenbankspalten. Die Validierung verhindert damit einen konkreten Persistenzfehler. Beleg: `Configurations/ContentConfigurations.cs:14`.
- Ein Update ausschließlich von `VocabularySet.Title` lässt die Beziehungen zu Einträgen und Karten bestehen. Diese hängen an IDs, nicht am Titel. Beleg: `Configurations/ContentConfigurations.cs:23` und `:53`.

**Bedenken:**

- **MEDIUM — Der geplante Fehlzustand widerspricht dem geplanten Seitenaufbau.** Bei fehlendem Set soll nur der Leerzustand erscheinen; nach einem 404 im Dialog wird gleichzeitig `['sets']` invalidiert. Sobald der Abruf das Set entfernt, können Dialog und Eingaben verschwinden. Beleg: `02-04-PLAN.md:158` und `:159`.
- **MEDIUM — Die zugesicherte Fokusrückgabe übernimmt die unbelegte Radix-Annahme.** Der Plan erklärt, Radix fokussiere „Umbenennen“ automatisch. Der gemeinsame Wrapper registriert dafür keinen Trigger. Beleg: `02-04-PLAN.md:159`; tatsächlicher Mechanismus: `frontend/node_modules/@radix-ui/react-dialog/dist/index.mjs:154`.

**Vorschläge:** Die Korrektur des Dialogvertrags aus 02-03 als Voraussetzung aufnehmen. Den 404-Test mit einer veränderten Set-Liste ausführen, nicht mit dauerhaft unveränderten Stub-Daten.

**Risiko: MEDIUM.**

## 02-05

**Zusammenfassung:** Die Korrektur von Vokabeln erhält die richtigen Identitäten. Bei der Schnellerfassung bleibt eine Lücke in Fehlerrückmeldung und Testmatrix.

**Stärken:**

- Lernstand hängt an `(LearnerId, CardId)`, Karten hängen am Eintrag. Das geplante Ändern ausschließlich der Texte erhält diese Beziehungen. Beleg: `Configurations/LearningConfigurations.cs:12`, `Configurations/ContentConfigurations.cs:53`.
- Ein ausdrückliches Fokusziel nach erfolgreichem Löschen ist nötig und sinnvoll, weil der Papierkorb mit seiner Zeile verschwindet. Die vorhandene Liste verwendet stabile Entry-IDs als React-Key. Beleg: `frontend/src/features/manage/SetDetailPage.tsx:114`.

**Bedenken:**

- **MEDIUM — Leere Eingaben der Schnellerfassung bleiben stumm.** Der Plan bezeichnet die Erfassung als „ohne Clientprüfung“. Tatsächlich verhindert `if (source.trim() && target.trim())` bereits den API-Aufruf. Eine neue Anzeige von `addEntry.isError` kann bei leerem Feld deshalb niemals erscheinen. Die vorgesehene Matrix prüft hier nur Server- und Netzfehler. Beleg: `SetDetailPage.tsx:50`; geplante Ergänzung: `02-05-PLAN.md:180`.
- **MEDIUM — Der 404-Fall kann die Rückfokussierung zerstören.** Nach einem fehlgeschlagenen Bearbeiten oder Löschen wird die Eintragsliste invalidiert. Entfernt der nächste Abruf die Vokabel, verschwindet der vorgesehene Stift beziehungsweise Papierkorb. Ein gleichbleibender Key hilft nur, solange der Eintrag noch existiert. Beleg: `SetDetailPage.tsx:114`; geplanter Ablauf: `02-05-PLAN.md:142` und `:180`.

**Vorschläge:** Die Schnellerfassungsmatrix um je ein leeres beziehungsweise ausschließlich aus Leerzeichen bestehendes Feld und Enter-Submit ergänzen; dafür sichtbare Rückmeldung vorsehen. Für verschwundene Einträge auch nach Fehler oder Abbruch ein bestehendes Fokusziel festlegen und mit einem tatsächlich veränderten Listenabruf testen.

**Risiko: MEDIUM.**

## 02-06

**Zusammenfassung:** Middleware-Reihenfolge, Refresh-Ausnahme und Geschwistertests passen zum Ziel. Das vorgesehene Proxy-Vertrauen ist jedoch weiter als behauptet.

**Stärken:**

- Der Limiter partitioniert bereits nach `RemoteIpAddress`. Forwarded Headers vor `UseRateLimiter()` anzuwenden erreicht daher den vorhandenen Mechanismus. Beleg: `backend/src/WordQuest.Api/Program.cs:117` und `:173`.
- Die Geschwistertests treffen eine notwendige zusätzliche Zugriffskontrolle: Der Mandantenfilter trennt Geschwister nicht; dafür existiert `MayActFor`. Beleg: `SessionEndpoints.cs:141`.
- Die Refresh-Fehlerursache ist korrekt lokalisiert: Der Client löscht derzeit bei jedem erfolglosen Refresh die Tokens. Beleg: `frontend/src/lib/api.ts:96`.

**Bedenken:**

- **HIGH — `172.16.0.0/12` bezeichnet nicht das konkrete Compose-Netz.** In den Compose-Dateien wird dieses Netz nicht verbindlich festgelegt. Der Plan vertraut damit auch anderen Docker-Netzen und möglichen LAN-Clients innerhalb dieses Bereichs. Kommt ein LAN-Client beispielsweise aus `172.20.x.x`, kann die Auswertung nach dessen Adresse noch einen vom Client vorangestellten XFF-Wert übernehmen. nginx hängt eingehende Header derzeit lediglich an. Beleg: `docker-compose.quick.yml:69`, `frontend/nginx.conf:44`, `02-06-PLAN.md:140`. Microsoft beschreibt `ForwardLimit` ausdrücklich als Vorsichtsmaßnahme ohne Sicherheitsgarantie. [Proxy-Dokumentation](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/proxy-load-balancer?view=aspnetcore-10.0).
- **MEDIUM — Die Traefik-Kette wird nicht geprüft.** Die geplanten Tests verwenden eine Proxy-Stufe oder einen vorangestellten Spoofing-Wert; der Smoke verwendet nginx. Der ausgelieferte Traefik-Pfad benötigt hingegen die Auswertung zweier Proxy-Stufen. Beleg: `docker-compose.yml:59`, `02-06-PLAN.md:120`.
- **MEDIUM — `false` beim Refresh garantiert nicht den allgemeinen Fehlertext.** Nach `false` verarbeitet `api()` weiterhin die ursprüngliche 401-Antwort. Enthält diese `detail`, wird genau dieser Text angezeigt. Das Ändern von `refreshAccessToken` allein erfüllt daher die zugesicherte Fehlerform nicht für alle Aufrufer. Beleg: `frontend/src/lib/api.ts:138` und `:160`; geplante Änderung: `02-06-PLAN.md:182`.

**Vorschläge:** Vertrauen an die tatsächliche Proxy-Topologie binden und eingehende Header an deren Grenze passend bereinigen. Tests für LAN-Adressen im 172er-Bereich, beide Proxy-Stufen und abweichende Compose-Subnetze ergänzen. Vorübergehende Refresh-Fehler ausdrücklich als allgemeinen `ApiError` weitergeben; dabei einen ursprünglichen 401-Body mit `detail` testen.

**Risiko: HIGH.**

## 02-07

**Zusammenfassung:** Die fachlichen Regeln sind konsistent mit dem Bestand. Die verbleibenden Risiken liegen vor allem beim Abschlussnachweis.

**Stärken:**

- Die geplante Serienberechnung berücksichtigt dieselben Retterbedingungen wie die bestehende Fortschreibung: Auffüllen beim Monatswechsel und Überbrücken genau eines verpassten Tages. Beleg: `StreakRules.cs:22`, `:53` und `:74`.
- Die Zusammenführung der Meisterschaftsregel ist erforderlich: Die Übersicht zählt derzeit einzelne Review-States, die Ampel gruppiert nach Wort und verlangt alle Richtungen. Beleg: `LearnerEndpoints.cs:202`, `:250` und `:257`.
- „Rot vor Grün“ widerspricht der gemeinsamen Meisterschaftsregel nicht: Eine vollständig gemeisterte Gruppe erfüllt weder die niedrige Ease- noch die hohe Lapses-Bedingung für Rot. Beleg: `LearnerEndpoints.cs:263`.

**Bedenken:**

- **LOW — „Dieselben Befehle wie CI“ ist nicht wörtlich erfüllt.** CI erzeugt TRX-Ergebnisse und sammelt Coverage; der geplante Backend-Helfer verwendet nur `dotnet test --no-build`. Beleg: `.github/workflows/ci.yml:59`, `02-01-PLAN.md:159`.
- **MEDIUM — Automatisches Gate und Phasenabnahme müssen getrennte Status behalten.** Der Plan lässt manuelle Prüfungen ausdrücklich offen. Ein kleinerer CSS-Viewport prüft Reflow, ersetzt aber nicht sämtliche Auswirkungen echten Browser-Zooms oder die Bedienung auf dem Tablet. Beleg: `frontend/e2e/keyboard-zoom.spec.ts:4`, `02-07-PLAN.md:221`, `02-VALIDATION.md:96`.

**Vorschläge:** Entweder die CI-Optionen übernehmen oder den Beleg präzise als funktional vergleichbaren lokalen Lauf benennen. Die Phase erst nach den erforderlichen manuellen Nachweisen als vollständig verifiziert markieren.

**Risiko: MEDIUM.**

## Prioritäten über alle Pläne

Vor Ausführung sollten vier Punkte geklärt beziehungsweise korrigiert werden:

1. Gemeinsame XP-Zähler bei parallelen Antworten schützen — **02-01**.
2. Set-ID vor dem Speichern einer Sitzung prüfen — **02-02**.
3. Proxy-Vertrauen auf die tatsächliche Topologie begrenzen — **02-06**.
4. Fokusrückgabe und Dialogbestand nach 404 im gemeinsamen Baustein lösen — **02-03**, danach in **02-04/05** nutzen.

Abdeckung: **7 von 7 Plänen**. Keine Dateien geändert. **UNBEKANNT:** tatsächliches Verhalten auf Heimnetzgeräten, durch Traefik und bei echtem Browser-Zoom; dafür wurden keine Laufzeitprüfungen ausgeführt.
