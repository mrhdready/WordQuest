# Lernwörter — Modul-Vorschlag (v2, `SPL2-01` bis `SPL2-06`)

Stand 2026-10-25. Idee und Entscheidungen von Dennis, zur Diskussion mit dem Owner. Kein v1-Scope.

## Ziel

Das Kind sieht nur ein Bild und schreibt das Wort dazu. Es geht um die richtige Schreibweise eines Wortes in einer Sprache, nicht um eine Übersetzung. Beispiel: Bild eines Fahrrads, erwartet wird „Fahrrad“.

## Entscheidungen (Dennis, 2026-10-25)

1. Strenge Bewertung: Groß- und Kleinschreibung zählt, ein Tippfehler ist falsch. Die richtige Schreibweise wird danach angezeigt.
2. Ob der Artikel („das Fahrrad“) Pflicht ist, stellen die Eltern pro Set ein.
3. Jedes Wort braucht ein Bild. Ein Emoji am Eintrag reicht als Bild (wie heute bei Farben oder „Hund“ 🐶); fehlt es, muss ein Elternteil ein Bild hochladen.
4. Die Rückmeldung markiert die falschen Buchstaben (Dennis, 2026-10-25).
5. Barrierefreiheit über Anhören (Diktat): Stufe 1 ist ein Knopf „Anhören“, der das Wort mit der Sprachausgabe des Browsers vorliest (Web Speech API `speechSynthesis`, keine neue Abhängigkeit, kein Internet). Stufe 2 (später): Eltern sprechen das Wort selbst ein; die Aufnahme wird wie ein Bild gespeichert und gesichert. Cloud-Dienste (z. B. ElevenLabs) und eine Sprachsynthese auf dem Server (Piper) sind verworfen: Konto, Schlüssel, Kosten bzw. zusätzlicher Container widersprechen dem Kernwert. Die Bildpflicht bleibt; Anhören ergänzt das Bild, ersetzt es nicht.

## Zuschnitt als Modul

Ein Set bekommt eine Art: `Vokabeln` (heute) oder `Lernwörter`. Das Modul ist der Teil, der nur für `Lernwörter` gilt. Es hängt sich an bestehende Stellen, statt sie zu kopieren:

| Bereich | Heute | Lernwörter |
|---|---|---|
| Set (`VocabularySet.cs`) | Quell- und Zielsprache | Art `Lernwörter`, eine Sprache, Einstellung „Artikel Pflicht“ |
| Eintrag (`VocabularyEntry.cs`) | `SourceText` und `TargetText` | nur das Wort; Bild oder Emoji Pflicht |
| Bild (`vocabulary_picture`, Phase 3.1.1) | optional | Pflicht, sonst Emoji |
| Bewertung (`AnswerEvaluator.cs`, `TextNormalizer.cs`) | Kleinschreibung, ein Tippfehler zählt als richtig, Artikel optional | eigene strenge Regel: exakt nach Unicode-Normalisierung und Trimmen; Artikel je nach Set-Einstellung |
| Lernrunde (`SessionPage.tsx`) | Text als Frage, Spielarten mit Auswahl | Bild als Frage, nur Eintippen |
| Wiederholung, XP, Serie, Level | SM-2 und Gamification | unverändert mitbenutzt |

Kein eigenes Backend-Projekt neben `Content` und `Learning`: Das Modul ist ein Set-Typ plus eine zweite Bewertungsregel. Ein eigenes Projekt hätte dieselben Entitäten und Dienste doppelt (AGENTS.md: DDD-light, keine Abstraktion für einen einzelnen Fall). Steht das zur Diskussion, wäre die Grenze die Bewertungsregel.

## Anforderungen

- **SPL2-01**: Eltern legen ein Set der Art „Lernwörter“ an (eine Sprache, Einstellung „Artikel Pflicht“ ja/nein). Ein Eintrag besteht aus dem Wort und braucht ein Bild oder ein Emoji; ohne beides lässt er sich nicht speichern. Der CSV-Import übernimmt Zeilen ohne Emoji erst, wenn ein Bild ergänzt ist, und sagt das in einem deutschen Satz.
- **SPL2-02**: In der Lernrunde eines Lernwörter-Sets sieht das Kind nur das Bild (bzw. das Emoji) und tippt das Wort. Der Bildtext für Screenreader verrät das Wort nicht.
- **SPL2-03**: Der Server bewertet streng: Groß- und Kleinschreibung zählt, jeder Tippfehler ist falsch, der Artikel nach der Set-Einstellung. Bei einem Fehler zeigt die Rückmeldung die richtige Schreibweise und markiert die Stellen, an denen die Eingabe abweicht.
- **SPL2-04**: Wiederholung, XP, Serie und Fortschritt gelten wie bei Vokabel-Sets; die Eltern sehen Lernwörter-Sets in der Fortschrittsansicht.
- **SPL2-05**: Knopf „Anhören“ in der Lernwörter-Runde liest das Wort mit der Sprachausgabe des Browsers vor (Diktat), per Tastatur erreichbar; fehlt eine Stimme für die Sprache, wird der Knopf mit einem deutschen Hinweis deaktiviert statt still zu versagen.
- **SPL2-06** (später): Eltern können pro Wort eine eigene Aufnahme hinterlegen; sie wird statt der Sprachausgabe abgespielt und wie Bilder gespeichert, gesichert und wiederhergestellt.

## Offene Punkte für die Diskussion

- Anhören: Die Qualität deutscher Stimmen auf Android-Geräten ist an echten Geräten zu prüfen.
- Emoji als Bild: Mehrdeutige Emojis (🐶 als „Hund“ oder „Welpe“) gehen zu Lasten der Eltern. Reicht ein Hinweis beim Anlegen?
- Eine mitgelieferte Bildersammlung wäre bequemer, ist aber eine Lizenzfrage (vgl. `CNT2-01`, `VOKABEL-REGISTRY.md`).
