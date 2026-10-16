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

Die CI baut bei jedem Push auf `master` zwei Container-Images und legt sie auf
der GitHub Container Registry ab:

| Image | Inhalt |
|---|---|
| `ghcr.io/<account>/wordquest-api` | ASP.NET-Core-Backend, wendet Migrationen beim Start selbst an |
| `ghcr.io/<account>/wordquest-web` | nginx mit der gebauten PWA, leitet `/api` ans Backend weiter |

Beide sind für `linux/amd64` und `linux/arm64` gebaut — es läuft also auch auf
einem Raspberry Pi 5 oder einem ARM-NAS.

> **Einmalig nötig:** Die Pakete stehen nach dem ersten CI-Lauf auf *privat*.
> Unter **GitHub → dein Profil → Packages → wordquest-api → Package settings →
> Change visibility → Public** umstellen, für `-web` genauso. Ohne diesen
> Schritt braucht jeder Zielhost eine Anmeldung mit Token.

### Variante A — Heimnetz (Standard)

Für den Rechner im Heimnetz, auf dem WordQuest laufen soll. Kein Zertifikat,
keine Domain.

```bash
git clone https://github.com/<account>/WordQuest.git wordquest
cd wordquest
./setup.sh
```

`setup.sh` fragt genau drei Dinge:

1. das Image-Präfix (`ghcr.io/<account>/wordquest`),
2. die E-Mail-Adresse für dein Elternkonto,
3. das Passwort dafür, zweimal, mindestens 8 Zeichen; die Eingabe bleibt unsichtbar.

Dann erzeugt es DB-Passwort und JWT-Schlüssel als Dateien in `secrets/`, legt
`.env` an (`COMPOSE_FILE=docker-compose.quick.yml`), lädt die Images, startet
WordQuest und legt das Elternkonto an. Danach läuft die App auf
**http://<host>:8080**; anmelden kannst du dich nur mit diesem Konto, einen
Demo-Zugang gibt es nicht.

Ein zweiter Lauf von `setup.sh` ändert nichts: Secrets, `.env` und Konto
bleiben, wie sie sind. Ein anderer Port geht mit `WQ_PORT=9000` in `.env`.

**Was hier fehlt:** Ohne HTTPS lässt sich die App nicht als PWA aufs Tablet
legen — Service Worker verlangen eine sichere Herkunft (außer auf
`localhost`). Im Browser funktioniert alles, aber ohne Installation und ohne
Offlinebetrieb. Wer das braucht, nimmt Variante B.

**Früherer Schnelltest:** Wer WordQuest schon mit der alten Schnelltest-Datei
gestartet hat, findet dessen Daten im Volume des Compose-Projekts
`wordquest-quick`. Sie werden nicht übernommen. Werden sie nicht mehr gebraucht:
`docker compose -p wordquest-quick down -v`.

Der Installer schützt das Verzeichnis `secrets/` mit `0700`. Die einzelnen
Secret-Dateien erhalten `0644`, damit die Container sie als Non-Root-Benutzer
über ihre read-only Dateimounts lesen können. Vorhandene Inhalte bleiben erhalten.

Was dabei entsteht und **nicht** ins Repository gehört (steht in `.gitignore`):

```
secrets/db_password.txt    48 Zeichen Zufall
secrets/jwt_key.txt        48 Zeichen Zufall, signiert die Tokens
.env                       Compose-Datei, Image-Präfix, weitere Einstellungen
backups/                   tägliche pg_dumps, Ordner mit 0700
```

#### Sicherung

Der Dienst `backup` sichert die Datenbank jeden Tag nach `backups/`
(`backups/daily/wordquest-<Datum>.sql.gz`) und hebt 14 tägliche, 8 wöchentliche
und 6 monatliche Stände auf. `setup.sh` legt den Ordner mit `0700` an, denn die
Dumps enthalten alle Familiendaten samt Passwort-Hashes, und nennt am Ende den
Pfad. Der Ordner muss auf einem Linux-Dateisystem liegen (z. B. ext4), nicht auf
einer SMB-Freigabe oder einem exFAT-Stick. Eine Sicherung sofort anstoßen:
`docker compose exec backup /backup.sh`. Zurückspielen geht bisher von Hand,
siehe [Betrieb](#betrieb).

#### Passwort vergessen

Im Installationsverzeichnis:

```bash
docker compose exec api dotnet WordQuest.Api.dll reset-password <E-Mail>
```

Der Befehl erzeugt ein neues Passwort und zeigt es **genau einmal** an; es wird
nirgends im Klartext gespeichert. Damit anmelden. Gibt
es kein Elternkonto mit dieser Adresse, meldet er das und ändert nichts.
Angemeldete Geräte können ihre Sitzung danach nicht mehr verlängern. Wer schon
angemeldet ist, bleibt höchstens bis zum Ablauf des aktuellen Zugangs angemeldet
(Standard 15 Minuten, `Auth:AccessTokenMinutes`).

#### Wenn die API nicht startet

Fehlt das DB-Passwort oder der JWT-Schlüssel oder ist einer davon ein bekannter
Standardwert aus diesem Repository, bricht die API den Start ab, zum Beispiel:

```
Start abgebrochen: WQ_JWT_SIGNING_KEY fehlt oder ist ein bekannter Standardwert. Führe `setup.sh` aus oder trage einen eigenen Wert ein.
```

`./setup.sh` erzeugt fehlende Secret-Dateien. Das gilt auch für einen selbst
gesetzten `ConnectionStrings__Default`: Dessen Passwort wird genauso geprüft.
Nur mit `ASPNETCORE_ENVIRONMENT=Development` (Variante C) entfällt die Prüfung.

### Variante B — Mit Domain und TLS (für Fortgeschrittene)

Mit eigener Domain und Let's-Encrypt-Zertifikat über Traefik. Nur damit lässt
sich die App als PWA installieren.

```bash
git clone https://github.com/<account>/WordQuest.git wordquest
cd wordquest
cp .env.example .env
```

In `.env` von Hand eintragen: `COMPOSE_FILE=docker-compose.yml`,
`WQ_IMAGE_PREFIX`, `WQ_HOST`, `WQ_ACME_EMAIL` und den DNS-Anbieter (siehe
unten). Danach `./setup.sh`: Es lässt die vorhandene `.env` unverändert,
erzeugt die Secrets, startet den Stack und legt auch hier das Elternkonto an.
WordQuest ist dann unter `https://<WQ_HOST>` erreichbar.

#### Zu TLS — die häufigste Stolperstelle

Eine PWA lässt sich nur über HTTPS installieren. Im Heimnetz führt der
bequemste Weg über eine **echte Subdomain mit DNS-Challenge**: Der Hostname
zeigt per lokalem DNS auf die interne IP, das Zertifikat kommt trotzdem von
Let's Encrypt, weil die Prüfung über einen DNS-Eintrag läuft und nicht über
eine von außen erreichbare Adresse.

Dafür in `.env`:

```
WQ_HOST=wordquest.deine-domain.de
WQ_ACME_DNS_PROVIDER=cloudflare
CF_DNS_API_TOKEN=<Token mit Zone:DNS:Edit>
```

Andere Anbieter brauchen andere Variablen — die
[Traefik-Providerliste](https://doc.traefik.io/traefik/https/acme/#providers)
nennt sie je Anbieter; die Variable gehört dann in den `environment`-Block des
`proxy`-Dienstes.

Der Umweg über ein selbstsigniertes Zertifikat ist möglich, aber schlecht: Ein
Kind, das erst eine Sicherheitswarnung wegklicken muss, um zu lernen, ist kein
guter Ausgangspunkt — und iOS installiert eine PWA mit ungültigem Zertifikat
gar nicht erst.

#### Demo-Daten

Demo-Daten (Elternkonto, Kind, Beispielset) gibt es nur noch als
Entwickler-Option: `WQ_SEED_DEMO_DATA=true` legt sie beim Start auf einer
leeren Datenbank an. In beiden Compose-Dateien und in `.env.example` steht der
Wert auf `false`. Steht in einer älteren `.env` noch `true`, bricht `setup.sh`
mit einem Hinweis ab, denn das Demo-Konto hat ein bekanntes Passwort.

#### Aktualisieren

```bash
docker compose pull && docker compose up -d
```

Neue Migrationen wendet die API beim Start selbst an. Ein Backup vorher
schadet trotzdem nicht.

Für einen festen Stand statt des jeweils letzten Builds ein Git-Tag setzen
(`git tag v0.1.0 && git push --tags`) und in `.env` `WQ_VERSION=0.1.0`
eintragen.

### Variante C — Entwicklung

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

Images lokal bauen statt ziehen:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
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
