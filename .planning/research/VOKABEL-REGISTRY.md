# Vokabel-Registry — Vorschlag (v2, `CNT2-01`)

Stand 2026-10-22. Entscheidung Dennis: auf v2.0 verschoben. Grundlage: [VOKABEL-LEHRPLAN.md](VOKABEL-LEHRPLAN.md) (Lehrpläne, Lizenzen, Didaktik mit Quellen) und der Skill `.claude/skills/vokabel-csv/`.

## Randbedingung

Die CSP erlaubt nur Verbindungen zur eigenen Adresse (`connect-src 'self'`, `frontend/nginx-security-headers.conf`). Ein Abruf aus dem Internet im Browser ist damit gesperrt und würde vom Kindergerät nach draußen gehen.

## Stufen

1. **Sammlung im Repo, Download per Hand** (keine App-Änderung): `vokabeln/<klasse-N>/<thema>.csv` plus `vokabeln/index.json` (`id`, `titel`, `klasse`, `ger`, `thema`, `anzahl`, `lizenz`, `version`). CI prüft jede Datei mit `check-csv.mjs` und den Index gegen die Dateien. Eltern laden eine CSV und nutzen „Datei wählen“.
2. **„Aus der Bibliothek“ neben „Datei wählen“:** Die Sets werden beim Bauen ins Web-Image gelegt (gleiche Herkunft, z. B. `/vokabeln/index.json`). Liste nach Klasse und Thema, ein Klick füllt das Import-Textfeld, Vorschau und Übernehmen wie bisher. Keine CSP-Änderung, kein Internet nötig, kein Backend. Grenze: neue Sets kommen mit dem nächsten Update.
3. **Neue Sets ohne App-Update** (nur bei Bedarf): Die API lädt Index und Sets vom Server aus (Cache, Prüfsumme). Braucht Internet am Heimserver, deutlich komplexer.

## Leitplanken

- Lizenz CC0 1.0 für alle Sets; Beitragende bestätigen eigene Arbeit oder CC0-Quelle. Keine CC-BY-SA-Quellen (z. B. Wiktionary).
- Keine 1:1-Übernahme von Lehrwerk-, Cambridge- oder Oxford-Listen; keine Lehrwerks- oder Prüfungsnamen (§ 4 Abs. 2, § 87b UrhG).
- Emojis nur als Unicode-Zeichen.
- Wachstum: Skill erzeugt → Mensch prüft Inhalt → PR in `vokabeln/` → CI → nächstes Release. Start: 3–4 Sets je Klasse 3–6 entlang der Themen-Matrix.
- Ordner im WordQuest-Repo (Stufe 2 bringt die Sets ohne Umweg ins Image).
