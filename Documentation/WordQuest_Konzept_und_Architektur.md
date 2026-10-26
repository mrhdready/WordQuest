# WordQuest — Konsolidiertes Konzept & Architektur

**Version:** 1.1 (gegen Code abgeglichen)
**Stand:** 24.09.2026
**Status:** Konzept- und Architekturgrundlage, abgeglichen mit dem Code (Commit `4ce32da`). Aktueller Umfang, Anforderungen und Roadmap stehen in `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md` und `.planning/ROADMAP.md` — bei Widerspruch gelten diese.

**Markierungen in diesem Dokument:**

- **geplant, nicht umgesetzt** — Zielbild, im Code noch nicht vorhanden; mit Verweis auf die Anforderung, falls eine existiert.
- **verworfen / zurückgestellt** — im ursprünglichen Konzept vorgesehen, für v1.0 bewusst nicht geplant.
- **Idee** — langfristige Idee ohne Planung.

---

## 0. Warum dieses Dokument existiert

Im Repository lagen neun `.docx`-Dateien mit stark überlappendem, teils widersprüchlichem Inhalt:

| Datei | Inhalt | Status |
|---|---|---|
| `WordQuest_Projektdokumentation*.docx` (4×) | Fachkonzept, Epics 1–10, Schulfokus | **abgelöst** |
| `WordQuest_Projektdokumentation_Vollstaendig*.docx` (3×) | dito, minimal erweitert | **abgelöst** |
| `WordQuest_Software_Architecture_Document.docx` | SAD-Kurzfassung | **abgelöst** |
| `WordQuest_SAD_Extended.docx` | SAD mit 17 Kapiteln, aber überwiegend Platzhaltertext | **abgelöst** |

Die vier zentralen Widersprüche zwischen dieser Doku und dem neueren Produktkonzept sind hiermit entschieden:

| Konflikt | Alte Doku | Neues Konzept | **Entscheidung** |
|---|---|---|---|
| Zielgruppe | Schule, Klassen, Lehrer | Ein Kind, Elternteil | **Familie zuerst** (→ §1); Schulen sind für v1.0 außer Scope |
| Frontend | React/TS PWA | Flutter | **React/TS PWA** (→ ADR-002) |
| Backend | ASP.NET Core | Node/Azure Functions | **ASP.NET Core** (→ ADR-003) |
| KI (OCR, Aussprache, Coach) | „Ollama oder Azure OpenAI" | Kernfeature | **Nicht im MVP** (→ §11) |

**Ablage:** Die `.docx`-Dateien werden aus dem Repository entfernt. Ihr Inhalt liegt als Markdown in `Documentation/archiv/Ursprungskonzept.md`. Projektdokumentation gehört in einem Git-Repo als Markdown versioniert — `.docx` erzeugt bei jedem Speichern einen binären Diff, der nicht reviewbar ist.

---

## 1. Scope-Entscheidung: „Familie zuerst, Schule später"

Gebaut wird zunächst die **Familien-App** — ein Elternkonto, ein bis drei Kinder, selbstgehostet auf einem Rechner im Haus. Aber: Das Datenmodell und die Autorisierung werden **von Tag 1 an mandantenfähig** geschnitten.

Konkret heißt das:

- Es gibt eine Entität `Tenant` mit `type ∈ {Family, School}`. Eine Familie *ist* ein Mandant — nur mit anderem Namen im UI.
- Es gibt eine Entität `Group` (Lerngruppe). In der Familie ist das implizit eine Gruppe pro Kind; in der Schule wird daraus „Klasse 6b". — **geplant, nicht umgesetzt:** `Group` existiert im Code nicht.
- Jede Datenbankzeile mit Nutzerbezug trägt `tenant_id`. Jede Query filtert darauf (umgesetzt über EF-Core-Global-Query-Filter, `WordQuestDbContext.cs`).
- Rollen heißen `Owner`, `Guardian` (Elternteil/Lehrkraft) und `Learner` (Kind/Schüler) — nicht `Parent`/`Teacher`.

Das kostet im MVP etwa 3–5 % Mehraufwand. Der nachträgliche Einbau von Mandantenfähigkeit in ein gewachsenes Schema kostet dagegen erfahrungsgemäß Wochen und produziert Datenlecks zwischen Mandanten. Das ist der Grund, warum diese Entscheidung *jetzt* getroffen wird und nicht später.

**Stand v1.0:** Eine Familie pro Instanz; mehrere Familien pro Instanz und Schulen sind außer Scope (`.planning/PROJECT.md`). Die Mandantentrennung im Code bleibt trotzdem bestehen.

**Bewusst nicht im Scope (auch nicht vorbereitet):** LDAP/Active Directory, Moodle, IServ, SCORM, Notenexport, Mehrsprachigkeit über Englisch hinaus. Diese Punkte aus der alten Doku sind Schul-Themen und würden das MVP erdrücken. Sie kommen über die Integrations-Schnittstelle (→ §12) wieder rein, wenn sie gebraucht werden.

---

## 2. Produktvision und Leitplanken

**Vision:** Ein Kind soll 10 Minuten spielen und dabei 20 Vokabeln wiederholt haben, ohne den Eindruck zu haben, gelernt zu haben.

Fünf Leitplanken, an denen jede spätere Feature-Entscheidung gemessen wird:

1. **Kurze Einheiten.** Eine Session dauert 3–7 Minuten und hat einen definierten Endpunkt. Kein endloses Scrollen, kein „noch eine Runde"-Sog. Das ist eine Lern-App, kein Aufmerksamkeits-Casino.
2. **Nie bestrafen.** Eine falsche Antwort kostet keine Punkte, keine Leben, keine Streak. Sie führt lediglich dazu, dass das Wort früher wiederkommt. Formulierung: „Fast! Das üben wir gleich nochmal." — nie „Falsch".
3. **Touch first.** Alle Interaktionen mit dem Daumen bedienbar, Trefferflächen ≥ 48 px, primäre Aktionen im unteren Bildschirmdrittel. Tastatureingabe ist immer optional, nie erzwungen.
4. **Offline lauffähig.** Eine Lernsession muss ohne Netz vollständig durchlaufen. Synchronisation passiert danach. — **geplant, nicht umgesetzt** (v2, `LRN2-02`): Das Frontend ruft `/sessions/sync` nicht auf; ohne installierte Zertifizierungsstelle registriert sich kein Service Worker (→ §13).
5. **Datensparsam.** Kein Kindername ist zwingend. Kein Tracking, keine Werbung, keine externen Analytics. Das ist bei einer App für ein 11-jähriges Kind keine Kür.

---

## 3. Rollen und Zugang

| Rolle | Kann | Login |
|---|---|---|
| `Owner` | Instanz verwalten, Backup, Updates, erste Einrichtung | E-Mail + Passwort (optional TOTP: **geplant, nicht umgesetzt**) |
| `Guardian` | Lernende anlegen, Vokabeln pflegen, Dashboard sehen | E-Mail + Passwort |
| `Learner` | Lernen, spielen, Sammlung ansehen | **Profilauswahl + PIN** |

Im Code haben `Owner` und `Guardian` dieselben Rechte (Policy `Guardian` = Rollen `Owner` oder `Guardian`, `Program.cs`).

**Zum Kinder-Login:** Ein Kind soll kein Passwort tippen müssen — das ist die häufigste Abbruchstelle bei Lern-Apps. Stattdessen: Startbildschirm zeigt Avatar-Kacheln, ein Tipp auf den eigenen Avatar, dann eine PIN mit genau 4 Ziffern über ein großes Ziffernfeld (Tippen oder Tastatur); die vierte Ziffer meldet an, ohne weiteren Tipp und ohne Absende-Button; während der Anmeldung steht „Einen Moment …“ sichtbar unter den Punkten, und dieselbe Statuszeile sagt es Screenreadern an (die Ziffernanzahl sagt sie nur an, sichtbar zeigen sie die Punkte). Bei falscher PIN wird die Eingabe geleert, die Meldung bleibt stehen und der Fokus liegt auf der Taste 1. Enter auf einer fokussierten Ziffern-Taste bleibt wirkungslos, damit ein Enter aus Gewohnheit keine Ziffer anhängt; die Leertaste bedient sie. Die PIN schützt nicht gegen Angreifer, sondern gegen das Geschwisterkind — das ist das realistische Bedrohungsmodell im Wohnzimmer. Technisch wird für das Kind ein Refresh-Token (30 Tage, rotierend) auf dem Gerät hinterlegt, sodass die PIN nur bei Profilwechsel oder nach 30 Tagen ohne Nutzung nötig ist. Beim Anlegen eines Kindes ist die PIN Pflicht; das Feld nimmt höchstens 4 Zeichen an, und der Server prüft sie auf genau 4 Ziffern 0–9 (`PAR-02`); dieselbe Prüfung gilt beim Ändern über `PATCH /learners/{id}/settings` (`PAR-01`). Dort bleibt die PIN bei leerer Eingabe unverändert; hat das Kind noch keine PIN, ist sie auch beim Ändern Pflicht. Eine neue PIN hebt eine Sperre nach Fehlversuchen sofort auf und meldet alle Geräte ab, auf denen das Kind noch angemeldet ist (Widerruf seiner Refresh-Tokens).

Auf einem Familientablet ist „Gerät ist vertrauenswürdig" die richtige Annahme. Auf einem Schul-Tablet später nicht — dort würde die PIN pro Session erzwungen. Das Feld `Tenant.RequirePinEverySession` existiert im Code, wird aber nicht ausgewertet (**geplant, nicht umgesetzt**; Schulen außer Scope).

---

## 4. Funktionsumfang und Priorisierung

Priorisierung nach MoSCoW, bezogen auf das MVP (= „ein Kind kann damit für die nächste Vokabelarbeit lernen"). Der verbindliche Umfang für v1.0 steht in `.planning/REQUIREMENTS.md`.

### Must — MVP

| # | Feature | Anmerkung |
|---|---|---|
| M1 | Vokabelsets anlegen, Vokabeln manuell erfassen | Schnellerfassung: eine Zeile `Hund = dog`, Tab springt weiter. Eigenes Bild je Vokabel im Dialog „Vokabel bearbeiten“; das Kind sieht es in der Lernrunde statt des Emojis |
| M2 | CSV-Import | Text einfügen oder eine Datei wählen (`.csv`/`.txt`, höchstens 1 MB); die Datei liest der Browser ins Textfeld: mit UTF-16-BOM als UTF-16 (LE oder BE, z. B. Excel „Unicode-Text“), sonst erst strikt als UTF-8, sonst als Windows-1252; ein BOM wird entfernt. Während eine Datei gelesen wird, zählt keine weitere Auswahl. Feste Spaltenreihenfolge Quelle; Ziel; [Emoji], Trennzeichen-Erkennung (`;`, `,`, Tab; Zeichen in Anführungszeichen zählen dabei nicht mit), Vorschau vor dem Import. Die erste Zeile gilt nur als Kopfzeile, wenn jedes belegte Feld ein Kopfwort ist und jedes aus einer anderen Gruppe stammt (Quelle: `Deutsch`, `German`, `Quelle`, `Source`; Ziel: `Englisch`, `English`, `Ziel`, `Target`; Emoji: `Emoji`, `Bild`). `Quelle;source` oder `Bild;picture` sind Vokabeln; im Zweifel wird die erste Zeile importiert und erscheint in der Vorschau |
| M3 | Spaced Repetition Engine | → §6, das Herzstück |
| M4 | Antwortbewertung mit Tippfehlertoleranz | → §6.4 |
| M5 | Lernsession („Quest") mit definiertem Ende | höchstens 15 Items (ein Zeitlimit gibt es nicht) |
| M6 | Drei Spielmodi: **Karteikarte**, **Wort-Fänger**, **Memory** | → §7; umgesetzt ist im Frontend nur **Karteikarte**, die beiden anderen sind nur im Backend definiert (v2, `LRN2-01`) |
| M7 | XP, Level, Münzen, Tagesstreak | → §8 |
| M8 | Eltern-Dashboard mit Ampel | → §9 |
| M9 | PWA installierbar, Session offline lauffähig | → §13; **geplant, nicht umgesetzt** (v2, `LRN2-02`) |
| M10 | Docker-Compose-Deployment mit einem Befehl | → §14 |

### Should — nach v1.0 (Idee)

Monster-Duell und Buchstaben-Chaos als drittes/viertes Spiel · Text-to-Speech für Vokabelaussprache (Browser-`SpeechSynthesis`, kostenlos, kein Server) · Sammelkarten · Tagesmissionen · Avatar-Anpassung · Themenwelten als visueller Fortschrittspfad

### Could — später (Idee)

Foto-Import des Vokabelhefts (OCR) · Aussprachebewertung · KI-Beispielsätze · Wochenreport „Vokabel-Coach" · Familien-Rangliste (Ranglisten sind laut `.planning/PROJECT.md` als Druck auf Kinder außer Scope)

### Won't (vorerst)

Schul-Mandanten im UI · LDAP · Moodle/IServ · App-Store-Release · Monetarisierung

**Zur Monetarisierung:** Im ursprünglichen Konzept stand ein Familienabo. Das ist mit dem Ziel „selbst hostbar als Docker-Container" nicht vereinbar — wer selbst hostet, zahlt kein Abo. Entweder Open Source und selbstgehostet, oder SaaS mit Abo. Für den genannten Zweck (Familie, eigener Server) ist die Entscheidung klar: **Open Source, AGPL-3.0** (`LICENSE`), keine Monetarisierung. Falls später doch ein gehostetes Angebot entstehen soll, ist AGPL die richtige Basis dafür.

---

## 5. Domänenmodell

```
Tenant (type: Family|School)
 ├─ User (role: Owner|Guardian|Learner)
 │   ├─ LearnerProfile      (Avatar, PIN-Hash, Tagesbudget, Spieltempo, Ton)
 │   ├─ GamificationProfile (XP, Münzen, Streak, Streak-Retter)
 │   └─ RefreshToken
 ├─ Group                      // geplant, nicht umgesetzt
 │   └─ GroupMembership        // geplant, nicht umgesetzt
 └─ VocabularySet              // "Unit 3 — At the zoo"
     └─ VocabularyEntry        // Lemma-Paar + Metadaten
         └─ Card               // Eine Abfragerichtung!
              └─ ReviewState   // pro Learner × Card
                   └─ ReviewLog
LearningSession
 └─ SessionItem
Achievement · CollectibleCard · DailyMission · CoinTransaction   // geplant, nicht umgesetzt
```

### 5.1 Die wichtigste Modellierungsentscheidung: `VocabularyEntry` ≠ `Card`

Ein Vokabelpaar `Hund ↔ dog` ist **nicht** eine Lernkarte, sondern zwei:

- `DE→EN`: „Hund" → erwartet `dog` (Produktion, schwer)
- `EN→DE`: „dog" → erwartet `Hund` (Rezeption, leicht)

Diese beiden Richtungen werden **unterschiedlich schnell gelernt und müssen getrennt terminiert werden.** Ein Kind erkennt „dog" längst, bevor es „Hund" aktiv produzieren kann. Wer beide Richtungen auf einen gemeinsamen Fortschrittswert abbildet, terminiert die schwierige Richtung zu selten und die leichte zu oft — und das Kind langweilt sich und scheitert gleichzeitig. Das ist der häufigste Konstruktionsfehler in selbstgebauten Vokabeltrainern.

Später kommt als dritte Kartenart `AUDIO→DE` dazu (Hören und verstehen), ohne dass das Schema sich ändert. Der Enum-Wert `AudioToSource` existiert bereits; erzeugt werden derzeit nur die beiden Textrichtungen (`VocabularyEntry.CreateDefaultCards`).

### 5.2 Kerntabellen (PostgreSQL, Auszug)

Auszug aus der Migration `20260917045557_Initial`, ergänzt um `vocabulary_picture` aus `VocabularyPictures`. Aufzählungen (Richtung, Zustand, Bewertung, Wortart) werden als Text gespeichert. `tenant_id` hat keinen Fremdschlüssel auf `tenant`; die Trennung erfolgt über den Query-Filter.

```sql
CREATE TABLE vocabulary_entry (
  id                  uuid PRIMARY KEY,
  tenant_id           uuid NOT NULL,
  set_id              uuid NOT NULL REFERENCES vocabulary_set(id) ON DELETE CASCADE,
  source_text         varchar(200) NOT NULL,   -- "Hund"
  target_text         varchar(200) NOT NULL,   -- "dog"
  target_alternatives text[] NOT NULL,         -- ["hound"] – gelten als richtig
  source_alternatives text[] NOT NULL,         -- für EN→DE: "gehen", "fahren"
  part_of_speech      varchar(20) NOT NULL,    -- Unknown | Noun | Verb | Adjective | Adverb | Phrase
  example_source      varchar(500),
  example_target      varchar(500),
  emoji               varchar(16),             -- "🐶" – für Memory-Spiel
  audio_url           varchar(500),
  position            int NOT NULL,
  created_at          timestamptz NOT NULL
);

CREATE TABLE vocabulary_picture (  -- höchstens ein Bild je Vokabel (IMG-01)
  id         uuid PRIMARY KEY REFERENCES vocabulary_entry(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL,
  version    uuid NOT NULL,                    -- neu bei jedem Speichern, steht in der Bild-URL
  data       bytea NOT NULL                    -- WebP, JPEG oder PNG, höchstens 300 KB
);
CREATE UNIQUE INDEX ix_vocabulary_picture_version ON vocabulary_picture (version);

CREATE TABLE card (
  id         uuid PRIMARY KEY,
  tenant_id  uuid NOT NULL,
  entry_id   uuid NOT NULL REFERENCES vocabulary_entry(id) ON DELETE CASCADE,
  direction  varchar(20) NOT NULL              -- SourceToTarget | TargetToSource | AudioToSource
);
CREATE UNIQUE INDEX ix_card_entry_id_direction ON card (entry_id, direction);

CREATE TABLE review_state (
  learner_id       uuid NOT NULL,              -- kein Fremdschlüssel
  card_id          uuid NOT NULL,              -- kein Fremdschlüssel
  tenant_id        uuid NOT NULL,
  ease_factor      double precision NOT NULL DEFAULT 2.5,
  interval_days    double precision NOT NULL,
  repetitions      int NOT NULL,
  lapses           int NOT NULL,
  due_at           timestamptz NOT NULL,
  first_seen_at    timestamptz NOT NULL,       -- Basis des Tagesbudgets
  last_reviewed_at timestamptz,                -- Concurrency-Token (D-10)
  last_grade       varchar(10),
  state            varchar(20) NOT NULL,       -- New|Learning|Review|Relearning|Suspended
  PRIMARY KEY (learner_id, card_id)
);
CREATE INDEX ix_review_state_learner_id_due_at ON review_state (learner_id, due_at);
CREATE INDEX ix_review_state_learner_id_state  ON review_state (learner_id, state);

CREATE TABLE review_log (          -- append-only, Basis aller Statistiken
  id                      bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tenant_id               uuid NOT NULL,
  learner_id              uuid NOT NULL,
  card_id                 uuid NOT NULL,
  session_id              uuid,
  game_key                varchar(40) NOT NULL,  -- 'classic' | 'wordcatcher' | 'memory' | 'cram'
  grade                   varchar(10) NOT NULL,  -- Again | Hard | Good | Easy
  answer_ms               int NOT NULL,
  given_answer            varchar(300),
  resulting_interval_days double precision NOT NULL,
  reviewed_at             timestamptz NOT NULL
);
```

Bilder liegen in der Datenbank und nicht im Dateisystem: Sicherung, Wiederherstellung und Update nehmen sie ohne zusätzliches Volume mit. Die Entität `VocabularyPicture` hat keine Navigation an `VocabularyEntry`, damit keine Abfrage die Bytes in Listen oder Runden mitlädt.

`review_log` ist bewusst append-only und wird nie aktualisiert. Alle Auswertungen (Ampel, Wochenreport, Problemwörter) sollen sich daraus ableiten lassen. Das erlaubt, den Lernalgorithmus später zu wechseln und den Fortschritt aus dem Log **neu zu berechnen**, statt ihn zu verlieren. (Die heutige Ampel in §9 liest `review_state`, nicht `review_log`.)

Lerndaten hängen über Fremdschlüssel mit `ON DELETE CASCADE` an Karte und Kind: `review_state`, `review_log`, `learning_session`, `session_item` und `gamification_profile` gehen mit der Karte bzw. dem Kind, `refresh_token` mit dem Konto. Der Sitzungsbezug des Protokolls (`review_log.session_id`) und der Set-Bezug einer Runde (`learning_session.set_id`) werden `SET NULL` (`FIX-02`, `PAR-03`). Verwaiste Zeilen aus Altinstallationen räumt die API beim Start vor der Migration auf (`OrphanCleanup`); danach ist der Schritt wirkungslos.

`review_state.last_reviewed_at` ist das Concurrency-Token des Lernstands (`HARD-02`): Jede Antwort schreibt den Wert, das UPDATE prüft den gelesenen. Antworten zwei Geräte gleichzeitig auf dieselbe Karte in zwei Runden, schreibt nur die erste den Lernstand fort; die zweite trifft keine Zeile mehr, und Aufgabe, Protokoll und XP werden zurückgerollt. Damit das auch bei einer Uhr greift, die denselben Wert liefert, liegt der neue Wert mindestens 1 µs über dem gelesenen (PostgreSQL speichert Mikrosekunden, `LearningService`).

---

## 6. Lernalgorithmus

### 6.1 Verfahren: SM-2 mit vereinfachter Bewertungsskala

Statt der klassischen 6-stufigen Selbsteinschätzung (die ein Kind überfordert und in einem Spiel ohnehin nicht abfragbar ist) wird auf 4 Stufen reduziert, die aus dem Spielverhalten **automatisch** abgeleitet werden:

| Grade | Bedeutung | Wie im Spiel erkannt |
|---|---|---|
| 0 `Again` | falsch | falsche Antwort oder Zeit abgelaufen |
| 1 `Hard` | richtig, aber mühsam | richtig nach Hinweis, oder Antwortzeit > 8 s, oder Tippfehler korrigiert |
| 2 `Good` | richtig | richtig in 2–8 s |
| 3 `Easy` | sofort sicher | richtig in < 2 s |

Das Kind bewertet sich nie selbst. Das ist bewusst — Selbsteinschätzung ist bei Kindern unzuverlässig und unterbricht den Spielfluss.

### 6.2 Intervallberechnung

```
grade = 0 (Again):
    repetitions = 0
    lapses     += 1
    ease_factor = max(1.3, ease_factor - 0.20)
    interval_days = 0               // Rampe beginnt von vorn, siehe unten
    state       = Relearning
    due_at      = jetzt + 10 Minuten    // Wiedervorlage in derselben Session

grade >= 1:
    ease_factor = clamp(1.3, 2.8,
                  ease_factor + (0.1 - (3 - grade) * (0.08 + (3 - grade) * 0.02)))
    repetitions += 1
    hard_factor = (grade == 1 ? 0.6 : 1.0)
    interval    = repetitions == 1 ? 1                    // 1 Tag
                : repetitions == 2 ? 3                    // 3 Tage
                : max(interval_days, 1) * ease_factor
    interval    = interval * hard_factor
    interval    = interval * random(0.95, 1.05)   // Fuzzing gegen Stapelbildung
    interval    = clamp(interval, 1, 180)         // Deckel bei 6 Monaten
    state       = Review
    due_at      = heute + interval Tage, normalisiert auf 04:00 Ortszeit
```

Das Fuzzing verhindert, dass alle 40 Vokabeln einer Unit, die am selben Tag gelernt wurden, auch exakt am selben Tag wieder fällig werden — sonst entsteht nach zwei Wochen ein Tag mit 120 fälligen Karten und das Kind gibt auf.

Das Normalisieren auf 04:00 sorgt dafür, dass „morgen" auch morgens früh schon „morgen" ist und nicht erst nach 24 Stunden. Die Zeitzone ist über `WQ_TIMEZONE` einstellbar (Default `Europe/Berlin`).

Der Dämpfungsfaktor für mühsame Antworten (`hard_factor`) greift auf allen Stufen, nicht erst ab der dritten: eine Vokabel, die beim zweiten Mal nur mit Mühe kam, in drei Tagen wiederzusehen ist zu spät.

Beim Vergessen fällt das Intervall auf **null** zurück, nicht nur die Zähler. Die Karte durchläuft anschließend wieder 1 Tag → 3 Tage → Rampe. Wer hier das alte Intervall stehen lässt, terminiert eine gerade vergessene Karte nach drei richtigen Antworten wieder auf ein halbes Jahr — und genau das macht den Unterschied zwischen „hat es gelernt" und „hat es an diesem Tag geraten".

### 6.3 Session-Zusammenstellung

Eine Quest enthält maximal 15 Items, zusammengestellt in dieser Reihenfolge:

1. Alle Karten in `Relearning` mit `due_at <= now` (Fehler, auch aus früheren Sessions), bei gewähltem Set nur aus diesem Set
2. Fällige `Review`-Karten, älteste `due_at` zuerst — **maximal 10**, bei gewähltem Set nur aus diesem Set
3. Auffüllen mit `New`-Karten aus dem aktiven Set (Rezeptionsrichtung EN→DE zuerst) — **maximal 5 neue pro Tag und Lernendem**

Zusätzlich wird eine falsch beantwortete Karte sofort als Wiederholungs-Item an die laufende Session angehängt.

**Wann eine neue Karte zählt.** Neue Karten zählen für das Tageslimit erst mit der ersten Antwort. Der Start einer Runde legt keinen Lernstand an; die erste Antwort legt ihn an und setzt `first_seen_at` auf den Antwortzeitpunkt. Eine gezeigte, nicht beantwortete Karte kommt deshalb in der nächsten Runde wieder, und ein Abbruch kostet kein Tageslimit (`FIX-03`, `FIX-09`). Rundenstart und Übersicht (`newRemainingToday`) zählen dieselbe Menge: beantwortete Lernstände mit `first_seen_at` ab Beginn des lokalen Tages.

Der Rundenstart rechnet zusätzlich neue Karten mit, die unbeantwortet in einer offenen Runde desselben Kindes liegen, die vor höchstens 30 Minuten gestartet wurde. Je Karte zählt das einmal, auch wenn sie in zwei Runden liegt; eine Karte mit einer Antwort (auch im Klassenarbeit-Modus) zählt nicht als reserviert. Für weitere neue Karten bleibt nur der Rest des Tageslimits. Mehrere offene Runden bieten so zusammen nicht mehr neue Wörter an, als das Limit erlaubt. Reservierte Karten aus dem gewählten Umfang kommen in der nächsten Runde ohne weiteres Budget wieder, solange heute noch neue Karten erlaubt sind und die Rückstandsbremse nicht greift; sie sind in ihrer offenen Runde ohnehin beantwortbar. Eine abgeschlossene Runde reserviert nichts. Eine per „Schließen“ verlassene Runde bleibt offen und blockiert das Budget höchstens 30 Minuten. Die Übersicht zählt weiter nur Antworten.

Bewusste Grenzen:

- Ansehen ohne Antwort kostet weiter nichts. Ohne Antwort kommen dieselben neuen Karten immer wieder. Über den Rest des Tageslimits hinaus deckt ein Kind ohne Antwort neue Karten aus einem anderen Set erst auf, wenn seine Runden abgeschlossen oder vor mehr als 30 Minuten gestartet sind.
- Zwei Starts in derselben Sekunde sehen die Reservierung des anderen nicht und bieten beide das volle Budget an.
- Wird eine Runde erst nach mehr als 30 Minuten beantwortet und ist inzwischen eine zweite gestartet, kann das Kind über dem Limit landen.
- Eine Antwort auf ein neues Wort über dem Limit wird nie abgelehnt; eine Antwort zählt immer.

Die Deckelung bei 5 neuen Karten pro Tag ist der wichtigste Parameter des ganzen Systems. Wer 40 neue Vokabeln an einem Abend einspeist, erzeugt in den Folgetagen eine Wiederholungslawine, die das Kind sicher zum Abbruch bringt. Der Wert ist pro Lernendem konfigurierbar (`daily_new_limit`, Default 5, Bereich 3–15) und wird im Eltern-Dashboard erklärt, nicht nur als Zahl angeboten.

**Rückstandsbremse.** Das Tagesbudget allein genügt nicht. Es begrenzt den Zufluss, aber nicht das Verhältnis von Zufluss zu Abfluss: Wer nur eine Einheit am Tag schafft, bekommt trotzdem jeden Tag fünf neue Wörter dazu, und der Berg fälliger Wiederholungen wächst über Monate. Deshalb gilt zusätzlich:

> Neue Karten werden nur eingeführt, solange der Rückstand an fälligen Karten in **eine Session** passt (≤ 15).

Die Bremse zählt alle fälligen Karten des Kindes, auch wenn ein Set gewählt ist. Wer in einem Set hinterherhängt, bekommt auch in einem anderen keine neuen Wörter.

Das ist keine Feinabstimmung, sondern die Bedingung dafür, dass das System überhaupt funktioniert. Eine Simulation über ein Schuljahr (600 Karten, realistisches Antwortverhalten) zeigte den Unterschied:

| Einheiten/Tag | | Spitzenlast | Rückstand am Ende | Median-Intervall |
|---|---|---|---|---|
| 1 | ohne Bremse | 159 | 135 | 8 Tage |
| 1 | **mit Bremse** | **37** | **21** | **40 Tage** |
| 2 | ohne Bremse | 328 | 293 | 7 Tage |
| 2 | **mit Bremse** | **46** | **29** | **51 Tage** |
| 4 | ohne Bremse | 278 | 143 | 47 Tage |
| 4 | **mit Bremse** | **74** | **49** | **54 Tage** |

Die Tabellenwerte stammen aus einem einmaligen Simulationslauf und werden vom Repository nicht ausgegeben. Der Test `YearLongSimulationTests` prüft für 1, 2 und 4 Einheiten pro Tag nur Schwellen (u. a. Spitzenlast < 120, Median-Intervall > 20 Tage, ohne Bremse mehr als doppelte Spitzenlast).

Die aussagekräftigste Spalte ist die letzte. Ohne Bremse bleibt das Median-Intervall bei sieben bis acht Tagen — das heißt: Nach einem Jahr Lernen ist keine einzige Vokabel wirklich gefestigt, weil jede zu spät drankommt und deshalb wieder vergessen wird. Das Kind arbeitet täglich und kommt nicht voran. Mit Bremse lernt es weniger Wörter (rund 280 statt 535 bei zwei Einheiten täglich), aber die sitzen.

Das ist die pädagogisch richtige Abwägung: Lieber 280 Wörter, die halten, als 535, die nicht halten.

**Klassenarbeit-Modus (Idee):** Vor einer Vokabelarbeit gibt es einen Extramodus, der die Terminierung ignoriert und gezielt alle Karten eines Sets nach Schwierigkeit übt. Diese Durchläufe werden mit `game_key='cram'` geloggt und beeinflussen `review_state` **nicht** — sonst zerstört das Pauken vor der Arbeit die langfristige Terminierung. Im Backend ist `cram` im `GameCatalog` bereits so definiert (ändert die Terminierung nicht); das Frontend bietet den Modus nicht an.

### 6.4 Antwortbewertung

Serverseitig, nicht im Client (der Client kennt die Antwort nicht — sonst ist sie im Netzwerk-Tab ablesbar).

```
1. Normalisieren: trim, Mehrfachleerzeichen, Kleinschreibung,
   Unicode NFKC, typografische Apostrophe → ', Anführungszeichen und
   Striche vereinheitlicht, abschließende ".", "!" und "?" entfernt
2. Artikel/Partikel optional: führendes "to " (to go),
   "a "/"an "/"the " sowie deutsche Artikel ("der/die/das/den/dem/des",
   "ein/eine/…") und "sich "/"zu " werden entfernt
3. Exakter Vergleich gegen die erwartete Antwort und alle Alternativen
   (auch mit ",", ";", "/", "|" getrennte Varianten) → Easy/Good/Hard nach Zeit
4. Damerau-Levenshtein-Distanz ≤ 1 bei erwarteter Antwort ≥ 5 Zeichen ohne den
   Artikel aus Schritt 2 ("the dog" zählt wie "dog"), bzw. = 0 bei kürzeren → als richtig werten, aber Grade auf Hard deckeln und Hinweis zeigen:
     "Richtig — achte auf die Schreibweise: beautiful"
5. Sonst falsch.
```

Der Tippfehler-Fall ist wichtig: Ein Kind, das `becuase` tippt, kennt die Vokabel — es tippt nur auf einem Tablet. Es hier als „falsch" zu werten, verletzt Leitplanke 2 und verfälscht zusätzlich die Terminierung.

**Damerau, nicht Levenshtein** — und zwar wegen genau dieses Beispiels. Der häufigste Tippfehler auf einer Tastatur ist der Dreher zweier benachbarter Buchstaben. Die einfache Levenshtein-Distanz bewertet `becuase` ↔ `because` als **zwei** Operationen und würde die Antwort verwerfen; Damerau zählt den Dreher als eine. Der Unterschied betrifft ausgerechnet den Fall, für den die Toleranz gedacht war.

---

## 7. Spielmodule und Plugin-Architektur

### 7.1 Trennung Lernlogik / Spiel

Das zentrale Architekturprinzip: **Spiele kennen keine Lernlogik.** Ein Spiel bekommt fertige Aufgaben geliefert und meldet Ergebnisse zurück. Es weiß nichts über Intervalle, Ease-Faktoren oder Fälligkeiten.

```
POST /api/v1/sessions              → Session mit N Items
  Request:  { learnerId, setId?, gameKey?, size? }
  Response-Item: {
    itemId, cardId, prompt, promptType: "text"|"audio",
    expectedAnswerType: "choice"|"text",
    choices?: [...],               // vom Server erzeugte Distraktoren (nicht bei "classic")
    emoji?, pictureVersion?,       // nur die Version des Bildes; die Bytes kommen über GET /pictures/{version}
    exampleSentence?, isRetry
  }

POST /api/v1/sessions/{id}/answers → Ergebnis
  Request: { itemId, givenAnswer, answerMs, clientAnswerId?, hintUsed }
  Response: { correct, grade, correctAnswer, message, hadTypo,
              xpAwarded, coinsAwarded, retryItem? }
```

Der Spielschlüssel wird beim Start der Session festgelegt, nicht pro Antwort. Ein neues Spiel zu bauen bedeutet damit: eine React-Komponente schreiben, die diese beiden Verträge bedient, plus ein Eintrag im serverseitigen `GameCatalog` (XP-Gewicht, maximale Bewertung, ob die Terminierung beeinflusst wird). Ein unbekannter Schlüssel fällt auf `classic` zurück. Keine Änderung an der Lernengine.

**Distraktoren** (falsche Antwortoptionen) erzeugt der Server, nicht das Spiel — und zwar bevorzugt aus demselben Set und derselben Wortart. „Apfel" gegen `apple / orange / banana / pear` ist eine echte Übung; „Apfel" gegen `apple / school / running / because` ist geraten. Fallback auf die übrigen Wörter desselben Sets, wenn zu wenig gleichartige vorhanden sind. Der Vorrat (höchstens 40 Wörter je Abfrage) wird zufällig aus dem ganzen Set gezogen, damit in großen Sets jedes Wort als falsche Option vorkommen kann. Es gibt höchstens vier Optionen.

### 7.2 Spielkatalog

| Key | Spiel | Antworttyp | Grade-Ableitung | Stand |
|---|---|---|---|---|
| `classic` | **Karteikarte** — Wort mit Bild der Vokabel (sonst Emoji), umdrehen, tippen | text | Zeit + Damerau-Levenshtein | umgesetzt |
| `wordcatcher` | **Wort-Fänger** — Wörter fallen, richtiges antippen | choice | Zeit bis Treffer | nur Backend (`GameCatalog`); Frontend v2 (`LRN2-01`) |
| `memory` | **Memory** — Emoji/Bild ↔ Wort | match | Anzahl Fehlversuche | nur Backend (`GameCatalog`); Frontend v2 (`LRN2-01`) |
| `monsterduel` | **Monster-Duell** — richtige Antwort = Schaden | choice/text/order | gemischt | Idee |
| `letterchaos` | **Buchstaben-Chaos** — Buchstaben sortieren | order | Anzahl Umsortierungen | Idee |
| `timerace` | **Rennen gegen die Zeit** — 60 s, so viele wie möglich | choice | reine Geschwindigkeit | Idee |

Die Antworttypen `match` und `order` liefert der Server heute nicht; er kennt nur `text` und `choice`.

**Anmerkung zu Wort-Fänger:** Fallende Objekte plus Zeitdruck erzeugen bei manchen Kindern Stress statt Spaß. Die Fallgeschwindigkeit ist deshalb konfigurierbar (`speed: relaxed|normal|fast`, gespeichert im Lernprofil) und startet auf `relaxed`. Wenn die Zeit abläuft, gilt das als `Again` — nicht als Niederlage, das Wort fällt einfach langsam nochmal.

**Anmerkung zu Memory:** Memory trainiert primär visuelles Gedächtnis, nicht Vokabelabruf. Es zählt daher nur mit halbem XP-Gewicht und liefert maximal Grade `Good`, nie `Easy`. Es ist ein Belohnungsspiel, kein Prüfspiel — das ist in Ordnung, solange es die Terminierung nicht verzerrt.

### 7.3 Registrierung

**Verworfen / zurückgestellt:** Eine Frontend-Registry `frontend/src/games/registry.ts` existiert nicht und ist für v1.0 nicht geplant. `frontend/src/features/learn/SessionPage.tsx` rendert die Session direkt und startet sie immer mit `gameKey: 'classic'`. Die serverseitigen Spieleigenschaften stehen im `GameCatalog` (`backend/src/WordQuest.Modules.Learning/Services/GameCatalog.cs`, abrufbar über `GET /api/v1/sessions/games`).

Ursprünglicher Entwurf, falls mit neuen Spielmodi (v2) eine Registry nötig wird:

```ts
// frontend/src/games/registry.ts  (nicht umgesetzt)
export interface GameModule {
  key: string;
  title: string;
  icon: string;
  supports: AnswerType[];        // welche expectedAnswerType es rendern kann
  minItems: number;
  xpWeight: number;              // 1.0 = voll, 0.5 = Memory
  maxGrade?: Grade;
  Component: React.FC<GameProps>;
}
```

---

## 8. Gamification — konkrete Zahlen

Gamification scheitert meist nicht am Konzept, sondern an unausbalancierten Zahlen. Deshalb hier festgelegt:

**XP**

```
korrekte Antwort               10 XP × gameXpWeight
Antwort in < 2 s (Easy)        +5 XP (ebenfalls × gameXpWeight)
Session abgeschlossen          +25 XP
alle Items korrekt             +50 XP
Tagesmission erfüllt           +100 XP   // Konstante vorhanden, Missionen nicht umgesetzt
```

Falsche Antworten kosten **0 XP** (Leitplanke 2). Eine typische Session gibt 150–250 XP.

**Level 1–100**, kumulative Schwelle: `XP(n) = 70 · n²`

| Level | Kumulative XP | ≈ Sessions (à 200 XP) | ≈ Kalenderzeit bei 1 Session/Tag |
|---|---|---|---|
| 2 | 280 | 1–2 | erster Abend |
| 5 | 1 750 | 9 | gut 1 Woche |
| 10 | 7 000 | 35 | gut 1 Monat |
| 25 | 43 750 | 220 | ca. 7 Monate |
| 50 | 175 000 | 875 | ca. 2,5 Jahre |
| 100 | 700 000 | 3 500 | nicht erreichbar, bewusst |

Level 2 fällt bewusst noch in den ersten Abend — der erste Levelaufstieg muss passieren, bevor das Kind entscheidet, ob es die App nochmal öffnet.

Level 100 ist absichtlich unerreichbar — ein erreichtes Maximum beendet die Motivation. Sichtbarer Fortschritt kommt aus Sammlung und Welten, nicht aus dem Levelbalken allein.

**Münzen:** 1 Münze pro korrekter Antwort, 20 pro abgeschlossener Session. Ausgabe für Avatar-Items (50–300) und Schatzkisten (100) — **geplant, nicht umgesetzt**; Münzen werden derzeit nur gesammelt.

**Streaks:** Zählt ein Tag mit ≥ 1 abgeschlossener Session. **Zwei „Streak-Retter" pro Monat** kompensieren automatisch genau einen verpassten Tag — ohne Rückfrage, ohne Kaufmöglichkeit. Ein an Tag 40 gerissener Streak ist ein realer Abbruchgrund, und ein krankes oder verreistes Kind hat den Ausfall nicht verschuldet. Kein Streak-Zähler auf dem Startbildschirm vor Tag 3 — **geplant, nicht umgesetzt**: `LearnHomePage.tsx` zeigt den Zähler immer. Angezeigt wird die aktuelle Serie (`StreakRules.CurrentStreak`, `FIX-05`): Nach einer Pause ohne verfügbaren Retter ist sie 0, die Startseite zeigt dann „Starte heute deine Serie!“, die Eltern-Ansicht „Keine laufende Serie“. Die Übersicht berechnet sie beim Lesen aus dem letzten aktiven Tag (Ortszeit) und ändert nichts; gespeichert wird die Serie nur beim Abschluss einer Runde.

**Sammelkarten (geplant, nicht umgesetzt):** Eine Karte je 20 **neu gefestigter** Vokabeln — nicht je 20 beantworteter Vokabeln, sonst lässt sich die Sammlung durch stumpfes Wiederholen derselben leichten Wörter farmen. „Gefestigt" folgt derselben Regel wie die grüne Ampel in §9 (`repetitions ≥ 3 && ease ≥ 2.1 && lapses ≤ 1`). Serien zu je 12 Karten (Tiere, Drachen, Ritter, Fahrzeuge), Raritäten 70 / 25 / 5 %. **Keine lizenzierten Inhalte** (im Ursprungskonzept standen Fußballstars) — Bildrechte an realen Personen sind für ein Open-Source-Projekt nicht handhabbar. Im Code existiert nur der Zähler `GamificationProfile.MasteredSinceLastCard`, er wird nicht fortgeschrieben.

**Tagesmissionen (geplant, nicht umgesetzt):** Drei pro Tag, aus einem Pool gezogen, alle mit dem Kenntnisstand des Kindes erfüllbar (keine Mission „gewinne 2 Monsterkämpfe", wenn Monster-Duell noch gesperrt ist).

---

## 9. Eltern-Dashboard

Ampeleinstufung pro Vokabel (`VocabularyEntry`, aggregiert über beide Richtungen, `GET /learners/{id}/traffic-light`):

| Ampel | Kriterium |
|---|---|
| 🟢 sicher | beide Karten `repetitions ≥ 3` und `ease ≥ 2.1` und `lapses ≤ 1` |
| 🟡 unsicher | mindestens eine Karte schon beantwortet, aber weder 🟢 noch 🔴 erfüllt |
| 🔴 schwierig | `lapses ≥ 3` oder `ease < 1.8` (bei einer der beiden Karten) |
| ⚪ neu | noch nie beantwortet |

Die Regel samt Ampelschwellen steht einmal in `MasteryRules` (Learning-Modul, `FIX-06`); die Wortzählung (`WordProgressAsync`) und die Zählung von fälligen Karten und Tagesbudget stehen einmal im `LearningService`, Rundenstart, Ampel und Übersicht benutzen sie. Die Übersicht zählt sicher gelernte Wörter, also genau die Wörter mit grüner Ampel, und alle Wörter der Familie. Die Felder `cardsMastered`/`cardsTotal` behalten ihren Namen und zählen Wörter.

Umgesetzt sind die Übersicht (`GET /learners/{id}/overview`: Level, XP, Münzen, Streak, heute fällig, neue Karten übrig, sicher gelernte Wörter) und die Ampel je Set. **Geplant, nicht umgesetzt** (v2, `PAR2-03`): Wochenübersicht (Minuten pro Tag, Antworten, Trefferquote) · Top-10-Problemwörter mit Fehlversuchen.

**Was das Dashboard bewusst nicht zeigt:** keine Vergleiche mit anderen Kindern, keine Prognosen („wird die Arbeit nicht bestehen"), keine Minuten-Genauigkeit der Nutzungszeiten. Das Dashboard soll einem Elternteil zeigen, wo es helfen kann — es ist kein Überwachungswerkzeug. Das Kind sieht in seinem Profil, dass Eltern den Fortschritt sehen können; heimliche Überwachung ist ausgeschlossen.

---

## 10. Systemarchitektur

### 10.1 C4 — Container

Das Bild zeigt den einzigen Betriebsweg, das Heimnetz über HTTPS mit eigener Zertifizierungsstelle: `docker-compose.quick.yml` liefert `web` auf den Ports 80 und 443 aus (belegt: 8080 und 8443), liest DB-Passwort und JWT-Schlüssel aus Dateien in `./secrets` und wird mit `./setup.sh` eingerichtet (`SETUP-01`, `SETUP-02`, `TLS-01`, `TLS-02`).

```
┌──────────────────── Docker-Host (NAS / Mini-PC / Raspberry Pi 5) ────────────────┐
│                                                                                  │
│   Browser (Tablet, Handy, Laptop im LAN)                                         │
│         │                                                                        │
│         │ :443 HTTPS (:80 HTTP, CA-Download)                                     │
│         ▼                                                                        │
│  ┌──────────────┐  /api   ┌──────────────────┐     ┌────────────┐                │
│  │ web          │────────►│  api             │────►│ postgres   │                │
│  │ nginx + PWA  │         │ ASP.NET Core 10  │     │  17        │                │
│  └──────────────┘         │                  │     └────────────┘                │
│         ▲ liest           │  ┌────────────┐  │     ┌────────────┐                │
│  ┌──────┴───────┐         │  │ Learning   │  │     │ backup     │ (pg_dump,      │
│  │ Volume tls   │         │  │ Gamif.     │  │     └────────────┘  täglich)      │
│  └──────▲───────┘         │  │ Content    │  │                                   │
│         │ schreibt        │  │ Identity   │  │                                   │
│  ┌──────┴───────┐         │  └────────────┘  │                                   │
│  │ certs        │         └──────────────────┘                                   │
│  │ ohne Netz    │──► Volume tls-ca (CA-Schlüssel, nur certs)                     │
│  └──────────────┘                                                                │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Der Browser spricht nur mit `web` (Ports 80 und 443, änderbar über `WQ_HTTP_PORT` und `WQ_HTTPS_PORT`); nginx im `web`-Container reicht `/api/` und `/health/` an `api` weiter (`frontend/nginx.conf`). Der Dienst `certs` (API-Image, `tls watch`, ohne Netz, als `0:101`) ist der einzige Schreiber der Zertifikate: Er legt die CA im Volume `tls-ca` an und schreibt `server.pem` und `wordquest-ca.crt` ins Volume `tls`; `web` bindet nur `tls` schreibgeschützt unter `/etc/nginx/tls` ein und liest das Zertifikat bei jedem Handshake neu, eine Erneuerung braucht deshalb keinen nginx-Neustart. Der `backup`-Container verbindet sich mit `postgres`, nicht mit `api`. Aufbewahrung: 14 Tage, 8 Wochen, 6 Monate; `setup.sh` legt `./backups` mit `0700` an (`SETUP-01`). Ein optionaler Log-Container (seq) ist nicht vorhanden.

Kein Redis, kein Message Broker, kein separater Auth-Server im MVP. Für eine Familie mit drei Kindern ist das Over-Engineering, und jeder zusätzliche Container ist ein Ding, das der Betreiber (die Eltern) warten muss. Bei Schulbetrieb kämen Redis (Session-Cache) und ein Worker-Container dazu — die API hält keinen Zustand im Speicher außer dem Rate Limiter; Schulen sind für v1.0 außer Scope.

### 10.2 Backend-Struktur — Modularer Monolith

```
backend/src/
  WordQuest.Api/               // Minimal APIs, Endpoint-Definitionen, Auth, DI-Root
  WordQuest.Modules.Identity/  // Nutzer, Rollen, PIN, Token
  WordQuest.Modules.Content/   // Sets, Einträge, Karten, CSV-Import
  WordQuest.Modules.Learning/  // SM-2, Session-Assembly, Bewertung   ◄ Kern
  WordQuest.Modules.Gamification/
  WordQuest.Shared.Kernel/     // ITenantContext, ITenantOwned, Grade
  WordQuest.Infrastructure/    // EF Core, Migrationen, LearningService, Demo-Seed
backend/tests/
  WordQuest.Learning.Tests/    // ◄ höchste Testabdeckung, siehe unten
```

**Verworfen / zurückgestellt:** Ein Modul `WordQuest.Modules.Reporting` gibt es nicht; die Auswertungen rechnet der `LearningService`, `LearnerEndpoints.cs` ruft sie nur auf. `Result<T>`, In-Process-Domain-Events (z. B. `CardReviewed`) und Repositories gibt es ebenfalls nicht und sie sind nicht geplant.

**Architekturhaltung: DDD-light.** Die Module sind grobe Bounded Contexts. Sie enthalten Entitäten und reine Domänendienste ohne EF- oder HTTP-Abhängigkeit (`Sm2Scheduler`, `SessionComposer`, `AnswerEvaluator`, `XpRules`, `StreakRules`, `LevelCurve`). Einzige Modulabhängigkeit: `Learning` → `Content`. Aggregates, Domain-Events und Repositories werden bewusst nicht eingeführt; volles DDD ist nicht geplant. Die Orchestrierung einer Session (Auswahl, Bewertung, Terminierung, Protokoll, Belohnung) liegt im `LearningService` in `WordQuest.Infrastructure`, der die Gamification-Regeln direkt aufruft. Endpunkte bleiben dünn; nicht triviale Logik gehört in Module oder Services.

**Testfokus:** `WordQuest.Modules.Learning` ist der einzige Teil, in dem ein Fehler *unsichtbar* schadet — ein falsch berechnetes Intervall merkt niemand, aber das Kind lernt schlechter. Dieser Teil bekommt Unit-Tests (Ziel: Abdeckung > 90 %; in CI wird keine Abdeckung gemessen), inklusive eines Simulationstests, der 365 Tage Lernverhalten mit einem synthetischen Lernenden durchspielt und prüft, dass die tägliche Kartenlast nicht explodiert (`YearLongSimulationTests`). UI und CRUD brauchen diese Tiefe nicht. API-Integrationstests gegen echtes PostgreSQL (`WordQuest.Api.Tests`, `WebApplicationFactory`) decken Anmeldung, Refresh, die Trennung zwischen Geschwistern und jede FIX-Anforderung ab (`QUAL-01`); die CI führt sie gegen PostgreSQL 17 aus (`.github/workflows/ci.yml`).

**Testvorgehen:** Neue Funktionen entstehen testgetrieben (TDD). Ein Bugfix beginnt mit einem Test, der den Fehler reproduziert und zunächst fehlschlägt.

### 10.3 Architekturentscheidungen (ADRs)

**ADR-001 — Modularer Monolith statt Microservices.** Ein Deployment-Artefakt, eine Datenbank, eine Transaktion. Bei erwarteten 1–30 gleichzeitigen Nutzern pro Instanz ist jede Servicegrenze reine Kosten. Modulgrenzen im Code halten die Option offen. Innerhalb der Module gilt DDD-light (→ §10.2).

**ADR-002 — React/TypeScript PWA statt Flutter.** Entscheidend ist Selbsthostbarkeit: Eine PWA wird über eine URL aufgerufen und per „Zum Homescreen" installiert. Eine Flutter-App müsste signiert, verteilt und aktualisiert werden — bei iOS faktisch nur über den App Store oder TestFlight, was dem Selfhosting-Ziel widerspricht. Die PWA ist außerdem konsistent mit der bestehenden Doku. Preis: etwas geringere Animationsperformance und keine echte Push-Notification auf iOS. Beides ist für den Anwendungsfall verschmerzbar. Die Installation als PWA setzt HTTPS mit einem vertrauten Zertifikat voraus; im Heimnetz heißt das: Die eigene Zertifizierungsstelle (→ ADR-008) ist auf dem Gerät installiert, sonst läuft die App als normale Browser-App.

**ADR-003 — ASP.NET Core 10 (LTS) statt Node.** Folgt der bestehenden Doku und dem beruflichen Umfeld des Maintainers. Zielframework ist `net10.0`: .NET 8 und 9 erreichen am 10.11.2026 ihr End of Support, .NET 10 läuft bis November 2028. EF Core und Minimal APIs decken den Bedarf ab. ASP.NET Core Identity wird nicht verwendet; Passwort-Hashing (PBKDF2) und JWT-Ausgabe sind im Projekt selbst implementiert. Ziel für die Imagegröße: unter 120 MB (nicht gemessen). Gegenargument (ein TypeScript-Sprachraum für Frontend und Backend) ist real, wiegt aber Vertrautheit mit der Plattform nicht auf.

**ADR-004 — PostgreSQL, kein SQLite.** SQLite wäre für eine Einzelfamilie ausreichend und einfacher zu sichern. Aber: gleichzeitige Schreibzugriffe von drei Kindern auf Tablets, und der spätere Schulpfad wäre versperrt. Postgres im Compose-Stack kostet ~150 MB RAM. Akzeptabel.

**ADR-005 — Keine KI im MVP.** Jede KI-Funktion (OCR, Aussprachebewertung, Satzgenerierung) bringt entweder Cloud-Abhängigkeit mit Kinderdaten oder erhebliche lokale Hardwareanforderungen. Der Nutzen für das Kernproblem („das Kind behält Vokabeln nicht") ist gegenüber einer korrekt implementierten Spaced-Repetition-Engine gering. Provider-Interfaces (→ §11) sind vorgesehen, aber noch nicht im Code definiert.

**ADR-006 — Antwortbewertung serverseitig.** Kostet eine Netzwerk-Roundtrip pro Antwort (offline: lokale Vorabbewertung mit serverseitiger Korrektur beim Sync — **geplant, nicht umgesetzt**, v2), verhindert aber, dass die Lösung im Client liegt. Bei einem Spiel mit Belohnungen ist das relevant — Kinder finden solche Lücken.

**ADR-007 — Keine Variante mit Domain und Let's Encrypt.** Kontext: Bis 1.0.1 gab es neben dem Heimnetz über HTTP eine Variante mit eigener Domain, Traefik und Let's-Encrypt-Zertifikat per DNS-Challenge. Sie verlangt eine Domain, ein Token beim DNS-Anbieter und einen lokalen DNS-Eintrag; das ist für Eltern ohne Vorwissen nicht machbar. Entscheidung (Owner, 2026-10-25): Die Variante ist entfernt. HTTPS im Heimnetz kommt stattdessen mit einer eigenen Zertifizierungsstelle je Installation (Quick 261025-fpi). Folgen: eine Betriebsdatei (`docker-compose.quick.yml`), ein Paket mit fünf Dateien, geändert ohne Übergangsversion; Installationen von 1.0.x werden nicht migriert, sondern neu installiert; `OPS2-01` ist Out of Scope.

**ADR-008 — HTTPS mit eigener Zertifizierungsstelle je Installation.** Kontext: Eltern ohne Vorwissen sollen WordQuest im Heimnetz ohne Domain und ohne Internetzugang für Zertifikate betreiben; eine PWA und der Service Worker brauchen aber HTTPS mit einem vertrauten Zertifikat. iOS und macOS vertrauen einem Server-Zertifikat nur mit RSA ab 2048 Bit, höchstens 825 Tagen Laufzeit, den Namen im Subject Alternative Name und Extended Key Usage `serverAuth` ([support.apple.com/103769](https://support.apple.com/103769)). Entscheidung (Owner, 2026-10-25): Jede Installation legt ihre eigene CA an. Der Dienst `certs` im API-Image (`tls watch`, nur BCL, ohne Netz) ist der einzige Schreiber: CA mit RSA 3072 und 10 Jahren, Server-Zertifikat mit RSA 2048 und 800 Tagen für die Namen aus `WQ_TLS_NAMES` (Kurzname, `.local`, `.fritz.box`, IPv4-Adressen, `localhost`, `127.0.0.1`), die `setup.sh` bei jedem Lauf in `.env` schreibt. `certs` stellt ein neues Server-Zertifikat derselben CA aus, wenn weniger als 30 Tage übrig sind oder sich die Namensliste geändert hat; eine Namensänderung wirkt ab dem nächsten `./setup.sh`. Jeder unklare CA-Zustand stoppt `certs`, ohne etwas zu ändern; der Ausweg (beide Volumes löschen, `./setup.sh`) steht in der Installationsanleitung. Die CA liegt nicht in den Sicherungen; nach einem Umzug entsteht eine neue. Die CA trägt keine Name Constraints, weil die Unterstützung auf den Plattformen der Familie nicht sicher ist. Restrisiko: Wer den CA-Schlüssel vom WordQuest-Gerät stiehlt, kann sich auf Geräten mit installierter CA als beliebige Seite ausgeben; die Anleitung empfiehlt deshalb, die CA nur auf den Geräten der Familie zu installieren. Folgen: Bis die CA auf einem Gerät installiert ist, warnt der Browser; der Fingerabdruck (am Ende von `setup.sh` und per `tls show`) ist der Prüfweg. Der Service Worker und die PWA-Installation gibt es nur mit vertrauter CA. Kein HSTS (→ §15).

---

## 11. Erweiterungspunkte für KI (geplant, nicht umgesetzt)

**Stand:** Keines der Interfaces existiert im Code, und KI ist für v1.0 nicht geplant. Die Compose-Dateien setzen zwar `WQ_AI_PROVIDER: none`, die API liest die Variable aber nicht aus.

Zielbild: Vier Interfaces werden definiert und mit einer No-Op-Implementierung registriert. Features, deren Provider fehlt, werden im UI gar nicht erst angezeigt.

```csharp
public interface IVocabularyOcrProvider {              // Foto des Vokabelhefts
    Task<IReadOnlyList<ExtractedPair>> ExtractAsync(Stream image, CancellationToken ct);
}
public interface IPronunciationScorer {                // Aussprachebewertung
    Task<PronunciationScore> ScoreAsync(Stream audio, string expected, CancellationToken ct);
}
public interface ISentenceGenerator {                  // Beispielsätze
    Task<IReadOnlyList<string>> GenerateAsync(VocabularyEntry e, int count, CancellationToken ct);
}
public interface ILearningCoach {                      // Wochenreport
    Task<CoachReport> BuildAsync(Guid learnerId, DateRange range, CancellationToken ct);
}
```

Konfiguration über `WQ_AI_PROVIDER = none | ollama | openai`. Bei `ollama` zeigt die Doku, wie ein Ollama-Container in dasselbe Compose-Netz gehängt wird.

**Realistische Einschätzung zur Aussprachebewertung:** Das ist die aufwendigste der vier Funktionen. Whisper liefert Transkription, aber keine brauchbare Aussprachebewertung — dafür braucht es Forced Alignment (z. B. mit `wav2vec2` oder Montreal Forced Aligner) und phonemweise Konfidenzwerte. Ein simpler Ansatz „Whisper transkribiert, Text vergleichen" ist bei einem Kind mit deutschem Akzent unbrauchbar streng oder unbrauchbar nachsichtig. Falls diese Funktion wichtig wird, ist die Azure-Speech-API mit `PronunciationAssessment` der realistische Weg — mit der bekannten Datenschutzabwägung.

**Realistische Einschätzung zu OCR:** Deutlich einfacher und mit dem besten Nutzen-pro-Aufwand-Verhältnis der vier. Ein Vokabelheft mit zwei sauberen Spalten lässt sich mit Tesseract lokal und kostenlos brauchbar auslesen, wenn das UI anschließend eine Korrekturansicht zeigt, statt blind zu importieren. Das ist der erste Kandidat, falls KI-Funktionen kommen (Idee).

---

## 12. API (Auszug)

REST, `/api/v1`, JSON, JWT im `Authorization`-Header. Ein OpenAPI-Dokument wird nur in der Development-Umgebung erzeugt.

```
GET    /auth/profiles                   Profilkacheln der Kinder (ohne Anmeldung)
POST   /auth/login                      E-Mail + Passwort → Access + Refresh
POST   /auth/learner-login              learnerId + PIN   → Access + Refresh
POST   /auth/refresh
POST   /auth/logout

POST   /account/password                currentPassword, newPassword → 204 (Elternkonto)

GET    /learners                        Kinder des Mandanten
POST   /learners                        displayName, pin (Pflicht, genau 4 Ziffern), dailyNewLimit? (3–15, Standard 5), avatarKey? (höchstens 50 Zeichen)
PATCH  /learners/{id}/settings          displayName?, dailyNewLimit?, speed?, soundEnabled?, pin? (genau 4 Ziffern, leer = unverändert; Pflicht, solange das Kind keine PIN hat)
DELETE /learners/{id}                   löscht das Kind samt Lernstand, XP, Serie und Anmeldungen; 404 für fremde oder unbekannte Kinder
GET    /learners/{id}/overview          Level, XP, Streak, fällig, gefestigt
GET    /learners/{id}/traffic-light?setId=   404 für fremde oder unbekannte Kinder

GET    /sets
POST   /sets                            title (Pflicht, höchstens 200 Zeichen); description höchstens 2000, sourceLanguage/targetLanguage höchstens 5 Zeichen
PATCH  /sets/{id}                       title: benennt das Set um, IDs und Lernstand bleiben; Titel Pflicht, höchstens 200 Zeichen; 404 für fremde oder unbekannte Sets
DELETE /sets/{id}                       löscht Vokabeln und Lernstand aller Kinder dazu, Sitzungsprotokolle bleiben ohne Set-Bezug; 404 für fremde oder unbekannte Sets
GET    /sets/{id}/entries
POST   /sets/{id}/entries               sourceText, targetText (je Pflicht, höchstens 200 Zeichen); emoji höchstens 16, exampleSource/exampleTarget höchstens 500 Zeichen; 404 für fremde oder unbekannte Sets
PUT    /sets/{id}/entries/{entryId}     korrigiert Deutsch und Englisch, IDs und Lernstand bleiben; je Wort Pflicht, höchstens 200 Zeichen; 404 für fremde oder unbekannte Vokabeln
DELETE /sets/{id}/entries/{entryId}     löscht den Lernstand aller Kinder zu dieser Vokabel; 404 für fremde oder unbekannte Vokabeln
PUT    /sets/{id}/entries/{entryId}/picture   roher Body (kein Formular), nur Elternkonten; Signatur und Struktur WebP/JPEG/PNG, sonst 400; leer 400; über 300 KB 413; fremde oder unbekannte Vokabel 404; gleichzeitiger erster Upload 409; ersetzt ein vorhandenes Bild → { pictureVersion }
DELETE /sets/{id}/entries/{entryId}/picture   nur Elternkonten; 204, auch ohne Bild; fremde oder unbekannte Vokabel 404
GET    /pictures/{version}              jede Rolle der Familie; Content-Type aus den Bytes, Cache-Control: no-store; 404 für fremde oder ersetzte Versionen
POST   /sets/import/preview             CSV-Text als JSON → Vorschau; Zeilen über den Grenzen von /entries (Wort 200, Emoji 16) sind Problemzeilen
POST   /sets/{id}/import                bestätigte Einträge; Einträge außerhalb der Grenzen von /entries werden übersprungen; 404 für fremde oder unbekannte Sets

POST   /sessions                        { learnerId, setId?, gameKey?, size? }
POST   /sessions/{id}/answers
POST   /sessions/{id}/complete          → XP, Münzen, Level, Streak
POST   /sessions/sync                   Batch-Upload offline erfasster Antworten einer Session
GET    /sessions/games                  Spielkatalog (Key, Titel, XP-Gewicht)
```

`/sessions/sync` existiert serverseitig, wird vom Frontend aber nicht aufgerufen (Offline-Lernen ist v2, `LRN2-02`).

Fehlerform der Sitzungs-Endpunkte (`FIX-04`): Unbekannte Runde, Karte oder unbekanntes Kind ergeben 404 mit deutschem `detail`; eine unbekannte oder fremde `setId` beim Start ergibt 404 („Dieses Set gibt es nicht (mehr).“); `size` außerhalb 1–50 ergibt 400; eine gleichzeitige Doppel-Antwort auf dieselbe Aufgabe ergibt 409, ebenso gleichzeitige Antworten auf dieselbe Karte in zwei Runden (ohne XP für die zweite); eine Wiederholung nach der ersten Antwort ergibt 200 ohne neue Wertung (0 XP); wird Karte oder Kind gelöscht, während eine Antwort gerade gespeichert wird, ergibt das 404 statt 500 oder 409 (Fremdschlüssel-Verletzung bzw. per Kaskade gelöschte Aufgabe); eine neue Antwort auf eine schon abgeschlossene Runde ergibt 409 („Diese Runde ist schon beendet. Starte eine neue Runde.“), auch per `/sessions/sync`.

**Geplant, nicht umgesetzt:** `GET /sessions/{id}` · `GET /learners/{id}/stats/problem-words` (v2, `PAR2-03`) · `GET /gamification/profile/{learnerId}` · `GET /gamification/missions/today` · `GET /gamification/collection/{learnerId}`.

Fehlerformat: RFC 9457 (`application/problem+json`). Ein fehlender oder unlesbarer JSON-Body oder ein nicht lesbarer Parameter ergibt in jeder Umgebung 400 mit „Die Anfrage ist unvollständig oder nicht lesbar.“ (`Program.cs`, `ThrowOnBadRequest` plus Exception-Handler). Ein lesbarer Body, dem ein Pflichtfeld fehlt oder in dem es `null` ist, bindet ohne Fehler; Anmeldung, Refresh, Abmelden, Import-Vorschau, Import-Bestätigung und Sync prüfen das selbst und antworten mit 400 und deutschem Feldfehler. Rate Limiting: 10 Anfragen pro Minute pro Gerät auf `/auth/profiles`, `/auth/login`, `/auth/learner-login` und `/account/password`; `/auth/refresh` und `/auth/logout` sind ausgenommen, sie erneuern bzw. beenden nur eine bestehende Anmeldung (`FIX-01`). Der Wert kommt aus `Auth:RequestsPerMinute` (Standard 10 in `appsettings.json`); nur der e2e-Teststack (`frontend/e2e/docker-compose.e2e.yml`) erhöht ihn, weil Playwright alle Anfragen von einer IP schickt. Das Gerät erkennt die API am Kopf `X-Forwarded-For`: nginx setzt ihn selbst auf die Adresse seines Absenders und verwirft einen vom Gerät mitgeschickten Wert. Die API übernimmt genau einen Wert und nur von Absendern aus privaten Netzen (`Program.cs`, `ForwardLimit = 1`). Grenze: Wo Docker die Absenderadresse nicht durchreicht (Docker Desktop, Rootless Docker, Zugriff über IPv6 auf ein Compose-Netz nur mit IPv4), sieht nginx für alle Geräte die Gateway-Adresse, dann teilen sich alle Geräte wieder einen Topf. Ein Gerät mit mehreren Adressen bekommt je Adresse 10 Versuche pro Minute; für die PIN greift zusätzlich die Sperre pro Profil, für das Elternpasswort nur dieses Limit. PIN: nach 10 Fehlversuchen in Folge wird das Profil 15 Minuten gesperrt.

---

## 13. PWA und Offline

**Service Worker** (Workbox über `vite-plugin-pwa`): App-Shell und statische Assets werden vorab gecacht; API-Lesezugriffe (`GET /api/…`) `NetworkFirst` mit 5-Sekunden-Timeout; API-Schreibzugriffe werden nicht gecacht. Der Service Worker registriert sich nur über HTTPS mit vertrautem Zertifikat (oder `localhost`), im Heimnetz also erst, wenn die eigene Zertifizierungsstelle auf dem Gerät installiert ist; ist die Warnung nur weggeklickt, lehnt Chromium das Skript des Workers ab, und WordQuest läuft als reine Browser-App. Die e2e-Suite prüft beide Pfade über HTTPS: Chromium vertraut dort genau dem Schlüssel des ausgelieferten, von der CA signierten Server-Zertifikats (SPKI-Liste aus `e2e/global-setup.ts`), und der Worker registriert sich (`login.spec.ts`, `manage.spec.ts`); `learn.spec.ts` läuft ohne dieses Vertrauen mit weggeklickter Warnung und prüft, dass keine Registrierung entsteht und Lernen trotzdem geht. `/wordquest-ca.crt` steht in der `navigateFallbackDenylist` (mit und ohne Query), sonst lieferte der Worker bei einer Navigation die App-Seite statt der Datei. Sitzungsende (Abmelden, Refresh 400/401, verbrauchter Token nach 409 ohne Nachfolger) und jede neue Anmeldung löschen den Cache `wq-api`, soweit `caches` verfügbar ist (HTTPS oder `localhost`); die Anmeldung löscht, bevor sie speichert (`api.ts`, `HARD-04`). Grenze: Ein GET, der beim Abmelden noch läuft, kann den Cache danach neu anlegen; dieser Eintrag liegt bis zur nächsten Anmeldung im Browser. Ohne Sitzung fragt die App nur die Profilliste (`/auth/profiles`) ab, die Oberfläche zeigt einen solchen Eintrag also nicht. Bild-Antworten (`GET /pictures/{version}`) fallen unter die API-Lesezugriffe und liegen damit nur in `wq-api`, das beim Abmelden geleert wird.

**Geplant, nicht umgesetzt (v2, `LRN2-02`)** — der Rest dieses Abschnitts beschreibt das Zielbild. Dexie und IndexedDB werden heute nicht verwendet.

**Lokaler Speicher** (IndexedDB): der aktive Vokabelsatz, die letzten 200 fälligen Karten mit ihren `ReviewState`-Werten, eine Outbox mit unsynchronisierten Antworten, das Gamification-Profil.

**Offline-Ablauf:** Session wird aus den lokal vorgehaltenen Karten zusammengestellt. Bewertung erfolgt lokal nach denselben Regeln (die Normalisierungs- und Levenshtein-Logik liegt als geteiltes TypeScript-Modul auch im Client vor — die *Terminierung* jedoch nicht). Antworten gehen in die Outbox. Beim nächsten Online-Kontakt: `POST /sessions/sync`, der Server rechnet `review_state` autoritativ neu, XP und Münzen werden serverseitig vergeben und im Client überschrieben.

**Konfliktregel:** Der Server gewinnt immer bei `review_state`. Bei XP gilt „höherer Wert gewinnt" — ein Kind, das offline gespielt hat, verliert nie Punkte. Doppelte Antworten werden idempotent verworfen (der Client schickt als `clientAnswerId` die Id des Session-Items; jede Retry-Karte ist ein eigenes Item mit eigener Id, und `crypto.randomUUID` wird nicht gebraucht, das über reines Heimnetz-HTTP fehlt). Serverseitig bereits umgesetzt: eindeutiger Index auf `session_item.client_answer_id`; ein schon beantwortetes Item liefert das gespeicherte Ergebnis ohne erneute Wertung.

---

## 14. Deployment

Die Compose-Dateien im Repository sind die Quelle; hier steht nur die Übersicht.

| Datei | Zweck | Stand |
|---|---|---|
| `docker-compose.quick.yml` | Heimnetz über HTTPS mit eigener CA, `https://<host>` (Ports 80/443, belegt 8080/8443), Dienst `certs` für die Zertifikate | **einzige Betriebsdatei**; Secret-Dateien aus `setup.sh`, Elternkonto aus `setup.sh`, Demo-Daten standardmäßig aus (`WQ_SEED_DEMO_DATA=false`), tägliches Backup nach `./backups` (`SETUP-01`) |
| `docker-compose.build.yml` | Images aus dem Quellcode bauen (zusätzlich zu `docker-compose.quick.yml`) | — |
| `docker-compose.dev.yml` | Entwicklung | — |

Images: `${WQ_IMAGE_PREFIX}-api` und `${WQ_IMAGE_PREFIX}-web`, Tag `${WQ_VERSION:-1.1.0}`, Präfix-Standard `ghcr.io/mrhdready/wordquest` (`.env.example`, `docker-compose.quick.yml`; `REL-04`). Die CI (`ci.yml`) baut bei jedem Push auf `master` und bei Tags `v*` beide Images für `linux/amd64` und `linux/arm64` und schiebt sie nach GHCR; aus einem Tag `vX.Y.Z` entsteht das Image-Tag `X.Y.Z` (`type=semver`). Bei Tags `v*` baut danach der Job `release` (`needs: images`, damit kein Paket ohne Images erscheint) mit `.github/release-package.sh` das Paket `wordquest.tar.gz` und `wordquest.tar.gz.sha256` und hängt beide per vorinstalliertem `gh` an das GitHub-Release (legt es an, falls es fehlt; `--clobber`). Das Paket enthält eine feste Liste: `docker-compose.quick.yml`, `.env.example`, `setup.sh`, `upgrade.sh` und `restore.sh` im Ordner `wordquest/`, ohne erweiterte Attribute; `.env`, `secrets/` und `backups/` gehören nie dazu. Das Skript bricht ab, wenn der Tag nicht `v` plus `WQ_VERSION` aus `.env.example` ist. Nur dieser Job hat `contents: write`. Der Build-Stage beider Dockerfiles läuft auf der Build-Plattform (`FROM --platform=$BUILDPLATFORM`), nur der Runtime-Stage wird je Zielplattform gebaut; .NET läuft dabei nicht unter Emulation.

**Zielbild Erstinstallation:** Paket aus dem GitHub-Release laden und entpacken (`curl -fsSL …/releases/latest/download/wordquest.tar.gz | tar xz`, kein Git nötig), `cd wordquest`, `./setup.sh`, Browser öffnen, anmelden. Die Anleitung für Eltern ist `Documentation/Installation.md`. Fünf Minuten, keine manuelle SQL-Eingabe. Migrationen laufen beim API-Start automatisch; davor legt die API die Migrationshistorie an, damit der erste Start gegen die leere Datenbank keine erwartbaren `fail:`-Zeilen ins Log schreibt (echte Datenbankfehler bleiben `fail:`). Das Vorladen des DataProtection-Schlüsselrings beim Start ist abgeschaltet: WordQuest schützt nichts mit DataProtection (JWT mit eigenem Schlüssel, Refresh-Token als SHA256-Hash), und die zwei `warn:`-Zeilen zu Schlüsseln im Container entfallen damit. Heute erzeugt `setup.sh` die Secrets, legt `.env` mit `COMPOSE_FILE=docker-compose.quick.yml` an (einzige Frage dazu: Image-Präfix mit dem Standard `ghcr.io/mrhdready/wordquest` aus `.env.example`, den Enter übernimmt), prüft per echtem Bind über Docker, ob die Ports 80 und 443 frei sind (eigene laufende Container zählen als frei; belegt: am Terminal Rückfrage nach 8080 und 8443, sonst Abbruch mit deutschem Hinweis auf `WQ_HTTP_PORT` und `WQ_HTTPS_PORT`), schreibt die Namensliste `WQ_TLS_NAMES` in `.env`, startet den Stack, wartet auf ein bereites Zertifikat (`tls show`) und einen TLS-Handshake gegen die eigene CA und fragt E-Mail und Passwort für das Elternkonto ab; das Konto legt das CLI-Verb `create-owner` im API-Container an, das Passwort geht per stdin hinein (`SETUP-02`). Ein zweiter Lauf ändert nichts außer der Zeile `WQ_TLS_NAMES`, wenn sich Name oder Adressen des Geräts geändert haben; zwei gleichzeitige Läufe werden nicht unterstützt. Ein vergessenes Elternpasswort setzt `docker compose exec api dotnet WordQuest.Api.dll reset-password <E-Mail>` zurück: Das neue Passwort wird erzeugt und genau einmal angezeigt, alle Refresh-Tokens des Kontos werden widerrufen (`SETUP-04`). Außerhalb von Development startet die API nicht, wenn DB-Passwort oder JWT-Schlüssel fehlen oder ein bekannter Standardwert aus dem Repository sind oder der JWT-Schlüssel kürzer als 32 Zeichen ist; ein expliziter `ConnectionStrings__Default` wird über seinen Passwort-Teil genauso geprüft (`SecretCheck.cs`, `SETUP-05`). Demo-Daten gibt es nur noch als Entwickler-Option (`WQ_SEED_DEMO_DATA=true`): Außerhalb von Development startet die API damit nicht, und sie bricht nach der Migration ab, solange ein Demo-Elternkonto aus einer Altinstallation noch das bekannte Passwort hat; die Meldung nennt den Ausweg `docker compose run --rm api reset-password demo@wordquest.local` (`DemoAccountCheck.cs`). Wiederherstellen ist umgesetzt: `restore.sh` listet die Sicherungen aus `backups/`, verlangt eine Bestätigung, sichert vorher den Ist-Stand, spielt die gewählte Datei in einer neu angelegten Datenbank in einer Transaktion ein (`psql -1 -f -`: Scheitert eine Anweisung, bleibt nichts davon; bricht nur das Lesen ab, erkennt das `pipefail`) und fällt bei einem Fehler auf die Vorher-Sicherung zurück (`REL-02`). Update ist umgesetzt, ohne Git (`REL-01`, D-16): `upgrade.sh` lädt `wordquest.tar.gz` und `wordquest.tar.gz.sha256` von `WQ_RELEASE_URL` (Umgebung, sonst `.env`, sonst `https://github.com/mrhdready/WordQuest/releases/latest/download`; nur `http://` oder `https://`, bei https mit `--proto '=https' --proto-redir '=https'`) in ein Arbeitsverzeichnis `.upgrade.*` im Installationsordner und prüft die SHA256. Vor dem Entpacken vergleicht es Typ und Name jedes Eintrags mit der festen Liste (ein Ordner, fünf Dateien); nach dem Entpacken müssen sie reguläre Dateien und die drei Skripte ausführbar sein. Danach sichert es die Datenbank nach `backups/vor-update-…` und prüft die Sicherung (gzip, Endzeile, Kontotabelle); ohne geprüfte Sicherung ändert es nichts. Erst dann ersetzt es genau die fünf Dateien per `mv` (`.env`, `secrets/` und `backups/` bleiben unberührt) und startet sich per `exec ./upgrade.sh --continue <Sicherung>` mit der neuen Fassung neu; dieser Aufruf ist die feste Schnittstelle zwischen alter und neuer Fassung. Die neue Fassung lädt die Version aus der neuen `.env.example` und schreibt sie erst nach erfolgreichem Laden als `WQ_VERSION` in `.env`, startet den Stack und wartet auf `/health/ready`. Scheitert das Laden, laufen WordQuest und `.env` mit der bisherigen Version weiter, die Paketdateien sind schon neu, und ein neuer Aufruf setzt das Update fort. Scheitert der Start oder ist die API nach zwei Minuten nicht bereit, nennt die Meldung alte Version, Sicherungsdatei und den Weg zurück (alte Version in `.env`, dann `./restore.sh <Datei>`); die Sicherung steht in der Liste von `restore.sh`. Ein früherer Git-Klon (`.git` im Ordner) lädt kein Paket und nimmt wie bisher die Version aus der eigenen `.env.example`. Grenzen: Dateien, die eine neue Version nicht mehr mitbringt, bleiben im Ordner liegen. Und weil die alte `upgrade.sh` das neue Paket gegen ihre eigene Liste prüft, braucht eine Änderung der Dateiliste zuerst eine Übergangsversion, deren `upgrade.sh` beide Listen kennt. Mit dem Wegfall der Domain-Variante (ADR-007) hat sich die Liste ohne Übergangsversion geändert, weil es keine Installationen von 1.0.x gibt (Owner, 2026-10-25): Eine `upgrade.sh` aus 1.0.x lehnt das neue Paket ab („Das WordQuest-Paket enthält andere Dateien als erwartet. Es wurde nichts geändert.“), 1.0.x wird neu installiert. Ab jetzt gilt die Regel wieder.

**Zu TLS im Heimnetz:** Eine PWA ist nur über HTTPS mit einem vertrauten Zertifikat installierbar (Ausnahme `localhost`). Statt einer Domain mit öffentlichem Zertifikat legt jede Installation eine eigene CA an (→ ADR-008). Bis sie auf einem Gerät installiert ist, warnt dessen Browser beim ersten Besuch; `setup.sh` nennt dafür die Fingerabdrücke, und `http://<host>/wordquest-ca.crt` liefert die CA zum Installieren. Jede andere Adresse über HTTP leitet auf HTTPS um (→ §15, Transport). Die Alternative (Reverse Proxy über Cloudflare Tunnel) ist nicht Default, weil sie Daten durch Dritte leitet.

**Hardware-Richtwert:** 2 vCPU, 2 GB RAM, 10 GB Storage. Läuft auf einem Raspberry Pi 5 (arm64-Images werden gebaut) und auf jedem NAS mit Docker.

---

## 15. Sicherheit und Datenschutz

| Thema | Umsetzung |
|---|---|
| Passwörter | PBKDF2-HMAC-SHA256, 210 000 Iterationen, eigene Implementierung (`PasswordHasher.cs`), kein ASP.NET Core Identity |
| Passwort ändern | `POST /api/v1/account/password` (`AccountEndpoints.cs`, nur Elternkonten, Rate-Limit wie `/auth`) prüft das aktuelle Passwort; die Konto-Id kommt nur aus dem Token. Falsches aktuelles Passwort ergibt 400 mit Feldfehler, nicht 401. Neue Passwörter brauchen mindestens 8 Zeichen; Passwörter nur aus Leerzeichen werden abgelehnt, Leerzeichen am Rand bleiben Teil des Passworts. Andere Sitzungen bleiben angemeldet. **Bekannte Lücke:** neue Passwörter werden nicht gegen Listen häufiger Passwörter geprüft (v1, D-18) |
| PIN | Genau 4 Ziffern 0–9, serverseitig geprüft beim Anlegen und beim Ändern; separat gehasht (gleiches Verfahren), 10 Fehlversuche in Folge, dann 15 Minuten Sperre. Fehlversuche werden in einem Statement gezählt (`ExecuteUpdateAsync` mit `FailedPinAttempts + 1` in `AuthService.cs`), auch parallele Anfragen zählen alle (`HARD-03`). Grenze: Anfragen, die die Sperre schon vor ihrem Setzen geprüft haben, werden noch ausgewertet; je Gerät begrenzt das Rate-Limit sie auf 10 pro Minute |
| Token | Access 15 min, Refresh 30 Tage rotierend, Reuse-Detection; gespeichert wird nur der Hash des Refresh-Tokens. `reset-password` widerruft alle Refresh-Tokens des Kontos, eine neue Kinder-PIN (`PATCH /learners/{id}/settings`) alle Refresh-Tokens des Kindes; bereits ausgegebene Access-Tokens bleiben bis zu ihrem Ablauf gültig (höchstens 15 Minuten, `Auth:AccessTokenMinutes`). Refresh, Abmelden und Widerruf (`reset-password`, neue PIN) laufen je Konto unter einer Zeilensperre auf `app_user` (`TransactionExtensions.LockUserAsync`): Ein laufender Refresh schreibt seinen Nachfolger entweder vor dem Widerruf fest und wird mit widerrufen, oder er sieht danach den widerrufenen Token; der alte Token wird zusätzlich bedingt beansprucht (nur solange `revoked_at` leer ist). Der unmittelbare Vorgänger ergibt bis 10 Sekunden nach seiner Rotation 409 „Die Anmeldung wurde gerade in einem anderen Fenster erneuert.“ ohne neue Tokens, solange sein Nachfolger aktiv ist (zwei Fenster erneuern gleichzeitig); in allen anderen Fällen greift die Reuse-Detection und widerruft alle Refresh-Tokens des Kontos. Restrisiko dieser 10 Sekunden: Hat ein Angreifer einen gestohlenen Token zuerst erneuert und legt das echte Gerät den alten in diesem Fenster vor, bleibt der Diebstahl unerkannt; das Gerät bekommt nur 409, die Kette des Angreifers lebt bis zum nächsten Widerruf (akzeptiert, `HARD-01`). Abmelden liest den Token erst unter der Sperre und widerruft die ganze Kette ab dem vorgelegten Token, auch eben ausgestellte oder schon weitergedrehte Nachfolger. Jeder Pfad mit dieser Sperre sperrt zuerst `app_user` und schreibt erst danach `refresh_token` bzw. `learner_profile`; die Anmeldungen per Passwort und PIN nehmen die Sperre nicht selbst, warten beim Schreiben aber auf sie (Fremdschlüssel von `refresh_token` und `last_login_at` in `app_user`). Läuft eine Anmeldung dabei in einen Deadlock mit einem PIN-Wechsel, löst PostgreSQL ihn nach `deadlock_timeout` (Standard 1 s) mit 40P01 auf, und die Ausführungsstrategie (`EnableRetryOnFailure`) wiederholt den betroffenen Lauf; das kostet bis etwa eine Sekunde. **Bekannte Lücke:** Eine Anmeldung mit dem alten Passwort bzw. der alten PIN, deren Prüfung schon bestanden ist, wenn `reset-password` oder eine neue PIN läuft, schreibt ihren Refresh-Token erst nach dem Widerruf fest und bleibt angemeldet; dasselbe gilt für die Wiederholung nach einem solchen Deadlock. Das Frontend meldet nur ab, wenn der Refresh mit 400 oder 401 scheitert; bei 429, 5xx oder Netzfehler bleibt die Anmeldung bestehen; die auslösende Aktion zeigt bei 429 und 5xx „Das hat nicht geklappt. Versuche es noch einmal.“, bei einem Netzfehler „Der Server ist gerade nicht erreichbar. Prüfe die Verbindung und versuche es noch einmal.“ (`api.ts`, `FIX-01`). Eine Refresh-Antwort übernimmt das Frontend nur, solange im Speicher noch der gesendete Token steht; auch 400/401 meldet nur dann ab, ein inzwischen von einem anderen Fenster gespeicherter Token bleibt. Bei 409 übernimmt das Fenster den Token, den ein anderes Fenster derselben Anmeldung speichert (Abfrage alle 100 ms); kommt binnen 3 Sekunden keiner, bleibt der Speicher unverändert (er gehört allen Fenstern, die Antwort an das andere kann noch unterwegs sein), und die Aktion zeigt „Die Anmeldung wird gerade in einem anderen Fenster erneuert. Versuche es gleich noch einmal.“ Das Fenster sendet diesen Token nicht noch einmal: Steht er beim nächsten Versuch immer noch im Speicher, meldet es lokal ab, ohne Widerruf auf dem Server. Abfragen wiederholt TanStack Query nach einem Fehler einmal automatisch, nach 409 nicht (`retryQuery` in `api.ts`), damit diese Wiederholung nicht schon nach einer Sekunde der nächste Versuch ist. Die Anmeldung per Passwort oder PIN erneuert und wiederholt nach 401 nichts (`auth.tsx`): Ein Fehlversuch zählt beim Rate-Limit einmal, auch wenn noch eine Sitzung im Speicher steht. Eine 401 auf eine Anfrage, deren Access-Token inzwischen ersetzt ist, wiederholt die Anfrage einmal mit dem gespeicherten Token, ohne neuen Refresh. Nach Abmelden oder einer neuen Anmeldung (Kennung `wq.session`, neu bei jeder Anmeldung, gleich bei der Rotation) wird keine Anfrage der alten Anmeldung wiederholt. Grenze: Ein Fenster, das nach einem Update noch den alten Code geladen hat, schreibt und löscht diese Kennung nicht; meldet sich dort ein anderes Profil an, kann ein Fenster mit neuem Code beide Anmeldungen bis zum Neuladen nicht unterscheiden. Die Oberfläche folgt dem Speicher (`useSyncExternalStore` in `auth.tsx`), auch über Fenster hinweg (`storage`-Ereignis). Wechselt dabei die Anmeldung (neue Kennung oder abgemeldet), leert die App den Abfrage-Cache von TanStack Query im Speicher (`App.tsx`); ein anderes Profil im selben Fenster sieht keine Daten des vorigen. Abmelden leert zuerst lokal und sendet danach den Server-Logout; eine später eintreffende Refresh-Antwort wird verworfen. Bricht der Client eine Anfrage ab, nachdem die Arbeit ihrer Transaktion getan ist, wird sie trotzdem festgeschrieben (`InTransactionAsync` übergibt dem Commit nicht das Token der Anfrage); ein solcher Abbruch ergibt keine `fail:`-Zeile im Log. Für einen Refresh, den der Client in diesem Moment abbricht, gilt die Grenze der verlorenen Bestätigung (unten). Grenze: Kommt 409 ohne zweites Fenster (Bestätigung eines erfolgreichen Refresh verloren), zeigt das Fenster nach 3 Sekunden den Hinweis und meldet sich beim nächsten Versuch ab; trifft die Antwort an ein anderes Fenster erst nach diesem nächsten Versuch ein, sind alle Fenster abgemeldet; der Nachfolger bleibt ungenutzt auf dem Server, bis er abläuft (`HARD-01`) |
| Transport | Im Heimnetz über HTTPS mit eigener Zertifizierungsstelle (→ ADR-008). HTTP (Port 80 bzw. `WQ_HTTP_PORT`) beantwortet jeden Pfad außer `/wordquest-ca.crt` mit 301 auf `https://<host>:<WQ_HTTPS_PORT><Pfad und Query>`; die CA kommt über HTTP und HTTPS, damit ein Gerät sie vor dem ersten Vertrauen laden kann (`frontend/nginx.conf`, Template mit `WQ_HTTPS_PORT`). Kein HSTS, auf keiner Antwort (Owner-Entscheidung 2026-10-25: Ein Browser mit HSTS verbietet das Wegklicken einer Zertifikatswarnung). Keine Cookies: Tokens liegen im `localStorage` und gehen im `Authorization`-Header (bewusst akzeptiertes Risiko) |
| Autorisierung | `tenant_id` über einen EF-Core-Global-Query-Filter — nicht pro Query von Hand; zusätzlich darf ein Kind nur für sich selbst lernen (`MayActFor`, Geschwister teilen den Mandanten) |
| Uploads | Eine gewählte CSV-Datei liest der Browser (höchstens 1 MB); übertragen wird wie beim Einfügen nur Text im JSON-Body. Der Bild-Upload (`PUT /sets/{id}/entries/{entryId}/picture`) ist je Endpoint auf 300 KB begrenzt (begrenztes Lesen, nginx mit 1 MB davor) und nimmt nur Dateien mit Signatur und schlüssiger Struktur von WebP, JPEG oder PNG an, kein SVG; der Server dekodiert nicht. Vor dem Hochladen verkleinert der Browser das Bild auf höchstens 512 px an der längsten Kante (Drehung aus EXIF angewandt; ein Browser, der `imageOrientation: 'from-image'` nicht kennt, dekodiert ohne diese Option, die Drehung hängt dort vom Browser ab) und kodiert es neu als WebP, ohne WebP-Kodierer (Safari) als JPEG auf weißem Grund; dabei entfallen EXIF- und GPS-Daten des Fotos. Jede 413, ob vom Endpoint unter 1 MB oder von nginx darüber, zeigt die App mit demselben Text „Das Bild ist zu groß. Erlaubt sind höchstens 300 KB.“. Grenze: Ein direkter API-Aufruf eines Elternkontos kann Metadaten mitschicken, der Server entfernt sie nicht. Ein Bild, das der Browser nicht laden oder dekodieren kann, erscheint in Vokabelliste und Lernrunde als Emoji im selben Rahmen (ohne Emoji bleibt der Rahmen leer). Allgemeines Größenlimit der API: **geplant, nicht umgesetzt** (v2, `OPS2-03`) |
| Headers | CSP, derzeit mit `style-src 'unsafe-inline'`; `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. Alle mit `always` in `frontend/nginx-security-headers.conf`, eingebunden in beiden server-Blöcken von `frontend/nginx.conf` (HTTP und HTTPS) und in jeder location mit eigenem Cache-Control (`/assets/`, `/sw.js`, `/index.html`, `/wordquest-ca.crt`); sie gelten damit für jede Antwort, auch HTML, Assets, `sw.js`, Fehlerantworten und die Umleitung von HTTP |
| Audit | Auditlog für Anmeldungen, Rollenwechsel, Löschungen: **geplant, nicht umgesetzt** |

**Datensparsamkeit:** Pflichtfeld für ein Kind ist ausschließlich ein Anzeigename — ein Spitzname genügt, kein Geburtsdatum, keine E-Mail, keine Klasse. Es existiert keine Telemetrie und kein externer Analytics-Dienst. Alle Schriften und Icons werden mitgeliefert, nicht von einem CDN geladen (ein Google-Fonts-Aufruf überträgt die IP des Kindes an einen Dritten); die CSP erlaubt Schriften nur von der eigenen Origin.

**Löschung:** „Kind löschen" (`DELETE /learners/{id}`, nur Elternkonten) löscht hart: Der Endpunkt entfernt das Konto, die Datenbank über die Fremdschlüssel Profil, `review_state`, `review_log`, Runden, XP/Serie und Refresh-Tokens (`PAR-03`). Ein noch angemeldetes Gerät des Kindes bekommt danach beim Refresh 401 und auf Übersicht und Rundenstart 404. In der Oberfläche liegt „Kind löschen“ auf der Bearbeiten-Seite eines Kindes, unter dem Formular und außerhalb davon; es öffnet einen Bestätigungsdialog („{Name} löschen?“, Startfokus auf „Abbrechen“, Enter direkt nach dem Öffnen und Esc löschen nicht, ein Klick auf die Abdunklung schließt nicht). Erst „Endgültig löschen“ ruft den Endpunkt auf; danach zeigt die Kinderliste „{Name} ist gelöscht.“. War das Kind schon gelöscht (anderer Tab), bleibt „Dieses Kind gibt es nicht (mehr).“ im Dialog stehen, bis er geschlossen wird. Den Dialog-Baustein (`components/ui/dialog.tsx`) nutzt auch die Set-Seite: „Set umbenennen“ (`PATCH /sets/{id}`: Titel ändern, IDs und Lernstand bleiben, `PAR-04`) und „Set löschen“ (`DELETE /sets/{id}`) mit derselben Bestätigung („Set „{Titel}“ löschen?“), danach zeigt die Set-Liste „Das Set „{Titel}“ ist gelöscht.“. Auch jede Vokabelzeile nutzt ihn: der Stift öffnet „Vokabel bearbeiten“ (`PUT /sets/{id}/entries/{entryId}`: Deutsch und Englisch ändern, IDs, Lernstand, Emoji und Alternativen bleiben, `PAR-04`), im selben Dialog liegt unter den Wörtern der Abschnitt „Bild“ mit „Bild wählen“ (Datei-Feld für Bilder, `accept="image/*"` ohne `capture`; ob das Handy dabei die Kamera anbietet, ist manuelle Abnahme), einer Vorschau und „Bild entfernen“ (nur mit Bild, ohne Rückfrage). Bildänderungen gelten sofort, ohne „Speichern“ („Das Bild ist gespeichert.“ bzw. „Das Bild ist entfernt.“); „Abbrechen“ betrifft nur die Wörter. Der Papierkorb öffnet die Bestätigung „„{Deutsch}“ löschen?“, und das Löschen der Vokabel entfernt auch ihr Bild; danach steht „„{Deutsch}“ ist gelöscht.“ über der Liste und der Fokus liegt auf der Set-Überschrift. `PATCH /learners/{id}/settings` antwortet für ein gelöschtes Kind ebenfalls mit 404 und diesem Text. Datenexport als JSON und Löschen der ganzen Familie: v2 (`PAR2-02`). Löschen ist als gute Praxis gedacht, nicht als Zusage, DSGVO-Pflichten zu erfüllen.

**Zum Familienbetrieb:** Solange die Instanz im eigenen Haushalt für die eigenen Kinder läuft, greift die DSGVO über die Haushaltsausnahme (Art. 2 Abs. 2 lit. c) nicht. Relevant würde sie, sobald fremde Kinder Zugang bekommen — etwa bei einem Schuleinsatz, der für v1.0 außer Scope ist. *(Keine Rechtsberatung — bei tatsächlichem Schuleinsatz gehört das dem schulischen Datenschutzbeauftragten vorgelegt.)*

---

## 16. Roadmap

Die gültige Roadmap steht in `.planning/ROADMAP.md`, die Anforderungen in `.planning/REQUIREMENTS.md`. Versionspläne werden nur dort gepflegt, nicht in diesem Dokument.

Stand v1.0 in einem Satz: Aus dem vorhandenen Lernkern wird eine funktionierende, sichere Basis, die eine andere Familie im Heimnetz betreiben kann (sichere Installation im Heimnetz, Fehlerbehebungen und Integrationstests, versioniertes Release mit Update- und Restore-Skripten). Bis 1.0.1 lief die Installation über HTTP; seit 1.1.0 läuft sie über HTTPS mit einer eigenen Zertifizierungsstelle je Installation (ADR-008).

**Langfristige Ideen (ungeplant):**

- Spiele im Frontend: Wort-Fänger und Memory (v2, `LRN2-01`); Monster-Duell, Buchstaben-Chaos, Rennen gegen die Zeit
- Offline-Lernen mit Outbox (v2, `LRN2-02`)
- Text-to-Speech, Sammelkarten, Tagesmissionen, Avatar-Anpassung, Themenwelten
- Klassenarbeit-Modus (`cram`, im Backend vorbereitet)
- OCR-Import des Vokabelhefts, weitere KI-Funktionen (→ §11)
- Schule: Mandanten-UI, Gruppen, Lehrer-Rolle, Bulk-Anlage, LDAP — für v1.0 außer Scope

**Zu den Migrationen:** Eine EF-Core-Migration besteht aus generiertem C# **plus** einem Model-Snapshot, den nur `dotnet ef` korrekt schreiben kann. Die erste Migration (`20260917045557_Initial`) ist erzeugt und eingecheckt; die API wendet Migrationen beim Start selbst an, und die CI prüft, dass keine Migration fehlt.

---

## 17. Offene Punkte

| # | Frage | Warum relevant |
|---|---|---|
| O1 | Welches Englischbuch/Lehrwerk? | Bestimmt Wortschatz-Struktur und ob es maschinenlesbare Wortlisten gibt — spart viel Tipparbeit |
| O2 | Welche Geräte nutzen die Kinder typischerweise? | Bildschirmgröße bestimmt Layout; iOS bedeutet keine Push-Benachrichtigungen |
| O3 | Wo läuft der Server? | NAS, Mini-PC oder Pi — bestimmt Images und Aufwand fürs TLS-Setup |
| O4 | Soll er mitgestalten dürfen? | Ein Kind, das den Namen seines Monsters aussuchen darf, nutzt die App messbar länger |
| O5 | Lizenz endgültig AGPL-3.0? | Betrifft Sammelkarten-Grafiken und Sounds — die Assets müssen kompatibel lizenziert sein. Das Repository enthält eine AGPL-3.0-`LICENSE` |
| O6 | Repository öffentlich? | Beeinflusst CI-Setup und ob Secrets je im Verlauf lagen |

---

## 18. Abgleich mit dem Ursprungskonzept

Das Ursprungskonzept liegt in `Documentation/archiv/Ursprungskonzept.md`.

| Idee aus dem Ursprungskonzept | Übernommen als |
|---|---|
| Welten, Inseln, Dschungel, Weltraum | Visueller Fortschrittspfad, Idee — kosmetisch, nicht strukturell |
| Fotos vom Vokabelheft | OCR-Provider, Idee (→ §11) |
| PDF-Upload | Zurückgestellt — schulische Vokabel-PDFs sind zu heterogen für zuverlässiges Parsing; CSV-Import deckt den Fall pragmatisch ab |
| Abenteuer-Modus mit Entdecker-Story | Rahmenerzählung um die Session-Struktur, Idee |
| Kein Bestrafen | Leitplanke 2, algorithmisch verankert (falsche Antwort kostet 0 XP) |
| Wort-Fänger, Monster-Duell, Memory, Zeitrennen | In den Spielkatalog §7.2 übernommen; umgesetzt ist bisher nur die Karteikarte |
| Intelligente Wiederholung (3/7/14 Tage) | Ersetzt durch echtes SM-2 — feste Intervallstufen passen sich nicht an die Schwierigkeit des einzelnen Wortes an, und genau das ist der Punkt |
| Aussprachetrainer mit KI-Bewertung | Idee (→ §11, mit Aufwandsvorbehalt) |
| Sammelkarten alle 20 Vokabeln | Übernommen, Kriterium auf *gefestigte* Vokabeln geschärft (§8); nicht umgesetzt |
| Fußballstar-Karten | **Gestrichen** — Bild- und Persönlichkeitsrechte |
| Tägliche Missionen | Übernommen, §8; nicht umgesetzt |
| Eltern-Dashboard mit Ampel | Übernommen, Kriterien konkretisiert, §9 |
| KI-Wochenreport „Vokabel-Coach" | Idee (→ §11) |
| Level 1–100, Trophäen, Streaks, Schatzkisten, Avatare | Übernommen, mit konkreten Zahlen hinterlegt, §8; umgesetzt sind Level, XP, Münzen und Streaks |
| Flutter | **Ersetzt** durch React-PWA (ADR-002) |
| Azure Functions | **Ersetzt** durch ASP.NET Core im Container (ADR-003) |
| Familienabo, kostenlose Basisversion | **Gestrichen** — unvereinbar mit Selfhosting (§4) |
