# WordQuest

Selbstgehostete Lernplattform für Englisch-Vokabeln. Ein Kind spielt zehn Minuten
und hat dabei zwanzig Vokabeln wiederholt, ohne den Eindruck zu haben, gelernt zu
haben.

Vollständiges Konzept und Architektur:
[`Documentation/WordQuest_Konzept_und_Architektur.md`](Documentation/WordQuest_Konzept_und_Architektur.md)

**Stand: Meilenstein 0.1/0.2 — ein durchgehender Pfad.** Eltern-Login, Vokabeln
anlegen und importieren, Karteikarten-Session mit echter SM-2-Terminierung,
XP/Level/Streak, Eltern-Dashboard mit Ampel. Die Minispiele (Wort-Fänger,
Memory) und der Offline-Betrieb stehen noch aus.

---

## Installation

Für den Betrieb im Heimnetz auf einem Raspberry Pi 5 oder einem NAS gibt es
genau eine Anleitung: [`Documentation/Installation.md`](Documentation/Installation.md).
Sie führt vom leeren Gerät bis zur ersten Anmeldung, erklärt Update
(`./upgrade.sh` holt das neueste Release selbst) und Wiederherstellen
(`./restore.sh`) und hilft bei Problemen. WordQuest läuft dort über HTTPS mit
einer eigenen Zertifizierungsstelle je Installation; `setup.sh` nennt am Ende die
Fingerabdrücke zum Prüfen.

**Für Entwickler und Forks:** Die CI baut bei jedem Push auf `master` und bei
jedem Tag `v*` die Images `ghcr.io/<account>/wordquest-api` und `-web` für
`linux/amd64` und `linux/arm64` und legt sie auf der GitHub Container Registry
ab. Bei Tags `v*` hängt die CI danach zusätzlich das Paket `wordquest.tar.gz`
mit Prüfsumme (`wordquest.tar.gz.sha256`) an das GitHub-Release; es enthält nur
die Dateien für den Betrieb (gebaut von `.github/release-package.sh`). Die
Installation zieht eine feste Version (`WQ_VERSION` in `.env.example`) vom
Präfix `ghcr.io/mrhdready/wordquest`. Wer eigene Images baut, stellt seine
Pakete unter **GitHub → Profil → Packages → Package settings → Change
visibility** auf *Public* und gibt bei `setup.sh` das eigene Präfix an. Ein
Fork setzt in `.env` außerdem
`WQ_RELEASE_URL=https://github.com/<account>/WordQuest/releases/latest/download`.

### Demo-Daten

Demo-Daten (Elternkonto, Kind, Beispielset) gibt es nur noch als
Entwickler-Option: `WQ_SEED_DEMO_DATA=true` legt sie beim Start auf einer
leeren Datenbank an. In `docker-compose.quick.yml` und in `.env.example` steht der
Wert auf `false`. Steht in einer älteren `.env` noch `true` (auch `True` oder
`"true"`), bricht `setup.sh` mit einem Hinweis ab, denn das Demo-Konto hat ein
bekanntes Passwort. Außerhalb des Entwicklungsmodus startet auch die API mit
eingeschalteten Demo-Daten nicht.

### Entwicklung

```bash
# 1. Nur die Datenbank im Container
docker compose -f docker-compose.dev.yml up -d

# 2. Backend
cd backend
dotnet run --project src/WordQuest.Api        # http://localhost:5080

# 3. Frontend
cd ../frontend
npm install
npm run dev                                    # http://localhost:5173
```

Der Vite-Dev-Server leitet `/api` an `localhost:5080` weiter. Im
Entwicklungsmodus legt die API Demo-Daten an (Zugangsdaten in
`backend/src/WordQuest.Infrastructure/Seed/DemoDataSeeder.cs`).

Images lokal bauen statt ziehen (vorher einmal `./setup.sh`, das die Secrets
und die `.env` anlegt):

```bash
docker compose -f docker-compose.quick.yml -f docker-compose.build.yml up -d --build
```

#### Migrationen

Das Datenmodell steht im Code, aber eine EF-Core-Migration besteht aus
generiertem C# plus einem Model-Snapshot, den nur das Werkzeug korrekt
schreiben kann. Nach jeder Änderung an einer Entität:

```bash
dotnet tool install --global dotnet-ef        # einmalig
cd backend
dotnet ef migrations add <Name> \
  --project src/WordQuest.Infrastructure \
  --startup-project src/WordQuest.Api
```

Die erzeugten Dateien gehören ins Repository. Fehlen sie, bricht die CI mit
einer entsprechenden Meldung ab — der Container würde sonst erst beim Start
scheitern.

---

## Aufbau

```
backend/
  src/
    WordQuest.Shared.Kernel/        Mandantenkontext, Bewertungsskala
    WordQuest.Modules.Identity/     Nutzer, Rollen, PIN, Passwort-Hashing
    WordQuest.Modules.Content/      Sets, Vokabeln, Karten, CSV-Import
    WordQuest.Modules.Learning/     SM-2, Session-Auswahl, Antwortbewertung  ← Kern
    WordQuest.Modules.Gamification/ XP, Level, Münzen, Streaks
    WordQuest.Infrastructure/       EF Core, DbContext, Seed, Orchestrierung
    WordQuest.Api/                  Minimal APIs, JWT, Rate Limiting
  tests/
    WordQuest.Learning.Tests/       Lernengine inkl. 365-Tage-Simulation
frontend/
  src/
    components/ui/                  Basisbausteine (Radix + Tailwind)
    features/auth/                  Profilauswahl mit PIN, Eltern-Login
    features/learn/                 Kinderbereich: Startseite und Session
    features/manage/                Elternbereich: Vokabeln, Fortschritt
Documentation/                      Konzept und Architektur
```

Module reden über Projektgrenzen hinweg nur in eine Richtung:
`Api → Infrastructure → Module → Shared.Kernel`. Das hält die Option offen,
später einzelne Module herauszulösen, ohne heute Microservices zu bezahlen.

---

## Der Teil, der wirklich zählt

`WordQuest.Modules.Learning` ist die einzige Stelle, an der ein Fehler
**unsichtbar** schadet. Ein falsch berechnetes Intervall merkt niemand — aber
es summiert sich über Wochen zu einem Tag mit 300 fälligen Karten, und an dem
Tag hört das Kind auf.

Deshalb gilt hier:

- reine Funktionen ohne Datenbankzugriff (`Sm2Scheduler`, `SessionComposer`, `AnswerEvaluator`)
- hohe Testabdeckung, inklusive einer Simulation über ein volles Schuljahr
- jede Parameteränderung wird gegen diese Simulation geprüft

```bash
cd backend
dotnet test
```

Drei Bremsen tragen das ganze System:

1. **Höchstens 5 neue Karten pro Tag und Kind** (`LearnerProfile.DailyNewLimit`).
   Wer hier 40 einstellt, erzeugt in den Folgetagen eine Wiederholungslawine.
2. **Keine neuen Karten, solange Rückstand besteht** (`SchedulerOptions.NewCardBacklogLimit`).
   Das Tagesbudget begrenzt den Zufluss, nicht das Verhältnis von Zufluss zu
   Abfluss. Ohne diese Bremse wächst der Berg über Monate — die Simulation
   landet dann bei über 250 fälligen Karten und einem Median-Intervall von acht
   Tagen, also: nichts festigt sich mehr.
3. **Höchstens 10 fällige Wiederholungen pro Session** (`SchedulerOptions.MaxDuePerSession`).
   Eine Session endet, bevor das Kind müde wird.

---

## Entscheidungen, die im Code sichtbar sind

| Entscheidung | Warum |
|---|---|
| Ein Vokabelpaar = **zwei** Lernkarten | „dog → Hund" sitzt viel früher als „Hund → dog". Gemeinsam terminiert, wird die schwere Richtung zu selten und die leichte zu oft geübt. |
| Bewertung **serverseitig** | Läge die Lösung im Client, stünde sie im Netzwerk-Tab. Bei einem Spiel mit Belohnungen finden Kinder solche Lücken. |
| **Damerau**-Levenshtein, nicht Levenshtein | Der häufigste Tippfehler ist der Dreher zweier Buchstaben. Levenshtein zählt `becuase` ↔ `because` als zwei Fehler und würde die Antwort verwerfen — ausgerechnet den Fall, für den die Toleranz gedacht war. |
| Ein Tippfehler zählt als richtig | Wer `becuase` tippt, kennt die Vokabel. Als „falsch" zu werten verletzt das Konzept und verfälscht die Terminierung. |
| Falsche Antwort kostet **0 XP** | Nie bestrafen. Die einzige Folge ist, dass das Wort früher wiederkommt. |
| `tenant_id` von Tag 1 an, per Global Query Filter | Mandantenfähigkeit nachzurüsten kostet Wochen und produziert Datenlecks. Der Filter sitzt im `DbContext`, nicht in einzelnen Queries. |
| Kind meldet sich mit **Avatar + PIN** an | Ein Passwortfeld ist die häufigste Abbruchstelle. Die PIN schützt gegen das Geschwisterkind — das ist das realistische Bedrohungsmodell im Wohnzimmer. |
| Zwei **Streak-Retter** pro Monat, automatisch | Ein an Tag 40 gerissener Streak ist ein realer Abbruchgrund, und ein krankes Kind hat den Ausfall nicht verschuldet. Nicht kaufbar. |
| Sammelkarten an **gefestigte** Vokabeln gekoppelt | Sonst lässt sich die Sammlung durch stumpfes Wiederholen leichter Wörter farmen. |

---

## Betrieb

| | |
|---|---|
| Hardware | 2 vCPU, 2 GB RAM, 10 GB Storage — läuft auf einem Raspberry Pi 5 |
| Zugriff | HTTPS mit eigener Zertifizierungsstelle (Dienst `certs`), Ports 80/443, belegt → 8080/8443 (`WQ_HTTP_PORT`, `WQ_HTTPS_PORT`) |
| Backups | täglich per `pg_dump` nach `./backups`, 14 Tage / 8 Wochen / 6 Monate |
| Healthchecks | `/health/live`, `/health/ready` |
| Secrets | Dateien unter `./secrets/`, nie als Umgebungsvariable |
| Logs | `docker compose logs -f api` |

Wiederherstellen aus einer Sicherung geht mit `./restore.sh`; die Anleitung steht
in [`Documentation/Installation.md`](Documentation/Installation.md). Ein
einfaches `psql` in die laufende Datenbank stellt nichts wieder her, weil die
Tabellen dort schon existieren.

---

## Datenschutz

Pflichtfelder für ein Kind sind ausschließlich ein Anzeigename — ein Spitzname
genügt — und die PIN für die Anmeldung. Kein Geburtsdatum, keine E-Mail, keine Klasse. Es gibt keine Telemetrie
und keinen externen Analytics-Dienst; Schriften und Icons werden mitgeliefert
statt von einem CDN geladen.

Solange die Instanz im eigenen Haushalt für die eigenen Kinder läuft, greift die
DSGVO über die Haushaltsausnahme (Art. 2 Abs. 2 lit. c) nicht. Relevant wird sie
ab dem ersten Einsatz mit fremden Kindern. Die Architektur ist darauf ausgelegt,
dass dieser Übergang keine Nacharbeit erfordert.

---

## Lizenz

[AGPL-3.0](LICENSE)
