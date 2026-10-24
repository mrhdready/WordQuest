---
name: vokabel-csv
description: Erzeugt Vokabel-Sets (Deutsch/Englisch) als CSV für den WordQuest-Import, passend zu Klassenstufe und Thema deutscher Lehrpläne, und prüft die Datei gegen die Regeln des Imports und des Lernens. Verwenden, wenn neue Vokabeln, ein Vokabelset, eine Vokabelliste oder eine CSV für WordQuest erstellt werden sollen (z. B. „Klasse 4, Thema Tiere“, „Unit-Thema Schule, Klasse 5“).
---

# Vokabel-CSV für WordQuest

Erzeugt ein Set als CSV, das der Import in WordQuest ohne Problemzeilen annimmt (Set öffnen → „Liste importieren (CSV)“ → „Datei wählen“ oder Text einfügen).

## Eingaben

Vom Nutzer erfragen, was fehlt — nicht raten:

- **Klassenstufe** (3–10) oder GER-Stufe (Pre A1 … B1)
- **Thema** (z. B. Tiere, Schule, Essen) — Orientierung: Themen-Matrix in [lehrplan.md](lehrplan.md)
- **Größe** — Standard 12 Einträge (Kl. 3–6: 10–15, ab Kl. 7: bis 20)
- **Zieldatei** — Standard `./<thema>-klasse<N>.csv` im aktuellen Ordner
- optional: Bundesland, Lehrwerk-Unit als *Themen*hinweis, Wörter, die rein oder raus sollen

## Vorgehen

1. Thema und Stufe gegen [lehrplan.md](lehrplan.md) abgleichen. Passt das Thema nicht zur Stufe, das sagen und eine passende Stufe vorschlagen.
2. **Eigene Auswahl** treffen (Rechtliches unten): Grundwortschatz des Themas für diese Stufe, Mix aus etwa 60 % Nomen, 20 % Verben, 20 % Adjektive/Redemittel, dazu 2–4 kurze Redemittel („Wie heißt du?;What's your name?“).
3. Datei schreiben (Format unten), UTF-8, LF. Dateiname klein, ohne Umlaute und Leerzeichen (`haustiere-klasse3.csv`).
4. Prüfen: `node .claude/skills/vokabel-csv/check-csv.mjs <datei>` (aus dem Repo-Root; Node ≥ 18, keine Pakete). Es meldet zwei Arten von Befunden: „Import“ (der Import markiert die Zeile als Problem) und „Qualität“ (der Import nimmt sie an, beim Lernen stört sie). Bei Exit ≠ 0 die gemeldeten Zeilen korrigieren und erneut prüfen, bis Exit 0.
5. Dem Nutzer die Tabelle zeigen (Deutsch | Englisch | Emoji), den Dateipfad und die Prüfausgabe nennen.

## Format

```
Deutsch;Englisch;Emoji
der Hund;dog;🐶
die Katze;cat;🐱
der Radiergummi;rubber/eraser;
Wie heißt du?;What's your name?;
```

- Trennzeichen immer `;`. Erste Zeile genau `Deutsch;Englisch;Emoji` — der Import erkennt sie als Kopfzeile.
- **Deutsch:** Nomen mit bestimmtem Artikel („der Hund“), Verben im Infinitiv („laufen“). Artikel sind bei der Antwort optional, unterscheiden aber Homonyme.
- **Englisch:** Nomen ohne Artikel, Verben ohne „to“ (beides ist bei der Antwort ohnehin optional). Britisches Englisch als Zielwort, amerikanische Variante als Alternative mit `/` („rubber/eraser“, „colour/color“).
- **Kein `,` `|` `"` und kein zweites `;` innerhalb eines Feldes.** WordQuest trennt Antwort-Varianten an `,` `;` `/` `|` — „Yes, please“ würde zu den zwei Antworten „yes“ und „please“. Kommas weglassen oder umformulieren. `/` nur für echte Alternativen.
- **Emoji:** ein passendes Unicode-Emoji oder leer lassen; keine Bilder, keine Shortcodes. Kein Emoji, das die Lösung in Schrift zeigt (z. B. 🆗 für „okay“).
- Jedes Wort höchstens 200 Zeichen, Emoji höchstens 16 Zeichen, keine doppelten Paare.
- **Jede Vokabel wird in beide Richtungen abgefragt** (Deutsch → Englisch und Englisch → Deutsch). Deshalb darf weder ein deutsches noch ein englisches Wort mit zwei verschiedenen Übersetzungen vorkommen („der Hund;dog“ und „der Köter;dog“ wären in der Rückrichtung mehrdeutig).
- Unregelmäßige Plurale als eigene Einträge („die Mäuse;mice“), wenn die Stufe sie verlangt.

## Rechtliches (Pflicht)

- Keine Wortliste aus Schulbüchern (Klett, Cornelsen, Westermann …), Cambridge-YLE oder Oxford 3000/5000 abschreiben, auch nicht in Teilen in deren Reihenfolge. Diese Listen nur als Niveau-Orientierung nutzen. Einzelne Wörter sind frei, Auswahl und Anordnung einer Liste können geschützt sein (§ 4 Abs. 2, § 87b UrhG).
- Keine Lehrwerks- oder Prüfungsnamen in Dateiname oder Inhalt.
- Keine Inhalte aus CC-BY-SA-Quellen (z. B. Wiktionary) übernehmen — Sets sollen später unter CC0 teilbar sein.

## Grenzen

- Die App ignoriert „.“, „!“ und „?“ am Antwortende, auf beiden Seiten (beide Richtungen werden abgefragt). Redemittel wie „What's your name?“ sind deshalb unproblematisch.
- Der Skill erzeugt nur die CSV. Bilder pro Vokabel lädt ein Elternteil in der App hoch.
