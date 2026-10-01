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
4. **Offline lauffähig.** Eine Lernsession muss ohne Netz vollständig durchlaufen. Synchronisation passiert danach. — **geplant, nicht umgesetzt** (v2, `LRN2-02`): Das Frontend ruft `/sessions/sync` nicht auf; im primären HTTP-Betrieb registriert sich kein Service Worker (→ §13).
5. **Datensparsam.** Kein Kindername ist zwingend. Kein Tracking, keine Werbung, keine externen Analytics. Das ist bei einer App für ein 11-jähriges Kind keine Kür.

---

## 3. Rollen und Zugang

| Rolle | Kann | Login |
|---|---|---|
| `Owner` | Instanz verwalten, Backup, Updates, erste Einrichtung | E-Mail + Passwort (optional TOTP: **geplant, nicht umgesetzt**) |
| `Guardian` | Lernende anlegen, Vokabeln pflegen, Dashboard sehen | E-Mail + Passwort |
| `Learner` | Lernen, spielen, Sammlung ansehen | **Profilauswahl + PIN** |

Im Code haben `Owner` und `Guardian` dieselben Rechte (Policy `Guardian` = Rollen `Owner` oder `Guardian`, `Program.cs`).

**Zum Kinder-Login:** Ein Kind soll kein Passwort tippen müssen — das ist die häufigste Abbruchstelle bei Lern-Apps. Stattdessen: Startbildschirm zeigt Avatar-Kacheln, ein Tipp auf den eigenen Avatar, dann eine PIN über ein großes Ziffernfeld. Die PIN schützt nicht gegen Angreifer, sondern gegen das Geschwisterkind — das ist das realistische Bedrohungsmodell im Wohnzimmer. Technisch wird für das Kind ein Refresh-Token (30 Tage, rotierend) auf dem Gerät hinterlegt, sodass die PIN nur bei Profilwechsel oder nach 30 Tagen ohne Nutzung nötig ist. Das PIN-Format wird serverseitig derzeit nicht geprüft; **geplant** für v1.0 sind 4–6 Ziffern (`PAR-02`).

Auf einem Familientablet ist „Gerät ist vertrauenswürdig" die richtige Annahme. Auf einem Schul-Tablet später nicht — dort würde die PIN pro Session erzwungen. Das Feld `Tenant.RequirePinEverySession` existiert im Code, wird aber nicht ausgewertet (**geplant, nicht umgesetzt**; Schulen außer Scope).

---

## 4. Funktionsumfang und Priorisierung

Priorisierung nach MoSCoW, bezogen auf das MVP (= „ein Kind kann damit für die nächste Vokabelarbeit lernen"). Der verbindliche Umfang für v1.0 steht in `.planning/REQUIREMENTS.md`.

### Must — MVP

| # | Feature | Anmerkung |
|---|---|---|
| M1 | Vokabelsets anlegen, Vokabeln manuell erfassen | Schnellerfassung: eine Zeile `Hund = dog`, Tab springt weiter |
| M2 | CSV-Import | Feste Spaltenreihenfolge Quelle; Ziel; [Emoji], Trennzeichen-Erkennung (`;`, `,`, Tab), Vorschau vor dem Import |
| M3 | Spaced Repetition Engine | → §6, das Herzstück |
| M4 | Antwortbewertung mit Tippfehlertoleranz | → §6.4 |
| M5 | Lernsession („Quest") mit definiertem Ende | höchstens 15 Items (ein Zeitlimit gibt es nicht) |
| M6 | Drei Spielmodi: **Karteikarte**, **Wort-Fänger**, **Memory** | → §7; umgesetzt ist im Frontend nur **Karteikarte**, die beiden anderen sind nur im Backend definiert (v2, `LRN2-01`) |
| M7 | XP, Level, Münzen, Tagesstreak | → §8 |
| M8 | Eltern-Dashboard mit Ampel | → §9 |
| M9 | PWA installierbar, Session offline lauffähig | → §13; **geplant, nicht umgesetzt** (v2, `LRN2-02`, `OPS2-01`) |
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

Auszug aus der Migration `20260917045557_Initial`. Aufzählungen (Richtung, Zustand, Bewertung, Wortart) werden als Text gespeichert. `tenant_id` hat keinen Fremdschlüssel auf `tenant`; die Trennung erfolgt über den Query-Filter.

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
  last_reviewed_at timestamptz,
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

`review_log` ist bewusst append-only und wird nie aktualisiert. Alle Auswertungen (Ampel, Wochenreport, Problemwörter) sollen sich daraus ableiten lassen. Das erlaubt, den Lernalgorithmus später zu wechseln und den Fortschritt aus dem Log **neu zu berechnen**, statt ihn zu verlieren. (Die heutige Ampel in §9 liest `review_state`, nicht `review_log`.)

Weil `review_state` und `review_log` keine Fremdschlüssel auf `card` bzw. Lernprofil haben, bleiben beim Löschen eines Sets oder Eintrags Lerndaten zurück. Die Bereinigung ist für v1.0 geplant (`FIX-02`, `PAR-03`).

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

1. Alle Karten in `Relearning` mit `due_at <= now` (Fehler, auch aus früheren Sessions)
2. Fällige `Review`-Karten, älteste `due_at` zuerst — **maximal 10**
3. Auffüllen mit `New`-Karten aus dem aktiven Set (Rezeptionsrichtung EN→DE zuerst) — **maximal 5 neue pro Tag und Lernendem**

Zusätzlich wird eine falsch beantwortete Karte sofort als Wiederholungs-Item an die laufende Session angehängt.

Die Deckelung bei 5 neuen Karten pro Tag ist der wichtigste Parameter des ganzen Systems. Wer 40 neue Vokabeln an einem Abend einspeist, erzeugt in den Folgetagen eine Wiederholungslawine, die das Kind sicher zum Abbruch bringt. Der Wert ist pro Lernendem konfigurierbar (`daily_new_limit`, Default 5, Bereich 3–15) und wird im Eltern-Dashboard erklärt, nicht nur als Zahl angeboten.

**Rückstandsbremse.** Das Tagesbudget allein genügt nicht. Es begrenzt den Zufluss, aber nicht das Verhältnis von Zufluss zu Abfluss: Wer nur eine Einheit am Tag schafft, bekommt trotzdem jeden Tag fünf neue Wörter dazu, und der Berg fälliger Wiederholungen wächst über Monate. Deshalb gilt zusätzlich:

> Neue Karten werden nur eingeführt, solange der Rückstand an fälligen Karten in **eine Session** passt (≤ 15).

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
   Striche vereinheitlicht, abschließende "." und "!" entfernt
2. Artikel/Partikel optional: führendes "to " (to go),
   "a "/"an "/"the " sowie deutsche Artikel ("der/die/das/den/dem/des",
   "ein/eine/…") und "sich "/"zu " werden entfernt
3. Exakter Vergleich gegen die erwartete Antwort und alle Alternativen
   (auch mit ",", ";", "/", "|" getrennte Varianten) → Easy/Good/Hard nach Zeit
4. Damerau-Levenshtein-Distanz ≤ 1 bei erwarteter Antwort ≥ 5 Zeichen, bzw. = 0
   bei kürzeren → als richtig werten, aber Grade auf Hard deckeln und Hinweis zeigen:
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
    emoji?, exampleSentence?, isRetry
  }

POST /api/v1/sessions/{id}/answers → Ergebnis
  Request: { itemId, givenAnswer, answerMs, clientAnswerId?, hintUsed }
  Response: { correct, grade, correctAnswer, message, hadTypo,
              xpAwarded, coinsAwarded, retryItem? }
```

Der Spielschlüssel wird beim Start der Session festgelegt, nicht pro Antwort. Ein neues Spiel zu bauen bedeutet damit: eine React-Komponente schreiben, die diese beiden Verträge bedient, plus ein Eintrag im serverseitigen `GameCatalog` (XP-Gewicht, maximale Bewertung, ob die Terminierung beeinflusst wird). Ein unbekannter Schlüssel fällt auf `classic` zurück. Keine Änderung an der Lernengine.

**Distraktoren** (falsche Antwortoptionen) erzeugt der Server, nicht das Spiel — und zwar bevorzugt aus demselben Set und derselben Wortart. „Apfel" gegen `apple / orange / banana / pear` ist eine echte Übung; „Apfel" gegen `apple / school / running / because` ist geraten. Fallback auf die übrigen Wörter desselben Sets, wenn zu wenig gleichartige vorhanden sind. Es gibt höchstens vier Optionen.

### 7.2 Spielkatalog

| Key | Spiel | Antworttyp | Grade-Ableitung | Stand |
|---|---|---|---|---|
| `classic` | **Karteikarte** — Wort, umdrehen, tippen | text | Zeit + Damerau-Levenshtein | umgesetzt |
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

**Streaks:** Zählt ein Tag mit ≥ 1 abgeschlossener Session. **Zwei „Streak-Retter" pro Monat** kompensieren automatisch genau einen verpassten Tag — ohne Rückfrage, ohne Kaufmöglichkeit. Ein an Tag 40 gerissener Streak ist ein realer Abbruchgrund, und ein krankes oder verreistes Kind hat den Ausfall nicht verschuldet. Kein Streak-Zähler auf dem Startbildschirm vor Tag 3 — **geplant, nicht umgesetzt**: `LearnHomePage.tsx` zeigt den Zähler immer. Bekannter Fehler: Eine gerissene Serie wird bis zur nächsten abgeschlossenen Session als laufend angezeigt (`FIX-05`).

**Sammelkarten (geplant, nicht umgesetzt):** Eine Karte je 20 **neu gefestigter** Vokabeln — nicht je 20 beantworteter Vokabeln, sonst lässt sich die Sammlung durch stumpfes Wiederholen derselben leichten Wörter farmen. „Gefestigt" folgt derselben Regel wie die grüne Ampel in §9 (`repetitions ≥ 3 && ease ≥ 2.1 && lapses ≤ 1`). Serien zu je 12 Karten (Tiere, Drachen, Ritter, Fahrzeuge), Raritäten 70 / 25 / 5 %. **Keine lizenzierten Inhalte** (im Ursprungskonzept standen Fußballstars) — Bildrechte an realen Personen sind für ein Open-Source-Projekt nicht handhabbar. Im Code existiert nur der Zähler `GamificationProfile.MasteredSinceLastCard`, er wird nicht fortgeschrieben.

**Tagesmissionen (geplant, nicht umgesetzt):** Drei pro Tag, aus einem Pool gezogen, alle mit dem Kenntnisstand des Kindes erfüllbar (keine Mission „gewinne 2 Monsterkämpfe", wenn Monster-Duell noch gesperrt ist).

---

## 9. Eltern-Dashboard

Ampeleinstufung pro Vokabel (`VocabularyEntry`, aggregiert über beide Richtungen, `GET /learners/{id}/traffic-light`):

| Ampel | Kriterium |
|---|---|
| 🟢 sicher | beide Karten `repetitions ≥ 3` und `ease ≥ 2.1` und `lapses ≤ 1` |
| 🟡 unsicher | mindestens eine Karte schon vorgelegt, aber weder 🟢 noch 🔴 erfüllt |
| 🔴 schwierig | `lapses ≥ 3` oder `ease < 1.8` (bei einer der beiden Karten) |
| ⚪ neu | noch nie vorgelegt |

Dieselbe Schwelle (`ease ≥ 2.1`) gilt für „gefestigte Karten" in der Übersicht. Heute steht die Regel an zwei Stellen in `LearnerEndpoints.cs`; sie soll einmal definiert werden (`FIX-06`).

Umgesetzt sind die Übersicht (`GET /learners/{id}/overview`: Level, XP, Münzen, Streak, heute fällig, neue Karten übrig, gefestigte Karten) und die Ampel je Set. **Geplant, nicht umgesetzt** (v2, `PAR2-03`): Wochenübersicht (Minuten pro Tag, Antworten, Trefferquote) · Top-10-Problemwörter mit Fehlversuchen.

**Was das Dashboard bewusst nicht zeigt:** keine Vergleiche mit anderen Kindern, keine Prognosen („wird die Arbeit nicht bestehen"), keine Minuten-Genauigkeit der Nutzungszeiten. Das Dashboard soll einem Elternteil zeigen, wo es helfen kann — es ist kein Überwachungswerkzeug. Das Kind sieht in seinem Profil, dass Eltern den Fortschritt sehen können; heimliche Überwachung ist ausgeschlossen.

---

## 10. Systemarchitektur

### 10.1 C4 — Container

Das Bild zeigt die Variante mit Domain und TLS (`docker-compose.yml`). Primärer Betrieb für v1.0 ist das Heimnetz über HTTP ohne Traefik: `docker-compose.quick.yml` liefert `web` auf Port 8080 aus und wird für v1.0 betriebstauglich gemacht (`SETUP-01`). Die Domain-Variante bleibt für fortgeschrittene Nutzer bestehen.

```
┌──────────────────── Docker-Host (NAS / Mini-PC / Raspberry Pi 5) ────────────────┐
│                                                                                  │
│  ┌─────────────┐   :80/:443                                                      │
│  │  Traefik    │◄──────────── Browser (Tablet, Handy, Laptop im LAN)             │
│  │  (TLS)      │                                                                 │
│  └──────┬──────┘                                                                 │
│         │                                                                        │
│         ▼                                                                        │
│  ┌──────────────┐  /api   ┌──────────────────┐     ┌────────────┐                │
│  │ web          │────────►│  api             │────►│ postgres   │                │
│  │ nginx + PWA  │         │ ASP.NET Core 10  │     │  17        │                │
│  └──────────────┘         │                  │     └────────────┘                │
│                           │  ┌────────────┐  │     ┌────────────┐                │
│                           │  │ Learning   │  │     │ backup     │ (pg_dump,      │
│                           │  │ Gamif.     │  │     └────────────┘  täglich)      │
│                           │  │ Content    │  │                                   │
│                           │  │ Identity   │  │                                   │
│                           │  └────────────┘  │                                   │
│                           └──────────────────┘                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Traefik leitet alle Anfragen an `web`; nginx im `web`-Container reicht `/api/` und `/health/` an `api` weiter (`frontend/nginx.conf`). Der `backup`-Container verbindet sich mit `postgres`, nicht mit `api`. Aufbewahrung: 14 Tage, 8 Wochen, 6 Monate. In der HTTP-Variante (`docker-compose.quick.yml`) gibt es heute weder Traefik noch Backup. Ein optionaler Log-Container (seq) ist nicht vorhanden.

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

**Verworfen / zurückgestellt:** Ein Modul `WordQuest.Modules.Reporting` gibt es nicht; die Auswertungen liegen in `LearnerEndpoints.cs`. `Result<T>`, In-Process-Domain-Events (z. B. `CardReviewed`) und Repositories gibt es ebenfalls nicht und sie sind nicht geplant.

**Architekturhaltung: DDD-light.** Die Module sind grobe Bounded Contexts. Sie enthalten Entitäten und reine Domänendienste ohne EF- oder HTTP-Abhängigkeit (`Sm2Scheduler`, `SessionComposer`, `AnswerEvaluator`, `XpRules`, `StreakRules`, `LevelCurve`). Einzige Modulabhängigkeit: `Learning` → `Content`. Aggregates, Domain-Events und Repositories werden bewusst nicht eingeführt; volles DDD ist nicht geplant. Die Orchestrierung einer Session (Auswahl, Bewertung, Terminierung, Protokoll, Belohnung) liegt im `LearningService` in `WordQuest.Infrastructure`, der die Gamification-Regeln direkt aufruft. Endpunkte bleiben dünn; nicht triviale Logik gehört in Module oder Services.

**Testfokus:** `WordQuest.Modules.Learning` ist der einzige Teil, in dem ein Fehler *unsichtbar* schadet — ein falsch berechnetes Intervall merkt niemand, aber das Kind lernt schlechter. Dieser Teil bekommt Unit-Tests (Ziel: Abdeckung > 90 %; in CI wird keine Abdeckung gemessen), inklusive eines Simulationstests, der 365 Tage Lernverhalten mit einem synthetischen Lernenden durchspielt und prüft, dass die tägliche Kartenlast nicht explodiert (`YearLongSimulationTests`). UI und CRUD brauchen diese Tiefe nicht; API-Integrationstests gegen echtes PostgreSQL sind für v1.0 geplant (`QUAL-01`).

**Testvorgehen:** Neue Funktionen entstehen testgetrieben (TDD). Ein Bugfix beginnt mit einem Test, der den Fehler reproduziert und zunächst fehlschlägt.

### 10.3 Architekturentscheidungen (ADRs)

**ADR-001 — Modularer Monolith statt Microservices.** Ein Deployment-Artefakt, eine Datenbank, eine Transaktion. Bei erwarteten 1–30 gleichzeitigen Nutzern pro Instanz ist jede Servicegrenze reine Kosten. Modulgrenzen im Code halten die Option offen. Innerhalb der Module gilt DDD-light (→ §10.2).

**ADR-002 — React/TypeScript PWA statt Flutter.** Entscheidend ist Selbsthostbarkeit: Eine PWA wird über eine URL aufgerufen und per „Zum Homescreen" installiert. Eine Flutter-App müsste signiert, verteilt und aktualisiert werden — bei iOS faktisch nur über den App Store oder TestFlight, was dem Selfhosting-Ziel widerspricht. Die PWA ist außerdem konsistent mit der bestehenden Doku. Preis: etwas geringere Animationsperformance und keine echte Push-Notification auf iOS. Beides ist für den Anwendungsfall verschmerzbar. Die Installation als PWA setzt HTTPS voraus; im primären HTTP-Heimnetzbetrieb von v1.0 läuft die App als normale Browser-App.

**ADR-003 — ASP.NET Core 10 (LTS) statt Node.** Folgt der bestehenden Doku und dem beruflichen Umfeld des Maintainers. Zielframework ist `net10.0`: .NET 8 und 9 erreichen am 10.11.2026 ihr End of Support, .NET 10 läuft bis November 2028. EF Core und Minimal APIs decken den Bedarf ab. ASP.NET Core Identity wird nicht verwendet; Passwort-Hashing (PBKDF2) und JWT-Ausgabe sind im Projekt selbst implementiert. Ziel für die Imagegröße: unter 120 MB (nicht gemessen). Gegenargument (ein TypeScript-Sprachraum für Frontend und Backend) ist real, wiegt aber Vertrautheit mit der Plattform nicht auf.

**ADR-004 — PostgreSQL, kein SQLite.** SQLite wäre für eine Einzelfamilie ausreichend und einfacher zu sichern. Aber: gleichzeitige Schreibzugriffe von drei Kindern auf Tablets, und der spätere Schulpfad wäre versperrt. Postgres im Compose-Stack kostet ~150 MB RAM. Akzeptabel.

**ADR-005 — Keine KI im MVP.** Jede KI-Funktion (OCR, Aussprachebewertung, Satzgenerierung) bringt entweder Cloud-Abhängigkeit mit Kinderdaten oder erhebliche lokale Hardwareanforderungen. Der Nutzen für das Kernproblem („das Kind behält Vokabeln nicht") ist gegenüber einer korrekt implementierten Spaced-Repetition-Engine gering. Provider-Interfaces (→ §11) sind vorgesehen, aber noch nicht im Code definiert.

**ADR-006 — Antwortbewertung serverseitig.** Kostet eine Netzwerk-Roundtrip pro Antwort (offline: lokale Vorabbewertung mit serverseitiger Korrektur beim Sync — **geplant, nicht umgesetzt**, v2), verhindert aber, dass die Lösung im Client liegt. Bei einem Spiel mit Belohnungen ist das relevant — Kinder finden solche Lücken.

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

GET    /learners                        Kinder des Mandanten
POST   /learners                        displayName, avatarKey?, pin?
PATCH  /learners/{id}/settings          dailyNewLimit, speed, soundEnabled, pin
GET    /learners/{id}/overview          Level, XP, Streak, fällig, gefestigt
GET    /learners/{id}/traffic-light?setId=

GET    /sets
POST   /sets
DELETE /sets/{id}
GET    /sets/{id}/entries
POST   /sets/{id}/entries
DELETE /sets/{id}/entries/{entryId}
POST   /sets/import/preview             CSV-Text als JSON → Vorschau
POST   /sets/{id}/import                bestätigte Einträge

POST   /sessions                        { learnerId, setId?, gameKey?, size? }
POST   /sessions/{id}/answers
POST   /sessions/{id}/complete          → XP, Münzen, Level, Streak
POST   /sessions/sync                   Batch-Upload offline erfasster Antworten einer Session
GET    /sessions/games                  Spielkatalog (Key, Titel, XP-Gewicht)
```

`/sessions/sync` existiert serverseitig, wird vom Frontend aber nicht aufgerufen (Offline-Lernen ist v2, `LRN2-02`).

**Geplant, nicht umgesetzt:** `GET /sessions/{id}` · `GET /learners/{id}/stats/problem-words` (v2, `PAR2-03`) · `GET /gamification/profile/{learnerId}` · `GET /gamification/missions/today` · `GET /gamification/collection/{learnerId}`.

Fehlerformat: RFC 9457 (`application/problem+json`). Rate Limiting: 10 Anfragen pro Minute pro IP auf allen `/auth`-Routen, einschließlich `refresh`. Weil im Heimnetz hinter dem Proxy alle Geräte dieselbe IP haben, kann ein Familienmitglied die anderen aussperren (bekannter Fehler, `FIX-01`). PIN: nach 10 Fehlversuchen in Folge wird das Profil 15 Minuten gesperrt.

---

## 13. PWA und Offline

**Service Worker** (Workbox über `vite-plugin-pwa`): App-Shell und statische Assets werden vorab gecacht; API-Lesezugriffe (`GET /api/…`) `NetworkFirst` mit 5-Sekunden-Timeout; API-Schreibzugriffe werden nicht gecacht. Der Service Worker registriert sich nur über HTTPS (oder `localhost`), im primären HTTP-Heimnetzbetrieb also nicht.

**Geplant, nicht umgesetzt (v2, `LRN2-02`)** — der Rest dieses Abschnitts beschreibt das Zielbild. Dexie und IndexedDB werden heute nicht verwendet.

**Lokaler Speicher** (IndexedDB): der aktive Vokabelsatz, die letzten 200 fälligen Karten mit ihren `ReviewState`-Werten, eine Outbox mit unsynchronisierten Antworten, das Gamification-Profil.

**Offline-Ablauf:** Session wird aus den lokal vorgehaltenen Karten zusammengestellt. Bewertung erfolgt lokal nach denselben Regeln (die Normalisierungs- und Levenshtein-Logik liegt als geteiltes TypeScript-Modul auch im Client vor — die *Terminierung* jedoch nicht). Antworten gehen in die Outbox. Beim nächsten Online-Kontakt: `POST /sessions/sync`, der Server rechnet `review_state` autoritativ neu, XP und Münzen werden serverseitig vergeben und im Client überschrieben.

**Konfliktregel:** Der Server gewinnt immer bei `review_state`. Bei XP gilt „höherer Wert gewinnt" — ein Kind, das offline gespielt hat, verliert nie Punkte. Doppelte Antworten werden idempotent verworfen (Antworten tragen eine clientseitig erzeugte UUID). Serverseitig bereits umgesetzt: eindeutiger Index auf `session_item.client_answer_id`; ein schon beantwortetes Item liefert das gespeicherte Ergebnis ohne erneute Wertung.

---

## 14. Deployment

Die Compose-Dateien im Repository sind die Quelle; hier steht nur die Übersicht.

| Datei | Zweck | Stand |
|---|---|---|
| `docker-compose.quick.yml` | Heimnetz über HTTP, `http://<host>:8080`, kein Traefik, kein Zertifikat | **primärer Betrieb für v1.0**; heute noch als Probebetrieb markiert: bekannte Standardwerte für DB-Passwort und JWT-Schlüssel, Demo-Daten an, kein Backup. Betriebstauglich machen: `SETUP-01`, `SETUP-02`, `SETUP-05` |
| `docker-compose.yml` | Domain + Traefik v3 + Let's Encrypt (DNS-Challenge), Secrets als Dateien, tägliches Backup | für fortgeschrittene Nutzer; wird in v1.0 nicht erweitert |
| `docker-compose.build.yml` | Images aus dem Quellcode bauen (zusätzlich zu `docker-compose.yml`) | — |
| `docker-compose.dev.yml` | Entwicklung | — |

Images: `${WQ_IMAGE_PREFIX}-api` und `${WQ_IMAGE_PREFIX}-web`, Tag `${WQ_VERSION:-master}`. Versionierte Tags (z. B. `1.0.0`) statt `master` sind für v1.0 geplant (`REL-04`). Die CI baut die Images für `linux/amd64` und `linux/arm64`.

**Zielbild Erstinstallation:** `git clone`, `./setup.sh`, `docker compose up -d`, Browser öffnen, anmelden. Fünf Minuten, keine manuelle SQL-Eingabe. Migrationen laufen beim API-Start automatisch. Heute erzeugt `setup.sh` die Secrets und fragt Hostname, E-Mail für Let's Encrypt und Image-Präfix ab; die Zugangsdaten des DNS-Providers müssen von Hand in `.env` eingetragen werden. Ein Elternkonto legt `setup.sh` noch nicht an — ohne Demo-Daten gibt es heute keinen Weg zum ersten Login. Geplant: `setup.sh` fragt E-Mail und Passwort ab und legt das Konto an (`SETUP-02`); Update und Wiederherstellung über `upgrade.sh` und `restore.sh` (`REL-01`, `REL-02`).

**Zu TLS im Heimnetz:** Eine PWA ist nur über HTTPS installierbar (Ausnahme `localhost`). Im LAN ist das die häufigste Stolperstelle. Für v1.0 ist deshalb der HTTP-Betrieb ohne Domain der Standard — ohne Zertifikatswarnungen, dafür ohne PWA-Installation. Für fortgeschrittene Nutzer bleibt der Weg über eine echte Subdomain (`wordquest.deine-domain.de`) mit Let's-Encrypt-DNS-Challenge, per lokalem DNS auf die interne IP aufgelöst. Das vermeidet Zertifikatswarnungen auf dem Tablet des Kindes — und ein Kind, das eine Sicherheitswarnung wegklicken muss, um zu lernen, ist pädagogisch kein guter Ausgangspunkt. Die Alternative (Reverse Proxy über Cloudflare Tunnel) ist nicht Default, weil sie Daten durch Dritte leitet.

**Hardware-Richtwert:** 2 vCPU, 2 GB RAM, 10 GB Storage. Läuft auf einem Raspberry Pi 5 (arm64-Images werden gebaut) und auf jedem NAS mit Docker.

---

## 15. Sicherheit und Datenschutz

| Thema | Umsetzung |
|---|---|
| Passwörter | PBKDF2-HMAC-SHA256, 210 000 Iterationen, eigene Implementierung (`PasswordHasher.cs`), kein ASP.NET Core Identity |
| PIN | separat gehasht (gleiches Verfahren), 10 Fehlversuche in Folge, dann 15 Minuten Sperre |
| Token | Access 15 min, Refresh 30 Tage rotierend, Reuse-Detection; gespeichert wird nur der Hash des Refresh-Tokens |
| Transport | HSTS außerhalb von Development; TLS nur in der Domain-Variante. Keine Cookies: Tokens liegen im `localStorage` und gehen im `Authorization`-Header (bewusst akzeptiertes Risiko) |
| Autorisierung | `tenant_id` über einen EF-Core-Global-Query-Filter — nicht pro Query von Hand; zusätzlich darf ein Kind nur für sich selbst lernen (`MayActFor`, Geschwister teilen den Mandanten) |
| Uploads | CSV wird als Text im JSON-Body übertragen, es gibt keinen Datei- oder Bild-Upload. Größenlimit: **geplant, nicht umgesetzt** (v2, `OPS2-03`) |
| Headers | CSP in `frontend/nginx.conf`, derzeit mit `style-src 'unsafe-inline'`; `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` |
| Audit | Auditlog für Anmeldungen, Rollenwechsel, Löschungen: **geplant, nicht umgesetzt** |

**Datensparsamkeit:** Pflichtfeld für ein Kind ist ausschließlich ein Anzeigename — ein Spitzname genügt, kein Geburtsdatum, keine E-Mail, keine Klasse. Es existiert keine Telemetrie und kein externer Analytics-Dienst. Alle Schriften und Icons werden mitgeliefert, nicht von einem CDN geladen (ein Google-Fonts-Aufruf überträgt die IP des Kindes an einen Dritten); die CSP erlaubt Schriften nur von der eigenen Origin.

**Löschung:** „Kind löschen" soll kaskadierend Profil, `review_state`, `review_log` und Gamification-Daten entfernen — **geplant für v1.0** (`PAR-03`); einen Endpunkt dafür gibt es heute nicht. Datenexport als JSON und Löschen der ganzen Familie: v2 (`PAR2-02`). Löschen ist als gute Praxis gedacht, nicht als Zusage, DSGVO-Pflichten zu erfüllen.

**Zum Familienbetrieb:** Solange die Instanz im eigenen Haushalt für die eigenen Kinder läuft, greift die DSGVO über die Haushaltsausnahme (Art. 2 Abs. 2 lit. c) nicht. Relevant würde sie, sobald fremde Kinder Zugang bekommen — etwa bei einem Schuleinsatz, der für v1.0 außer Scope ist. *(Keine Rechtsberatung — bei tatsächlichem Schuleinsatz gehört das dem schulischen Datenschutzbeauftragten vorgelegt.)*

---

## 16. Roadmap

Die gültige Roadmap steht in `.planning/ROADMAP.md`, die Anforderungen in `.planning/REQUIREMENTS.md`. Versionspläne werden nur dort gepflegt, nicht in diesem Dokument.

Stand v1.0 in einem Satz: Aus dem vorhandenen Lernkern wird eine funktionierende, sichere Basis, die eine andere Familie im Heimnetz betreiben kann (sichere HTTP-Installation, Fehlerbehebungen und Integrationstests, versioniertes Release mit Update- und Restore-Skripten).

**Langfristige Ideen (ungeplant):**

- Spiele im Frontend: Wort-Fänger und Memory (v2, `LRN2-01`); Monster-Duell, Buchstaben-Chaos, Rennen gegen die Zeit
- Offline-Lernen mit Outbox (v2, `LRN2-02`), PWA-Installation über Domain und TLS (v2, `OPS2-01`)
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
