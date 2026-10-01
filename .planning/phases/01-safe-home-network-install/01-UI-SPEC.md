---
phase: "1"
slug: "safe-home-network-install"
status: draft
shadcn_initialized: false
preset: none
created: "2026-10-01"
---

# Phase 1 — UI Design Contract

> Visueller und interaktiver Vertrag für Phase 1 (Safe Home-Network Install). Erzeugt vom gsd-ui-researcher, geprüft vom gsd-ui-checker.
> Quelle der Entscheidungen: GitHub-Issue #3 (mrhdready/WordQuest), Variante A = Apple HIG, Grundprinzipien. Alle Token-Werte stehen normativ in `DESIGN.md` (Repo-Root, entsteht im selben Branch direkt nach dieser Datei). Dieser Vertrag nennt Token **nur beim Namen** (`{colors.brand}`), Hex-/OKLCH-Werte stehen ausschließlich in der Vergleichstabelle unter „Color".

---

## Geltungsbereich

**UI dieser Phase (ROADMAP Erfolgskriterien 3, 4, 5):**

| Seite | Route (neu) | Anforderung |
|-------|-------------|-------------|
| Passwort ändern | `/verwalten/konto` | SETUP-03, QUAL-02 |
| Kinderliste (Einstieg zum Bearbeiten) | `/verwalten/kinder` | PAR-01 (Zugang) |
| Kind bearbeiten (Name, Neue-Karten-Limit, PIN) | `/verwalten/kinder/:learnerId` | PAR-01, PAR-02, QUAL-02 |
| Kinder-Login, PIN-Eingabe (bestehende Seite, **Pflichtänderung**, siehe unten) | `/` (`ProfilePickerPage`) | Erfolgskriterium 4 („Kind meldet sich mit neuer PIN an") |

**Nicht Teil von Phase 1:**

- **Kind anlegen auf frischer Installation** (Q2): wird eigene v1-Anforderung. Im Frontend gibt es heute **keine** Stelle, die `POST /api/v1/learners` aufruft (Beleg: `grep -rn "'/learners'" frontend/src` trifft nur `ProgressPage.tsx:29`, lesend). Erfolgskriterium 4 setzt ein vorhandenes Kind voraus; Tests und manuelle Prüfung legen es per API an. Abhängigkeit: Ohne die neue Anforderung ist die Kinderliste auf einer frischen Installation leer (siehe Leerzustand).
- Löschen von Kind/Set/Eintrag, Umbenennen von Sets (Phase 2). Das Token `{colors.danger}` und die Button-Variante `danger` werden hier definiert, aber nicht für Aktionen genutzt.
- Dark Mode, Kontrastmodus „mehr Kontrast", neue Kinderbereich-Optik (siehe „Bekannte Abweichungen").

---

## Quellen (HIG, in dieser Session aufgelöst)

Die fünf Seiten unter `https://developer.apple.com/design/human-interface-guidelines/<page>` (`design-principles`, `accessibility`, `color`, `layout`, `typography`) sind JavaScript-gerendert; ein direkter Seitenabruf liefert nur den Titel. Der Inhalt wurde am 2026-10-01 über die zugehörigen Datendateien `https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<page>.json` geholt (alle fünf HTTP 200) und gelesen. Liquid Glass (Abschnitte „Liquid Glass color" in `color`, „Differentiate controls from content" in `layout`) ist ausgeschlossen und fließt nirgends ein.

| HIG-Seite | Verwendete Aussage (sinngemäß, belegt) | Folge im Vertrag |
|-----------|----------------------------------------|------------------|
| design-principles | Simplicity: „Include just what's necessary" und „Be concise"; Agency: „Help people recover from mistakes"; Familiarity: „Keep visuals and interactions consistent", „Provide clear feedback"; Delight: „Don't mistake delight for decoration" | Je Seite genau eine Aufgabe, eine Primäraktion; Wiederverwendung der Bestands-Bausteine; Eingaben bleiben nach Fehlern erhalten; Rückmeldung nach Speichern; keine dekorativen Animationen in Formularen |
| accessibility | Textkontrast ≥ 4.5:1 bis 17 pt; Standard-Steuerelement 44×44 pt; Abstand um Elemente mit Rahmen ca. 12 pt, ohne Rahmen ca. 24 pt; „Convey information with more than color alone"; Text ideal um mindestens 200 % vergrößerbar; Zeitgesteuerte Oberflächen vermeiden; Reduce Motion beachten; Bedienung allein per Tastatur | 44 px Mindest-Tippziel, Abstände ≥ 16 px zwischen Controls, Fehler = Farbe + Icon + Text, keine Auto-Dismiss-Meldungen, Press-Skalierung bei Reduce Motion aus, Tastatur-Pfad ist Pflichttest |
| color | „Avoid using the same color to mean different things"; „Avoid relying solely on color"; semantische Rollen (Label, Secondary label, Placeholder, Separator, Link); Hintergrundstufen primär/sekundär/tertiär; Light-/Dark-/Increased-Contrast-Varianten empfohlen | Ein Akzent (`{colors.brand}`) nur für Interaktives; zwei Hintergrundstufen; Placeholder ohne Alpha-Trick; Abweichung bei Dark/Contrast als bekannte Abweichung |
| layout | Wichtigstes oben/leading; Ausrichten und Gruppieren über Weißraum; Progressive Disclosure; Layout muss bei größerer Schrift umbrechen statt abschneiden; Safe Areas | Einspaltige Formulare, linksbündig, Label oben; Tabs umbrechen statt scrollen; vorhandene `safe-top/safe-bottom` bleiben |
| typography | Standard 17 pt, Minimum 11 pt; leichte Gewichte vermeiden (Regular, Medium, Semibold, Bold bevorzugen); Textstile „Large (default)": Title 1 28/34, Title 2 22/28, Body und Headline 17/22, Subhead 15/20, Footnote 13/18; wenige Schriftfamilien; Kürzung minimieren | 4 Größen 15/17/22/28 mit HIG-Zeilenhöhen, 2 Gewichte, eine Systemschrift, Umbruch statt Auslassungspunkte |

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (kein `components.json`; handgeschriebene Bausteine in `frontend/src/components/ui/`, Radix-Primitives, `class-variance-authority`) |
| Preset | not applicable |
| Component library | Radix-Primitives (`@radix-ui/react-slot`, `@radix-ui/react-label`, `@radix-ui/react-dialog` installiert, Dialog in Phase 1 ungenutzt) |
| Icon library | `lucide-react` (`package.json`) |
| Font | Systemschrift, **eine** Familie: `{typography.font-family}` = `system-ui`-Stapel ohne `ui-rounded` (HIG: Schriftfamilien minimieren, nicht einbetten). Bestand: `index.css:33-35` beginnt mit `ui-rounded`/`SF Pro Rounded`; dort entfällt der gerundete Anfang. |
| Token-Quelle | `DESIGN.md` (normativ). `frontend/src/index.css` `@theme` wird aus `DESIGN.md` exportiert (`npx @google/design.md export --format css-tailwind DESIGN.md`), nicht von Hand gepflegt. |
| Radien | unverändert (`index.css:30` Card 20 px, Controls `rounded-2xl`): die fünf HIG-Seiten treffen keine Aussage dazu. Radien sind nicht Teil der Abstandsskala. |

**shadcn-Gate:** Nicht ausgeführt. Der Gate verlangt eine Rückfrage an den Nutzer; diese Instanz kann nicht fragen. Der Vertrag nimmt `Tool: none` an, weil `AGENTS.md` neue Dependencies, Ordner und Integrationen nur mit Freigabe erlaubt und `DESIGN.md` die eine Token-Quelle sein soll. Registry-Gate entfällt damit.

---

## Bausteine dieser Phase

Enumerated by `grep -hE "^export function" frontend/src/components/ui/*.tsx | wc -l` — 15 components — `frontend/src/components/ui` (lokal, kein Paket)@6a918e8 — 2026-10-01.

Die Tabelle ist eine **nicht erschöpfende** Liste bekannter Bausteine, keine geschlossene Erlaubnisliste. Zusätzlich exportiert: `buttonVariants`, `ButtonProps` (`button.tsx`).

| Baustein | Import | Verwendung in Phase 1 |
|----------|--------|----------------------|
| `Card`, `CardHeader`, `CardTitle` (h2), `CardDescription`, `CardContent`, `CardFooter` | `@/components/ui/card` | Je Formular eine Card; Kinderliste: Card je Kind als Link (Muster `SetsPage.tsx:49-61`) |
| `Button` (`variant`: primary, secondary, outline, ghost, danger; `size`: sm, md, lg, xl, icon) | `@/components/ui/button` | Primäraktion `primary` + `size="md"`, Zurück-Link `ghost` (`asChild` mit `Link`) |
| `Input` | `@/components/ui/input` | Alle Felder; neues Verhalten für Fehler/Fokus siehe „Interaktionsvertrag" |
| `Label` | `@/components/ui/misc` | Pflicht an jedem Feld (`htmlFor`) |
| `ErrorNote` | `@/components/ui/misc` | Formularweite Fehler (Server/Netz); **wird erweitert** (Icon, Token) |
| `EmptyState`, `Spinner` | `@/components/ui/misc` | Kinderliste leer; Laden |
| `Badge`, `Progress`, `Textarea` | — | in Phase 1 nicht genutzt |

**Neu (klein, in `components/ui/`):**

| Baustein | Zweck | Vertrag |
|----------|-------|---------|
| `Field` | Label + Eingabe + Hinweis + Fehlertext verdrahten | Rendert `Label` (oben), Eingabe, optional Hinweis (`<p id="{id}-hint">`), optional Fehler (`<p id="{id}-error">` mit Icon). Setzt auf der Eingabe `aria-describedby` (Hinweis-ID, bei Fehler zusätzlich Fehler-ID), `aria-invalid="true"` nur bei Fehler. Ein Baustein statt sechsmaliger Handverdrahtung in zwei Formularen. |
| `StatusNote` | Erfolgsmeldung | Container mit `role="status"` (immer im DOM, Text erscheint nach Erfolg), Icon `CircleCheck`, Farben `{colors.brand-soft}` / `{colors.ink}`. **Keine** `success`-Token (siehe Q7). |

Icons: `Users` (Tab „Kinder"), `KeyRound` (Tab „Konto"), `CircleAlert` (Fehler), `CircleCheck` (Erfolg), `ChevronRight` (vorhanden). Existenz der Exportnamen in der installierten `lucide-react`-Version beim Umsetzen per `npm run typecheck` prüfen; bei Abweichung gleichwertiges Icon wählen.

---

## Spacing Scale

Skala (Q8, einheitlich und zentral über `DESIGN.md`): **4 / 8 / 16 / 24 / 32 / 48 / 64**.

| Token | Value | Verwendung |
|-------|-------|-----------|
| xs | 4px | Abstand Eingabe zu Hinweis/Fehlertext, Icon-Lücke inline |
| sm | 8px | Label zu Eingabe, Icon zu Text, enge Chip-Innenabstände |
| md | 16px | Seitenrand mobil, Abstand zwischen Buttons, Standard-Innenabstand kompakter Boxen |
| lg | 24px | Card-Innenabstand, Abstand zwischen Formularfeldern, vor der Aktionszeile |
| xl | 32px | Seitenabstand oben/unten, Abstand zwischen Cards |
| 2xl | 48px | Abschnittswechsel |
| 3xl | 64px | Seitenebene |

**Geltungsbereich:** `padding`, `margin`, `gap`, `space-*`. Größen (`h-`, `w-`, `min-h-`) sind keine Abstände und stehen unter „Named exceptions". HIG nennt rund 12 pt Abstand um Elemente mit Rahmen und rund 24 pt ohne Rahmen; 12 gehört nicht zur Skala, daher gilt für Abstände zwischen Controls mindestens `md` (16).

### Umrechnungsregel für Bestandswerte

| Alt (Tailwind) | Neu | Regel |
|----------------|-----|-------|
| 12 px (`gap-3`, `py-3`, `px-3`, `pb-3`, `mb-3`) | 16 (`*-4`) zwischen Controls, Feldern, Absätzen; 8 (`*-2`) bei Icon+Text, Spinner, Chip-Innenabstand | Kontext entscheidet, Standard ist 16 |
| 20 px (`p-5`, `px-5`, `pt-5`, `mb-5`) | 24 (`*-6`) für Card-Innenabstand, Abschnittsabstände; 16 (`px-4`) für den Seitenrand | |
| 28 px (`px-7`) | 24 (`px-6`) | Button `lg` |
| 40 px (`pt-10`, `py-10`) | 48 (`pt-12`) als Abschnittswechsel; 32 (`py-8`) als Card-Innenabstand | |
| 10/14/2,5/3,5/0,5/1,5 (Tailwind-Einheiten) | nächste Skalenstufe nach Kontext | |

### Zentrale Änderungen (Komponenten)

| Datei:Zeile | Alt | Neu |
|-------------|-----|-----|
| `frontend/src/components/ui/card.tsx:17` | `p-5 pb-3` | `p-6 pb-4` |
| `frontend/src/components/ui/card.tsx:29` | `p-5 pt-0` | `p-6 pt-0` |
| `frontend/src/components/ui/card.tsx:33` | `p-5 pt-0` | `p-6 pt-0` |
| `frontend/src/components/ui/button.tsx:24` | `md: h-12 px-5` | `md: h-12 px-6` |
| `frontend/src/components/ui/button.tsx:25` | `lg: h-14 px-7` | `lg: h-14 px-6` |
| `frontend/src/components/ui/misc.tsx:47` | Badge `px-3` | `px-2` |
| `frontend/src/components/ui/misc.tsx:58` | Spinner `gap-3` | `gap-2` |
| `frontend/src/components/ui/misc.tsx:67` | ErrorNote `px-4 py-3` | `p-4` |

### Betroffene Seiten (Bestandswerte außerhalb der Skala)

Baseline am 2026-10-01: **51 Treffer in 11 Dateien**. Re-runnable (Zielwert 0 nach Phase 1; die Seiten des Kinderbereichs werden mitgezogen, weil die Skala zentral gilt):

```bash
grep -rnoE "\b(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-(0\.5|1\.5|2\.5|3\.5|3|5|7|9|10|11|14)\b" frontend/src --include=*.tsx | wc -l
```

| Datei | Zeilen mit Treffern |
|-------|--------------------|
| `components/ui/button.tsx` | 24, 25 |
| `components/ui/card.tsx` | 17 (zwei), 29, 33 |
| `components/ui/misc.tsx` | 47, 58, 67 |
| `features/auth/GuardianLoginPage.tsx` | 33 |
| `features/auth/ProfilePickerPage.tsx` | 60, 78, 94, 110, 127 |
| `features/learn/LearnHomePage.tsx` | 36, 37, 51, 52, 84, 113 (zwei), 138 |
| `features/learn/SessionPage.tsx` | 115, 126, 142, 151 (zwei), 167, 182, 218, 246, 248 |
| `features/manage/ManageLayout.tsx` | 16, 17 |
| `features/manage/ProgressPage.tsx` | 81, 82, 89, 105, 106, 113 |
| `features/manage/SetDetailPage.tsx` | 63, 64, 108 (zwei), 166 (zwei), 193 |
| `features/manage/SetsPage.tsx` | 51, 67, 68 |

### Named exceptions (Größen, nicht Abstände)

| Ausnahme | Wert | Begründung / Fundstelle |
|----------|------|-------------------------|
| Mindest-Tippziel | 44 px Höhe (`Button size="sm"`, `button.tsx:23` `h-11`) | Projektvorgabe 44 px; HIG „Default control size" iOS 44×44 pt |
| Standard-Tippziel Formular | 48 px (`Button md`, `Input` `h-12`, `touch-target` `index.css:78-81`) | auf der Skala |
| Glyph-Größen | 16 und 24 px; `h-5 w-5` (20 px) wird 24 px | Bestand: `ManageLayout.tsx:23`, `LearnHomePage.tsx:46`, `SetsPage.tsx:59,89`, `misc.tsx:59` |
| PIN-Punkte, Fortschrittsbalken | `ProfilePickerPage.tsx:116-117` (20 px), `misc.tsx:22` (`h-3`) | Zustandsanzeigen, keine Controls; PIN-Punkte werden 24 px (Glyph-Regel) |
| Button-Höhen `lg` 56 px, `xl` 64 px | `button.tsx:25-26` | Größe, kein Abstand; `lg` bleibt für Bestandsseiten |
| Kartenmindesthöhe Lernkarte | `SessionPage.tsx:151` `min-h-44` | Kinderbereich, keine Phase-1-Seite |
| Formularbreite | `max-w-md` (28 rem) | wie `GuardianLoginPage.tsx:33` |

Die Kommentare `button.tsx:21` („44 px") und `index.css:77` („mindestens 48 px") widersprechen sich. Festlegung: Mindesthöhe aller Tippziele **44 px**, Standard in Formularen **48 px**.

---

## Typography

Genau **4 Größen, 2 Gewichte**. Ableitung aus HIG „Large (default)": Subhead 15/20, Body/Headline 17/22, Title 2 22/28, Title 1 28/34. Einheit `rem` (Browser-Zoom und Schriftgrößen-Einstellung wirken; 1 rem = 16 px).

| Role (`{typography.*}`) | Size | Weight | Line Height | Verwendung |
|-------------------------|------|--------|-------------|------------|
| body | 17px | 400 | 22px | Fließtext, Eingabetext (≥ 16 px verhindert iOS-Fokus-Zoom), Listenzeilen |
| label | 15px | 600 | 20px | Feldlabels, Tab-Beschriftung |
| caption | 15px | 400 | 20px | Hinweistexte, Fehlertexte, Beschreibungen, Meta-Zeilen |
| heading | 22px | 600 | 28px | Seiten-/Card-Titel (`CardTitle` h2), App-Name im Kopf |
| display | 28px | 600 | 34px | Kinderbereich (große Zahlen/Prompts); in Phase 1 nicht verwendet |

Buttons: 17px / 600 (HIG Headline). Gewichte: **400 und 600**. 500, 700 und 900 entfallen (HIG erlaubt Regular, Medium, Semibold, Bold; der Vertrag begrenzt auf zwei Gewichte für eine klare Hierarchie). Zeilenhöhen folgen HIG-Leading, nicht dem Generalwert 1,5; die Formulartexte der Phase sind kurz und umbrechen frei. Regel: Elemente mit umbrechbarem Text bekommen **keine feste Höhe** (WCAG 1.4.12 Textabstand, 200 % Zoom); feste Höhe nur für einzeilige Controls.

### Umrechnung Bestand (Tailwind-Schriftgrößen)

| Alt | Neu |
|-----|-----|
| `text-xs`, `text-sm` | caption (15) bzw. label (15, Gewicht 600) |
| `text-base` | body (17) |
| `text-lg`, `text-xl` | heading (22) |
| `text-2xl`, `text-3xl` | display (28) |
| `font-medium`, `font-bold`, `font-black` | 600 |
| `tracking-tight` (`card.tsx:21`) | entfällt |

Baseline (re-runnable, Zielwert 0 für `font-medium|bold|black`):
`grep -rnE "font-(bold|black|medium|extrabold)" frontend/src --include=*.tsx | wc -l` → am 2026-10-01 betroffen in `LearnHomePage.tsx` (43, 54, 55, 84, 91, 102), `ManageLayout.tsx:19`, `card.tsx:21`, `SessionPage.tsx` (157, 222, 233, 253, 268), `ProgressPage.tsx` (83, 106, 115, 138), `SetsPage.tsx:53`, `ProfilePickerPage.tsx` (63, 83, 106), `misc.tsx` (47, 67).

---

## Color

Ableitung aus HIG-Rollen (Label, Secondary label, Hintergrundstufen, Separator, Akzent). Token behalten ihre Bestandsnamen, damit Seiten nicht umbenannt werden müssen; zwei Token sind neu.

| Role | Token | Usage |
|------|-------|-------|
| Dominant (60 %) | `{colors.surface}` | Seitenhintergrund (HIG: Hintergrund „Primary for the overall view"); leicht grau, damit Cards sich ohne Rahmenkontrast abheben |
| Secondary (30 %) | `{colors.surface-raised}` | Cards, Eingabefelder, Tab-Leiste inaktiv (HIG: „Secondary for grouping content") |
| Text primär | `{colors.ink}` | Fließtext, Titel (HIG „Label") |
| Text sekundär | `{colors.ink-soft}` | Hinweise, Meta, inaktive Tabs, Placeholder **ohne Alpha** (HIG „Secondary label") |
| Accent (10 %) | `{colors.brand}` | siehe Liste unten |
| Accent gedrückt/Hover, Fokus | `{colors.brand-strong}` | Hover der Primäraktion; `{colors.focus-ring}` verweist darauf |
| Accent-Fläche leise | `{colors.brand-soft}` | Erfolgsmeldung-Hintergrund, Hover von Ghost/Outline |
| Destructive/Fehler | `{colors.danger}`, `{colors.danger-soft}` | Fehlertext, Fehlerrahmen, Fehler-Icon; in Phase 2 zusätzlich die Lösch-Aktion |
| Steuerungsrahmen (neu) | `{colors.border-control}` | Rahmen von Eingabefeldern und Outline-Buttons (≥ 3:1) |
| Fokusring (neu) | `{colors.focus-ring}` | Fokusindikator aller fokussierbaren Elemente (≥ 3:1 gegen `surface` und `surface-raised`) |
| Trennlinie dekorativ | `{colors.border-subtle}` | Card-Rand, Listentrenner; **nie** als einziger Hinweis auf ein Control (HIG „Separator") |

**Accent reserved for** (und nur dafür; HIG „Avoid using the same color to mean different things"):
1. Hintergrund der **einen** Primäraktion je Seite („Passwort ändern", „Änderungen speichern")
2. Hintergrund des aktiven Tabs in `ManageLayout`
3. Textlinks im Fließtext
4. Fokusring (als `{colors.focus-ring}`)

Nicht erlaubt: Brand für statische Texte oder Dekoration (Bestandsverstoß siehe „Bekannte Abweichungen").

**Zustandsfarben ohne Farbe allein:** Fehler = `{colors.danger}` Rahmen + Icon `CircleAlert` + Fehlertext. Erfolg = Icon `CircleCheck` + Text auf `{colors.brand-soft}`. Aktiver Tab = gefüllte Fläche und `aria-current="page"` (setzt `NavLink`).

### Vergleichstabelle (einzige Stelle mit Werten; Bestand zum Vergleich, Vorschlag zur Übernahme in `DESIGN.md`)

Kontrast selbst berechnet am 2026-10-01 (WCAG-2.x-Formel aus OKLCH → sRGB, Werte außerhalb des sRGB-Gamuts abgeschnitten). Die Messung aus dem Issue wurde damit reproduziert.

| Token | Bestand (`index.css`) | Bestand gemessen | Vorschlag | Vorschlag gemessen | Anforderung |
|-------|----------------------|------------------|-----------|--------------------|-------------|
| `brand` | `:17` `oklch(0.58 0.17 265)` ≈ `#4873DE` | Weiß auf brand **4,41:1** (Fehler) | `oklch(0.54 0.19 262)` ≈ `#2A66DB` | Weiß auf brand 5,24:1 | Text ≥ 4,5:1 |
| `brand-strong` | `:18` `oklch(0.47 0.18 265)` ≈ `#274FBE` | Weiß 7,12:1 | `oklch(0.44 0.19 262)` ≈ `#0A46B9` | Weiß 8,13:1 | Hover/Fokus |
| `brand-soft` | `:19` `oklch(0.95 0.03 265)` | brand-strong darauf 6,13:1 | `oklch(0.95 0.03 262)` | brand-strong darauf 7,00:1; ink-soft darauf 5,64:1 | Text ≥ 4,5:1 |
| `danger` | `:25` `oklch(0.6 0.18 25)` ≈ `#D74745` | auf `danger-soft` **3,68:1**, Weiß auf danger 4,31:1 (Fehler) | `oklch(0.52 0.19 27)` ≈ `#BE2323` | auf `danger-soft` 5,28:1, Weiß 6,08:1 | Text ≥ 4,5:1 |
| `danger-soft` | `:26` `oklch(0.96 0.04 25)` | — | `oklch(0.96 0.03 27)` | — | Hintergrund |
| `border-control` (neu) | Bestand nutzt `border-subtle` `:15` `oklch(0.91 0.008 265)` ≈ `#DFE1E7` | auf Weiß **1,31:1**, auf `surface` 1,27:1 (Fehler) | `oklch(0.60 0.01 265)` ≈ `#7D8086` | auf Weiß 3,95:1, auf neuem `surface` 3,57:1 | Nicht-Text ≥ 3:1 |
| `focus-ring` (neu) | `button.tsx:9` `outline-brand` (4,28:1 auf `surface`); Input `input.tsx:11,25` nur Rahmenfarbwechsel, `focus:outline-none` | — | = `brand-strong` | auf Weiß 8,13:1, auf `surface` 7,34:1 | Nicht-Text ≥ 3:1 |
| `ink` | `:10` `oklch(0.22 0.03 265)` ≈ `#141A29` | auf `surface` 16,85:1 | unverändert | auf neuem `surface` 15,66:1 | Text |
| `ink-soft` | `:11` `oklch(0.48 0.02 265)` ≈ `#585E69` | auf `surface` 6,36:1 | unverändert | auf neuem `surface` 5,91:1, auf Weiß 6,54:1 | Text |
| `surface` | `:13` `oklch(0.99 0.004 265)` ≈ `#FAFCFF` | fast identisch mit Card | `oklch(0.965 0.004 280)` ≈ `#F3F3F6` | Stufe unter der Card | HIG Hintergrundstufen |
| `surface-raised` | `:14` `oklch(1 0 0)` | — | unverändert | — | |
| Placeholder | `input.tsx:10,24` `text-ink-soft/60` | ≈ **2,68:1** (Fehler) | `ink-soft` ohne Alpha oder gar kein Placeholder | 6,54:1 | Text ≥ 4,5:1 |

Der Vorschlag `brand` liegt mit 5,24:1 bewusst über der Grenze, damit Hover-/Gamut-Rundung nicht darunter fällt. `DESIGN.md`-Lint meldet Kontrast nur als `warning` bei Exit 0: Ausgabe lesen, Kontrastwarnungen sind blockierend (siehe `AGENTS.md`).

**Q7 (bewusst unverändert):** `success` (`index.css:21-22`) 2,99:1 auf `success-soft`, `warn` (`index.css:23-24`) 1,98:1 auf `warn-soft`. Phase 1 nutzt beide nicht. Eintrag in `DESIGN.md` unter „Bekannte Abweichung", hier unter „Bekannte Abweichungen".

---

## Seiten- und Layoutvertrag

### `ManageLayout` (`frontend/src/features/manage/ManageLayout.tsx`)

- Tabs: **Vokabeln**, **Fortschritt**, **Kinder**, **Konto** (Reihenfolge fest; Icons `BookOpen`, `LayoutDashboard`, `Users`, `KeyRound`). Der Tab „Kinder" ist aktiv für `/verwalten/kinder` und alle Unterrouten.
- Tab-Leiste `flex-wrap`, Abstand `{spacing.sm}`; bei 320 px und 200 % Zoom bricht sie um, kein horizontales Scrollen (HIG „Layout" Anpassungsfähigkeit, WCAG 1.4.10).
- `<Outlet />` (`ManageLayout.tsx:48`) wird in `<main>` gelegt, Kopf bleibt `<header>`, Tabs `<nav aria-label="Verwaltung">`. Ohne `main` meldet axe `landmark-one-main` und `region`.
- Seitenrand `px-4`, oben/unten `py-6`; Abstand Kopf zu Tabs 24, Tabs zu Inhalt 24 (Skala).
- `document.title` je Seite: „Passwort ändern – WordQuest", „Kinder – WordQuest", „Kind bearbeiten – WordQuest" (WCAG 2.4.2).
- Überschriften: `h1` bleibt App-Name im Kopf; Seitentitel als `h2` (`CardTitle`), darunter keine Ebenen überspringen.

### Seite „Passwort ändern" (`/verwalten/konto`)

Reihenfolge von oben: Card (max. Breite `max-w-md`, linksbündig im Container) mit `CardTitle` „Passwort ändern", `CardDescription`, Formular.

| # | Element | Details |
|---|---------|---------|
| 1 | Feld „Aktuelles Passwort" | `type="password"`, `autoComplete="current-password"`, `required` |
| 2 | Feld „Neues Passwort" | `type="password"`, `autoComplete="new-password"`, `required`, Dauerhinweis „Mindestens 10 Zeichen." |
| 3 | Feld „Neues Passwort wiederholen" | `type="password"`, `autoComplete="new-password"`, `required` |
| 4 | Formularweiter Fehler | `ErrorNote` (`role="alert"`) nur für Server-/Netzfehler ohne Feldbezug |
| 5 | Primäraktion | `Button variant="primary" size="md"`, volle Breite mobil, `type="submit"` |
| 6 | Erfolg | `StatusNote` unter der Aktionszeile |

Hinweis „Alle Felder sind Pflichtfelder." steht einmal in der `CardDescription`.
Einfügen per Paste und Passwortmanager bleibt erlaubt (WCAG 3.3.8): kein `onPaste`-Blocker, kein `autocomplete="off"`.

### Seite „Kinder" (`/verwalten/kinder`)

- Liste von Cards als Link (Muster `SetsPage.tsx:49-61`): Avatar (`aria-hidden`), Name (label-Rolle), Meta-Zeile caption: „Neue Karten pro Tag: {n} · PIN gesetzt" bzw. „· Keine PIN". Rechts `ChevronRight`. Linkname für Screenreader: „{Name} bearbeiten" (`aria-label`).
- Karten-Abstand `{spacing.md}`. Mindesthöhe ergibt sich aus Innenabstand (≥ 48 px, über 44).
- Daten: `GET /learners` (`LearnerDto`: `id`, `displayName`, `avatarKey`, `dailyNewLimit`, `hasPin` …, `Contracts.cs`/`types.ts:23-31`).
- Leerzustand siehe Copywriting. Kein „Kind anlegen"-Button (Q2).

### Seite „Kind bearbeiten" (`/verwalten/kinder/:learnerId`)

Card mit `CardTitle` „Kind bearbeiten", `CardDescription` = Kindname (nicht änderbar während Eingabe: zeigt den gespeicherten Namen). Davor ein Zurück-Link („Zurück zu den Kindern", `ghost`, Höhe 44).

| # | Feld | Typ | Hinweis (Dauertext) |
|---|------|-----|--------------------|
| 1 | „Name" | `type="text"`, `autoComplete="off"`, `required`; vorbelegt | — |
| 2 | „Neue Karten pro Tag" | `type="number"`, `inputMode="numeric"`, `min=3`, `max=15`, `required`; vorbelegt | „Zwischen 3 und 15. So viele neue Wörter bekommt dein Kind am Tag." |
| 3 | „Neue PIN (optional)" | `type="text"`, `inputMode="numeric"`, `pattern="[0-9]*"`, `autoComplete="off"`, kein `maxLength` | „4 bis 6 Ziffern. Leer lassen, um die bisherige PIN zu behalten." (bei `hasPin=false`: „4 bis 6 Ziffern. Ohne PIN kann sich das Kind nicht anmelden." — Anmeldung ohne PIN: **UNBEKANNT**, ob das Backend das erlaubt; Satz vor Umsetzung gegen `AuthService.LearnerLoginAsync` prüfen, sonst nur ersten Teil verwenden) |

Entscheidungen (Ermessensspielraum des Researchers, überstimmbar):
- PIN **sichtbar** (`type="text"`): Die Eltern legen den Code für das Kind fest und sollen ihn lesen können; ein Wiederholungsfeld entfällt (weniger Felder, weniger Fehlerpfade).
- Kein `maxLength`: Es würde eingefügte Zeichen still abschneiden und den Fehler verstecken; der Server entscheidet, die UI zeigt den Fehlertext.
- Sprache/Geschwindigkeit (`speed`), Ton (`soundEnabled`) und Avatar sind **nicht** Teil von PAR-01 und erscheinen nicht.
- Nach erfolgreichem Speichern: PIN-Feld wird geleert, Name/Limit zeigen die gespeicherten Werte, Erfolgsmeldung.

### Pflichtänderung: PIN-Eingabe des Kindes (`ProfilePickerPage.tsx`)

**Befund (Konflikt zu PAR-02):** `PIN_LENGTH = 4` (`:12`), Auto-Submit bei vier Ziffern (`:54`), Text „Gib deine vier Zahlen ein." (`:107`), vier Punkte (`:111`). Mit einer 5- oder 6-stelligen PIN kann sich das Kind nie anmelden; der Auto-Submit bei vier Ziffern würde stattdessen Fehlversuche zählen (`MaxPinAttempts = 10`, danach 15 Minuten Sperre, `AuthOptions.cs:24-26`). Erfolgskriterium 4 („Kind meldet sich mit neuer PIN an") ist so nicht erfüllbar.

Vertrag (Empfehlung, Entscheidung des Auftraggebers nötig, falls anders gewünscht):
- Kein Auto-Submit. Punkte wachsen mit der Eingabe bis 6; neue Taste „Los geht's" (`primary`, `size="xl"`, volle Breite unter dem Ziffernfeld, `disabled` unter 4 Ziffern).
- `Enter` auf der Seite löst die Anmeldung wie die Taste aus.
- Text: „Gib deine Zahlen ein." statt „vier Zahlen".
- Punkte: gefüllt `{colors.brand}`, leer nur als Umriss `{colors.border-control}` (leere Punkte in `brand-soft` haben < 3:1); `aria-label` am Container nennt „PIN-Eingabe, {n} Ziffern eingegeben".
- Fokus-/Abstands-/Typo-Regeln wie überall; Profilkacheln (`:71-78`) erhalten über die globale Fokusregel erstmals einen sichtbaren Fokus.

---

## Interaktionsvertrag

### Formularverhalten (beide Formulare)

1. `<form noValidate>`: natives Browser-Popup entfällt, damit die exakten Fehlertexte gelten. `required` bleibt für die Semantik.
2. Validierung **beim Absenden**, nicht beim Verlassen eines Feldes. Fehler eines Feldes verschwindet, sobald das Feld geändert wird. Enter im Textfeld nimmt denselben Pfad wie der Button.
3. Alle Feldfehler erscheinen gleichzeitig; Fokus springt auf das **erste** fehlerhafte Feld (dessen `aria-describedby` liest den Fehler vor). Einzelne Feldfehler haben kein `role="alert"` (kein Doppelvorlesen).
4. Fehler am Feld: Rahmen `{colors.danger}`, Icon `CircleAlert`, Text in caption-Rolle in `{colors.danger}` direkt unter dem Feld (Abstand `{spacing.xs}`), `aria-invalid="true"`.
5. Serverfehler mit Feldbezug (z. B. falsches aktuelles Passwort, ungültige PIN) werden **am Feld** angezeigt, nicht nur formularweit. Dafür muss `ApiError` (`frontend/src/lib/api.ts:8`) die `errors`-Map des `ValidationProblem` mitführen: `readErrorMessage` (`api.ts:134-141`) liest heute nur `detail ?? title`, ein 400 des Servers würde als „One or more validation errors occurred." erscheinen.
6. **Falsches aktuelles Passwort darf kein 401 sein.** `api()` löst bei 401 einen Token-Refresh aus (`api.ts:122`) und räumt bei dessen Scheitern den Token-Speicher (`api.ts:87`). Der Server antwortet deshalb mit 400 `ValidationProblem` (Feld `currentPassword`).
7. Während der Anfrage: Absende-Button `disabled`, Beschriftung „Einen Moment …" (wie `GuardianLoginPage.tsx:66-68`), Formular behält alle Eingaben (HIG Agency). Doppeltes Absenden ist dadurch ausgeschlossen.
8. Bei Fehlschlag (Server/Netz) bleiben alle Eingaben, die Meldung erscheint als `ErrorNote` oberhalb der Aktionszeile und der Fokus bleibt am Button.
9. Erfolg: `StatusNote` (`role="status"`) wird beschriftet; **keine** automatische Ausblendung (HIG Cognitive: Auto-Dismiss vermeiden); Passwortfelder werden geleert. Weiterleitung entfällt.
10. Keine Animation in Formularen. `active:scale-[0.97]` an Buttons (`button.tsx:8`) wird unter `prefers-reduced-motion: reduce` abgeschaltet (HIG Accessibility: Skalieren reduzieren); heute deckt `index.css:122-127` nur `animate-pop`/`animate-nudge` ab.

### Zustände je Baustein

| Baustein | Default | Hover | Fokus (`:focus-visible`) | Fehler | Deaktiviert/Busy |
|----------|---------|-------|--------------------------|--------|------------------|
| Input | `{colors.surface-raised}`, Rahmen `{colors.border-control}` 2 px | — | globaler Ring | Rahmen `{colors.danger}` + Fehlertext + Icon | `opacity-50` (ausgenommen von Kontrastpflicht, nicht für Fehlerzustand verwenden) |
| Button primary | Fläche `{colors.brand}`, Text Weiß (`on-brand`) | Fläche `{colors.brand-strong}` | globaler Ring | — | Text „Einen Moment …", `opacity-50`, `pointer-events-none` |
| Button ghost/outline | Text `{colors.ink-soft}` bzw. `{colors.ink}`; outline-Rahmen `{colors.border-control}` | Fläche `{colors.brand-soft}` | globaler Ring | — | wie oben |
| Tab (NavLink) | Fläche `{colors.surface-raised}`, Text `{colors.ink-soft}` | Fläche `{colors.brand-soft}` | globaler Ring | — | — |
| Kinder-Link-Card | `{colors.surface-raised}` | Rahmen/Schatten unverändert | globaler Ring | — | — |

**Globale Fokusregel** (zentral in `index.css` `@layer base`, aus `DESIGN.md`): `:focus-visible { outline: 2px solid {colors.focus-ring}; outline-offset: 2px }` für alle fokussierbaren Elemente. Entfallen: `focus:outline-none` plus Rahmenwechsel in `input.tsx:11` und `:25`, `focus-visible:outline-*` in `button.tsx:9`. Ring ≥ 3:1 gegen `surface` und `surface-raised`, übersteht Windows-Kontrastmodus (Outline statt Box-Shadow).

### Tastatur und Zoom (Pflicht-Durchgang QUAL-02)

- Tab-Reihenfolge entspricht der visuellen: Abmelden, Tabs (Vokabeln, Fortschritt, Kinder, Konto), Seiteninhalt von oben nach unten, Primäraktion zuletzt. Kein Fokusfang. Landmarken (`header`, `nav`, `main`) erfüllen WCAG 2.4.1 ohne Sprunglink.
- `Enter` in jedem Textfeld sendet; `Space`/`Enter` aktiviert Buttons und Links.
- 200 % Zoom und 320 px Breite: kein Verlust von Inhalt, kein horizontales Scrollen, Tabs und Felder umbrechen, Primäraktion bleibt erreichbar.
- **Blocker für 200 % Zoom:** `frontend/index.html:8` setzt `maximum-scale=1.0, user-scalable=no`. Das verhindert Pinch-Zoom (WCAG 1.4.4); axe meldet `meta-viewport`. Beides muss aus dem Viewport-Meta entfernt werden, sonst ist Erfolgskriterium 5 nicht erreichbar. Doppeltipp-Zoom bleibt durch `touch-action: manipulation` (`index.css:72-75`) unterdrückt.

---

## Copywriting Contract

Alle Texte Deutsch, ganze Sätze, echte Umlaute (neue UI-Texte). Fehlertexte sind die **einzige Wahrheit** für Client, Server und Tests (exakter Textvergleich).

### Passwort ändern

| Element | Copy |
|---------|------|
| Seitentitel / `CardTitle` | Passwort ändern |
| Beschreibung | Mit dem neuen Passwort meldest du dich ab sofort an. Alle Felder sind Pflichtfelder. |
| Labels | Aktuelles Passwort · Neues Passwort · Neues Passwort wiederholen |
| Dauerhinweis Neues Passwort | Mindestens 10 Zeichen. |
| Primary CTA | Passwort ändern |
| Busy | Einen Moment … |
| Erfolg (`role="status"`) | Dein Passwort wurde geändert. |
| Fehler: aktuelles Passwort leer | Bitte gib dein aktuelles Passwort ein. |
| Fehler: aktuelles Passwort falsch (Server, 400) | Das aktuelle Passwort stimmt nicht. |
| Fehler: neues Passwort leer | Bitte gib ein neues Passwort ein. |
| Fehler: neues Passwort zu kurz (Client und Server) | Das neue Passwort braucht mindestens 10 Zeichen. |
| Fehler: Wiederholung leer | Bitte wiederhole das neue Passwort. |
| Fehler: Wiederholung abweichend | Die beiden neuen Passwörter stimmen nicht überein. |
| Fehler: Server/Netz | Das Passwort konnte nicht geändert werden. Prüfe die Verbindung und versuche es noch einmal. |

Prüfreihenfolge: Das Feld „Wiederholung" wird nur geprüft, wenn „Neues Passwort" gültig ist. So bleibt in der Matrix („immer genau ein Feld falsch") je Fall genau ein Fehlertext sichtbar. Zählweise der Länge: UTF-16-Länge auf beiden Seiten (`string.Length` / `.length`); Randfälle mit Zeichen außerhalb des BMP werden nicht gesondert behandelt. Grenzen: 9 Zeichen ungültig, 10 gültig.

### Kind bearbeiten

| Element | Copy |
|---------|------|
| Titel | Kind bearbeiten |
| Zurück-Link | Zurück zu den Kindern |
| Labels | Name · Neue Karten pro Tag · Neue PIN (optional) |
| Primary CTA | Änderungen speichern |
| Busy | Einen Moment … |
| Erfolg (`role="status"`) | Die Änderungen wurden gespeichert. |
| Fehler: Name leer oder nur Leerzeichen (Client und Server) | Wie soll das Kind heißen? Ein Spitzname genügt. |
| Fehler: Limit leer oder außerhalb 3 bis 15 | Bitte gib eine Zahl zwischen 3 und 15 ein. |
| Fehler: PIN ungültig (nicht 4 bis 6 Ziffern, Buchstaben, Leerzeichen; Client und Server, auch bei direktem API-Aufruf) | Die PIN muss aus 4 bis 6 Ziffern bestehen. |
| Fehler: Server/Netz beim Speichern | Die Änderungen konnten nicht gespeichert werden. Prüfe die Verbindung und versuche es noch einmal. |
| Fehler: Laden fehlgeschlagen | Das Kind konnte nicht geladen werden. Prüfe die Verbindung und versuche es noch einmal. |
| Fehler: Kind nicht gefunden (404) | Dieses Kind gibt es nicht (mehr). |

Leere PIN (`""`) heißt „PIN unverändert" und ist gültig. Jeder andere Wert muss `^[0-9]{4,6}$` entsprechen. Grenzen: 3 und 7 Ziffern ungültig, 4 und 6 gültig. Das Limit wird in der UI auf 3 bis 15 begrenzt (der Server klemmt bereits still auf diesen Bereich, `LearnerEndpoints.cs:104`).

**Befund Server-Text:** `LearnerEndpoints.cs:52` liefert „Wie soll das Kind heissen? Ein Spitzname genuegt." (ersatz-transliteriert, `:52`). Der Vertragstext oben hat echte Umlaute und ß; die Serverstelle wird beim Anfassen des Endpunkts angeglichen, damit Client- und Servertext identisch sind. Kommentare im Code bleiben bei `ae/oe/ue`.

### Kinderliste

| Element | Copy |
|---------|------|
| Titel | Kinder |
| Zeile Meta | Neue Karten pro Tag: {n} · PIN gesetzt (bzw. · Keine PIN) |
| Leerzustand, Titel | Noch kein Kinderprofil |
| Leerzustand, Hinweis | Sobald ein Kinderprofil angelegt ist, kannst du es hier bearbeiten. |
| Laden | Lädt … (Standard von `Spinner`) |
| Fehler Liste | Die Kinder konnten nicht geladen werden. Prüfe die Verbindung und versuche es noch einmal. |

Der Leerhinweis verspricht bewusst keine Anlege-Aktion, weil es in Phase 1 keine gibt (Q2).

### Kinder-PIN-Seite (Änderung)

| Element | Copy |
|---------|------|
| Anleitung | Gib deine Zahlen ein. |
| Taste | Los geht's |

### Destruktive Aktionen in dieser Phase

Keine. Das Überschreiben der PIN ist umkehrbar (erneut setzen) und braucht keine Bestätigung. HIG „Assistive Access" („Always ask for confirmation twice" bei schwer rückgängig zu machenden Aktionen) wird in Phase 2 beim Löschen eines Kindes relevant. Das Zurücksetzen des Passworts per Kommando im Container ist kein UI.

### Terminal-Texte (Q4–Q6, kein UI-Vertrag, zur Einordnung)

Mindestlänge 10 Zeichen gilt gleich in App, `setup.sh` und Reset-Kommando; neue Terminalzeilen mit echten Umlauten; Reset-Kommando gibt das erzeugte Passwort einmal aus. Die Formulierung der Terminalzeilen gehört in die Pläne von SETUP-02/04, nicht in diese Datei.

---

## UI Considerations

> Zustandsabdeckung. Texte für Leer-/Fehlerzustände stehen in „Copywriting Contract" und werden hier nur referenziert.

Applicable state considerations resolved: 8 covered, 2 backstop, 2 unresolved

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | Kinderliste | ✅ covered | Leere Liste zeigt `EmptyState` mit dem Text aus „Kinderliste" (Titel und Hinweis), ohne Anlege-Aktion |
| loading | Kinderliste, Kind-Formular | ✅ covered | `Spinner` (`role="status"`) bis die Daten da sind; das Kind-Formular wird erst mit Bestandswerten gerendert, nie leer und dann überschrieben |
| error | Kinderliste, Kind laden, 404 | ✅ covered | Fehlertexte aus „Kinderliste" bzw. „Kind bearbeiten" als `ErrorNote`; 404 mit Link „Zurück zu den Kindern" |
| error | Speichern und Passwort ändern (Server/Netz) | ✅ covered | `ErrorNote` (`role="alert"`) oberhalb der Aktion, alle Eingaben bleiben erhalten, kein Feld wird geleert |
| partial | PIN-Hinweis bei `hasPin` wahr/falsch, Kind ohne Name-Änderung | ✅ covered | Meta-Zeile der Liste und Dauerhinweis am PIN-Feld unterscheiden beide Fälle in Textform |
| zero-one-many | Kinder: ein Kind, mehrere | ✅ covered | Liste verhält sich identisch; kein Sonderfall für ein Kind |
| populated | Kind-Formular | ✅ covered | Name und Limit vorbelegt aus `GET /learners`, PIN-Feld immer leer |
| double-submit | Beide Formulare | ✅ covered | Primärbutton `disabled`, solange die Anfrage läuft |
| long-text | Kindername in Liste, Titelzeile und Beschreibung | 🧪 backstop | Visueller Test mit einem Namen ohne Trennstelle (40+ Zeichen): Text bricht um (`break-words`), nichts wird abgeschnitten; Maximallänge im Backend UNBEKANNT |
| overflow | Vier Tabs bei 320 px und 200 % Zoom | 🧪 backstop | Visueller/Zoom-Test: Tabs umbrechen in zweite Zeile, kein horizontales Scrollen |
| session | Sitzung läuft während des Ausfüllens ab (401, Refresh scheitert → Token weg → Weiterleitung `/login`) | ⚠ unresolved | Eingaben gehen verloren; Planer behandelt als Annahme, kein Sonderverhalten in Phase 1 |
| side-effect | Passwort geändert: bleibt die laufende Sitzung gültig, werden andere Geräte abgemeldet? | ⚠ unresolved | Hängt vom Backend (Token-Widerruf) ab: UI darf nach Erfolg nicht still abmelden, `StatusNote` bleibt stehen; Planer legt das Backend-Verhalten fest und testet „nur das neue Passwort funktioniert" |

---

## Barrierefreiheit (WCAG 2.2 AA, Nachweis QUAL-02)

| Prüfpunkt | Vertrag |
|-----------|---------|
| Kontrast Text | ≥ 4,5:1 für **jeden** Text, auch Größe ≥ 24 px (strenger als HIG-Tabelle, die 3:1 ab 18 pt zulässt); alle Phase-1-Paare sind in der Vergleichstabelle gelistet |
| Kontrast Nicht-Text | Steuerungsrahmen, Fokusring, Icons mit Aussage ≥ 3:1 |
| Zielgröße | ≥ 44 px Höhe und Breite für jedes Control (übertrifft das WCAG-2.5.8-Minimum von 24 px) |
| Namen/Labels | Jedes Feld hat sichtbares Label (`htmlFor`), Hinweis und Fehler per `aria-describedby`; Icon-Buttons mit `aria-label` |
| Fehler (3.3.1, 3.3.3) | Text + Icon + Farbe, benennt das Problem und was zu tun ist |
| Statusmeldungen (4.1.3) | Erfolg `role="status"`, Fehler formularweit `role="alert"` |
| Fokus (2.4.7, 2.4.11) | Globaler Ring; kein fester Kopf, der Fokus verdeckt |
| Authentifizierung (3.3.8) | Paste und Passwortmanager erlaubt; PIN-Pad des Kinder-Logins: ob es ohne Autofill/Paste die Anforderung erfüllt, ist **UNBEKANNT** und gesondert zu bewerten (nicht Teil der Phase-1-Seiten, aber geändert) |
| Titel/Landmarken | `document.title` je Seite, `header`/`nav`/`main` |
| Reduce Motion | Press-Skalierung und Animationen unter `prefers-reduced-motion: reduce` aus |

**Messmethode:** axe-core mit Tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` auf beiden Seiten, 0 Verstöße oder jede verbleibende benannt und begründet. Die Regel `color-contrast` ist in jsdom nicht belastbar (kein Layout/Rendering): Kontrast zusätzlich über den `DESIGN.md`-Lint (Warnungen blockierend) und axe/Lighthouse in einem echten Browser auf den beiden gebauten Seiten. Ausgeliefert wird nur der Lightmodus (`index.css:40` `color-scheme: light`), also nur dort prüfen.

**Edge-Case-Matrix (Quelle: Fehlertext-Tabellen oben, „genau ein Feld falsch", Happy Path zuletzt):**

| Formular | Fälle (je mit Button **und** Enter) |
|----------|-------------------------------------|
| Passwort ändern | aktuell leer · aktuell falsch (Server) · neu leer · neu 9 Zeichen · Wiederholung leer · Wiederholung abweichend · Grenzfall neu genau 10 Zeichen · Happy Path |
| Kind bearbeiten | Name leer · Name nur Leerzeichen · Limit leer · Limit 2 · Limit 16 · PIN 3 Ziffern · PIN 7 Ziffern · PIN mit Buchstaben · PIN mit Leerzeichen · Grenzen PIN 4 und 6 gültig · PIN leer gültig (unverändert) · Happy Path mit neuer PIN |
| Server (API direkt, Integrationstest) | PIN `abc`, `123`, `1234567`, `" 1234"`, `"   "` je 400 mit Text „Die PIN muss aus 4 bis 6 Ziffern bestehen."; Passwort neu 9 Zeichen je 400 |

**Bestandslücke Server:** `LearnerEndpoints.cs:117` behandelt `string.IsNullOrWhiteSpace(request.Pin)` als „PIN unverändert". Ein Pin aus Leerzeichen würde still ignoriert statt abgelehnt; die Validierung für PAR-02 muss `""`/`null` von allen anderen Werten trennen.

---

## Bekannte Abweichungen (bewusst, mit Fundstelle)

| Abweichung | Fundstelle | Begründung |
|------------|-----------|------------|
| `success`/`warn`-Text unter 4,5:1 (2,99:1 bzw. 1,98:1) | `index.css:21-24`, `misc.tsx` Badge-Tönungen, `ProgressPage.tsx:10-22`, `SessionPage.tsx:222` | Q7: Phase 1 nutzt sie nicht; Eintrag in `DESIGN.md` |
| Kein Dark Mode, kein „Increase Contrast"-Satz | `index.css:40`; HIG `color` empfiehlt Light/Dark/Increased Contrast | Ausgeliefert wird nur Light; Einfachheit zuerst; Tokens liegen über AA, daher kein Kontrastmodus nötig |
| Brand für statische Zahlen/Fortschritt | `ProgressPage.tsx:138` (`text-brand-strong`), `misc.tsx:22-25` (`bg-brand`), PIN-Punkte | HIG: Akzent = Interaktives. Nicht in Phase 1 angefasst, Neuvergabe in späterer Phase |
| `hover:brightness-*` statt Token | `button.tsx:15,18` | Phase 1 nutzt `primary`/`ghost`/`outline`; `secondary`/`danger` erhalten Hover-Token in Phase 2 (Lösch-Dialog) |
| Rundheit/Schatten nicht aus HIG abgeleitet | `index.css:30`, `card.tsx:8` | die fünf Seiten regeln sie nicht |
| `touch-target` 48 px vs. Kommentar „44 px" | `index.css:77-81`, `button.tsx:21` | Festlegung oben: Mindestens 44, Standard 48 |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none (`Tool: none`) | not applicable |
| Third-party | none | not applicable |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS
- [ ] Dimension 7 Inventory Provenance: PASS

**Approval:** pending
