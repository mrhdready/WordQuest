# WordQuest — Konsolidiertes Konzept & Architektur

**Version:** 1.0 (konsolidiert)
**Stand:** 15.09.2026
**Status:** Verbindliche Grundlage — ersetzt die bisherigen `.docx`-Fassungen im Ordner `Documentation/`

---

## 0. Warum dieses Dokument existiert

Im Repository lagen neun `.docx`-Dateien mit stark überlappendem, teils widersprüchlichem Inhalt:

| Datei | Inhalt | Status |
|---|---|---|
| `WordQuest_Projektdokumentation*.docx` (4×) | Fachkonzept, Epics 1–10, Schulfokus | **abgelöst** |
| `WordQuest_Projektdokumentation_Vollstaendig*.docx` (3×) | dito, minimal erweitert | **abgelöst** |
| `WordQuest_Software_Architecture_Document.docx` | SAD-Kurzfassung | **abgelöst** |
| `WordQuest_SAD_Extended.docx` | SAD mit 17 Kapiteln, aber überwiegend Platzhaltertext | **abgelöst** |

Die drei zentralen Widersprüche zwischen dieser Doku und dem neueren Produktkonzept sind hiermit entschieden:

| Konflikt | Alte Doku | Neues Konzept | **Entscheidung** |
|---|---|---|---|
| Zielgruppe | Schule, Klassen, Lehrer | Ein Kind, Elternteil | **Familie zuerst, schulfähig geschnitten** (→ §1) |
| Frontend | React/TS PWA | Flutter | **React/TS PWA** (→ ADR-002) |
| Backend | ASP.NET Core | Node/Azure Functions | **ASP.NET Core** (→ ADR-003) |
| KI (OCR, Aussprache, Coach) | „Ollama oder Azure OpenAI" | Kernfeature | **Nicht im MVP**, Plugin-Punkte vorbereitet (→ §11) |

**Empfehlung zur Ablage:** Die neun `.docx` nach `Documentation/archiv/` verschieben. Projektdokumentation gehört in einem Git-Repo als Markdown versioniert — `.docx` erzeugt bei jedem Speichern einen binären Diff, der nicht reviewbar ist.

---

## 1. Scope-Entscheidung: „Familie zuerst, Schule später"

Gebaut wird zunächst die **Familien-App** — ein Elternkonto, ein bis drei Kinder, selbstgehostet auf einem Rechner im Haus. Aber: Das Datenmodell und die Autorisierung werden **von Tag 1 an mandantenfähig** geschnitten.

Konkret heißt das:

- Es gibt eine Entität `Tenant` mit `type ∈ {Family, School}`. Eine Familie *ist* ein Mandant — nur mit anderem Namen im UI.
- Es gibt eine Entität `Group` (Lerngruppe). In der Familie ist das implizit eine Gruppe pro Kind; in der Schule wird daraus „Klasse 6b".
- Jede Datenbankzeile mit Nutzerbezug trägt `tenant_id`. Jede Query filtert darauf.
- Rollen heißen `Guardian` (Elternteil/Lehrkraft) und `Learner` (Kind/Schüler) — nicht `Parent`/`Teacher`.

Das kostet im MVP etwa 3–5 % Mehraufwand. Der nachträgliche Einbau von Mandantenfähigkeit in ein gewachsenes Schema kostet dagegen erfahrungsgemäß Wochen und produziert Datenlecks zwischen Mandanten. Das ist der Grund, warum diese Entscheidung *jetzt* getroffen wird und nicht später.

**Bewusst nicht im Scope (auch nicht vorbereitet):** LDAP/Active Directory, Moodle, IServ, SCORM, Notenexport, Mehrsprachigkeit über Englisch hinaus. Diese Punkte aus der alten Doku sind Schul-Themen und würden das MVP erdrücken. Sie kommen über die Integrations-Schnittstelle (→ §12) wieder rein, wenn sie gebraucht werden.

---

## 2. Produktvision und Leitplanken

**Vision:** Ein Kind soll 10 Minuten spielen und dabei 20 Vokabeln wiederholt haben, ohne den Eindruck zu haben, gelernt zu haben.

Fünf Leitplanken, an denen jede spätere Feature-Entscheidung gemessen wird:

1. **Kurze Einheiten.** Eine Session dauert 3–7 Minuten und hat einen definierten Endpunkt. Kein endloses Scrollen, kein „noch eine Runde"-Sog. Das ist eine Lern-App, kein Aufmerksamkeits-Casino.
2. **Nie bestrafen.** Eine falsche Antwort kostet keine Punkte, keine Leben, keine Streak. Sie führt lediglich dazu, dass das Wort früher wiederkommt. Formulierung: „Fast! Das üben wir gleich nochmal." — nie „Falsch".
3. **Touch first.** Alle Interaktionen mit dem Daumen bedienbar, Trefferflächen ≥ 48 px, primäre Aktionen im unteren Bildschirmdrittel. Tastatureingabe ist immer optional, nie erzwungen.
4. **Offline lauffähig.** Eine Lernsession muss ohne Netz vollständig durchlaufen. Synchronisation passiert danach.
5. **Datensparsam.** Kein Kindername ist zwingend. Kein Tracking, keine Werbung, keine externen Analytics. Das ist bei einer App für ein 11-jähriges Kind keine Kür.

---

## 3. Rollen und Zugang

| Rolle | Kann | Login |
|---|---|---|
| `Owner` | Instanz verwalten, Backup, Updates, erste Einrichtung | E-Mail + Passwort + optional TOTP |
| `Guardian` | Lernende anlegen, Vokabeln pflegen, Dashboard sehen | E-Mail + Passwort |
| `Learner` | Lernen, spielen, Sammlung ansehen | **Profilauswahl + 4-stellige PIN** |

**Zum Kinder-Login:** Ein Kind soll kein Passwort tippen müssen — das ist die häufigste Abbruchstelle bei Lern-Apps. Stattdessen: Startbildschirm zeigt Avatar-Kacheln, ein Tipp auf den eigenen Avatar, dann eine 4-stellige PIN über ein großes Ziffernfeld. Die PIN schützt nicht gegen Angreifer, sondern gegen das Geschwisterkind — das ist das realistische Bedrohungsmodell im Wohnzimmer. Technisch wird für das Kind ein langlebiges Refresh-Token auf dem Gerät hinterlegt, sodass die PIN nur bei Profilwechsel oder nach 30 Tagen nötig ist.

Auf einem Familientablet ist „Gerät ist vertrauenswürdig" die richtige Annahme. Auf einem Schul-Tablet später nicht — dort wird die PIN pro Session erzwungen (`tenant.settings.requirePinEverySession`).

---

## 4. Funktionsumfang und Priorisierung

Priorisierung nach MoSCoW, bezogen auf das MVP (= „mein Sohn kann damit für die nächste Vokabelarbeit lernen").

### Must — MVP

| # | Feature | Anmerkung |
|---|---|---|
| M1 | Vokabelsets anlegen, Vokabeln manuell erfassen | Schnellerfassung: eine Zeile `Hund = dog`, Tab springt weiter |
| M2 | CSV-Import | Spaltenmapping im UI, Trennzeichen-Erkennung |
| M3 | Spaced Repetition Engine | → §6, das Herzstück |
| M4 | Antwortbewertung mit Tippfehlertoleranz | → §6.4 |
| M5 | Lernsession („Quest") mit definiertem Ende | 15 Items oder 5 Minuten |
| M6 | Drei Spielmodi: **Karteikarte**, **Wort-Fänger**, **Memory** | → §7 |
| M7 | XP, Level, Münzen, Tagesstreak | → §8 |
| M8 | Eltern-Dashboard mit Ampel | → §9 |
| M9 | PWA installierbar, Session offline lauffähig | → §13 |
| M10 | Docker-Compose-Deployment mit einem Befehl | → §14 |

### Should — Version 0.6

Monster-Duell und Buchstaben-Chaos als drittes/viertes Spiel · Text-to-Speech für Vokabelaussprache (Browser-`SpeechSynthesis`, kostenlos, kein Server) · Sammelkarten · Tagesmissionen · Avatar-Anpassung · Themenwelten als visueller Fortschrittspfad

### Could — Version 1.0+

Foto-Import des Vokabelhefts (OCR) · Aussprachebewertung · KI-Beispielsätze · Wochenreport „Vokabel-Coach" · Familien-Rangliste

### Won't (vorerst)

Schul-Mandanten im UI · LDAP · Moodle/IServ · App-Store-Release · Monetarisierung

**Zur Monetarisierung:** Im ursprünglichen Konzept stand ein Familienabo. Das ist mit dem Ziel „selbst hostbar als Docker-Container" nicht vereinbar — wer selbst hostet, zahlt kein Abo. Entweder Open Source und selbstgehostet, oder SaaS mit Abo. Für den genannten Zweck (Sohn, eigener Server) ist die Entscheidung klar: **Open Source, AGPL-3.0**, keine Monetarisierung. Falls später doch ein gehostetes Angebot entstehen soll, ist AGPL die richtige Basis dafür.

---

## 5. Domänenmodell

```
Tenant (type: Family|School)
 ├─ User (role: Owner|Guardian|Learner)
 │   ├─ LearnerProfile      (Avatar, PIN, Tagesbudget, Spieltempo)
 │   └─ GamificationProfile (XP, Münzen, Streak, Streak-Retter)
 ├─ Group                      // Familie: 1 pro Kind · Schule: Klasse
 │   └─ GroupMembership
 └─ VocabularySet              // "Unit 3 — At the zoo"
     └─ VocabularyEntry        // Lemma-Paar + Metadaten
         └─ Card               // Eine Abfragerichtung!
              └─ ReviewState   // pro Learner × Card
                   └─ ReviewLog
Session
 └─ SessionItem
Achievement · CollectibleCard · DailyMission · CoinTransaction
```

### 5.1 Die wichtigste Modellierungsentscheidung: `VocabularyEntry` ≠ `Card`

Ein Vokabelpaar `Hund ↔ dog` ist **nicht** eine Lernkarte, sondern zwei:

- `DE→EN`: „Hund" → erwartet `dog` (Produktion, schwer)
- `EN→DE`: „dog" → erwartet `Hund` (Rezeption, leicht)

Diese beiden Richtungen werden **unterschiedlich schnell gelernt und müssen getrennt terminiert werden.** Ein Kind erkennt „dog" längst, bevor es „Hund" aktiv produzieren kann. Wer beide Richtungen auf einen gemeinsamen Fortschrittswert abbildet, terminiert die schwierige Richtung zu selten und die leichte zu oft — und das Kind langweilt sich und scheitert gleichzeitig. Das ist der häufigste Konstruktionsfehler in selbstgebauten Vokabeltrainern.

Später kommt als dritte Kartenart `AUDIO→DE` dazu (Hören und verstehen), ohne dass das Schema sich ändert.

### 5.2 Kerntabellen (PostgreSQL, Auszug)

```sql
CREATE TABLE vocabulary_entry (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenant(id),
  set_id          uuid NOT NULL REFERENCES vocabulary_set(id) ON DELETE CASCADE,
  source_text     text NOT NULL,              -- "Hund"
  target_text     text NOT NULL,              -- "dog"
  target_alts     text[] NOT NULL DEFAULT '{}',-- ["hound"] – gelten als richtig
  part_of_speech  text,                       -- noun | verb | adj | phrase
  example_source  text,
  example_target  text,
  emoji           text,                       -- "🐶" – für Memory-Spiel
  audio_url       text,
  position        int  NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE card (
  id         uuid PRIMARY KEY,
  entry_id   uuid NOT NULL REFERENCES vocabulary_entry(id) ON DELETE CASCADE,
  direction  text NOT NULL CHECK (direction IN ('SourceToTarget','TargetToSource','AudioToSource')),
  UNIQUE (entry_id, direction)
);

CREATE TABLE review_state (
  learner_id     uuid NOT NULL REFERENCES learner_profile(id) ON DELETE CASCADE,
  card_id        uuid NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  ease_factor    real NOT NULL DEFAULT 2.5,
  interval_days  real NOT NULL DEFAULT 0,
  repetitions    int  NOT NULL DEFAULT 0,
  lapses         int  NOT NULL DEFAULT 0,
  due_at         timestamptz NOT NULL DEFAULT now(),
  first_seen_at  timestamptz NOT NULL DEFAULT now(),  -- Basis des Tagesbudgets
  last_grade     smallint,
  state          text NOT NULL DEFAULT 'New',  -- New|Learning|Review|Relearning
  PRIMARY KEY (learner_id, card_id)
);
CREATE INDEX ix_review_due ON review_state (learner_id, due_at) WHERE state <> 'Suspended';

CREATE TABLE review_log (          -- append-only, Basis aller Statistiken
  id           bigserial PRIMARY KEY,
  learner_id   uuid NOT NULL,
  card_id      uuid NOT NULL,
  session_id   uuid,
  game_key     text,               -- 'wordcatcher' | 'memory' | 'classic'
  grade        smallint NOT NULL,  -- 0..3
  answer_ms    int,
  given_answer text,
  reviewed_at  timestamptz NOT NULL DEFAULT now()
);
```

`review_log` ist bewusst append-only und wird nie aktualisiert. Alle Auswertungen (Ampel, Wochenreport, Problemwörter) leiten sich daraus ab. Das erlaubt, den Lernalgorithmus später zu wechseln und den Fortschritt aus dem Log **neu zu berechnen**, statt ihn zu verlieren.

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

Das Normalisieren auf 04:00 sorgt dafür, dass „morgen" auch morgens früh schon „morgen" ist und nicht erst nach 24 Stunden.

Der Dämpfungsfaktor für mühsame Antworten (`hard_factor`) greift auf allen Stufen, nicht erst ab der dritten: eine Vokabel, die beim zweiten Mal nur mit Mühe kam, in drei Tagen wiederzusehen ist zu spät.

Beim Vergessen fällt das Intervall auf **null** zurück, nicht nur die Zähler. Die Karte durchläuft anschließend wieder 1 Tag → 3 Tage → Rampe. Wer hier das alte Intervall stehen lässt, terminiert eine gerade vergessene Karte nach drei richtigen Antworten wieder auf ein halbes Jahr — und genau das macht den Unterschied zwischen „hat es gelernt" und „hat es an diesem Tag geraten".

### 6.3 Session-Zusammenstellung

Eine Quest enthält maximal 15 Items, zusammengestellt in dieser Reihenfolge:

1. Alle Karten in `Relearning` mit `due_at <= now` (Fehler aus dieser Session)
2. Fällige `Review`-Karten, älteste `due_at` zuerst — **maximal 10**
3. Auffüllen mit `New`-Karten aus dem aktiven Set — **maximal 5 neue pro Tag und Lernendem**

Die Deckelung bei 5 neuen Karten pro Tag ist der wichtigste Parameter des ganzen Systems. Wer 40 neue Vokabeln an einem Abend einspeist, erzeugt in den Folgetagen eine Wiederholungslawine, die das Kind sicher zum Abbruch bringt. Der Wert ist pro Lernendem konfigurierbar (`daily_new_limit`, Default 5, Bereich 3–15) und wird im Eltern-Dashboard erklärt, nicht nur als Zahl angeboten.

**Rückstandsbremse.** Das Tagesbudget allein genügt nicht. Es begrenzt den Zufluss, aber nicht das Verhältnis von Zufluss zu Abfluss: Wer nur eine Einheit am Tag schafft, bekommt trotzdem jeden Tag fünf neue Wörter dazu, und der Berg fälliger Wiederholungen wächst über Monate. Deshalb gilt zusätzlich:

> Neue Karten werden nur eingeführt, solange der Rückstand an fälligen Karten in **eine Session** passt (≤ 15).

Das ist keine Feinabstimmung, sondern die Bedingung dafür, dass das System überhaupt funktioniert. Die Simulation über ein Schuljahr (600 Karten, realistisches Antwortverhalten) zeigt den Unterschied:

| Einheiten/Tag | | Spitzenlast | Rückstand am Ende | Median-Intervall |
|---|---|---|---|---|
| 1 | ohne Bremse | 159 | 135 | 8 Tage |
| 1 | **mit Bremse** | **37** | **21** | **40 Tage** |
| 2 | ohne Bremse | 328 | 293 | 7 Tage |
| 2 | **mit Bremse** | **46** | **29** | **51 Tage** |
| 4 | ohne Bremse | 278 | 143 | 47 Tage |
| 4 | **mit Bremse** | **74** | **49** | **54 Tage** |

Die aussagekräftigste Spalte ist die letzte. Ohne Bremse bleibt das Median-Intervall bei sieben bis acht Tagen — das heißt: Nach einem Jahr Lernen ist keine einzige Vokabel wirklich gefestigt, weil jede zu spät drankommt und deshalb wieder vergessen wird. Das Kind arbeitet täglich und kommt nicht voran. Mit Bremse lernt es weniger Wörter (rund 280 statt 535 bei zwei Einheiten täglich), aber die sitzen.

Das ist die pädagogisch richtige Abwägung: Lieber 280 Wörter, die halten, als 535, die nicht halten.

**Klassenarbeit-Modus (Version 1.0):** Vor einer Vokabelarbeit gibt es einen Extramodus, der die Terminierung ignoriert und gezielt alle Karten eines Sets nach Schwierigkeit übt. Diese Durchläufe werden mit `game_key='cram'` geloggt und beeinflussen `review_state` **nicht** — sonst zerstört das Pauken vor der Arbeit die langfristige Terminierung.

### 6.4 Antwortbewertung

Serverseitig, nicht im Client (der Client kennt die Antwort nicht — sonst ist sie im Netzwerk-Tab ablesbar).

```
1. Normalisieren: trim, Mehrfachleerzeichen, Kleinschreibung,
   Unicode NFKC, typografische Apostrophe → '
2. Artikel/Partikel optional: führendes "to " (to go),
   "a "/"an "/"the " sowie deutsches "der/die/das " werden entfernt
3. Exakter Vergleich gegen target_text und alle target_alts → Good/Easy
4. Damerau-Levenshtein-Distanz ≤ 1 bei Wortlänge ≥ 5, bzw. = 0 bei kürzeren
   Wörtern → als richtig werten, aber Grade auf Hard deckeln und Hinweis zeigen:
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
  Response-Item: {
    itemId, cardId, prompt, promptType: "text"|"audio"|"emoji",
    expectedAnswerType: "choice"|"text"|"match"|"order",
    choices?: [...],               // vom Server erzeugte Distraktoren
    hint?: "Tier mit vier Beinen"
  }

POST /api/v1/sessions/{id}/answers → Ergebnis
  Request: { itemId, givenAnswer, answerMs, gameKey }
  Response: { correct, grade, correctAnswer, xpAwarded, coinsAwarded }
```

Ein neues Spiel zu bauen bedeutet damit: eine React-Komponente schreiben, die diese beiden Verträge bedient. Kein Backend-Eingriff, keine Änderung an der Lernengine.

**Distraktoren** (falsche Antwortoptionen) erzeugt der Server, nicht das Spiel — und zwar bevorzugt aus demselben Set und derselben Wortart. „Apfel" gegen `apple / orange / banana / pear` ist eine echte Übung; „Apfel" gegen `apple / school / running / because` ist geraten. Fallback auf zufällige Wörter des Lernenden, wenn zu wenig gleichartige vorhanden sind.

### 7.2 Spielkatalog

| Key | Spiel | Antworttyp | Grade-Ableitung | Version |
|---|---|---|---|---|
| `wordcatcher` | **Wort-Fänger** — Wörter fallen, richtiges antippen | choice | Zeit bis Treffer | MVP |
| `memory` | **Memory** — Emoji/Bild ↔ Wort | match | Anzahl Fehlversuche | MVP |
| `classic` | **Karteikarte** — Wort, umdrehen, tippen | text | Zeit + Levenshtein | MVP |
| `monsterduel` | **Monster-Duell** — richtige Antwort = Schaden | choice/text/order | gemischt | 0.6 |
| `letterchaos` | **Buchstaben-Chaos** — Buchstaben sortieren | order | Anzahl Umsortierungen | 0.6 |
| `timerace` | **Rennen gegen die Zeit** — 60 s, so viele wie möglich | choice | reine Geschwindigkeit | 0.6 |

**Anmerkung zu Wort-Fänger:** Fallende Objekte plus Zeitdruck erzeugen bei manchen Kindern Stress statt Spaß. Die Fallgeschwindigkeit ist deshalb konfigurierbar (`speed: relaxed|normal|fast`) und startet auf `relaxed`. Wenn die Zeit abläuft, gilt das als `Again` — nicht als Niederlage, das Wort fällt einfach langsam nochmal.

**Anmerkung zu Memory:** Memory trainiert primär visuelles Gedächtnis, nicht Vokabelabruf. Es zählt daher nur mit halbem XP-Gewicht und liefert maximal Grade `Good`, nie `Easy`. Es ist ein Belohnungsspiel, kein Prüfspiel — das ist in Ordnung, solange es die Terminierung nicht verzerrt.

### 7.3 Registrierung

```ts
// frontend/src/games/registry.ts
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

Die Session-Engine wählt nur Spiele, deren `supports` zu den Items passt. Ein Spiel hinzufügen = ein Eintrag in der Registry.

---

## 8. Gamification — konkrete Zahlen

Gamification scheitert meist nicht am Konzept, sondern an unausbalancierten Zahlen. Deshalb hier festgelegt:

**XP**

```
korrekte Antwort               10 XP × gameXpWeight
Antwort in < 2 s (Easy)        +5 XP
Session abgeschlossen          +25 XP
alle Items korrekt             +50 XP
Tagesmission erfüllt           +100 XP
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

**Münzen:** 1 Münze pro korrekter Antwort, 20 pro abgeschlossener Session. Ausgabe für Avatar-Items (50–300) und Schatzkisten (100).

**Streaks:** Zählt ein Tag mit ≥ 1 abgeschlossener Session. **Zwei „Streak-Retter" pro Monat** kompensieren automatisch einen verpassten Tag — ohne Rückfrage, ohne Kaufmöglichkeit. Ein an Tag 40 gerissener Streak ist ein realer Abbruchgrund, und ein krankes oder verreistes Kind hat den Ausfall nicht verschuldet. Kein Streak-Zähler auf dem Startbildschirm vor Tag 3.

**Sammelkarten:** Eine Karte je 20 **neu gefestigter** Vokabeln (`repetitions ≥ 3 && ease ≥ 2.0`) — nicht je 20 beantworteter Vokabeln, sonst lässt sich die Sammlung durch stumpfes Wiederholen derselben leichten Wörter farmen. Serien zu je 12 Karten (Tiere, Drachen, Ritter, Fahrzeuge), Raritäten 70 / 25 / 5 %. **Keine lizenzierten Inhalte** (im Ursprungskonzept standen Fußballstars) — Bildrechte an realen Personen sind für ein Open-Source-Projekt nicht handhabbar.

**Tagesmissionen:** Drei pro Tag, aus einem Pool gezogen, alle mit dem Kenntnisstand des Kindes erfüllbar (keine Mission „gewinne 2 Monsterkämpfe", wenn Monster-Duell noch gesperrt ist).

---

## 9. Eltern-Dashboard

Ampeleinstufung pro Vokabel (`VocabularyEntry`, aggregiert über beide Richtungen):

| Ampel | Kriterium |
|---|---|
| 🟢 sicher | beide Karten `repetitions ≥ 3` und `ease ≥ 2.1` und `lapses ≤ 1` |
| 🟡 unsicher | mindestens eine Karte `repetitions ≥ 1`, aber 🟢 nicht erfüllt |
| 🔴 schwierig | `lapses ≥ 3` oder `ease < 1.8` |
| ⚪ neu | noch nie abgefragt |

Ansichten: Wochenübersicht (Minuten pro Tag, Antworten, Trefferquote) · Set-Fortschritt als Ampelbalken · Top-10-Problemwörter mit Fehlversuchen · Streak und Level.

**Was das Dashboard bewusst nicht zeigt:** keine Vergleiche mit anderen Kindern, keine Prognosen („wird die Arbeit nicht bestehen"), keine Minuten-Genauigkeit der Nutzungszeiten. Das Dashboard soll einem Elternteil zeigen, wo es helfen kann — es ist kein Überwachungswerkzeug. Das Kind sieht in seinem Profil, dass Eltern den Fortschritt sehen können; heimliche Überwachung ist ausgeschlossen.

---

## 10. Systemarchitektur

### 10.1 C4 — Container

```
┌──────────────────── Docker-Host (NAS / Mini-PC / Raspberry Pi 5) ────────────────┐
│                                                                                  │
│  ┌─────────────┐   :80/:443                                                      │
│  │  Traefik    │◄──────────── Browser (Tablet, Handy, Laptop im LAN)             │
│  │  (TLS)      │                                                                 │
│  └──┬───────┬──┘                                                                 │
│     │       │                                                                    │
│     │ /     │ /api                                                               │
│     ▼       ▼                                                                    │
│  ┌──────┐ ┌──────────────────┐     ┌────────────┐                                │
│  │ web  │ │  api             │────►│ postgres   │                                │
│  │nginx │ │ ASP.NET Core 10  │     │  17        │                                │
│  │ PWA  │ │                  │     └────────────┘                                │
│  └──────┘ │  ┌────────────┐  │     ┌────────────┐                                │
│           │  │ Learning   │  │────►│ backup     │ (pg_dump, täglich, 14 Tage)    │
│           │  │ Gamif.     │  │     └────────────┘                                │
│           │  │ Content    │  │     ┌────────────┐                                │
│           │  │ Identity   │  │────►│ seq / logs │ (optional)                     │
│           │  │ Reporting  │  │     └────────────┘                                │
│           │  └────────────┘  │                                                   │
│           └──────────────────┘                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Kein Redis, kein Message Broker, kein separater Auth-Server im MVP. Für eine Familie mit drei Kindern ist das Over-Engineering, und jeder zusätzliche Container ist ein Ding, das der Betreiber (also du) warten muss. Bei Schulbetrieb kommen Redis (Session-Cache) und ein Worker-Container dazu — die Anwendung ist zustandslos ausgelegt, das ist dann eine Konfigurationsfrage.

### 10.2 Backend-Struktur — Modularer Monolith

```
src/
  WordQuest.Api/               // Minimal APIs, Endpoint-Definitionen, DI-Root
  WordQuest.Modules.Identity/  // Nutzer, Rollen, PIN, Token
  WordQuest.Modules.Content/   // Sets, Einträge, Karten, Import
  WordQuest.Modules.Learning/  // SM-2, Session-Assembly, Bewertung   ◄ Kern
  WordQuest.Modules.Gamification/
  WordQuest.Modules.Reporting/
  WordQuest.Shared.Kernel/     // TenantContext, Result<T>, Domain-Events
  WordQuest.Infrastructure/    // EF Core, Migrationen, Repositories
tests/
  WordQuest.Learning.Tests/    // ◄ höchste Testabdeckung, siehe unten
```

Module kommunizieren über In-Process-Domain-Events (`CardReviewed` → Gamification vergibt XP), nicht über direkte Referenzen. Das hält die Option offen, einzelne Module später herauszulösen — ohne heute die Komplexität von Microservices zu bezahlen.

**Testfokus:** `WordQuest.Modules.Learning` ist der einzige Teil, in dem ein Fehler *unsichtbar* schadet — ein falsch berechnetes Intervall merkt niemand, aber das Kind lernt schlechter. Dieser Teil bekommt Unit-Tests mit Zielabdeckung > 90 %, inklusive eines Simulationstests, der 365 Tage Lernverhalten mit einem synthetischen Lernenden durchspielt und prüft, dass die tägliche Kartenlast nicht explodiert. UI und CRUD brauchen diese Tiefe nicht.

### 10.3 Architekturentscheidungen (ADRs)

**ADR-001 — Modularer Monolith statt Microservices.** Ein Deployment-Artefakt, eine Datenbank, eine Transaktion. Bei erwarteten 1–30 gleichzeitigen Nutzern pro Instanz ist jede Servicegrenze reine Kosten. Modulgrenzen im Code halten die Option offen.

**ADR-002 — React/TypeScript PWA statt Flutter.** Entscheidend ist Selbsthostbarkeit: Eine PWA wird über eine URL aufgerufen und per „Zum Homescreen" installiert. Eine Flutter-App müsste signiert, verteilt und aktualisiert werden — bei iOS faktisch nur über den App Store oder TestFlight, was dem Selfhosting-Ziel widerspricht. Die PWA ist außerdem konsistent mit der bestehenden Doku. Preis: etwas geringere Animationsperformance und keine echte Push-Notification auf iOS. Beides ist für den Anwendungsfall verschmerzbar.

**ADR-003 — ASP.NET Core 10 (LTS) statt Node.** Folgt der bestehenden Doku und deinem beruflichen Umfeld. Zielframework ist `net10.0`: .NET 8 und 9 erreichen am 10.11.2026 ihr End of Support, .NET 10 läuft bis November 2028. EF Core, Minimal APIs und das eingebaute Identity-Modell decken den Bedarf ab; ein einzelnes Image bleibt unter 120 MB. Gegenargument (ein TypeScript-Sprachraum für Frontend und Backend) ist real, wiegt aber Vertrautheit mit der Plattform nicht auf.

**ADR-004 — PostgreSQL, kein SQLite.** SQLite wäre für eine Einzelfamilie ausreichend und einfacher zu sichern. Aber: gleichzeitige Schreibzugriffe von drei Kindern auf Tablets, und der spätere Schulpfad wäre versperrt. Postgres im Compose-Stack kostet ~150 MB RAM. Akzeptabel.

**ADR-005 — Keine KI im MVP.** Jede KI-Funktion (OCR, Aussprachebewertung, Satzgenerierung) bringt entweder Cloud-Abhängigkeit mit Kinderdaten oder erhebliche lokale Hardwareanforderungen. Der Nutzen für das Kernproblem („mein Sohn behält Vokabeln nicht") ist gegenüber einer korrekt implementierten Spaced-Repetition-Engine gering. Das Backend definiert stattdessen Provider-Interfaces (→ §11), die leer bleiben.

**ADR-006 — Antwortbewertung serverseitig.** Kostet eine Netzwerk-Roundtrip pro Antwort (offline: lokale Vorabbewertung mit serverseitiger Korrektur beim Sync), verhindert aber, dass die Lösung im Client liegt. Bei einem Spiel mit Belohnungen ist das relevant — Kinder finden solche Lücken.

---

## 11. Erweiterungspunkte für KI (nicht im MVP implementiert)

Vier Interfaces werden definiert und mit einer No-Op-Implementierung registriert. Features, deren Provider fehlt, werden im UI gar nicht erst angezeigt.

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

**Realistische Einschätzung zu OCR:** Deutlich einfacher und mit dem besten Nutzen-pro-Aufwand-Verhältnis der vier. Ein Vokabelheft mit zwei sauberen Spalten lässt sich mit Tesseract lokal und kostenlos brauchbar auslesen, wenn das UI anschließend eine Korrekturansicht zeigt, statt blind zu importieren. Das ist der Kandidat für Version 1.0.

---

## 12. API (Auszug)

REST, `/api/v1`, JSON, JWT im `Authorization`-Header. OpenAPI wird generiert.

```
POST   /auth/login                      E-Mail + Passwort → Access + Refresh
POST   /auth/learner-login              learnerId + PIN   → Access + Refresh
POST   /auth/refresh

GET    /learners                        Kinder des Mandanten
POST   /learners
PATCH  /learners/{id}/settings          dailyNewLimit, speed, sounds

GET    /sets
POST   /sets
POST   /sets/{id}/entries
POST   /sets/{id}/import                multipart CSV → Vorschau
POST   /sets/{id}/import/confirm

POST   /sessions                        { learnerId, setId?, gameKey?, size? }
GET    /sessions/{id}
POST   /sessions/{id}/answers
POST   /sessions/{id}/complete          → XP, Münzen, Karten, Missionsfortschritt
POST   /sessions/sync                   Batch-Upload offline erfasster Antworten

GET    /learners/{id}/stats/overview
GET    /learners/{id}/stats/traffic-light?setId=
GET    /learners/{id}/stats/problem-words

GET    /gamification/profile/{learnerId}
GET    /gamification/missions/today
GET    /gamification/collection/{learnerId}
```

Fehlerformat: RFC 9457 (`application/problem+json`). Rate Limiting: 5 Login-Versuche pro Minute pro IP, 10 PIN-Versuche pro Stunde pro Lernendem.

---

## 13. PWA und Offline

**Service Worker** (Workbox): App-Shell und statische Assets `CacheFirst`; API-Lesezugriffe `NetworkFirst` mit 5-Sekunden-Timeout; API-Schreibzugriffe nie cachen, sondern in die Outbox.

**Lokaler Speicher** (IndexedDB via Dexie): der aktive Vokabelsatz, die letzten 200 fälligen Karten mit ihren `ReviewState`-Werten, eine Outbox mit unsynchronisierten Antworten, das Gamification-Profil.

**Offline-Ablauf:** Session wird aus den lokal vorgehaltenen Karten zusammengestellt. Bewertung erfolgt lokal nach denselben Regeln (die Normalisierungs- und Levenshtein-Logik liegt als geteiltes TypeScript-Modul auch im Client vor — die *Terminierung* jedoch nicht). Antworten gehen in die Outbox. Beim nächsten Online-Kontakt: `POST /sessions/sync`, der Server rechnet `review_state` autoritativ neu, XP und Münzen werden serverseitig vergeben und im Client überschrieben.

**Konfliktregel:** Der Server gewinnt immer bei `review_state`. Bei XP gilt „höherer Wert gewinnt" — ein Kind, das offline gespielt hat, verliert nie Punkte. Doppelte `SessionItem`-IDs werden idempotent verworfen (Antworten tragen eine clientseitig erzeugte UUID).

---

## 14. Deployment

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: wordquest
      POSTGRES_USER: wordquest
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    volumes: [ pgdata:/var/lib/postgresql/data ]
    secrets: [ db_password ]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U wordquest"]
      interval: 10s
    restart: unless-stopped

  api:
    image: ghcr.io/<owner>/wordquest-api:${WQ_VERSION:-latest}
    environment:
      ConnectionStrings__Default: Host=db;Database=wordquest;Username=wordquest;Password_File=/run/secrets/db_password
      WQ_JWT_SIGNING_KEY_FILE: /run/secrets/jwt_key
      WQ_AI_PROVIDER: none
      WQ_PUBLIC_URL: https://wordquest.fritz.box
    depends_on:
      db: { condition: service_healthy }
    secrets: [ db_password, jwt_key ]
    restart: unless-stopped

  web:
    image: ghcr.io/<owner>/wordquest-web:${WQ_VERSION:-latest}
    restart: unless-stopped

  proxy:
    image: traefik:v3
    command:
      - --providers.docker
      - --entrypoints.websecure.address=:443
      - --certificatesresolvers.le.acme.dnschallenge=true
    ports: [ "443:443" ]
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt
    restart: unless-stopped

  backup:
    image: prodrigestivill/postgres-backup-local
    environment:
      POSTGRES_HOST: db
      SCHEDULE: "@daily"
      BACKUP_KEEP_DAYS: 14
      BACKUP_KEEP_WEEKS: 8
    volumes: [ ./backups:/backups ]
    restart: unless-stopped

volumes: { pgdata: , letsencrypt: }
secrets:
  db_password: { file: ./secrets/db_password.txt }
  jwt_key:     { file: ./secrets/jwt_key.txt }
```

**Zielbild Erstinstallation:** `git clone`, `./setup.sh` (erzeugt Secrets, fragt die Domain ab), `docker compose up -d`, Browser öffnen, Elternkonto anlegen. Fünf Minuten, keine manuelle SQL-Eingabe, keine Datei von Hand editieren. Migrationen laufen beim API-Start automatisch.

**Zu TLS im Heimnetz:** Eine PWA ist nur über HTTPS installierbar (Ausnahme `localhost`). Im LAN ist das die häufigste Stolperstelle. Empfohlener Weg: eine echte Subdomain (`wordquest.deine-domain.de`) mit Let's-Encrypt-DNS-Challenge, per lokalem DNS auf die interne IP aufgelöst. Das vermeidet Zertifikatswarnungen auf dem Tablet des Kindes — und ein Kind, das eine Sicherheitswarnung wegklicken muss, um zu lernen, ist pädagogisch kein guter Ausgangspunkt. Die Alternative (Reverse Proxy über Cloudflare Tunnel) ist dokumentiert, aber nicht Default, weil sie Daten durch Dritte leitet.

**Hardware-Richtwert:** 2 vCPU, 2 GB RAM, 10 GB Storage. Läuft auf einem Raspberry Pi 5 (arm64-Images werden gebaut) und auf jedem NAS mit Docker.

---

## 15. Sicherheit und Datenschutz

| Thema | Umsetzung |
|---|---|
| Passwörter | ASP.NET Core Identity, PBKDF2 (Default) oder Argon2id |
| PIN | separat gehasht, 10 Fehlversuche/Stunde, dann 15 Minuten Sperre |
| Token | Access 15 min, Refresh 30 Tage rotierend, Reuse-Detection |
| Transport | TLS erzwungen, HSTS, `Secure`/`HttpOnly`/`SameSite=Lax` |
| Autorisierung | `tenant_id` über einen EF-Core-Global-Query-Filter — nicht pro Query von Hand |
| Uploads | CSV/Bilder: Größenlimit, MIME-Prüfung, außerhalb des Webroot |
| Headers | CSP ohne `unsafe-inline`, `X-Content-Type-Options`, `Referrer-Policy` |
| Audit | Anmeldungen, Rollenwechsel, Löschungen im Auditlog |

**Datensparsamkeit:** Pflichtfeld für ein Kind ist ausschließlich ein Anzeigename — ein Spitzname genügt, kein Geburtsdatum, keine E-Mail, keine Klasse. Es existiert keine Telemetrie und kein externer Analytics-Dienst. Alle Schriften und Icons werden mitgeliefert, nicht von einem CDN geladen (ein Google-Fonts-Aufruf überträgt die IP des Kindes an einen Dritten).

**Löschung:** „Kind löschen" entfernt kaskadierend Profil, `review_state`, `review_log` und Gamification-Daten. Ein Datenexport als JSON steht im Eltern-Dashboard bereit. Für den späteren Schulbetrieb sind damit Auskunfts- und Löschpflichten bereits abgedeckt.

**Zum Familienbetrieb:** Solange die Instanz im eigenen Haushalt für die eigenen Kinder läuft, greift die DSGVO über die Haushaltsausnahme (Art. 2 Abs. 2 lit. c) nicht. Relevant wird sie, sobald fremde Kinder Zugang bekommen — also ab dem ersten Schuleinsatz. Die obigen Maßnahmen sind darauf ausgelegt, dass dieser Übergang keine Nacharbeit erfordert. *(Keine Rechtsberatung — bei tatsächlichem Schuleinsatz gehört das dem schulischen Datenschutzbeauftragten vorgelegt.)*

---

## 16. Roadmap

| Meilenstein | Inhalt | Aufwand* |
|---|---|---|
| **0.1** Skelett | Repo, Compose-Stack, Migrationen, Auth (Eltern + PIN), Vokabel-CRUD, CSV-Import | 3–4 Wochen |
| **0.2** Lernengine | SM-2, Session-Assembly, Antwortbewertung, Spiel `classic`, Simulationstest | 2–3 Wochen |
| **0.3** Spiele | `wordcatcher`, `memory`, Spiel-Registry, Distraktorenerzeugung | 2 Wochen |
| **0.4** Gamification | XP, Level, Münzen, Streak, Abschlussbildschirm | 1–2 Wochen |
| **0.5** PWA & Dashboard | Service Worker, Offline-Session, Sync, Eltern-Dashboard mit Ampel | 3 Wochen |
| **→ MVP** | **Nutzbar für deinen Sohn** | **≈ 12–14 Wochen** |
| **0.6** Ausbau | Monster-Duell, Buchstaben-Chaos, TTS, Sammelkarten, Missionen, Avatare, Welten | 4–6 Wochen |
| **1.0** Politur | Onboarding, Setup-Skript, Doku, arm64-Images, Klassenarbeit-Modus, OCR-Import | 4 Wochen |
| **2.0** Schule | Mandanten-UI, Gruppen, Lehrer-Rolle, Bulk-Anlage, LDAP | offen |

\* Nebenberuflich, ca. 8–10 Stunden pro Woche.

**Zu den Migrationen in 0.1:** Das Datenmodell steht im Code, aber eine EF-Core-Migration besteht aus generiertem C# **plus** einem Model-Snapshot, den nur `dotnet ef` korrekt schreiben kann. Die erste Migration wird deshalb einmal lokal erzeugt (`dotnet ef migrations add Initial`) und eingecheckt; danach wendet die API sie beim Start selbst an. Ohne diesen Schritt startet der Container nicht.

**Realistische Einordnung:** 12–14 Wochen bis zum MVP sind bei diesem Umfang nebenberuflich ambitioniert, aber machbar — vorausgesetzt, die Reihenfolge wird eingehalten. Der häufigste Fehlschlag bei solchen Projekten ist, in Woche 2 mit den Minispielen anzufangen, weil sie am meisten Spaß machen, und die Lernengine nie fertigzustellen. Die Engine ist der Teil, der den tatsächlichen Nutzen erzeugt; die Spiele sind die Verpackung.

**Verkürzung, falls schnelle Nutzbarkeit wichtiger ist als Vollständigkeit:** 0.1 bis 0.2 reichen für einen ersten echten Einsatz — Karteikarten mit funktionierender Terminierung sind schon deutlich besser als ein Vokabelheft. Das wären ~6 Wochen bis zum ersten echten Nutzen, mit Spielen als Ausbau danach.

---

## 17. Offene Punkte

| # | Frage | Warum relevant |
|---|---|---|
| O1 | Welches Englischbuch/Lehrwerk? | Bestimmt Wortschatz-Struktur und ob es maschinenlesbare Wortlisten gibt — spart viel Tipparbeit |
| O2 | Welches Gerät nutzt dein Sohn? | Bildschirmgröße bestimmt Layout; iOS bedeutet keine Push-Benachrichtigungen |
| O3 | Wo läuft der Server? | NAS, Mini-PC oder Pi — bestimmt Images und Aufwand fürs TLS-Setup |
| O4 | Soll er mitgestalten dürfen? | Ein Kind, das den Namen seines Monsters aussuchen darf, nutzt die App messbar länger |
| O5 | Lizenz endgültig AGPL-3.0? | Betrifft Sammelkarten-Grafiken und Sounds — die Assets müssen kompatibel lizenziert sein |
| O6 | Repository öffentlich? | Beeinflusst CI-Setup und ob Secrets je im Verlauf lagen |

---

## 18. Abgleich mit dem Ursprungskonzept

| Idee aus deinem Konzept | Übernommen als |
|---|---|
| Welten, Inseln, Dschungel, Weltraum | Visueller Fortschrittspfad, Version 0.6 — kosmetisch, nicht strukturell |
| Fotos vom Vokabelheft | OCR-Provider, Version 1.0 (→ §11) |
| PDF-Upload | Zurückgestellt — schulische Vokabel-PDFs sind zu heterogen für zuverlässiges Parsing; CSV-Import deckt den Fall pragmatisch ab |
| Abenteuer-Modus mit Entdecker-Story | Rahmenerzählung um die Session-Struktur, Version 0.6 |
| Kein Bestrafen | Leitplanke 2, algorithmisch verankert (falsche Antwort kostet 0 XP) |
| Wort-Fänger, Monster-Duell, Memory, Zeitrennen | Spielkatalog §7.2, vollständig übernommen |
| Intelligente Wiederholung (3/7/14 Tage) | Ersetzt durch echtes SM-2 — feste Intervallstufen passen sich nicht an die Schwierigkeit des einzelnen Wortes an, und genau das ist der Punkt |
| Aussprachetrainer mit KI-Bewertung | Interface definiert, Umsetzung Version 1.0+ (→ §11, mit Aufwandsvorbehalt) |
| Sammelkarten alle 20 Vokabeln | Übernommen, Kriterium auf *gefestigte* Vokabeln geschärft (§8) |
| Fußballstar-Karten | **Gestrichen** — Bild- und Persönlichkeitsrechte |
| Tägliche Missionen | Übernommen, §8 |
| Eltern-Dashboard mit Ampel | Übernommen, Kriterien konkretisiert, §9 |
| KI-Wochenreport „Vokabel-Coach" | Interface definiert, Version 1.0+ |
| Level 1–100, Trophäen, Streaks, Schatzkisten, Avatare | Übernommen, mit konkreten Zahlen hinterlegt, §8 |
| Flutter | **Ersetzt** durch React-PWA (ADR-002) |
| Azure Functions | **Ersetzt** durch ASP.NET Core im Container (ADR-003) |
| Familienabo, kostenlose Basisversion | **Gestrichen** — unvereinbar mit Selfhosting (§4) |
