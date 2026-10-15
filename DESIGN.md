---
version: alpha
name: WordQuest
description: >-
  Flaches Design nach der Grundhaltung der Apple Human Interface Guidelines (Issue #3, Variante A,
  kein Liquid Glass). Abweichungen vom Bestand in frontend/src/index.css am 2026-10-15 von @derivo
  entschieden, siehe Abschnitt "Abweichungen vom Bestand".
colors:
  primary: "oklch(0.47 0.18 265)"
  primary-soft: "oklch(0.95 0.03 265)"
  on-primary: "#FFFFFF"
  ink: "oklch(0.2 0.03 265)"
  ink-soft: "oklch(0.38 0.03 265)"
  success-text: "oklch(0.42 0.13 150)"
  warn-text: "oklch(0.48 0.12 60)"
  danger-text: "oklch(0.48 0.18 25)"
  coin: "oklch(0.5 0.12 75)"
  surface: "oklch(0.99 0.004 265)"
  surface-raised: "#FFFFFF"
  surface-error: "#FFECE8"
  surface-success: "#EBFFF0"
  surface-warn: "#FFF4D6"
  border-subtle: "oklch(0.91 0.008 265)"
  border-control: "oklch(0.55 0.03 265)"
  track: "oklch(0.91 0.008 265)"
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
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
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
  button-secondary:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.headline}"
    rounded: "{rounded.full}"
    height: 60px
  button-round:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: 48px
  button-round-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    size: 52px
  keypad-key:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.keypad}"
    rounded: "{rounded.full}"
    size: 80px
  card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  card-quiz:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.display}"
    rounded: "{rounded.xl}"
    padding: "{spacing.2xl}"
  sheet:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "{spacing.lg}"
  list-group:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  list-row:
    textColor: "{colors.ink}"
    typography: "{typography.body-lg}"
    height: 60px
    padding: "{spacing.md}"
  list-separator:
    backgroundColor: "{colors.border-subtle}"
  input:
    backgroundColor: "{colors.surface-raised}"
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
    typography: "{typography.body-md}"
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
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.coin}"
    typography: "{typography.body-sm}"
  tab-bar:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.full}"
    padding: "{spacing.sm}"
  tab:
    textColor: "{colors.ink}"
    typography: "{typography.label-tab}"
    rounded: "{rounded.full}"
    height: 52px
  tab-active:
    backgroundColor: "{colors.primary-soft}"
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

Grundhaltung der Apple Human Interface Guidelines (Issue #3, Variante A): Klarheit, Zurückhaltung, Tiefe; Systemschrift, viel Weißraum, runde Ecken, Inhalt im Mittelpunkt, große Tippflächen. **Kein Liquid Glass**, auch nicht als Akzent: keine Transparenz, kein Blur (Owner @mrhdready in Issue #3, 2026-10-01).

Bedienung liegt am Rand: runde Buttons oben, Haupt-Button und Tab-Leiste unten. Kinderbereich großflächig und freundlich, Elternbereich ruhig, mit gruppierten Listen.

Der Export nach `frontend/src/index.css` und der Umbau der Komponenten folgen als eigener GSD-Schritt; bis dahin zeigt die App den Bestand.

## Colors

- **Primary (oklch 0.47 0.18 265):** kräftiges Blau für die eine Hauptaktion pro Screen, Fortschrittsbalken, aktiven Tab, Fokusring und Links. Weiß darauf liegt deutlich über 4,5:1.
- **Primary soft:** helle Fläche für Neben-Buttons, runde Buttons, PIN-Tasten und den aktiven Tab.
- **Ink / Ink soft:** Text. Beide dunkler als im Bestand, damit Nebentext sicher über 4,5:1 liegt.
- **Statusfarben als Textfarben:** `success-text`, `warn-text`, `danger-text` sind dunkle Töne für Text auf hellen Flächen (`surface-success`, `surface-warn`, `surface-error`).
- **Coin:** Münzen, nur mit dem 🪙-Zeichen.
- **Surface / Surface raised:** Seitenhintergrund fast weiß, Karten, Listen, Felder und Sheets weiß.
- **Border subtle / Border control:** `border-subtle` nur für Trennlinien ohne Bedienfunktion, `border-control` (≥ 3:1) für Grenzen von Eingabefeldern.

## Typography

Systemschrift, abgerundet wo vorhanden (SF Pro Rounded auf Apple-Geräten). Große Titel (`large-title`, 34 px) oben links auf jeder Hauptseite. Das abgefragte Wort im Quiz steht in `display`. Abschnittsüberschriften in Listen als `label-section` in Großbuchstaben. Fließtext mindestens 15 px, Kinder-Texte 17 px.

## Layout

Einspaltig, Bildschirmrand `screen-margin` (16 px), oben `screen-top` (48 px, Raum für Statusleiste). Haupt-Button und Tab-Leiste sitzen `float-bottom` (32 px) über dem unteren Rand. Bottom-Sheets haben `sheet-inset` (8 px) Abstand zu den Rändern.

Alle Abstände (Innen- und Außenabstand, Lücken, Positionen) folgen ausschließlich der Skala 4/8/16/24/32/48/64 (`xs` bis `3xl`, Issue #3, Q8). `touch-min` und `touch-default` sind Größen von Tippflächen, keine Abstände, und gehören nicht zur Skala.

Tippflächen mindestens `touch-min` (44 px), Standard `touch-default` (48 px). PIN-Tasten 80 px, Haupt-Button 60–64 px.

## Elevation & Depth

Tiefe entsteht durch Tonwerte und weiche Schatten, nicht durch Transparenz:

- Ebenen: `surface` (Seite) → `surface-raised` (Karten, Listen, Felder, Tab-Leiste) → Sheet über einer abgedunkelten Fläche.
- Karten: weicher, kaum sichtbarer Schatten (`0 1px 2px` und `0 4px 16px` in dunklem Blau mit 6 % Deckkraft).
- Sheets und die schwebende Tab-Leiste: etwas stärkerer Schatten (`0 12px 40px`, 12 %).
- Buttons (Kapseln, runde Buttons, PIN-Tasten) haben keinen Schatten; sie heben sich über ihre Fläche ab (`primary` oder `primary-soft`).
- Keine Transparenz, kein `backdrop-filter`.

## Shapes

Durchgehend weich: Bedienelemente als Kapsel oder Kreis (`full`), Karten `lg` (32 px), Quiz-Karte `xl` (40 px), Sheets `sheet` (44 px), Listengruppen `md` (28 px), Hinweise `sm` (24 px). Keine eckigen Elemente.

## Components

- **Haupt-Button:** Kapsel in `primary` (`button-primary`), unten schwebend als `button-primary-floating`. Genau einer pro Screen.
- **Neben-Button:** Kapsel in `primary-soft` (`button-secondary`).
- **Runde Buttons:** Zurück, Schließen, Abmelden oben (`button-round`); Senden im Quiz und „+“ neben der Eltern-Tab-Leiste in `primary` (`button-round-primary`, „+“ 64 px).
- **PIN-Tastatur:** 3×4-Raster aus `keypad-key`, Löschen ohne Fläche.
- **Quiz:** Fortschritt als Kapsel neben dem Schließen-Button, Wort auf `card-quiz`, Antwortfeld als Kapsel mit rundem Senden-Button. Rückmeldung (richtig, Tippfehler, „Fast!“) als `sheet` von unten.
- **Listen:** gruppiert in `list-group`, Trennlinien `list-separator`, Zeilen `list-row`.
- **Formulare:** Beschriftung über dem Feld (`input-label`), sichtbar, nie nur Platzhalter. Jedes Feld hat eine 1-px-Grenze in `border-control` (WCAG 1.4.11).
- **Hinweise:** `note-error` (`role="alert"`) und `note-success` (`role="status"`), unter dem auslösenden Element.
- **Eltern-Navigation:** `tab-bar` unten mit Vokabeln und Fortschritt, aktiver Tab `tab-active`.
- **Fokus:** global `:focus-visible` mit 3 px Ring in `primary`, 3 px Abstand.

## Do's and Don'ts

- Do: Kontrast Text ≥ 4,5:1, Bedien-Grenzen ≥ 3:1; im echten Rendering mit axe belegen.
- Do: Werte nur über Tokens; fehlt eine Stufe, wird sie hier ergänzt.
- Don't: Transparenz, Blur oder Glas-Effekte.
- Don't: Zustände nur über Farbe zeigen (Status-Chips tragen immer Text).
- Don't: Hex oder Inline-Styles im JSX.

## Abweichungen vom Bestand

Entschieden von @derivo am 2026-10-15 auf Grundlage von Issue #3 (Stil darf abweichen, Tokens zentral ändern). Umgesetzt werden sie mit dem Export und dem Komponenten-Umbau.

| # | Bestand | Entscheidung | Hinweis |
|---|---|---|---|
| A2 | `--color-ink: oklch(0.22 0.03 265)` (`frontend/src/index.css:10`) | `ink` 0.2 | etwas dunkler |
| A3 | `--color-ink-soft: oklch(0.48 0.02 265)` (`index.css:11`) | `ink-soft` 0.38 0.03 | sicher über 4,5:1 |
| A5 | `--color-brand: oklch(0.58 0.17 265)` als Button-Fläche (`index.css:17`, `button.tsx:14`) | `primary` 0.47 (bisheriges `brand-strong`) | ersetzt UI-SPEC D1 (0.53) |
| A6 | `--color-success/warn/danger` hell (`index.css:21-26`) | dunkle `*-text`-Töne + helle Flächen | löst UI-SPEC D2 und Q7 |
| A7 | `--color-coin: oklch(0.78 0.15 85)` (`index.css:28`) | `coin` 0.5 0.12 75 | lesbar als Text |
| A8 | `--radius-card: 1.25rem` (20 px, `index.css:30`), Buttons `rounded-2xl` (`button.tsx:7`) | Karten 32 px, Buttons Kapsel | |
| A9 | Schrift-Reihenfolge `ui-rounded` zuerst (`index.css:33-35`) | `-apple-system` zuerst | |
| A10 | Fokusring `outline-2` in `brand` (`button.tsx:9`), Input ohne Outline (`input.tsx:11`) | global `:focus-visible`, 3 px in `primary` | entspricht UI-SPEC D6 |
| A11 | Input mit `border-2 border-border-subtle` (`input.tsx:8`), 1,31:1 | 1 px `border-control` 0.55 (4,86:1 auf weiß) | ersetzt UI-SPEC D5 (0.64) |
| A12 | Abstände 12 px (`*-3`) und 20 px (`*-5`), u. a. `card.tsx:17,29,33`, `button.tsx:24`, `ManageLayout.tsx:16`, `misc.tsx:67` | Skala 4/8/16/24/32/48/64 | Issue #3, Q8 „Umstellen“; betrifft jede Seite

A1 (Liquid Glass) und A4 (`surface` ersetzen) sind verworfen: kein Glass laut Issue #3, `surface` und `surface-raised` bleiben.
