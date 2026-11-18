# Abschluss der Planung mit GSD

Bis November 2026 lief die Planung über GSD (`@opengsd/gsd-core`) im Ordner `.planning/`. Am 2026-11-18 ist das Projekt auf GitHub Issues umgestiegen, weil GSD nicht mit jedem Agenten zuverlässig lief (Codex). Seitdem steht offene Arbeit nur noch in den [GitHub Issues](https://github.com/mrhdready/WordQuest/issues). Wie damit gearbeitet wird, regelt `AGENTS.md` → Issues.

Diese Datei hält fest, was aus `.planning/` noch gilt: den erreichten Stand, die Entscheidungen und wohin die offenen Punkte gegangen sind. Sie wird nicht weiter fortgeschrieben.

Der Ordner ist auf dem Stand [`f94c974`](https://github.com/mrhdready/WordQuest/tree/f94c974/.planning) vollständig erhalten: Phasenpläne, Zusammenfassungen, Reviews, Abnahmeprotokolle, Recherche und Codebase-Karte.

## Erreichter Stand

| Version | Stand |
|---|---|
| 1.0.0 | veröffentlicht 2026-10-24 (Tag `v1.0.0`) |
| 1.0.1 | veröffentlicht 2026-10-24 (Tag `v1.0.1`), Befunde aus der Abnahme |
| 1.1.0 | umgesetzt auf `v1-fertig` (`WQ_VERSION=1.1.0`), automatisch belegt, auf einer VM abgenommen. Geräteabnahme und Tag offen: [#10](https://github.com/mrhdready/WordQuest/issues/10) |

Umgesetzt in den Phasen 1 bis 3.1.1 und in den Quick-Tasks:

- **Installation und Konten:** `setup.sh` erzeugt Secrets und legt das Elternkonto an, keine Demo-Zugangsdaten, Passwort ändern in der App, Reset per CLI, Start bricht bei fehlenden oder Standard-Secrets ab (SETUP-01 bis SETUP-06).
- **Eltern:** Kind anlegen, bearbeiten und löschen, PIN mit genau 4 Ziffern, Set umbenennen und Vokabel korrigieren ohne Verlust des Lernstands (PAR-01 bis PAR-05).
- **Fehlerbehebungen:** Rate-Limit pro echter Client-IP, keine verwaisten Lerndaten, gezeigte, aber nicht beantwortete Karten kommen wieder, 4xx statt 500, aktuelle Serie, eine Regel für „gemeistert“, PIN per Tastatur, abgebrochene Runden verbrauchen kein Tageslimit (FIX-01 bis FIX-09).
- **Design:** `DESIGN.md` als einzige Quelle der Tokens, axe ohne Verstöße (DESIGN-01).
- **Qualität:** Integrationstests gegen echtes PostgreSQL, Formulartests mit Edge-Case-Matrix und axe (QUAL-01, QUAL-02).
- **Release:** `upgrade.sh` mit Sicherung vorab, `restore.sh`, Installationsseite für Laien, versionierte Images für amd64 und arm64 (REL-01 bis REL-04).
- **Härtung** nach dem Codex-Gesamtreview: Sitzungen ohne Rennen bei Refresh, Abmelden und mehreren Tabs, konsistente Lernrunden, atomare PIN-Sperre, Sicherheits-Header an jeder Antwort, Installation und Update ohne Git (HARD-01 bis HARD-05).
- **Bilder** pro Vokabel, mandantengetrennt in der Datenbank, mit Sicherung, Wiederherstellung und Update (IMG-01).
- **HTTPS im Heimnetz** mit eigener Zertifizierungsstelle pro Installation (Dienst `certs`), Traefik und Let's Encrypt entfernt (TLS-01 bis TLS-06, Release 1.1.0).

Einige dieser Anforderungen waren in GSD noch nicht abgehakt, weil der Abschluss der Abnahme in GSD nicht mehr ausgeführt wurde. Die Abnahmen auf der VM sind bestanden. Offen sind nur noch die Prüfungen an echten Geräten, und die stehen in [#5](https://github.com/mrhdready/WordQuest/issues/5) und [#10](https://github.com/mrhdready/WordQuest/issues/10).

## Entscheidungen, die weiter gelten

| Entscheidung | Grund |
|---|---|
| Umfang auf eine funktionierende Basis gekürzt (21 statt 53 Anforderungen) | Der größere Umfang widersprach dem Ziel einer einfachen App für Eltern ohne Vorkenntnisse. Die Recherche dazu bleibt Input für v2. |
| Heimnetz über HTTPS mit eigener Zertifizierungsstelle pro Installation, kein HSTS, CA nicht in den Sicherungen | Service Worker und PWA brauchen ein vertrautes Zertifikat. Das geht ohne Domain und ohne Internet (Owner 2026-10-25, ADR-008). Ersetzt den früheren Betrieb über reines HTTP. |
| Domain mit Let's Encrypt und Traefik entfernt | Für Eltern ohne Technik-Know-how nicht machbar (Owner 2026-10-25). Installationen der Version 1.0.x werden nicht migriert. |
| Elternkonto entsteht in `setup.sh`, nicht in einem Assistenten im Browser | Nur Heimnetz. Kein Zeitfenster, in dem jemand die Einrichtung übernehmen kann. Gleicher Mechanismus wie der Reset per CLI. |
| Schwelle für „gemeistert“: Ease ≥ 2.1, eine Konstante (`MasteryRules`) | Das Konzept widersprach sich (2.0 und 2.1). 2.1 entsprach dem Code. |
| Kinder-PIN genau 4 Ziffern, die vierte Ziffer meldet an | Owner 2026-10-21. „Los geht's“ entfällt, die Statuszeile zeigt „Einen Moment …“. |
| Offline-Lernen, neue Spielmodi und Berichte erst in v2 | Für die Basis nicht nötig. |
| Jede Code-Änderung bekommt vor „fertig“ ein Review durch einen Subagenten | Ausdrückliche Wahl des Betreibers (`AGENTS.md` → Review). |
| Löschen gilt als gute Praxis, nicht als Zusage zur DSGVO | Eine Familie, die für sich selbst hostet, fällt wahrscheinlich unter die Haushaltsausnahme. Es gab keine rechtliche Prüfung. |
| Regel für künftige Releases: Compose-Änderungen bleiben mit der Vorversion lauffähig, kein PostgreSQL-Major ohne eigenen Plan | Sonst trägt der Weg zurück aus `upgrade.sh` (alte Version in `.env`, `restore.sh`) nicht. |
| `upgrade.sh` sichert, prüft, zieht, schreibt `.env`, startet und prüft dann die Bereitschaft, in dieser Reihenfolge | `.env` erst nach der Bereitschaft zu schreiben würde bei einem Abbruch die alte Version neben einer migrierten Datenbank zurücklassen. |

## Bewusst ausgeschlossen

| Thema | Grund |
|---|---|
| Mehrere Familien pro Instanz | Eine Familie pro Heiminstallation. Die Mandantentrennung im Code bleibt trotzdem. |
| Schulen und Klassen | Andere Zielgruppe mit deutlich strengeren Anforderungen |
| E-Mail- und Push-Benachrichtigungen | Keine Mail-Infrastruktur bei Laien-Hostern |
| Passkeys und OIDC | Für eine Familien-App im Heimnetz nicht nötig |
| Tracking, Ranglisten, Strafen für eine gerissene Serie | Druck auf Kinder |
| App-Store, Monetarisierung, LDAP, Moodle | Nicht Ziel des Projekts |
| Tokens in Cookies | Tokens liegen bewusst im `localStorage`. Deshalb muss die CSP streng bleiben. |

## Bekannte, bewusst getragene Risiken

Aus der Codebase-Karte vom 2026-10-26 ([`codebase/CONCERNS.md`](https://github.com/mrhdready/WordQuest/blob/f94c974/.planning/codebase/CONCERNS.md)). Wo etwas zu tun ist, steht es als Issue.

- **Tokens im `localStorage`:** Jedes XSS liest sie aus. Dagegen helfen HTTPS, die strikte CSP, Refresh-Rotation mit Erkennung von Wiederverwendung und 15 Minuten Laufzeit für Access-Tokens.
- **Kein HSTS:** Das Vertrauen in die eigene Zertifizierungsstelle hängt am Nutzer. `setup.sh` zeigt die Fingerabdrücke, `Installation.md` leitet den Vergleich an.
- **Bildprüfung nur strukturell, ohne Decoder:** Das ist akzeptiert, solange nur Eltern hochladen. Ein Decoder bräuchte eine neue Dependency.
- **Rate-Limit nur im Speicher und genau eine API-Instanz:** Das ist eine Rahmenbedingung (`AGENTS.md` → Projekt).
- **Query-Cache ohne Nutzerbezug:** Der Schutz beim Anmeldewechsel beruht auf `queryClient.clear()`. Keine `memo`-Grenze über Komponenten mit `useQuery` ziehen.
- **Auth-Rotation und Sperrreihenfolge sind empfindlich:** Jede neue Stelle, die Tokens schreibt, muss unter `LockUserAsync` laufen. Rennen werden als Integrationstest belegt.
- **Zertifizierungsstelle:** Nie neu ausstellen, sonst verlieren alle Geräte das Vertrauen.

## Wohin die offenen Punkte gegangen sind

| Herkunft in `.planning/` | Issue |
|---|---|
| Manuelle Abnahme v1.0 (UAT, Bilder A1–A3, echte Geräte) | [#5](https://github.com/mrhdready/WordQuest/issues/5), schon vorher vorhanden |
| Geräteabnahme 1.1.0 und Tag `v1.1.0` (TLS-01 bis TLS-06) | [#10](https://github.com/mrhdready/WordQuest/issues/10) |
| Bekannte Fehler aus der Codebase-Karte | [#11](https://github.com/mrhdready/WordQuest/issues/11), [#12](https://github.com/mrhdready/WordQuest/issues/12), [#13](https://github.com/mrhdready/WordQuest/issues/13) |
| Technische Schulden | [#14](https://github.com/mrhdready/WordQuest/issues/14), [#15](https://github.com/mrhdready/WordQuest/issues/15), [#16](https://github.com/mrhdready/WordQuest/issues/16), [#18](https://github.com/mrhdready/WordQuest/issues/18), [#19](https://github.com/mrhdready/WordQuest/issues/19) |
| Beobachtung aus der Abnahme: `upgrade.sh` ohne „schon aktuell“ | [#17](https://github.com/mrhdready/WordQuest/issues/17) |
| `Documentation/questions.md`, Frage 1 (Projektsprache) | [#20](https://github.com/mrhdready/WordQuest/issues/20) |
| v2: PAR2-01 bis PAR2-04 | [#21](https://github.com/mrhdready/WordQuest/issues/21) bis [#24](https://github.com/mrhdready/WordQuest/issues/24) |
| v2: ACC2-01, ACC2-02 | [#25](https://github.com/mrhdready/WordQuest/issues/25), [#26](https://github.com/mrhdready/WordQuest/issues/26) |
| v2: LRN2-01, LRN2-02, CNT2-01 | [#27](https://github.com/mrhdready/WordQuest/issues/27), [#28](https://github.com/mrhdready/WordQuest/issues/28), [#29](https://github.com/mrhdready/WordQuest/issues/29) |
| v2: LRN2-03 bis LRN2-06 | [#30](https://github.com/mrhdready/WordQuest/issues/30) bis [#33](https://github.com/mrhdready/WordQuest/issues/33) |
| v2: CNT2-02, CNT2-03 | [#34](https://github.com/mrhdready/WordQuest/issues/34), [#35](https://github.com/mrhdready/WordQuest/issues/35) |
| v2: GAM2-01, GAM2-02 | [#36](https://github.com/mrhdready/WordQuest/issues/36), [#37](https://github.com/mrhdready/WordQuest/issues/37) |
| v2: OPS2-02, OPS2-03 (mit Digest-Pins und Sicherung außerhalb des Hosts) | [#38](https://github.com/mrhdready/WordQuest/issues/38), [#39](https://github.com/mrhdready/WordQuest/issues/39) |
| v2: SEC2-01 bis SEC2-03, AI2-01 | [#40](https://github.com/mrhdready/WordQuest/issues/40) bis [#43](https://github.com/mrhdready/WordQuest/issues/43) |
| v2: QA2-01 bis QA2-06 | [#44](https://github.com/mrhdready/WordQuest/issues/44) bis [#49](https://github.com/mrhdready/WordQuest/issues/49) |
| v2: Lernwörter SPL2-01 bis SPL2-06 | [#6](https://github.com/mrhdready/WordQuest/issues/6), schon vorher vorhanden |
| Priorisierung v2 und offene Fragen O1–O6 aus dem Ursprungskonzept | [#7](https://github.com/mrhdready/WordQuest/issues/7), schon vorher vorhanden |

Nicht übernommen, weil erledigt: die Befunde des Codex-Gesamtreviews (HARD-01 bis HARD-05) und die offenen Todos aus Phase 03.1-02 (Quick 261023-k4m).

## Was aus `.planning/` noch im Repo ist

Die Testskripte aus den Phasen liegen jetzt unter `scripts/smoke/` (Aufruf: `AGENTS.md` → Gate). Ihre Kommentare verweisen teils auf Plan-IDs wie `03.1-05` oder `D-16`. Diese stehen in den Plänen auf dem Stand [`f94c974`](https://github.com/mrhdready/WordQuest/tree/f94c974/.planning/phases).

Die Codebase-Karte (`codebase/`: Stack, Architektur, Konventionen, Tests, Schwachstellen) und die Recherche (`research/`, unter anderem Lehrpläne und Lizenzen für Vokabeln) sind nur noch dort zu finden. Was davon als Regel gilt, steht in `AGENTS.md`.
