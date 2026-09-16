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

## Schnellstart

### Produktion (Docker)

```bash
git clone <dieses-repo> wordquest
cd wordquest
./setup.sh
```

`setup.sh` erzeugt Secrets und `.env`, fragt nach dem Hostnamen und fährt den
Stack hoch. Danach ist WordQuest unter `https://<dein-host>` erreichbar.

Demo-Zugang, solange `WQ_SEED_DEMO_DATA=true` steht:

| | |
|---|---|
| Eltern | `demo@wordquest.local` / `demo1234` |
| Kind | Profil „Max", PIN `1234` |

> **Nach der Ersteinrichtung** eigenes Elternkonto anlegen, das Demo-Passwort
> ändern und `WQ_SEED_DEMO_DATA=false` in `.env` setzen.

#### Zu TLS

Eine PWA lässt sich nur über HTTPS installieren (Ausnahme: `localhost`). Im
Heimnetz ist das die häufigste Stolperstelle. Empfohlen: eine echte Subdomain
mit Let's-Encrypt-DNS-Challenge, per lokalem DNS auf die interne IP aufgelöst —
dann sieht das Kind keine Zertifikatswarnung. Die nötigen Variablen stehen in
`.env.example`.

### Entwicklung

```bash
# 1. Nur die Datenbank im Container
docker compose -f docker-compose.dev.yml up -d

# 2. Migrationen erzeugen (einmalig, siehe unten)
cd backend
dotnet tool install --global dotnet-ef
dotnet ef migrations add Initial \
  --project src/WordQuest.Infrastructure \
  --startup-project src/WordQuest.Api

# 3. Backend
dotnet run --project src/WordQuest.Api        # http://localhost:5080

# 4. Frontend
cd ../frontend
npm install
npm run dev                                    # http://localhost:5173
```

Der Vite-Dev-Server leitet `/api` an `localhost:5080` weiter.

> **Die erste Migration muss einmal von Hand erzeugt werden.** Das Datenmodell
> steht vollständig im Code, aber eine EF-Core-Migration besteht aus generiertem
> C# plus einem Model-Snapshot, den nur das Werkzeug korrekt schreiben kann.
> Ohne diesen Schritt startet die API nicht — `Database.MigrateAsync()` beim
> Start findet dann nichts anzuwenden. Die erzeugten Dateien gehören ins
> Repository.

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

Zwei Deckelungen tragen das ganze System:

1. **Höchstens 5 neue Karten pro Tag und Kind** (`LearnerProfile.DailyNewLimit`).
   Wer hier 40 einstellt, erzeugt in den Folgetagen eine Wiederholungslawine.
2. **Höchstens 10 fällige Wiederholungen pro Session** (`SchedulerOptions.MaxDuePerSession`).
   Eine Session endet, bevor das Kind müde wird.

---

## Entscheidungen, die im Code sichtbar sind

| Entscheidung | Warum |
|---|---|
| Ein Vokabelpaar = **zwei** Lernkarten | „dog → Hund" sitzt viel früher als „Hund → dog". Gemeinsam terminiert, wird die schwere Richtung zu selten und die leichte zu oft geübt. |
| Bewertung **serverseitig** | Läge die Lösung im Client, stünde sie im Netzwerk-Tab. Bei einem Spiel mit Belohnungen finden Kinder solche Lücken. |
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
| Backups | täglich per `pg_dump` nach `./backups`, 14 Tage / 8 Wochen / 6 Monate |
| Healthchecks | `/health/live`, `/health/ready` |
| Secrets | Dateien unter `./secrets/`, nie als Umgebungsvariable |
| Logs | `docker compose logs -f api` |

Wiederherstellung aus einem Backup:

```bash
gunzip -c backups/daily/wordquest-<datum>.sql.gz \
  | docker compose exec -T db psql -U wordquest -d wordquest
```

> Ein Backup, das nie zurückgespielt wurde, ist kein Backup. Einmal ausprobieren.

---

## Datenschutz

Pflichtfeld für ein Kind ist ausschließlich ein Anzeigename — ein Spitzname
genügt. Kein Geburtsdatum, keine E-Mail, keine Klasse. Es gibt keine Telemetrie
und keinen externen Analytics-Dienst; Schriften und Icons werden mitgeliefert
statt von einem CDN geladen.

Solange die Instanz im eigenen Haushalt für die eigenen Kinder läuft, greift die
DSGVO über die Haushaltsausnahme (Art. 2 Abs. 2 lit. c) nicht. Relevant wird sie
ab dem ersten Einsatz mit fremden Kindern. Die Architektur ist darauf ausgelegt,
dass dieser Übergang keine Nacharbeit erfordert.

---

## Lizenz

[AGPL-3.0](LICENSE)
