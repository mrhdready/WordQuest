---
phase: quick-261006-r7l
reviewed: 2026-10-06
depth: standard
files_reviewed: 2
files_reviewed_list:
  - setup.sh
  - .planning/quick/261006-r7l-installer-rechte-lesbare-docker-secrets-/smoke.mjs
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Review: Installer und Secret-Rechte

## Narrative Findings (AI reviewer)

Der geänderte Installer-Diff erfüllt die vorgelegten Kriterien für normale Secret-Dateien: ausführbarer Dateimodus, Verzeichnis 0700, beide Dateien 0644 und unveränderte Inhalte. Compose mountet einzelne Dateien; deshalb verhindert 0700 den Zugriff anderer Hostbenutzer, ohne den Containerzugriff auf die einzelnen Mounts zu verhindern. Keine HTTP- oder UI-Änderung bewertet.

`node .planning/quick/261006-r7l-installer-rechte-lesbare-docker-secrets-/smoke.mjs --installer` endete mit Exit-Code 0; alle fünf ausgegebenen Checks waren wahr. Der Docker-Nachweis wurde in dieser Reviewer-Instanz durch die Sandbox am Docker-Socket blockiert und bleibt unabhängig ungeprüft.

Keine offenen Findings im aktualisierten Diff.

## Behobener Testbefund

WR-01 (WARNING) betraf `smoke.mjs:19-26`: Die erste Version führte vor der Messung neuer Dateirechte zwei erfolgreiche Installer-Aufrufe aus und konnte eine nur beim Wiederholungsaufruf korrigierte Erstinstallation übersehen. Der aktualisierte Test verwendet den erfolgreichen direkten Erstaufruf und führt Bash nur als Ersatz bei dessen Fehlschlag aus. Die Rechte werden nun vor einem weiteren erfolgreichen Aufruf gemessen. Die Korrektur wurde am aktuellen Code geprüft; eine erneute Ausführung war für diese reine Ablaufkorrektur im Review nicht nötig.

Der Orchestrator meldet für den tatsächlichen API-Non-Root-Test einen roten Lauf vor dem Fix (Exit-Code 1) und einen grünen Lauf danach (Exit-Code 0). Das ist ein Nachweis des Orchestrators, keine eigene Docker-Beobachtung dieser Reviewer-Instanz.
