# Roadmap: WordQuest

## Overview

v1.0 turns the existing learning core into a working, safe base that another family can run in its home network. Phase 1 makes the plain-HTTP home-network install safe and recoverable (own parent account, generated secrets, daily backups, password and PIN recovery). Phase 2 removes the known defects that make learning unreliable and lets a parent delete a child and correct sets without leaving orphaned data, backed by integration tests against real PostgreSQL. Phase 3 ships a versioned 1.0.0 release with upgrade and restore scripts and one install page a non-expert can follow.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Safe Home-Network Install** - Parent installs over plain HTTP with own account, generated secrets and daily backups, and can recover passwords and child PINs
- [ ] **Phase 2: Reliable Learning & Clean Family Data** - Known learning bugs fixed, child deletion and set/entry correction without orphaned data, proven by integration tests
- [ ] **Phase 3: Installable 1.0.0 Release** - Versioned images, `upgrade.sh`, `restore.sh` and one install page for non-experts

## Phase Details

### Phase 1: Safe Home-Network Install

**Goal**: A parent installs WordQuest in the home network over plain HTTP with their own account, generated secrets and daily backups, and can recover their own password and a child's forgotten PIN without help
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: DESIGN-01, SETUP-01, SETUP-02, SETUP-03, SETUP-04, SETUP-05, SETUP-06, FIX-07, PAR-01, PAR-02, PAR-05, FIX-08, QUAL-02
**Success Criteria** (what must be TRUE):
  1. On a fresh host, `setup.sh` in home-network mode asks for the parent's email and password and generates DB password and JWT key; after start the parent logs in at `http://<host>:8080` with exactly that account, and no demo account exists
  2. The home-network stack writes a daily database dump to the backup directory, and outside Development the API refuses to start (clear error naming the secret) when the DB password or JWT key is missing or a known default
  3. Parent changes their password in the app and can then log in only with the new one; an operator who lost it resets it with one command inside the container and logs in with the result
  4. Parent edits a child's name, daily new-card limit and PIN, and the child logs in with the new PIN; a PIN that is not exactly 4 digits is rejected by the server with a readable message, also when sent directly to the API
  5. The password-change and edit-child forms have frontend tests covering the full edge-case matrix (one wrong field at a time, exact error texts, Enter-submit path, happy path last), axe reports 0 WCAG 2.2 AA violations on both pages, and a keyboard walkthrough plus 200 % zoom pass

**Plans**: 8/8 plans executed

Plans:
- [x] 01-01-PLAN.md — DESIGN.md-Tokens exportieren, UI-Bausteine und Eltern-Login umstellen (alte Theme-Namen als Übergang), Playwright/axe und Vitest einrichten (mit Paket-Freigabe)
- [x] 01-02-PLAN.md — setup.sh im Heimnetz-Modus: eigenes Elternkonto, erzeugte Secrets, kein Demo-Konto; Smoke gegen frisch gebautes Image; Integrationstest-Projekt
- [x] 01-03-PLAN.md — Verwalten-Seiten (Vokabeln, Set, Fortschritt) auf DESIGN.md, Field-Baustein, Testhilfe mit Parameterrouten, CSV-Import-Zustände belegt
- [x] 01-04-PLAN.md — Kinder-Anmeldung per Tastatur und Maus mit PIN 4–6, Lernseiten auf DESIGN.md, Lernen über HTTP belegt, Design-Migration abschließen
- [x] 01-05-PLAN.md — Passwort-Reset per Befehl, Secret-Prüfung beim Start (auch expliziter Connection-String), tägliche Sicherung
- [x] 01-06-PLAN.md — Passwort ändern in der App, Formular-Matrix, Frontend-Schritte im CI-Gate
- [x] 01-07-PLAN.md — Kind anlegen mit PIN- und Namensregel im Identity-Modul, seedfreier Erstdurchlauf bis zur ersten Lernantwort
- [x] 01-08-PLAN.md — Kind bearbeiten inklusive neuer PIN, Rate-Limit-robustes Phasen-Abschluss-Gate

**UI hint**: yes

### Phase 2: Reliable Learning & Clean Family Data

**Goal**: Children learn without lockouts, crashes, stuck cards or wrong numbers, and a parent can delete a child or correct sets and entries without orphaned data or lost progress, proven by integration tests against real PostgreSQL
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04, FIX-05, FIX-06, FIX-09, PAR-03, PAR-04, QUAL-01
**Success Criteria** (what must be TRUE):
  1. When one family member mistypes their login repeatedly, the others can still log in from their own devices, and token refresh during normal learning never counts against the login limit
  2. A card that was shown but not answered comes back in a later session instead of staying `New`; a double tap on an answer or an invalid session/item ID yields a clean 4xx/409 response and a readable message, never a 500
  3. After a missed day the dashboard shows the actual current streak (not the old one as ongoing), and the parent overview and traffic light count the same words as mastered (ease >= 2.1, defined once)
  4. After a parent deletes a set, an entry or a child (with confirmation), none of the removed words appear in any session and no learning history of the deleted child remains; renaming a set or correcting an entry keeps the child's progress on that word; the new rename/edit forms and the delete dialog pass the edge-case matrix and axe (0 WCAG 2.2 AA violations) like the Phase 1 forms
  5. API integration tests run against a real PostgreSQL in CI and cover login, refresh, isolation between siblings and each FIX requirement, all green

**Plans**: 7/7 plans executed

Plans:
- [x] 02-01-PLAN.md — Abgebrochene Runde verbraucht nichts und neue Karten kommen wieder (FIX-03/09), 404/400/409 statt 500 in der Lernrunde (FIX-04), Gate-Hilfe mit eigenem PostgreSQL
- [x] 02-02-PLAN.md — Fremdschlüssel-Migration `ReferentialIntegrity` mit Waisenbereinigung (einzige Migration), `DELETE /learners/{id}`, Backend-Tests für Kind, Set und Migration
- [x] 02-03-PLAN.md — Scrim-Token in DESIGN.md, Dialog-Baustein, „Kind löschen“ in der Oberfläche mit Matrix, axe, Tastatur und 200 % Zoom
- [x] 02-04-PLAN.md — Set umbenennen und Set löschen mit Dialogen, Längenprüfung statt 500, Erfolgsmeldung in der Set-Liste
- [x] 02-05-PLAN.md — Vokabel korrigieren und nur nach Bestätigung löschen, Fehler der Erfassung sichtbar
- [x] 02-06-PLAN.md — Rate-Limit pro Gerät hinter dem Proxy, Refresh ohne Limit und ohne Abmelden bei 429/5xx, Tests für Anmeldung und Geschwister-Trennung
- [x] 02-07-PLAN.md — Aktuelle Serie, eine Meisterschaftsregel für Wörter, Phasen-Gate wie CI

**UI hint**: yes

### Phase 3: Installable 1.0.0 Release

**Goal**: Another family installs, updates and restores WordQuest 1.0.0 in its home network by following one install page, without special know-how
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: REL-01, REL-02, REL-03, REL-04
**Success Criteria** (what must be TRUE):
  1. API and web images are published with the tag `1.0.0` for the home-server architecture, and a fresh install pulls that tag instead of `master`
  2. Following only the install page (install, update, backup/restore, step by step), a person new to the project gets from an empty host to a working parent login in home-network mode
  3. `upgrade.sh` writes a DB backup before pulling the new version, and the family's children, sets and progress are intact after the upgrade
  4. `restore.sh` restores a chosen backup, and afterwards the parent sees the data as of that backup

**Plans**: 5/5 plans executed

Plans:
- [x] 03-01-PLAN.md — Standard `1.0.0` und `ghcr.io/mrhdready/wordquest` (Präfix mit Enter), Installationsseite (Voraussetzungen, Installation, Sicherung, Hilfe), README auf Verweis, Release-Smoke mit Seitenabgleich
- [x] 03-02-PLAN.md — Cross-Build mit `$BUILDPLATFORM` für arm64 und amd64, Konzept §14, Plan-Gate mit e2e
- [x] 03-03-PLAN.md — `restore.sh` mit Liste, Bestätigung, Vorher-Sicherung, ausdrücklicher Fehlerweitergabe und Rückfall; Seitenabschnitt Wiederherstellen
- [x] 03-04-PLAN.md — `upgrade.sh` mit geprüfter Sicherung vor dem Laden der Zielversion, abgesichertem Start mit Weg zurück; Seitenabschnitt Update
- [x] 03-05-PLAN.md — Seite nach D-09 vollständig und gegen den Code belegt, automatisches Phasen-Gate, Übergabe der Nach-Release-Abnahme

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Safe Home-Network Install | 8/8 | In Progress | - |
| 2. Reliable Learning & Clean Family Data | 7/7 | In Progress | - |
| 3. Installable 1.0.0 Release | 5/5 | In Progress | - |

### Phase 03.1: Release Hardening (INSERTED)

**Goal:** Der Release-Kandidat 1.0.0 ist frei von den belegten Fehlern des Codex-Gesamtreviews (`.planning/v1.0-CODEX-REVIEW.md`) und läuft lokal als Prod-Stack
**Requirements**: HARD-01, HARD-02, HARD-03, HARD-04, HARD-05
**Depends on:** Phase 3
**Success Criteria** (what must be TRUE):
  1. Each of the 11 Codex findings has a test that was red before the fix and is green after it, or a documented, justified rejection
  2. Sessions end reliably: after logout, revocation or session expiry no stored token survives and the UI shows the login
  3. The full gate (backend, frontend, e2e with axe, install, release and proxy smokes) is green on the final commit
  4. A locally built production stack (setup.sh, Production, images built from the final commit) serves login and a learning round, observed in the browser
  5. Install and update from a locally built release package without git are green in the release smoke (download, checksum, self-update, image pull of the target version)

**Plans:** 7/7 plans executed

Plans:
- [x] 03.1-01-PLAN.md — Refresh und Widerruf unter Kontosperre mit bedingter Beanspruchung, 409-Gnadenfrist für den eben rotierten Vorgänger (D-17), Abmelden liest unter der Sperre neu und widerruft den Nachfolger, wiederholbarer Refresh nach 40P01, atomare PIN-Sperre (Befunde 1, 2 Server, 4 Server, 9)
- [x] 03.1-02-PLAN.md — Oberfläche folgt dem Token-Speicher auch über Tabs, verspätete Refresh-Antwort verworfen, 409 übernimmt nur innerhalb derselben Anmeldung, verspätete 401er ohne neuen Refresh, Abmelden und neue Anmeldung leeren `wq-api` (Befunde 2, 4, 5 Client; D-15)
- [x] 03.1-03-PLAN.md — Set-Wahl begrenzt die ganze Runde bei kontoweiter Rückstandsbremse (D-19), offene Runden der letzten 30 Minuten reservieren neue Karten (D-18), Lernstand mit Concurrency-Token und Mindestabstand ohne Migration (Befunde 6, 7, 8)
- [x] 03.1-04-PLAN.md — Sicherheits-Header aus einer Include-Datei an jeder nginx-Antwort beider Varianten, auch an Fehlerantworten (D-21), eindeutige CSV-Kopfzeile (D-20), Ladefehler der Set-Liste mit axe (Befunde 3, 10, 11)
- [x] 03.1-05-PLAN.md — Release-Paket mit exakt geprüftem Inhalt und Prüfsumme aus der CI, Installation per curl ohne Git, README und Konzept, erste Runde bis zur Zusammenfassung im Smoke (D-16, HARD-05)
- [x] 03.1-06-PLAN.md — upgrade.sh holt das neueste Release: Paketprüfung vor jeder Änderung, Sicherung, Ersetzen, exec, echter Pull aus lokaler Registry im Release-Smoke, Klon-Weg und Grenzen (D-16, HARD-05)
- [x] 03.1-07-PLAN.md — Prod-Stack aus dem End-Commit im Wegwerf-Klon, installiert aus dem Release-Paket, mit ganzer Lernrunde und Exit-Code-sicherer Prüfung, volles Phasen-Gate, Befund-Nachweis für alle 11 Befunde (D-03)

### Phase 03.1.1: Vocabulary Pictures (INSERTED)

**Goal:** Eltern können jeder Vokabel ein eigenes Bild geben, und das Kind sieht es in der Lernrunde. Bilder liegen in der Datenbank und sind damit in Sicherung, Wiederherstellung und Update enthalten
**Requirements**: IMG-01
**Depends on:** Phase 03.1
**Success Criteria** (what must be TRUE):
  1. A parent adds, replaces and removes a picture for a vocabulary entry in the app; the browser shrinks it before upload and drops camera metadata
  2. A child sees the entry's picture in the learning round (picture before emoji); another family never gets the picture (tenant isolation test)
  3. The server accepts only files up to a fixed size whose signature is WebP, JPEG or PNG and whose structure is consistent (JPEG starts with `FF D8 FF` and ends with `FF D9`; PNG: signature, first chunk `IHDR`, last chunk `IEND`; WebP: `RIFF` length matches the file size, `WEBP`/`VP8` marker), and rejects everything else with a German 4xx message; pictures are served only with an image Content-Type and `nosniff`, and a picture the browser cannot decode falls back to the emoji without a layout jump (D-16)
  4. Backup, restore and upgrade keep the pictures (release smoke)
  5. Full gate green, axe 0 on touched pages, keyboard and 200 % zoom

**Plans:** 5/5 plans executed — automatisch belegt, manuelle Abnahme A1–A3 offen

Plans:
- [x] 03.1.1-01-PLAN.md — Server: Bild speichern, ersetzen und ausliefern (Tabelle per dotnet ef, PUT/GET), nur Dateien mit Bild-Signatur und schlüssiger Struktur bis 300 KB, Konflikt 409 nach rotem Test, Mandantentrennung, Kaskade, Konzept (D-06 bis D-10, D-15, D-16)
- [x] 03.1.1-02-PLAN.md — Vorschaubild in der Vokabelliste: `pictureVersion` ohne Bildbytes (SQL-Nachweis per Interceptor), `api()` mit Blob-Antwort, `VocabPicture` mit Emoji-Rückfall bei Lade- und Dekodierfehler, DESIGN.md, axe, Tastatur, 200 % (D-03, D-09, D-12, D-13, D-16)
- [x] 03.1.1-03-PLAN.md — Abschnitt „Bild“ im Dialog „Vokabel bearbeiten“: wählen, ersetzen, entfernen, Verkleinern ohne EXIF/GPS (großes Foto dekodiert geprüft), Edge-Case-Matrix, 413 auch von nginx mit deutschem Text, DELETE mit Isolation (D-03 bis D-05, D-07, D-08, D-10, D-15)
- [x] 03.1.1-04-PLAN.md — Bild in der Lernrunde statt des Emojis, auch bei der Wiederholung und ohne Secure Context, Runde ohne Bildbytes (SQL-Nachweis), Emoji im selben Rahmen bei Dekodierfehler, axe, 200 % und 320 px (D-11, D-12, D-15, D-16)
- [x] 03.1.1-05-PLAN.md — Bild durch Sicherung, Wiederherstellung und Update im Release-Smoke, Installationsseite und Doku-Schlussprüfung, volles Gate und Klon-Smoke auf END unter `/bin/bash`; IMG-01 automatisch belegt, manuelle Abnahme A1–A3 offen; END als Release-Kandidat (D-01, D-14, D-15)
