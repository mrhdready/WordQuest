# Phase 1 — UI Review

**Audited:** 2026-10-16
**Baseline:** `01-UI-SPEC.md` (approved) und `DESIGN.md` (normativ)
**Screenshots:** nicht erstellt (Vorgabe: kein Dev-Server, kein Stack; nur Code-Audit)
**Interaction captures:** off (Code-Audit, kein Browserlauf)
**A11y-Beleg (übernommen, nicht neu gemessen):** e2e 23 passed / 1 skipped, axe 0 Verstöße (`frontend/e2e/axe.ts`, Stand 01-08-SUMMARY)

Befunde, die in den `## Review`-Abschnitten von 01-01 bis 01-08 als behoben oder akzeptiert stehen, sind hier nicht wiederholt.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Vertragstexte exakt umgesetzt; Profil-Ladefehler und leere Profilwahl haben Texte außerhalb des Vertrags, ohne nächsten Schritt |
| 2. Visuals | 3/4 | Anker je Seite wie vereinbart; leere Zustände ohne Überschrift, Zurück-Elemente uneinheitlich gebaut |
| 3. Color | 3/4 | Kein Hex, kein Inline-Style; Accent dennoch auf drei nicht freigegebenen Stellen |
| 4. Typography | 4/4 | Nur `type-*`-Tokens, null rohe `text-*`/`font-*`-Klassen |
| 5. Spacing | 4/4 | Keine 12/20/28/40-px-Reste, keine Arbitrary-Werte |
| 6. Experience Design | 3/4 | Zustände sauber; Profil-Ladefehler ist eine Sackgasse, 200-%-Zoom und Tastatur-Durchgang weiter unbelegt |

**Overall: 20/24**

---

## Top 3 Priority Fixes

1. **WARNING — Profil-Ladefehler ohne Ausweg** (`frontend/src/features/auth/ProfilePickerPage.tsx:47-51,116-118`): `retry: false` und keine Aktion; ein Kind sieht „Die Profile konnten nicht geladen werden.“ und kommt nur per Neuladen weiter. Fix: Text auf den Vertragstext „Der Server ist gerade nicht erreichbar. Prüfe die Verbindung und versuche es noch einmal.“ und darunter `Button variant="secondary"` „Noch einmal“ mit `onClick={() => void profiles.refetch()}`.
2. **WARNING — 200 % Zoom und Tastatur-Durchgang nicht belegt**: UI-SPEC „axe-Lauf“ und `01-VALIDATION.md:60,82` fordern beides je Phase-1-Seite; `grep -ri zoom frontend/e2e` ohne Treffer, VALIDATION-Zeile 60 steht auf ❌. Fix: Manuellen Durchgang auf `/`, `/login`, `/verwalten/kinder`, `/verwalten/kinder/neu`, `/verwalten/kinder/:id`, `/verwalten/konto` durchführen und mit Datum in `01-VALIDATION.md` eintragen; das ist Teil des Erfolgskriteriums 5, nicht optional.
3. **WARNING — Accent außerhalb der freigegebenen Liste** (`frontend/src/features/manage/ProgressPage.tsx:135`, `frontend/src/components/ui/misc.tsx:63`): Kennzahlen `text-primary` und der Spinner-Ring `border-primary` sind in UI-SPEC „Accent reserved for“ (1–7) nicht enthalten. Fix: Kennzahlen `text-ink`, Spinner-Ring `border-ink-soft`; oder beide Stellen in UI-SPEC/`DESIGN.md` als Accent-Rolle aufnehmen.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

Abgeglichen gegen den Copywriting Contract: Fehlertexte in `ChildFormPage.tsx:29-37`, Hilfetexte `:151-154,175`, CTAs `:149`, Erfolgstexte `:99,109`, Busy-Text „Einen Moment …“ (`:205`, `ProfilePickerPage.tsx:237`), „Gib deine Zahlen ein.“ (`ProfilePickerPage.tsx:167`), Leerer Zustand Kinderliste (`ChildrenPage.tsx:29`) — alle wörtlich. Kein „Submit“, „OK“, „Click here“.

- **WARNING** `ProfilePickerPage.tsx:117` „Die Profile konnten nicht geladen werden.“ — nicht im Vertrag, sagt nicht, was zu tun ist. Der Vertrag hat dafür „Der Server ist gerade nicht erreichbar. …“. Fix siehe Top 1.
- **WARNING** `ProfilePickerPage.tsx:140` „Hier ist noch kein Kinderprofil angelegt.“ — weicht von der Vertrags-Überschrift „Noch kein Kinderprofil“ ab und nennt keinen Weg. Auf frischer Installation ist das der erste Bildschirm. Fix: `EmptyState title="Noch kein Kinderprofil" hint="Ein Elternteil legt es unter „Ich bin ein Elternteil“ an."`.
- **Hinweis** `ProfilePickerPage.tsx:64` Fallback „Das hat nicht geklappt.“ ohne „Versuche es noch einmal.“ — Vertragstext vollständig übernehmen.
- **Hinweis** `ChildFormPage.tsx:30` „Der Name darf höchstens 100 Zeichen lang sein.“ steht nicht im Vertrag (Ergänzung aus 01-07, Doku-Drift dort als behoben gemeldet für die Namensgrenze — nur prüfen, ob der Text in UI-SPEC nachgetragen ist).

### Pillar 2: Visuals (3/4)

Anker wie in UI-SPEC „Primärer visueller Anker“: eine Card mit `CardTitle` und genau einem Primary-Button (`ChildFormPage.tsx:157-207`), `ListGroup`/`ListRow` mit Avatar, Name, `ChevronRight` (`ChildrenPage.tsx:32-47`), PIN-Punkte über Ziffernfeld plus schwebendes „Los geht’s“ (`ProfilePickerPage.tsx:175-238`). Icon-Buttons haben `aria-label` (`ManageLayout.tsx:34,64`, `ProfilePickerPage.tsx:156,221`, `SessionPage.tsx:250`).

- **WARNING** `misc.tsx:78-84` `EmptyState` rendert den Titel als `<p>`: visuell Headline, semantisch kein Heading. Auf `/verwalten/kinder` steht danach kein Inhalt unter dem `h2` „Kinder“, aber auf der Bearbeiten-Seite (`ChildFormPage.tsx:68`) ist der leere Zustand die einzige Aussage ohne Überschrift. Fix: `<h2>` bzw. `as`-Prop.
- **WARNING** Zurück-Elemente in drei Bauweisen: `Button variant="round" size="icon"` (`ProfilePickerPage.tsx:152`), Link mit `glass-clear`-Span `size-12` (`ChildFormPage.tsx:44-49`, Muster `SetDetailPage.tsx:58`). UI-SPEC verlangt `button-round`. Fix: Zurück-Link als `Button asChild variant="round"` plus Text, einmal in `components/ui` statt zweimal von Hand.
- **Hinweis** `ProfilePickerPage.tsx:159` `ChevronLeft` und `:225` `Delete` ohne `aria-hidden`, alle anderen Icons tragen es (lucide setzt es nach eigener Vorgabe; konsistent machen).
- Bekannt offen, nicht neu gewertet: Button-Variante `round` = `secondary` (01-01 „Bewusst offen“).

### Pillar 3: Color (3/4)

`grep` über `frontend/src/**/*.tsx`: 0 Hex-Werte, 0 `style={…}`, 0 Arbitrary-Farbklassen. Accent-Treffer (11):

| Stelle | Rolle | Im Vertrag? |
|---|---|---|
| `button.tsx:22` `bg-primary` | Primary-Button | ja (1) |
| `ManageLayout.tsx:53` `glass-selected text-primary` | aktiver Tab | ja (2) |
| `ManageLayout.tsx:63`, `SessionPage.tsx:246` `roundPrimary` | „+“ / Senden je Formular | ja (7 / 1) |
| `ProfilePickerPage.tsx:183` `bg-primary` | PIN-Punkte | ja (4) |
| `ProgressPage.tsx:68` `glass-selected text-primary` | Kind-Auswahl | wie Tab, vertretbar |
| `ProgressPage.tsx:135` `text-primary` | Kennzahlen (`Stat`) | **nein** |
| `misc.tsx:63` `border-primary` | Spinner-Ring | **nein** |
| `LearnHomePage.tsx:152` `glass-selected` | Auswahl ohne Accent-Text | n/a |

- **WARNING** zwei Stellen außerhalb der Accent-Liste, Fix siehe Top 3. Spinner ist auf jeder Ladephase jeder Seite sichtbar und verwässert damit die 10-%-Regel am häufigsten.
- Kontrast: durch axe 0 belegt (übernommen), PIN-Leerpunkt `border-border-control` erfüllt 1.4.11 laut A11.

### Pillar 4: Typography (4/4)

Verteilung (`grep -o "type-*"`): body-md 16, headline 11, body-md-strong 10, body-sm 9, body-lg 8, emoji 7, large-title 4, display 3, title 3, label-section 3, keypad 1, label-tab 1. Rohe `text-(xs…9xl)` und `font-(…)`: **0**. Rollen stimmen mit der UI-SPEC-Tabelle (`large-title` für „Wer lernt heute?“ `ProfilePickerPage.tsx:114`, `title` für „Hallo, …“ `:166`, Fehler `body-md-strong` `field.tsx:50`, Label `label-section` `misc.tsx:9`).

- **Hinweis** `type-display` und `type-body-sm` sind in `DESIGN.md:35,72` definiert, aber nicht in der Rollen-Tabelle der UI-SPEC; nur Phase-fremde Seiten nutzen sie. Kein Abzug.

### Pillar 5: Spacing (4/4)

`grep` auf `-(3|5|7|10|0.5|1.5|2.5)`-Abstände: **0 Treffer**; Arbitrary `[..px]`/`[..rem]`: **0**. Q8/A12 ist damit vollständig umgesetzt. Größen außerhalb der Abstandsskala sind Tokens: `h-13`/`size-13` = 52 px (`components.input.height`), `h-15`/`min-h-15` = 60 px (`DESIGN.md:136,154,197`), `size-20` = 80 px (Keypad), `size-16` = 64 px („+“).

- **Hinweis** `ManageLayout.tsx:52` Tabs `px-4` bei `flex-1` + `flex-wrap`: bei 320 px und vier Tabs bricht die Leiste um; laut 01-06 an 01-08 übergeben („Tab-Leiste bei 640 px“), Abnahme visuell offen (siehe Pillar 6).

### Pillar 6: Experience Design (3/4)

Abgedeckt: Laden (`Spinner` in `ChildrenPage.tsx:20`, `ChildFormPage.tsx:63`, `ProfilePickerPage.tsx:103`), Fehler beim Erstladen ohne Formularverlust (`ChildFormPage.tsx:66`), unbekanntes Kind (`:68`), Doppel-Submit per Ref und `disabled` (`:120,205`, Keypad `:208`), Fokus auf erstes Fehlerfeld (`:92-96`), Server-Feldfehler am Feld (`:134-138`), Fokus nach falscher PIN (`ProfilePickerPage.tsx:45`), physische Tastatur inkl. Enter-Doppelschutz (`:85-100`), „Los geht’s“ erst ab 4 Ziffern (`:57,233`). Keine zerstörerische Aktion in Phase 1 (Vertrag).

- **WARNING** Profil-Ladefehler ohne Wiederholen, siehe Top 1. Für die Zielgruppe (Kind am Tablet) ist das die einzige Sackgasse der Phase.
- **WARNING** 200 % Zoom und Tastatur-Durchgang fehlen als Beleg, siehe Top 2 (in 01-03/-04/-06 als „Abnahme am Ende der Phase“ offen, nicht akzeptiert).
- **Hinweis** `ChildrenPage.tsx:27` zeigt bei Ladefehler die `ErrorNote` ohne Wiederholen-Aktion; gleiche Lösung wie Top 1, geringeres Risiko (Elternteil kann neu laden).
- **Hinweis** `ChildFormPage.tsx:134-137` mappt Serverfehler nur für `displayName` und `pin`; ein `dailyNewLimit`-Feldfehler landete im allgemeinen Hinweis. Heute klemmt der Server still, daher kein realer Pfad.
- Bekannt offen, nicht neu gewertet: `refreshAccessToken` meldet bei 429 ab (01-04), `Stat` mit `<dd>` vor `<dt>` (01-03).

Registry audit: übersprungen, kein `components.json`, keine Drittregistries (UI-SPEC Registry Safety).

---

## Files Audited

- `frontend/src/components/ui/field.tsx`, `misc.tsx`, `list.tsx`, `button.tsx`, `input.tsx`
- `frontend/src/features/auth/ProfilePickerPage.tsx`
- `frontend/src/features/manage/ManageLayout.tsx`, `ChildrenPage.tsx`, `ChildFormPage.tsx`, `ProgressPage.tsx`
- `frontend/src/features/learn/LearnHomePage.tsx`, `SessionPage.tsx` (nur Accent/Größen)
- `frontend/e2e/*.spec.ts` (Grep auf Zoom/Tab)
- `.planning/phases/01-safe-home-network-install/01-UI-SPEC.md`, `01-VALIDATION.md`, `01-0[1-8]-SUMMARY.md` (Review-Abschnitte), `DESIGN.md`
