# WordQuest — Ursprungskonzept (Archiv)

**Status:** Historisch, abgelöst durch [`../WordQuest_Konzept_und_Architektur.md`](../WordQuest_Konzept_und_Architektur.md).
**Quelle:** Inhalt der früheren `.docx`-Dateien im Ordner `Documentation/`, hier zusammengeführt und dedupliziert (Stand 2026-09-24).

Dieses Dokument bewahrt die ursprüngliche Schul-Ausrichtung auf, damit nachvollziehbar bleibt, woher Entscheidungen im konsolidierten Konzept kommen. Es beschreibt **nicht** das aktuelle System. Die Abweichungen stehen in der Tabelle am Ende.

## Herkunft

| Frühere Datei | Inhalt |
|---|---|
| `WordQuest_Projektdokumentation.docx` (+ drei inhaltsgleiche Kopien `… 1/2/3.docx`) | Vision, Zielgruppen, Epics 1–10, Roadmap |
| `WordQuest_Projektdokumentation_Vollstaendig.docx` (+ zwei inhaltsgleiche Kopien `… 1/2.docx`) | wie oben, ergänzt um Ziele, Architektur, Rollenmodell, Datenschutz, Datenmodell, Open-Source-Strategie |
| `WordQuest_Software_Architecture_Document.docx` | SAD mit 25 Kapiteln, je ein Satz Inhalt |
| `WordQuest_SAD_Extended.docx` | SAD mit 17 Kapiteln, je ein Satz Inhalt |

In beiden SAD-Fassungen endete jeder Abschnitt mit demselben Platzhaltersatz („Architekturentscheidungen, Begründungen/Risiken, Akzeptanzkriterien und Umsetzungs­richtlinien/-hinweise sind … zu dokumentieren“). Diese Sätze sind hier weggelassen, weil sie keinen Inhalt tragen.

## Vision und Ziele

- Selfhostbare Lern- und Gamification-Plattform **für Schulen**, Schwerpunkt Vokabeltraining und Touch-Bedienung.
- Spielerisches, motivierendes, datenschutzfreundliches Lernen. Lehrkräfte sollen den Lernstand überwachen können.
- Ziele: Touch First, Selfhosting, Offlinefähigkeit, keine Herstellerbindung, Modularität, Datenschutz.
- Produktvision im SAD: modulare Fachmodule, beginnend mit Englisch.

## Zielgruppen und Rollen

- Schüler, Lehrer, Schuladministratoren, Schulträger.
- Rollenmodell: Administrator verwaltet Schule/System, Lehrer verwaltet Klassen und Inhalte, Schüler nutzt Lernspiele.

## Architektur (Ursprungsidee)

- React/TypeScript-PWA (Tailwind, responsive, Touch First), ASP.NET Core API, PostgreSQL, Docker Compose, Reverse Proxy mit Traefik oder NGINX, Backup-Service.
- Backend als Clean Architecture mit Domain-, Application-, Infrastructure- und API-Layer.
- C4-Skizze: Schüler, Lehrer, Administrator nutzen die PWA. Container sind PWA, API, PostgreSQL und Reverse Proxy. Komponenten sind Auth, Klassenverwaltung, Lernengine, Gamification, Reporting und Integrationen.
- Datenmodell: School 1:n Classroom, Classroom 1:n User, VocabularySet 1:n Vocabulary, User n:m Vocabulary über Progress. Zusätzlich Achievement.
- Ablauf einer Lernrunde: Spiel starten → API liefert nächste Vokabel → Antwort → Bewertung → Fortschritt speichern → XP vergeben.
- REST-API: `/auth`, `/users`, `/classes`, `/vocabulary`, `/learning`, `/statistics`.

## Epics

1. **Plattform & Infrastruktur**: containerisierte Installation, CI/CD, Konfiguration, Monitoring, Backups.
2. **Benutzerverwaltung**: Login, Rollen, Passwortverwaltung, später LDAP/AD.
3. **Schul- und Klassenverwaltung**: Schulen, Klassen, Lehrkräfte, Zuordnung von Schülern.
4. **Vokabelverwaltung**: CRUD, CSV-/Excel-Import, Zuordnung zu Klassen und Themenbereichen.
5. **Lernengine**: Karteikarten, Multiple Choice, Spaced Repetition, adaptiver Lernpfad.
6. **Spielmodule**: Memory, Wortjäger, Buchstaben-Chaos, Monster-Duell.
7. **Gamification**: XP, Level, Abzeichen, Avatare, tägliche Missionen, Sammelkarten, Quests.
8. **Lehrer-Dashboard**: Ampelsystem, Lernfortschritt, Klassenstatistiken, Problemwörter.
9. **PWA & Offlinefähigkeit**: installierbar, offline nutzbar, Synchronisation bei erneuter Verbindung, für Tablets optimiert.
10. **Integrationen**: LDAP/Active Directory, Moodle, IServ über Adapter, optionale KI über Ollama oder Azure OpenAI (Provider-Modell).

## Querschnittsthemen

- **Datenschutz:** möglichst wenige personenbezogene Daten, lokale Verarbeitung, Löschkonzepte, Auftragsverarbeitung optional, Betrieb in der Schule möglich.
- **Sicherheit:** TLS, Passwort-Hashing, RBAC, Rate Limiting, Threat Model für Missbrauch, Datenverlust und Account-Kompromittierung.
- **Backup:** tägliche PostgreSQL-Backups, verschlüsselte Archivierung, Wiederherstellungstest.
- **Logging & Monitoring:** OpenTelemetry, strukturierte Logs, Healthchecks, Auditlog.
- **Plugin-Architektur:** Lernspiele als Module mit definierten Interfaces.
- **Open Source:** modulare Erweiterbarkeit für Community-Beiträge.
- **Nichtfunktional:** Offlinefähigkeit, Touch-Bedienung, Performance, Skalierbarkeit, DSGVO.
- **Risiken:** Akzeptanz, Gerätevielfalt, Datenschutz, Inhaltsqualität.

## Roadmap (Ursprungsidee)

| Version | Inhalt |
|---|---|
| 0.1 | Basisplattform, Nutzer, Vokabeln, Lernengine, XP |
| 0.5 | Weitere Spiele und PWA |
| 1.0 | Lehrer-Dashboard, Importe, Schulen |
| 2.0 | LDAP, Moodle, IServ |
| 3.0 | Mehrsprachige Fachmodule |

Aufwandsschätzung im SAD: MVP 3 Monate, Beta 6 Monate, Version 1.0 in 9–12 Monaten.

## Was davon heute gilt

| Ursprungsidee | Heute |
|---|---|
| Zielgruppe Schule, Klassen, Lehrer | Familie zuerst: Eltern und Kinder, eine Familie pro Installation. Schulen sind ausdrücklich nicht Zielgruppe. |
| Clean Architecture mit vier Layern | Modularer Monolith: Api, Infrastructure, fachliche Module, Shared.Kernel |
| School/Classroom-Datenmodell | `Tenant` (Familie), `User`, `LearnerProfile`, `VocabularySet`, `VocabularyEntry`, `Card`, `ReviewState`, `ReviewLog`, `LearningSession`, `GamificationProfile` |
| Offline mit Synchronisation | Nicht umgesetzt, für v2 vorgesehen |
| LDAP, Moodle, IServ, KI | Nicht geplant bzw. nur als Idee |
| Roadmap 0.1–3.0 | Ersetzt durch `.planning/ROADMAP.md` |

Details zu diesen Entscheidungen stehen im konsolidierten Konzept, insbesondere in §0, §1 und §18.
