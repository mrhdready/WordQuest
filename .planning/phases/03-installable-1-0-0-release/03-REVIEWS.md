---
phase: 03
reviewers: [codex]
reviewed_at: 2026-10-18
plans_reviewed: [03-01-PLAN.md, 03-02-PLAN.md, 03-03-PLAN.md, 03-04-PLAN.md]
---

# Cross-AI Plan Review — Phase 3

## Prüfung der Befunde durch Claude (vor Übernahme)

| Befund | Prüfung | Urteil |
|---|---|---|
| 03-02 HIGH `load_dump` unter `set -e` | Reproduziert: `bash -c 'set -e; f(){ false; echo weiter; }; if f; …'` gibt „weiter“ und „f ok“ aus | übernehmen: jeder Teilschritt mit explizitem `|| return 1`, Tests für Drop/Create-, Lese- und Rückfallfehler |
| 03-02 MEDIUM Access-Tokens bleiben gültig | `Program.cs:94` validiert nur Signatur/Lebensdauer; Access-Token 15 min | übernehmen: Zusage auf „spätestens nach 15 Minuten“ abschwächen, Refresh-Löschung bleibt |
| 03-03 HIGH ungeschütztes `up -d` | `set -e` beendet vor der Rückfallmeldung | übernehmen: `up -d` geschützt, Fehlermeldung mit alter Version und Sicherungsdatei |
| 03-03 MEDIUM Pull im Erfolgsfall nicht belegt | `--ignore-buildable` überspringt api/web | übernehmen: Zielversion im Smoke unter anderem Tag ohne Build-Overlay bereitstellen (lokale Registry oder `docker tag` + kein Overlay), sonst als manuelle Abnahme benennen |
| 03-04 HIGH Abnahme blockiert Tag | stimmt: veröffentlichte Images entstehen erst durch das Tag | übernehmen: Phase-Gate ist automatisch; lokales Tag nach grünem Gate; Prüfungen mit veröffentlichten Images sind Nach-Release-Abnahme (UAT) durch Dennis |
| 03-04 MEDIUM `bash -n a b c` prüft nur `a` | Reproduziert: Exit 0 bei kaputter zweiter Datei, einzeln Exit 2 | übernehmen: eine Schleife je Datei |
| 03-01 MEDIUM Cleanup nach Teil-Build | plausibel aus Planablauf | übernehmen: Merker vor dem Build setzen bzw. Cleanup über Image-Labels |
| Übergreifend MEDIUM Gate erst in 03-04 | AGENTS.md verlangt Gate vor jeder Fertig-Meldung | übernehmen: jeder Plan läuft das volle Backend-/Frontend-Gate; e2e in 03-01 (Dockerfiles) und 03-04 |

## Codex Review (gpt-6.1-sol, reasoning high)

Dennis — alle vier Pläne sind gegen den Repository-Stand geprüft. Keine Dateien geändert.

## 03-01

**Kurzfassung:** REL-04 und der Installationsteil von REL-03 sind sinnvoll geschnitten. Der bestehende Release-Workflow wird korrekt wiederverwendet.

**Stärken**

- **Kein doppelter Workflow:** Die CI reagiert bereits auf `v*`, erzeugt Semver-Tags und baut beide Zielarchitekturen. Der Plan vermeidet zusätzliche Release-Logik. Belege: [.github/workflows/ci.yml:6](/Users/dennis/code/github.com/mrhdready/WordQuest/.github/workflows/ci.yml:6), [:131](/Users/dennis/code/github.com/mrhdready/WordQuest/.github/workflows/ci.yml:131), [:139](/Users/dennis/code/github.com/mrhdready/WordQuest/.github/workflows/ci.yml:139).
- **Kleine Änderung am Installer:** `setup.sh` erzeugt `.env` bereits aus `.env.example`. Den Präfix-Standard dort auszulesen nutzt den vorhandenen Mechanismus; für die Versionsübernahme ist keine neue Logik nötig. Beleg: [setup.sh:71](/Users/dennis/code/github.com/mrhdready/WordQuest/setup.sh:71).

**Bedenken**

- **MEDIUM — Aufräumen nach teilweise erfolgreichem Build ist lückenhaft.** Der Merker für erzeugte Tags soll erst nach `docker compose build api web` gesetzt werden. Wird das API-Image erfolgreich getaggt und scheitert anschließend der Web-Build, fehlen dem Cleanup die Eigentumsinformationen. Der nächste Lauf verweigert dann wegen des verbliebenen `1.0.0`-Tags den Start. Genau diese Kombination folgt aus [03-01-PLAN.md:125](/Users/dennis/code/github.com/mrhdready/WordQuest/.planning/phases/03-installable-1-0-0-release/03-01-PLAN.md:125) und [:145](/Users/dennis/code/github.com/mrhdready/WordQuest/.planning/phases/03-installable-1-0-0-release/03-01-PLAN.md:145).

**Vorschläge**

Die zuvor als abwesend geprüften Tags bereits vor dem Build für das Cleanup registrieren. Einen absichtlich scheiternden Teil-Build prüfen: Danach dürfen weder eigene Tags noch Container oder Volumes zurückbleiben.

**Risiko: MEDIUM.** Der Produktivänderungsumfang ist klein; die offene Stelle betrifft die Zuverlässigkeit des Prüfablaufs.

## 03-02

**Kurzfassung:** Der Restore-Ablauf deckt den normalen Fall gut ab. Fehlerfortpflanzung und die Aussage zur Sitzungsungültigkeit brauchen Korrekturen.

**Stärken**

- **Der Datenverlust-Test trifft echte Beziehungen:** Der Erstdurchlauf erzeugt Kind, Vokabeln und eine beantwortete Lernaufgabe. Beim Löschen des Kindes verschwinden Lernzustände und Protokolle durch Fremdschlüssel. Das anschließende Wiederherstellen prüft dadurch mehr als eine einzelne Benutzerzeile. Belege: [first-run.spec.ts:21](/Users/dennis/code/github.com/mrhdready/WordQuest/frontend/e2e/first-run.spec.ts:21), [:69](/Users/dennis/code/github.com/mrhdready/WordQuest/frontend/e2e/first-run.spec.ts:69), [LearningConfigurations.cs:28](/Users/dennis/code/github.com/mrhdready/WordQuest/backend/src/WordQuest.Infrastructure/Configurations/LearningConfigurations.cs:28), [:50](/Users/dennis/code/github.com/mrhdready/WordQuest/backend/src/WordQuest.Infrastructure/Configurations/LearningConfigurations.cs:50).
- **Der Web-Neustart ist begründet:** nginx verwendet feste Upstream-Namen ohne dynamischen Resolver. Der geplante Neustart nach dem API-Start berücksichtigt diesen Bestand. Beleg: [frontend/nginx.conf:40](/Users/dennis/code/github.com/mrhdready/WordQuest/frontend/nginx.conf:40).

**Bedenken**

- **HIGH — Die kritischen Fehler innerhalb von `load_dump` sind nicht ausreichend abgesichert.** Der Plan kombiniert Drop/Create, Dekompression und Import in einer Funktion; anschließend wird deren Erfolg für den Rückfall ausgewertet. Er verlangt aber keine explizite Fehlerweitergabe je Teilschritt. Bei einem Aufruf über `if load_dump …` beziehungsweise `load_dump … || …` schützt `set -e` die Funktionsbefehle nicht zuverlässig. Das habe ich isoliert reproduziert: Ein fehlgeschlagener erster Befehl wurde übergangen, die Funktion meldete anschließend Erfolg. Der vorgesehene Test provoziert ausschließlich einen SQL-Importfehler; Drop/Create-, Lesefehler und ein ebenfalls scheiternder Rückfall fehlen. Belege: [03-02-PLAN.md:137](/Users/dennis/code/github.com/mrhdready/WordQuest/.planning/phases/03-installable-1-0-0-release/03-02-PLAN.md:137), [:164](/Users/dennis/code/github.com/mrhdready/WordQuest/.planning/phases/03-installable-1-0-0-release/03-02-PLAN.md:164), [:175](/Users/dennis/code/github.com/mrhdready/WordQuest/.planning/phases/03-installable-1-0-0-release/03-02-PLAN.md:175).
- **MEDIUM — Gelöschte Refresh-Tokens machen bestehende Access-Tokens nicht ungültig.** Die Zusage „keine Anmeldung … mehr gültig“ ist stärker als der geplante Mechanismus. Die API prüft JWT-Signatur, Aussteller, Zielgruppe und Lebensdauer, ohne Refresh-Token-Abfrage. Bereits ausgegebene Access-Tokens bleiben bei unverändertem Schlüssel bis zum Ablauf gültig: standardmäßig 15 Minuten, mit 30 Sekunden Toleranz. Belege: [03-02-PLAN.md:30](/Users/dennis/code/github.com/mrhdready/WordQuest/.planning/phases/03-installable-1-0-0-release/03-02-PLAN.md:30), [Program.cs:94](/Users/dennis/code/github.com/mrhdready/WordQuest/backend/src/WordQuest.Api/Program.cs:94), [JwtTokenService.cs:45](/Users/dennis/code/github.com/mrhdready/WordQuest/backend/src/WordQuest.Api/Auth/JwtTokenService.cs:45), [AuthOptions.cs:15](/Users/dennis/code/github.com/mrhdready/WordQuest/backend/src/WordQuest.Api/Auth/AuthOptions.cs:15).

**Vorschläge**

- Explizite Statusprüfung für jeden destruktiven Teilschritt und die vollständige Eingabepipeline vorschreiben. Auch bei zweimaligem Fehlschlag muss ein Test belegen: API bleibt gestoppt, Vorher-Sicherung bleibt erhalten.
- Refresh- und Access-Token-Verhalten getrennt testen. Die kleinste Lösung ist eine präzise Zusage: keine Sitzungserneuerung mehr; bestehende Access-Tokens laufen aus. Sofortige vollständige Abmeldung wäre eine zusätzliche Auth-Entscheidung.

**Risiko: HIGH.** Fehler an dieser Stelle können einen unvollständigen Datenbestand als erfolgreichen Restore behandeln.

## 03-03

**Kurzfassung:** Sicherung vor Pull und Pull vor `.env` sind richtig angeordnet. Der Fehler nach Beginn der Umschaltung ist unzureichend behandelt und getestet.

**Stärken**

- **Die Konfiguration bleibt bei fehlendem Zielimage erhalten:** Die Zielversion soll nur für den Pull übergeben und `.env` erst nach dessen Erfolg geändert werden. Das begrenzt den Fehlerzustand vor der Umschaltung. Beleg: [03-03-PLAN.md:135](/Users/dennis/code/github.com/mrhdready/WordQuest/.planning/phases/03-installable-1-0-0-release/03-03-PLAN.md:135). Compose-Pull startet selbst keine Container. Siehe [Docker-Dokumentation](https://docs.docker.com/reference/cli/docker/compose/pull/).
- **Der entfallene Schnelltest-Umstieg entspricht der korrigierten Entscheidung:** Dafür wieder Migrationslogik einzubauen wäre unnötiger Scope. Maßgeblich ist [03-CONTEXT.md:43](/Users/dennis/code/github.com/mrhdready/WordQuest/.planning/phases/03-installable-1-0-0-release/03-CONTEXT.md:43).

**Bedenken**

- **HIGH — Ein Fehler von `docker compose up -d` umgeht den vorgesehenen Rückweg.** Nach dem Schreiben von `.env` steht ein ungeschütztes `up -d`; erst danach folgt die Health-Schleife mit verständlicher Rückfallmeldung. Bei einem direkten Compose-Fehler beendet `set -e` das Skript vorher. Container können dann teilweise ersetzt sein, während die Meldung mit alter Version und Sicherungsdatei ausbleibt. Beleg: [03-03-PLAN.md:136](/Users/dennis/code/github.com/mrhdready/WordQuest/.planning/phases/03-installable-1-0-0-release/03-03-PLAN.md:136). Compose kann vorhandene Container neu erzeugen und bei Fehlern Exit 1 liefern: [Docker-Dokumentation](https://docs.docker.com/reference/cli/docker/compose/up/).
- **MEDIUM — Der erfolgreiche Smoke belegt keinen erfolgreichen Zielimage-Pull.** Beide Versionsnamen zeigen auf dieselben lokal gebauten Images. Das Build-Overlay markiert API und Web als baubar; `--ignore-buildable` überspringt deren Pull. Im negativen Test fehlen dagegen veröffentlichte `1.0.0`-Images ebenfalls: Selbst ein versehentlich mit der aktuellen statt der Zielversion ausgeführter Pull könnte scheitern und den Test bestehen. Belege: [03-03-PLAN.md:79](/Users/dennis/code/github.com/mrhdready/WordQuest/.planning/phases/03-installable-1-0-0-release/03-03-PLAN.md:79), [:160](/Users/dennis/code/github.com/mrhdready/WordQuest/.planning/phases/03-installable-1-0-0-release/03-03-PLAN.md:160), [docker-compose.build.yml:9](/Users/dennis/code/github.com/mrhdready/WordQuest/docker-compose.build.yml:9). Die Flag-Semantik bestätigt die [Docker-Dokumentation](https://docs.docker.com/reference/cli/docker/compose/pull/).

**Vorschläge**

- Direkten Startfehler und Health-Timeout über denselben Fehlerpfad behandeln: alte Version, Sicherungsdatei und konkrete Wiederherstellungsschritte nennen.
- Beide Fälle automatisieren. Der Health-Fehler ist lokal provozierbar: `WQ_SEED_DEMO_DATA=true` löst bereits einen kontrollierten Production-Startabbruch aus, ohne ein neues Defekt-Image zu benötigen. Beleg: [Program.cs:35](/Users/dennis/code/github.com/mrhdready/WordQuest/backend/src/WordQuest.Api/Program.cs:35).
- Ergänzend einen kleinen Pull-Spy verwenden, der Zielversion und Reihenfolge prüft. Der echte Registry-Pull bleibt anschließend Veröffentlichungsabnahme.

**Risiko: HIGH.** Gerade der für Eltern schwierige Zustand „Update begonnen, Anwendung startet nicht“ bleibt offen.

## 03-04

**Kurzfassung:** Das Abschluss-Gate ist breit angelegt. Die Freigabereihenfolge enthält jedoch einen Zirkelschluss; die Syntaxprüfung prüft weniger Dateien als behauptet.

**Stärken**

- **Das Backend-Gate ist tatsächlich wirksam:** Der wiederverwendete Helfer baut mit `/warnaserror`, führt Tests gegen eigenes PostgreSQL aus und lehnt einen Lauf ohne gefundene Tests ab. Belege: [backend-test.sh:54](/Users/dennis/code/github.com/mrhdready/WordQuest/.planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh:54), [:65](/Users/dennis/code/github.com/mrhdready/WordQuest/.planning/phases/02-reliable-learning-clean-family-data/gate/backend-test.sh:65).
- **Die Grenze des Doku-Smokes wird ausdrücklich festgehalten:** Die Prüfung mit einer Person ohne Projektkenntnis bleibt eigenständige Abnahme. Das entspricht dem Ziel „ohne besonderes Know-how“. Beleg: [03-VALIDATION.md:80](/Users/dennis/code/github.com/mrhdready/WordQuest/.planning/phases/03-installable-1-0-0-release/03-VALIDATION.md:80).

**Bedenken**

- **HIGH — Die Release-Abnahme blockiert ihre eigene Voraussetzung.** Das Tag darf erst nach Abnahme entstehen. Die Abnahme verlangt aber bereits veröffentlichte `1.0.0`-Images und eine frische Installation daraus; deren Veröffentlichung wird erst durch das Tag ausgelöst. Zusätzlich soll jede Manual-Only-Zeile abgeschlossen sein, einschließlich des Updates auf eine erst später verfügbare Folgeversion. Belege: [03-04-PLAN.md:143](/Users/dennis/code/github.com/mrhdready/WordQuest/.planning/phases/03-installable-1-0-0-release/03-04-PLAN.md:143), [03-VALIDATION.md:78](/Users/dennis/code/github.com/mrhdready/WordQuest/.planning/phases/03-installable-1-0-0-release/03-VALIDATION.md:78), [:82](/Users/dennis/code/github.com/mrhdready/WordQuest/.planning/phases/03-installable-1-0-0-release/03-VALIDATION.md:82), [:100](/Users/dennis/code/github.com/mrhdready/WordQuest/.planning/phases/03-installable-1-0-0-release/03-VALIDATION.md:100).
- **MEDIUM — `bash -n setup.sh upgrade.sh restore.sh` prüft ausschließlich `setup.sh`.** Die weiteren Pfade sind Skriptargumente. Isoliert reproduziert: gültige erste Datei plus syntaktisch kaputte zweite Datei ergaben Exit **0**; die zweite Datei allein ergab Exit **2**. Das Abschluss-Gate kann daher trotz Syntaxfehlern grün werden. Beleg: [03-04-PLAN.md:140](/Users/dennis/code/github.com/mrhdready/WordQuest/.planning/phases/03-installable-1-0-0-release/03-04-PLAN.md:140).

**Vorschläge**

Zwei Freigabestufen definieren:

1. **Veröffentlichungsfreigabe:** lokales Gate und lokal mögliche Abnahmen; danach Dennis’ Tag/Push.
2. **Release-Abnahme:** veröffentlichte Manifeste, anonymer Pull und Installation auf dem Pi.

Den Test einer späteren Folgeversion als Nachprüfung führen. Die Syntaxprüfung muss jede Datei einzeln aufrufen, einschließlich Release-Smoke:

```bash
for script in setup.sh upgrade.sh restore.sh \
  .planning/phases/03-installable-1-0-0-release/smoke/release-smoke.sh; do
  bash -n "$script" || exit
done
```

**Risiko: HIGH.** Der aktuelle Ablauf kann weder widerspruchsfrei freigegeben werden noch alle behaupteten Syntaxprüfungen belegen.

**Planübergreifend:** Die Reihenfolge `03-01 → 03-02 → 03-03 → 03-04` kann bleiben. Zusätzlich besteht ein **MEDIUM-Regelkonflikt**: Die ersten drei Pläne verschieben das vollständige Gate nach 03-04, obwohl [AGENTS.md:152](/Users/dennis/code/github.com/mrhdready/WordQuest/AGENTS.md:152) es vor jeder Fertig-Meldung verlangt; ausdrücklich sichtbar etwa in [03-01-PLAN.md:261](/Users/dennis/code/github.com/mrhdready/WordQuest/.planning/phases/03-installable-1-0-0-release/03-01-PLAN.md:261). Diesen Widerspruch vor Ausführung auflösen.

Geprüft wurden Quellen und isolierte Bash-Reproduktionen. Docker-Smokes, Builds, Registry-Pulls und Hardware-Abnahmen wurden in diesem Review nicht ausgeführt.
