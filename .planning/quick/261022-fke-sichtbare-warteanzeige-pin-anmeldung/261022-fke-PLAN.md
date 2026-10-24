---
phase: quick-261022-fke
plan: "01"
type: execute
wave: 1
depends_on: [quick-261021-v4n]
files_modified:
  - frontend/src/features/auth/ProfilePickerPage.tsx
  - frontend/src/features/auth/ProfilePickerPage.test.tsx
  - Documentation/WordQuest_Konzept_und_Architektur.md
  - .planning/STATE.md
autonomous: true
requirements: [PAR-02, FIX-08]
must_haves:
  truths:
    - "Waehrend der Kinder-Anmeldung steht „Einen Moment …“ sichtbar am Ziffernfeld; nach Erfolg oder Fehler ist sie weg, bei Fehler steht die Fehlermeldung wie bisher."
    - "Die Anzeige ist die bestehende Statuszeile (role=status), kein zweiter Baustein, keine doppelte Ansage."
    - "Die Ziffernanzahl bleibt nur fuer Screenreader (sr-only); sichtbar ist allein die Warteanzeige."
    - "Die Zeile hat immer ihre Hoehe (eine Zeile type-body-md), die Tasten verschieben sich beim Einblenden nicht."
    - "Nur DESIGN.md-Tokens (type-body-md, text-ink); Kontrast >= 4.5:1."
---

<objective>
Entscheidung Dennis 2026-10-22 (Review-Befund 1 aus 261021-v4n): sehende Kinder
sollen das Warten nach der vierten Ziffer erkennen, nicht nur Screenreader.
</objective>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Roter Test – Warteanzeige sichtbar, Zaehler unsichtbar, verschwindet nach Fehler</name>
  <files>frontend/src/features/auth/ProfilePickerPage.test.tsx</files>
  <action>Neuer Test mit verzoegerter 401-Antwort: waehrend des Wartens ist „Einen Moment …“ im role=status und weder Element noch Vorfahr ist `sr-only`; der Zaehler „3 Ziffern eingegeben“ liegt in `sr-only`; nach der Antwort ist der Text weg und die Fehlermeldung steht.</action>
  <verify><automated>cd frontend && npx vitest run src/features/auth/ProfilePickerPage.test.tsx</automated> rot mit Grund „sr-only“</verify>
</task>

<task type="auto">
  <name>Task 2: Statuszeile sichtbar fuer das Warten, Platz reserviert</name>
  <files>frontend/src/features/auth/ProfilePickerPage.tsx</files>
  <action>Statuszeile als `<p role="status" className="min-h-lh text-center type-body-md text-ink">`; Text in einem `<span>`, der nur bei `busy` sichtbar ist, sonst `sr-only`. `min-h-lh` (Tailwind 4, 1lh) reserviert eine Zeile ohne px-Wert.</action>
  <verify><automated>cd frontend && npx vitest run src/features/auth/ProfilePickerPage.test.tsx</automated> gruen</verify>
</task>

<task type="auto">
  <name>Task 3: Doku und Gate</name>
  <files>Documentation/WordQuest_Konzept_und_Architektur.md, .planning/STATE.md</files>
  <action>Konzept §Kinder-Login: Warteanzeige sichtbar. Frontend-Gate, e2e mit axe, Install-Smoke, Tastatur/200 %/Screenshot mit verzoegerter Anmeldung, Review per `claude -p`.</action>
</task>

</tasks>
