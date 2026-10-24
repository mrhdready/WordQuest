#!/usr/bin/env node
/*
  Gate gegen alte Klassen, Inline-Styles, Hex und Einzelfall-px in .tsx-Dateien.

  Warum: Tailwind verwirft unbekannte Klassen still. Nach der Umstellung auf die
  Tokens aus DESIGN.md erzeugt z. B. "text-sm" oder "bg-brand" kein CSS mehr,
  Build, Lint und Typecheck bleiben trotzdem gruen (RESEARCH Pitfall 1).

  Aufruf: node scripts/design-classes.mjs [pfad ...]   (Standard: src)
  Exit 1 bei mindestens einem Treffer, sonst Exit 0.
*/
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// (?![\w-]) statt \b am Ende: sonst traefe bg-surface auch das neue bg-surface-error.
const rules = [
  {
    name: 'alte Klasse oder Inline-Style',
    pattern:
      /\b(bg|text|border|outline)-(surface|surface-raised|brand|brand-strong|brand-soft|border-subtle|success|success-soft|warn|warn-soft|danger|danger-soft|white)(?![\w-])|\btext-(xs|sm|base|lg|[2-9]?xl)(?![\w-])|\bfont-(medium|semibold|bold|extrabold|black)(?![\w-])|rounded-(2xl|3xl|\[)|style=\{|\b-?(p|m)[xytblrse]?-(3|5|7|10)\b|\bgap(-[xy])?-(3|5|7|10)\b/g,
  },
  { name: 'Hex-Farbe', pattern: /['"`]#[0-9a-fA-F]{3,8}\b/g },
  { name: 'Einzelfall-px', pattern: /-\[[^\]\s]*\d+px[^\]\s]*\]/g },
  // Glasfarbe als Flaeche ohne Varianten-Praefix bekommt keinen deckenden
  // Fallback; dafuer gibt es glass-flat*. hover:bg-glass-clear bleibt erlaubt,
  // glass-opaque ist schon deckend.
  {
    name: 'Glasfarbe ohne Fallback (glass-flat* nutzen)',
    pattern: /(?<![:\w-])bg-glass(-clear|-sheet|-selected)?(?![\w-])/g,
  },
]

function collect(path, files) {
  if (statSync(path).isDirectory()) {
    for (const entry of readdirSync(path)) {
      if (entry !== 'node_modules') collect(join(path, entry), files)
    }
  } else if (path.endsWith('.tsx')) {
    files.push(path)
  }
  return files
}

const roots = process.argv.slice(2)
const files = (roots.length > 0 ? roots : ['src']).flatMap((root) => collect(root, []))

let hits = 0
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, index) => {
    for (const rule of rules) {
      for (const match of line.matchAll(rule.pattern)) {
        console.log(`${file}:${index + 1}: ${match[0]} (${rule.name})`)
        hits += 1
      }
    }
  })
}

if (hits > 0) {
  console.log(`${hits} Treffer`)
  process.exit(1)
}
console.log('keine alten Klassen')
