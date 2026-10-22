// Prueft eine Vokabel-CSV fuer WordQuest. Zwei Arten von Regeln:
// - Import: was der Import als Problemzeile markiert (CsvVocabularyParser.cs,
//   ContentRules.cs). Grenzen hier nachziehen, wenn sie dort geaendert werden.
// - Qualitaet: was der Import annimmt, beim Lernen aber stoert
//   (TextNormalizer.SplitVariants trennt Antworten an , ; / |; jede Vokabel
//   wird in beide Richtungen abgefragt, VocabularyEntry.CreateDefaultCards).
// Aufruf: node check-csv.mjs <datei.csv>   Exit 0 = keine Befunde.
import { readFileSync } from 'node:fs'

const MAX_TEXT = 200 // ContentRules.MaxTextLength
const MAX_EMOJI = 16 // ContentRules.MaxEmojiLength, in UTF-16-Einheiten wie string.Length
const HEADER = 'Deutsch;Englisch;Emoji'

const file = process.argv[2]
if (!file) {
  console.error('Aufruf: node check-csv.mjs <datei.csv>')
  process.exit(2)
}

let text
try {
  // TextDecoder entfernt ein BOM selbst; der Import akzeptiert es ebenfalls.
  text = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(file))
} catch {
  console.error(`${file}: keine gültige UTF-8-Datei.`)
  process.exit(1)
}

const problems = []
const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
if (lines[0] !== HEADER) problems.push(`Qualität, Zeile 1: Kopfzeile soll genau "${HEADER}" sein.`)

const pairs = new Set()
const bySource = new Map()
const byTarget = new Map()
let entries = 0
for (let i = 1; i < lines.length; i++) {
  const n = i + 1
  const fields = lines[i].split(';')
  if (fields.length < 2 || fields.length > 3) {
    problems.push(`Qualität, Zeile ${n}: erwartet 2 oder 3 Felder mit ";" getrennt, gefunden ${fields.length}.`)
    continue
  }
  const [source, target, emoji = ''] = fields.map((f) => f.trim())
  entries++
  if (!source || !target) {
    problems.push(`Import, Zeile ${n}: Deutsch und Englisch müssen befüllt sein.`)
    continue
  }
  for (const [name, value] of [['Deutsch', source], ['Englisch', target]]) {
    if (value.length > MAX_TEXT) problems.push(`Import, Zeile ${n}: ${name} ist länger als ${MAX_TEXT} Zeichen.`)
    if (/[,|"]/.test(value)) problems.push(`Qualität, Zeile ${n}: ${name} enthält , | oder " — die Antwort zerfällt in Varianten.`)
  }
  if (emoji.length > MAX_EMOJI) problems.push(`Import, Zeile ${n}: Emoji ist länger als ${MAX_EMOJI} Zeichen.`)
  if (/[A-Za-z]{2}|^:\w+:$/.test(emoji)) problems.push(`Qualität, Zeile ${n}: Emoji-Spalte enthält Text statt eines Emojis.`)

  const pair = `${source}\0${target}`.toLowerCase()
  if (pairs.has(pair)) problems.push(`Import, Zeile ${n}: doppelter Eintrag.`)
  pairs.add(pair)
  // Beide Richtungen werden abgefragt: gleiche Frage mit anderer Lösung ist mehrdeutig.
  for (const [map, key, other, name] of [[bySource, source, target, 'Deutsch'], [byTarget, target, source, 'Englisch']]) {
    const k = key.toLowerCase()
    if (map.has(k) && map.get(k) !== other.toLowerCase()) {
      problems.push(`Qualität, Zeile ${n}: ${name} „${key}“ kommt mit anderer Übersetzung schon vor — die Abfrage wäre mehrdeutig.`)
    }
    map.set(k, other.toLowerCase())
  }
}

if (entries === 0) problems.push('Import: keine Vokabeln nach der Kopfzeile.')

if (problems.length) {
  console.error(problems.join('\n'))
  console.error(`FEHLER: ${problems.length} Befund(e) in ${file}.`)
  process.exit(1)
}
console.log(`OK: ${entries} Vokabeln, importierbar (${file}).`)
