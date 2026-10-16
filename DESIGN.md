---
version: alpha
name: WordQuest Liquid Glass
description: >-
  Liquid-Glass-Optik nach dem Vorbild von iOS, abgestimmt mit Owner @mrhdready (2026-10-15).
  Abweichungen vom Bestand in frontend/src/index.css stehen im Abschnitt "Abweichungen vom Bestand".
colors:
  primary: "oklch(0.47 0.18 265)"
  primary-light: "oklch(0.52 0.19 265)"
  primary-deep: "oklch(0.42 0.19 265)"
  on-primary: "#FFFFFF"
  ink: "oklch(0.2 0.03 265)"
  ink-soft: "oklch(0.38 0.03 265)"
  success-text: "oklch(0.42 0.13 150)"
  warn-text: "oklch(0.48 0.12 60)"
  danger-text: "oklch(0.48 0.18 25)"
  coin: "oklch(0.5 0.12 75)"
  backdrop-base: "oklch(0.93 0.03 265)"
  backdrop-blue: "oklch(0.74 0.17 265)"
  backdrop-cyan: "oklch(0.84 0.14 195)"
  backdrop-pink: "oklch(0.8 0.16 340)"
  backdrop-yellow: "oklch(0.9 0.14 85)"
  glass: "rgba(255, 255, 255, 0.5)"
  glass-clear: "rgba(255, 255, 255, 0.32)"
  glass-sheet: "rgba(255, 255, 255, 0.78)"
  glass-opaque: "rgba(255, 255, 255, 0.96)"
  glass-selected: "rgba(255, 255, 255, 0.6)"
  surface-error: "#FFECE8"
  surface-success: "#EBFFF0"
  surface-warn: "#FFF4D6"
  separator: "rgba(40, 50, 90, 0.12)"
  border-control: "oklch(0.55 0.03 265)"
  track: "rgba(255, 255, 255, 0.55)"
typography:
  display:
    fontFamily: "-apple-system, 'SF Pro Rounded', ui-rounded, 'Segoe UI Variable', system-ui, sans-serif"
    fontSize: 36px
    fontWeight: 800
    lineHeight: 42px
    letterSpacing: -0.01em
  large-title:
    fontFamily: "-apple-system, 'SF Pro Rounded', ui-rounded, 'Segoe UI Variable', system-ui, sans-serif"
    fontSize: 34px
    fontWeight: 700
    lineHeight: 41px
    letterSpacing: -0.02em
  title:
    fontFamily: "-apple-system, 'SF Pro Rounded', ui-rounded, 'Segoe UI Variable', system-ui, sans-serif"
    fontSize: 26px
    fontWeight: 700
    lineHeight: 32px
  headline:
    fontFamily: "-apple-system, 'SF Pro Rounded', ui-rounded, 'Segoe UI Variable', system-ui, sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 25px
  body-lg:
    fontFamily: "-apple-system, 'SF Pro Rounded', ui-rounded, 'Segoe UI Variable', system-ui, sans-serif"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 23px
  body-md:
    fontFamily: "-apple-system, 'SF Pro Rounded', ui-rounded, 'Segoe UI Variable', system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 21px
  body-md-strong:
    fontFamily: "-apple-system, 'SF Pro Rounded', ui-rounded, 'Segoe UI Variable', system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 21px
  body-sm:
    fontFamily: "-apple-system, 'SF Pro Rounded', ui-rounded, 'Segoe UI Variable', system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
  label-section:
    fontFamily: "-apple-system, 'SF Pro Rounded', ui-rounded, 'Segoe UI Variable', system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 600
    lineHeight: 18px
    letterSpacing: 0.03em
  label-tab:
    fontFamily: "-apple-system, 'SF Pro Rounded', ui-rounded, 'Segoe UI Variable', system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 600
    lineHeight: 13px
  keypad:
    fontFamily: "-apple-system, 'SF Pro Rounded', ui-rounded, 'Segoe UI Variable', system-ui, sans-serif"
    fontSize: 34px
    fontWeight: 400
    lineHeight: 41px
  emoji:
    fontFamily: "-apple-system, 'SF Pro Rounded', ui-rounded, 'Segoe UI Variable', system-ui, sans-serif"
    fontSize: 60px
    fontWeight: 400
    lineHeight: 60px
rounded:
  sm: 24px
  md: 28px
  lg: 32px
  xl: 40px
  sheet: 44px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  screen-margin: "{spacing.md}"
  screen-top: "{spacing.2xl}"
  float-bottom: "{spacing.xl}"
  sheet-inset: "{spacing.sm}"
  touch-min: 44px
  touch-default: 48px
components:
  screen:
    backgroundColor: "{colors.backdrop-base}"
    textColor: "{colors.ink}"
  screen-blob-1:
    backgroundColor: "{colors.backdrop-blue}"
  screen-blob-2:
    backgroundColor: "{colors.backdrop-cyan}"
  screen-blob-3:
    backgroundColor: "{colors.backdrop-pink}"
  screen-blob-4:
    backgroundColor: "{colors.backdrop-yellow}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.headline}"
    rounded: "{rounded.full}"
    height: 60px
  button-primary-floating:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.headline}"
    rounded: "{rounded.full}"
    height: 64px
  button-primary-gradient-start:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.on-primary}"
  button-primary-gradient-end:
    backgroundColor: "{colors.primary-deep}"
    textColor: "{colors.on-primary}"
  button-glass:
    backgroundColor: "{colors.glass-clear}"
    textColor: "{colors.ink}"
    typography: "{typography.headline}"
    rounded: "{rounded.full}"
    height: 60px
  button-round:
    backgroundColor: "{colors.glass-clear}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: 48px
  button-round-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    size: 52px
  keypad-key:
    backgroundColor: "{colors.glass-clear}"
    textColor: "{colors.ink}"
    typography: "{typography.keypad}"
    rounded: "{rounded.full}"
    size: 80px
  card:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  card-quiz:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    typography: "{typography.display}"
    rounded: "{rounded.xl}"
    padding: "{spacing.2xl}"
  sheet:
    backgroundColor: "{colors.glass-sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "{spacing.lg}"
  glass-fallback:
    backgroundColor: "{colors.glass-opaque}"
    textColor: "{colors.ink-soft}"
  list-group:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  list-row:
    textColor: "{colors.ink}"
    typography: "{typography.body-lg}"
    height: 60px
    padding: "{spacing.md}"
  list-separator:
    backgroundColor: "{colors.separator}"
  input:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    typography: "{typography.body-lg}"
    height: 52px
    padding: "{spacing.md}"
  input-border:
    backgroundColor: "{colors.border-control}"
    textColor: "{colors.on-primary}"
  input-label:
    textColor: "{colors.ink-soft}"
    typography: "{typography.label-section}"
  note-error:
    backgroundColor: "{colors.surface-error}"
    textColor: "{colors.danger-text}"
    typography: "{typography.body-md-strong}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  note-success:
    backgroundColor: "{colors.surface-success}"
    textColor: "{colors.success-text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  status-chip-warn:
    backgroundColor: "{colors.surface-warn}"
    textColor: "{colors.warn-text}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.full}"
  coin-label:
    backgroundColor: "{colors.glass-opaque}"
    textColor: "{colors.coin}"
    typography: "{typography.body-sm}"
  tab-bar:
    backgroundColor: "{colors.glass}"
    rounded: "{rounded.full}"
    padding: "{spacing.sm}"
  tab:
    textColor: "{colors.ink}"
    typography: "{typography.label-tab}"
    rounded: "{rounded.full}"
    height: 52px
  tab-active:
    backgroundColor: "{colors.glass-selected}"
    textColor: "{colors.primary}"
  progress-bar:
    backgroundColor: "{colors.track}"
    rounded: "{rounded.full}"
    height: 8px
  progress-bar-fill:
    backgroundColor: "{colors.primary}"
---

# WordQuest — Design

## Overview

Liquid Glass nach dem Vorbild von iOS: Bedienelemente schweben als Glasflächen über einem farbigen, weichen Hintergrund. Inhalt steht im Mittelpunkt, Bedienung liegt am Rand (runde Buttons oben, Kapsel-Buttons und Tab-Leiste unten). Kinderbereich verspielt und großflächig, Elternbereich ruhig, mit gruppierten Listen. Die Grundhaltung der Apple Human Interface Guidelines (Klarheit, Zurückhaltung, Tiefe) gilt weiter.

**Status:** Richtung nach Rücksprache mit Owner @mrhdready entschieden (2026-10-15); ersetzt den Ausschluss von Liquid Glass aus Issue #3. Die dort genannten Risiken bleiben Prüfpunkte: Kontrast auf durchscheinenden Flächen, Leistung von `backdrop-filter` auf günstigen Tablets, fremde Wirkung auf Android und Windows. Der Export nach `frontend/src/index.css` und der Umbau der Komponenten folgen als erster Plan von Phase 1; bis dahin zeigt die App den Bestand.

## Colors

- **Primary (oklch 0.47 0.18 265):** kräftiges Blau für die eine Hauptaktion pro Screen, Fortschrittsbalken, aktiven Tab und Links. Getönte Buttons zeigen einen Verlauf von `primary-light` nach `primary-deep`; Weiß darauf hält 4,5:1 an jedem Punkt des Verlaufs.
- **Ink / Ink soft:** Text. `ink-soft` ist dunkler als im Bestand, weil Glasflächen den Hintergrund durchscheinen lassen.
- **Statusfarben als Textfarben:** `success-text`, `warn-text`, `danger-text` sind dunkle Töne für Text auf hellen, deckenden Flächen (`surface-success`, `surface-warn`, `surface-error`).
- **Coin:** Münzen, nur mit dem 🪙-Zeichen.
- **Backdrop:** vier weiche Radialverläufe (blau oben links, cyan rechts, pink unten links, gelb unten rechts) auf `backdrop-base`. Nur Hintergrund, nie Text- oder Bedienfarbe.
- **Glass:** weiße Flächen mit Transparenz. `glass` für Karten und Gruppen, `glass-clear` für schwebende Buttons, `glass-sheet` für Bottom-Sheets, `glass-opaque` als Fallback.
- **Border control:** Grenze von Eingabefeldern (≥ 3:1), auch auf Glas.

## Typography

Systemschrift, abgerundet wo vorhanden (SF Pro Rounded auf Apple-Geräten). Große Titel (`large-title`, 34 px) oben links auf jeder Hauptseite. Das abgefragte Wort im Quiz steht in `display`. Abschnittsüberschriften in Listen als `label-section` in Großbuchstaben. Fließtext mindestens 15 px, Kinder-Texte 17 px. Gewichte 400/600/700/800.

- `body-md-strong`: wie `body-md` mit Gewicht 600, für Fehlertexte in Hinweisen (`note-error`).
- `emoji`: 60 px für die Emoji-Avatare der Kinderprofile.

## Layout

Einspaltig, Bildschirmrand `screen-margin` (16 px), oben `screen-top` (48 px, Raum für Statusleiste). Haupt-Button und Tab-Leiste schweben `float-bottom` (32 px) über dem unteren Rand. Bottom-Sheets haben `sheet-inset` (8 px) Abstand zu den Rändern.

Alle Abstände (Innen- und Außenabstand, Lücken, Positionen) folgen ausschließlich der Skala 4/8/16/24/32/48/64 (`xs` bis `3xl`, Issue #3, Q8). `touch-min` und `touch-default` sind Größen von Tippflächen, keine Abstände, und gehören nicht zur Skala. PIN-Tasten 80 px, Haupt-Button 60–64 px.

## Elevation & Depth

Tiefe entsteht durch Glas, nicht durch Farbe:

- Glasflächen: `backdrop-filter: blur(28px) saturate(200%)`.
- Lichtkante: oben innen 1 px weiß (95 %), unten innen 1 px weiß (40 %). Kein zusätzlicher Verlaufsrand: als Pseudo-Element verhindert er, dass axe den Kontrast auf Glas berechnet.
- Schatten: `0 12px 40px` in dunklem Blau mit 18 % Deckkraft; getönte Buttons werfen einen blauen Schatten.
- Ebenen: Hintergrund → Inhaltskarten (`glass`) → schwebende Bedienung (`glass-clear`, getönte Buttons) → Sheets (`glass-sheet`).

**Pflicht-Fallback:** Bei `prefers-reduced-transparency: reduce` und wenn `backdrop-filter` nicht unterstützt wird, werden alle Glasflächen außer getönten und Status-Flächen zu `glass-opaque` ohne Blur. Getönte Buttons behalten `primary` mit weißer Schrift.

## Shapes

Durchgehend weich: Bedienelemente als Kapsel oder Kreis (`full`), Karten `lg` (32 px), Quiz-Karte `xl` (40 px), Sheets `sheet` (44 px), Listengruppen `md` (28 px), Hinweise `sm` (24 px). Keine eckigen Elemente.

## Components

- **Haupt-Button:** getönte Kapsel (`button-primary`), unten schwebend als `button-primary-floating`. Genau einer pro Screen.
- **Neben-Button:** Glas-Kapsel (`button-glass`).
- **Runde Buttons:** Zurück, Schließen, Abmelden oben (`button-round`); Senden im Quiz und „+“ neben der Eltern-Tab-Leiste getönt (`button-round-primary`, „+“ 64 px).
- **PIN-Tastatur:** 3×4-Raster aus `keypad-key`, Löschen ohne Glas.
- **Quiz:** Fortschritt als Glas-Kapsel neben dem Schließen-Button, Wort auf `card-quiz`, Antwortfeld als Kapsel mit rundem Senden-Button. Rückmeldung (richtig, Tippfehler, „Fast!“) als `sheet` von unten.
- **Listen:** gruppiert in `list-group`, Trennlinien `list-separator`, Zeilen `list-row`.
- **Formulare:** Felder gruppiert in einer Glasfläche, Beschriftung über dem Feld (`input-label`), sichtbar, nie nur Platzhalter. Jedes Feld hat eine 1-px-Grenze in `border-control` (WCAG 1.4.11), damit die Feldgrenze unabhängig vom durchscheinenden Hintergrund erkennbar bleibt.
- **Hinweise:** `note-error` (`role="alert"`) und `note-success` (`role="status"`) auf deckender Fläche, unter dem auslösenden Element.
- **Eltern-Navigation:** `tab-bar` unten mit Vokabeln, Fortschritt, Kinder und Konto, aktiver Tab `tab-active`; bei 320 px bricht sie neben dem „+“ in zwei Zeilen um.
- **Fokus:** global `:focus-visible` mit 3 px Ring in `primary-deep`, 3 px Abstand. `primary` hält gegen `backdrop-blue` keine 3:1 (WCAG 1.4.11), `primary-deep` schon.

## Do's and Don'ts

- Do: Text nur auf Glas mit Deckkraft ab `glass` (50 %) oder auf deckenden Flächen; Kontrast ≥ 4,5:1 gegen den ungünstigsten Hintergrundpunkt prüfen (axe im echten Rendering).
- Do: Fallback für reduzierte Transparenz und fehlendes `backdrop-filter` immer mitliefern.
- Do: Leistung auf schwacher Hardware prüfen (günstiges Android-Tablet); ruckelt der Blur, bleibt nur der Fallback.
- Do: Werte nur über Tokens; fehlt eine Stufe, wird sie hier ergänzt.
- Don't: Glas auf Glas stapeln, außer Sheet über Inhalt.
- Don't: Backdrop-Farben für Text, Icons oder Zustände verwenden.
- Don't: Zustände nur über Farbe zeigen (Status-Chips tragen immer Text).
- Don't: Hex oder Inline-Styles im JSX.

## Abweichungen vom Bestand

Entschieden von @derivo am 2026-10-15; Liquid Glass (A1) nach Rücksprache mit Owner @mrhdready. Umgesetzt werden sie mit dem Export und dem Komponenten-Umbau.

| # | Bestand | Entscheidung | Hinweis |
|---|---|---|---|
| A1 | Flache Flächen, kein Blur (Issue #3; `01-UI-SPEC.md`, Designrichtung) | Liquid Glass für alles, mit deckendem Fallback | ersetzt den Ausschluss aus Issue #3 |
| A2 | `--color-ink: oklch(0.22 0.03 265)` (`frontend/src/index.css:10`) | `ink` 0.2 | etwas dunkler |
| A3 | `--color-ink-soft: oklch(0.48 0.02 265)` (`index.css:11`) | `ink-soft` 0.38 0.03 | dunkler wegen Glas |
| A4 | `--color-surface` / `surface-raised` (`index.css:13-14`) | ersetzt: `surface` → Backdrop, `surface-raised` → `glass` | alte Namen entfallen, alle Verwendungen werden umgestellt |
| A5 | `--color-brand: oklch(0.58 0.17 265)` als Button-Fläche (`index.css:17`, `button.tsx:14`) | `primary` 0.47 (bisheriges `brand-strong`) | ersetzt UI-SPEC D1 (0.53) |
| A6 | `--color-success/warn/danger` hell (`index.css:21-26`) | dunkle `*-text`-Töne + helle Flächen | löst UI-SPEC D2 und Q7 |
| A7 | `--color-coin: oklch(0.78 0.15 85)` (`index.css:28`) | `coin` 0.5 0.12 75 | lesbar als Text |
| A8 | `--radius-card: 1.25rem` (20 px, `index.css:30`), Buttons `rounded-2xl` (`button.tsx:7`) | Karten 32 px, Buttons Kapsel | |
| A9 | Schrift-Reihenfolge `ui-rounded` zuerst (`index.css:33-35`) | `-apple-system` zuerst | |
| A10 | Fokusring `outline-2` in `brand` (`button.tsx:9`), Input ohne Outline (`input.tsx:11`) | global `:focus-visible`, 3 px in `primary` | entspricht UI-SPEC D6 |
| A11 | Input mit `border-2 border-border-subtle` (`input.tsx:8`), 1,31:1 | Glasgruppe + 1 px `border-control` 0.55 | ersetzt UI-SPEC D5 (0.64, auf Glas unter 3:1); im Rendering per axe/manuell belegen |
| A12 | Abstände 12 px (`*-3`) und 20 px (`*-5`), u. a. `card.tsx:17,29,33`, `button.tsx:24`, `ManageLayout.tsx:16`, `misc.tsx:67` | Skala 4/8/16/24/32/48/64 | Issue #3, Q8 „Umstellen“; betrifft jede Seite |
