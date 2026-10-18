# WordQuest im Heimnetz installieren

Diese Seite führt dich Schritt für Schritt von einem leeren Gerät bis zur ersten Anmeldung mit deinem Elternkonto. Du brauchst dafür kein Vorwissen über Server oder Docker. Jeder Schritt nennt den Befehl und das, was danach zu sehen ist. Teile in spitzen Klammern wie `<Adresse>` sehen bei dir anders aus.

## Voraussetzungen

Zielgerät ist ein **Raspberry Pi 5 mit Raspberry Pi OS (64-bit)**. Ein NAS mit Docker geht ebenso, wenn du dort eine Kommandozeile hast; WordQuest gibt es für ARM (arm64) und für Intel/AMD (x86-64).

Auf dem Gerät brauchst du:

1. **Docker mit Compose.** Für Raspberry Pi OS (64-bit) installierst du Docker nach der offiziellen [Anleitung für Debian](https://docs.docker.com/engine/install/debian/); die [Seite für Raspberry Pi OS](https://docs.docker.com/engine/install/raspberry-pi-os/) verweist für 64-bit selbst dorthin.
2. **Deinen Benutzer in der Gruppe `docker`**, damit die Befehle ohne `sudo` laufen ([Docker-Anleitung](https://docs.docker.com/engine/install/linux-postinstall/)). Melde dich danach einmal ab und wieder an, erst dann wirkt die Gruppe.

   ```bash
   sudo usermod -aG docker $USER
   ```

3. **git**, um WordQuest herunterzuladen. Fehlt es (zum Beispiel bei Raspberry Pi OS Lite), installierst du es so:

   ```bash
   sudo apt install git
   ```

Prüfe danach, ob Docker Compose läuft:

```bash
docker compose version
```

Erwartet:

```text
Docker Compose version <Versionsnummer>
```

## Installation

Lade WordQuest in den Ordner `wordquest` herunter und wechsle hinein:

```bash
git clone https://github.com/mrhdready/WordQuest.git wordquest
cd wordquest
```

Starte die Einrichtung:

```bash
./setup.sh
```

`setup.sh` fragt genau drei Dinge. Zuerst:

1. das **Image-Präfix**. Drück einfach Enter, dann nimmt es den vorgeschlagenen Wert `ghcr.io/mrhdready/wordquest`. Einen anderen Wert brauchst du nur, wenn du eigene Images baust.

Danach lädt es WordQuest in der Version 1.0.0 und startet es; beim ersten Mal kann das ein paar Minuten dauern. Erst dann fragt es nach:

2. der **E-Mail-Adresse** für dein Elternkonto,
3. dem **Passwort** dafür, zweimal, mindestens 8 Zeichen. Die Eingabe bleibt unsichtbar.

Dann legt es dein Elternkonto an. Am Ende siehst du unter anderem diese Zeilen:

```text
✓ .env angelegt.
✓ API ist bereit.
✓ Elternkonto angelegt.
Fertig. WordQuest läuft unter: <Adresse> — Melde dich dort mit <deine E-Mail-Adresse> und deinem Passwort an.
Als Nächstes: Lege unter „Kinder“ das erste Kind an, dann unter „Vokabeln“ ein Vokabelset.
Tägliche Sicherungen liegen in: <Ordner>/backups
```

Öffne die Adresse aus der Zeile „Fertig.“ im Browser eines Geräts in deinem Heimnetz, zum Beispiel `http://192.168.178.20:8080`, und melde dich mit deiner E-Mail-Adresse und deinem Passwort an. `setup.sh` nimmt dafür den ersten Eintrag, den `hostname -I` ausgibt. Brauchst du die Adresse später wieder, zeigt dir derselbe Befehl sie als ersten Eintrag:

```bash
hostname -I
```

WordQuest nutzt den Port 8080. Ist er schon belegt, trägst du in die Datei `.env` eine Zeile wie `WQ_PORT=9000` ein und startest `./setup.sh` noch einmal.

Ob alles läuft, zeigt dir jederzeit:

```bash
docker compose ps
```

Die Liste zeigt die vier Dienste `api`, `backup`, `db` und `web`, jeweils mit `Up` in der Spalte `STATUS`.

Im Ordner `wordquest` sind dabei entstanden:

- `secrets/` mit dem Datenbank-Passwort und dem Schlüssel für die Anmeldung, nur für dich lesbar,
- `.env` mit den Einstellungen,
- `backups/` für die täglichen Sicherungen.

Diese Dateien gehören zu deiner Installation. Lösche sie nicht. Ein zweiter Lauf von `./setup.sh` lässt Secrets, `.env` und Konto unverändert.

Nach der Anmeldung siehst du die Bereiche „Vokabeln“, „Fortschritt“, „Kinder“ und „Konto“. Als Nächstes legst du unter „Kinder“ das erste Kind mit einer PIN an und unter „Vokabeln“ ein Set. Danach wählt das Kind auf der Startseite sein Profil und lernt. Auf einem Gerät, auf dem du als Elternteil angemeldet bist, erscheint die Profilauswahl erst, nachdem du dich abgemeldet hast.

Im Heimnetz läuft WordQuest ohne HTTPS. Deshalb lässt es sich nicht als App auf das Tablet legen; im Browser funktioniert es vollständig.

## Update

Wechsle in den Ordner `wordquest`, lade den neuen Stand von WordQuest herunter und starte das Update:

```bash
cd wordquest
git pull
./upgrade.sh
```

`upgrade.sh` nimmt die Version, die `git pull` mitgebracht hat. Bevor es etwas ändert, sichert es die Datenbank nach `backups/vor-update-<Datum>-<Uhrzeit>.sql.gz` und prüft die Sicherung. Erst danach lädt es die neue Version, trägt sie in `.env` ein, startet WordQuest damit und wartet, bis es bereit ist. Deine Kinder, Vokabeln und der Lernstand bleiben dabei erhalten. Am Ende siehst du unter anderem diese Zeilen:

```text
Aktualisiere WordQuest von <alte Version> auf <neue Version>.
✓ Sicherung geprüft: backups/vor-update-<Datum>-<Uhrzeit>.sql.gz
Lade Version <neue Version> …
Starte Version <neue Version> …
Warte auf die API …
✓ API ist bereit.
Fertig. WordQuest läuft jetzt mit Version <neue Version>. Die Sicherung von vorher liegt in <Datei>.
```

Die Sicherung steht danach in der Liste von `./restore.sh` (siehe „Wiederherstellen“). Gibt es keine neue Version, legt `./upgrade.sh` eine weitere Sicherung an und lädt höchstens neuere Images für die Datenbank und den Sicherungsdienst; deine Daten bleiben unverändert.

Hast du eine Datei von WordQuest selbst geändert, zum Beispiel den Port in einer Compose-Datei, bricht `git pull` ab, wenn das Update dieselbe Datei ändert, und ändert nichts. Mach deine Änderung dann mit `git checkout -- <Datei>` rückgängig, trag die Einstellung in `.env` ein, zum Beispiel `WQ_PORT=9000`, und starte `git pull` erneut. Einstellungen gehören nur in `.env`; `git pull` lässt `.env`, `secrets/` und `backups/` unverändert.

Wenn etwas schiefgeht:

- **Die neue Version ist noch nicht verfügbar.** Kurz nach dem Erscheinen einer Version dauert es einige Minuten, bis sie geladen werden kann. Dann endet `upgrade.sh` mit dieser Meldung und ändert nichts, WordQuest läuft mit der alten Version weiter:

  ```text
  Die Version <neue Version> ließ sich nicht laden. Wenn sie gerade erst erschienen ist, versuche es in einer Viertelstunde erneut; sonst prüfe die Internetverbindung und WQ_IMAGE_PREFIX in .env. Es wurde nichts geändert. Die Sicherung liegt in <Datei>.
  ```

- **Die Sicherung gelingt nicht.** Dann lädt `upgrade.sh` die neue Version gar nicht erst und meldet „Die Sicherung vor dem Update ist fehlgeschlagen. Es wurde nichts geändert.“
- **Die neue Version startet nicht.** Dann endet `upgrade.sh` mit einer Meldung wie dieser:

  ```text
  Die API ist nach zwei Minuten nicht bereit. Deine Daten von vorher liegen in <Datei>. Sieh mit `docker compose logs api` nach; die Meldung dort nennt meist den Ausweg. Zurück zur Version <alte Version>: Trage in .env WQ_VERSION=<alte Version> ein und spiele danach die Sicherung mit ./restore.sh <Datei> ein.
  ```

  Statt des ersten Satzes kann auch „Der Start der Version <neue Version> ist fehlgeschlagen.“ dastehen. Sieh zuerst mit `docker compose logs api` nach (siehe „Die API startet nicht“ unter Hilfe bei Problemen). Willst du zurück zur alten Version, trag in der Datei `.env` bei `WQ_VERSION=` die alte Version aus der Meldung ein und spiele die genannte Sicherung ein, zum Beispiel:

  ```bash
  ./restore.sh backups/vor-update-20261001-193000.sql.gz
  ```

  Das Skript fragt wie unter „Wiederherstellen“ nach `ja` und startet WordQuest danach mit der Version aus `.env` und dem Stand von vor dem Update. Rufe `./upgrade.sh` vorher nicht noch einmal auf: Ein neuer Aufruf sichert den Stand nach dem Update und nennt dann diese neue Datei. Die Sicherung von vor dem Update ist die aus der ersten Meldung; in der Liste von `./restore.sh` steht sie unter der neueren.

`upgrade.sh` gilt für Installationen, die mit `setup.sh` eingerichtet sind. Einen früheren Schnelltest setzt du neu auf (siehe „Früherer Schnelltest“ unter Hilfe bei Problemen).

## Sicherung und Wiederherstellung

Der Dienst `backup` sichert die Datenbank jeden Tag in den Ordner `backups/` und hebt 14 tägliche, 8 wöchentliche und 6 monatliche Stände auf. Die Sicherungen enthalten alle Familiendaten, deshalb ist der Ordner nur für dich lesbar.

Eine Sicherung sofort anstoßen:

```bash
docker compose exec backup /backup.sh
```

In der Ausgabe steht:

```text
SQL backup created successfully
```

Danach liegt in `backups/daily/` eine Datei `wordquest-<Datum>.sql.gz`.

Der Ordner `backups/` muss auf einem Linux-Dateisystem liegen (zum Beispiel auf der SD-Karte oder einer Platte mit ext4), nicht auf einer Windows-Freigabe oder einem exFAT-Stick. Der Sicherungsdienst läuft als root; unter Linux gehören die Sicherungsdateien deshalb root, und alte Stände löschst du mit `sudo`.

### Wiederherstellen

Im Ordner `wordquest`:

```bash
./restore.sh
```

Das Skript zeigt die vorhandenen Sicherungen, die neueste zuerst. Gib die Nummer der Sicherung ein, die du zurückholen willst. Danach fragt es, ob du fortfahren willst: Nur die Eingabe `ja` ersetzt den heutigen Stand, jede andere Antwort bricht ab, ohne etwas zu ändern. Die Ausgabe sieht so aus:

```text
Vorhandene Sicherungen, die neueste zuerst:
  1) backups/daily/wordquest-<Datum>.sql.gz
  2) backups/last/wordquest-<Datum>-<Uhrzeit>.sql.gz
Der heutige Stand von WordQuest wird durch den Stand aus <Datei> ersetzt. Vorher wird der heutige Stand gesichert.
✓ Heutiger Stand gesichert in backups/vor-wiederherstellung-<Datum>-<Uhrzeit>.sql.gz.
Starte WordQuest …
Fertig. WordQuest zeigt jetzt den Stand aus <Datei>. Der Stand von vorher liegt in <Vorher-Datei>.
```

Bevor etwas ersetzt wird, prüft das Skript die gewählte Datei und sichert den heutigen Stand nach `backups/vor-wiederherstellung-<Datum>-<Uhrzeit>.sql.gz`. Diese Datei steht beim nächsten Aufruf mit in der Liste; so kommst du auch wieder zum Stand von vor der Wiederherstellung zurück. Während des Einspielens ist WordQuest kurz nicht erreichbar.

Wenn etwas schiefgeht:

- Ist die gewählte Datei unvollständig oder keine WordQuest-Sicherung, lehnt das Skript sie ab und ändert nichts.
- Scheitert das Einspielen, spielt das Skript den Stand von vorher automatisch zurück, und WordQuest läuft weiter. Die Meldung nennt beide Dateien.
- Scheitert auch das, bleibt die API von WordQuest gestoppt, damit sie nicht mit einer leeren Datenbank startet; anmelden geht dann nicht. Die Meldung enthält „Die API bleibt gestoppt. Deine Daten liegen in <Datei>.“ Diese Datei kannst du mit `./restore.sh` wieder einspielen, sobald die Ursache behoben ist.

Für Fortgeschrittene: Mit einem Pfad nimmt das Skript direkt diese Datei, Prüfung und Rückfrage bleiben gleich, zum Beispiel:

```bash
./restore.sh backups/daily/wordquest-20261001.sql.gz
```

Eigene Sicherungen mit der Endung `.sql.gz` kannst du direkt in `backups/` legen, sie stehen dann mit in der Liste. Der Sicherungsdienst räumt nur seine Ordner `last`, `daily`, `weekly` und `monthly` auf; Dateien direkt in `backups/`, auch die `vor-wiederherstellung-…`- und `vor-update-…`-Dateien, löschst du selbst, wenn du sie nicht mehr brauchst.

Nach der Wiederherstellung müssen sich alle Geräte neu anmelden, Kinder wieder mit Profil und PIN. Wer gerade angemeldet ist, wird spätestens nach rund 15 Minuten abgemeldet. Passwörter und PINs gelten so, wie sie zur Zeit der Sicherung waren. Hast du dein Passwort nach der Sicherung geändert, weil du einen Verdacht hattest, setze es mit dem Befehl unter „Passwort vergessen“ (Hilfe bei Problemen) erneut zurück.

## Hilfe bei Problemen

**Die Images lassen sich nicht laden.** `setup.sh` bricht dann ab mit:

> Images konnten nicht geladen werden. Stimmt WQ_IMAGE_PREFIX in .env, und sind die Pakete öffentlich?

Prüfe die Internetverbindung des Geräts. Hast du beim Präfix etwas anderes als Enter eingegeben, korrigiere den Wert bei `WQ_IMAGE_PREFIX` in der Datei `.env` (Standard `ghcr.io/mrhdready/wordquest`). Starte danach `./setup.sh` noch einmal.

**Der Port ist belegt.** Bricht `setup.sh` beim Start mit einer Meldung ab, die den Port 8080 nennt, zum Beispiel mit `port is already allocated`, nutzt schon etwas anderes diesen Port. Läuft noch der frühere Schnelltest, beende ihn zuerst (siehe „Früherer Schnelltest“ unten). Sonst trag in `.env` eine Zeile wie `WQ_PORT=9000` ein und starte `./setup.sh` noch einmal. WordQuest läuft dann unter dem neuen Port.

**Der Ordner `backups` gehört nicht dir.** `setup.sh` bricht dann ab mit:

> Der Ordner backups gehört nicht dir. Ändere den Besitzer mit: sudo chown -R "$(id -un)" backups — und starte setup.sh erneut.

Führe genau diesen Befehl im Ordner `wordquest` aus und starte `./setup.sh` erneut:

```bash
sudo chown -R "$(id -un)" backups
```

**Passwort vergessen.** Im Ordner `wordquest`:

```bash
docker compose exec api dotnet WordQuest.Api.dll reset-password eltern@example.de
```

Ersetze `eltern@example.de` durch die E-Mail-Adresse deines Elternkontos.

Der Befehl erzeugt ein neues Passwort und zeigt es **genau einmal** an; es wird nirgends im Klartext gespeichert. Melde dich damit an und ändere das Passwort danach unter „Konto“. Gibt es kein Elternkonto mit dieser Adresse, meldet er das und ändert nichts. Geräte, die mit diesem Elternkonto angemeldet sind, können ihre Sitzung danach nicht mehr verlängern; wer schon angemeldet ist, bleibt höchstens bis zum Ablauf des aktuellen Zugangs angemeldet (Standard 15 Minuten).

**Die API startet nicht.** `setup.sh` meldet dann:

> Die API ist nach zwei Minuten nicht bereit. Sieh mit `docker compose logs api` nach, was fehlt.

Sieh nach, was die API meldet:

```bash
docker compose logs api
```

Eine Zeile, die mit „Start abgebrochen:“ beginnt, nennt den Grund und den Ausweg, zum Beispiel:

> Start abgebrochen: WQ_JWT_SIGNING_KEY fehlt oder ist ein bekannter Standardwert. Führe `setup.sh` aus oder trage einen eigenen Wert ein.

Fehlt `secrets/jwt_key.txt`, erzeugt `./setup.sh` die Datei neu; eine vorhandene Datei lässt es unverändert. Für `secrets/db_password.txt` hilft das nicht: Die Datenbank behält das Passwort aus der Installation, ein neu erzeugtes passt nicht dazu.

**Früherer Schnelltest.** Hast du WordQuest früher mit der alten Schnelltest-Datei ausprobiert, setzt du es mit dieser Seite neu auf; den alten Test beendest du mit `docker compose -p wordquest-quick down`, seine Daten bleiben in ihrem Docker-Volume, bis du es selbst löschst.

Mit eigener Domain und Zertifikat (nötig, um WordQuest als App aufs Tablet zu legen) gibt es eine Variante für Fortgeschrittene, siehe [README, Variante B](../README.md#variante-b--mit-domain-und-tls-für-fortgeschrittene).
