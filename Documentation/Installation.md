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
Als Nächstes: Lege unter „Verwalten → Kinder“ das erste Kind an, dann ein Vokabelset.
Tägliche Sicherungen liegen in: <Ordner>/backups
```

Öffne die Adresse aus der Zeile „Fertig.“ im Browser eines Geräts in deinem Heimnetz, zum Beispiel `http://192.168.178.20:8080`, und melde dich mit deiner E-Mail-Adresse und deinem Passwort an. Die Adresse ermittelt `setup.sh` mit `hostname -I`. Brauchst du sie später wieder, zeigt dir derselbe Befehl auf dem Pi die Adresse als ersten Eintrag der Zeile:

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

Als Nächstes legst du unter „Verwalten → Kinder“ das erste Kind mit einer PIN an und unter „Vokabeln“ ein Set. Danach wählt das Kind auf der Startseite sein Profil und lernt.

Im Heimnetz läuft WordQuest ohne HTTPS. Deshalb lässt es sich nicht als App auf das Tablet legen; im Browser funktioniert es vollständig.

## Sicherung

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

## Hilfe bei Problemen

**Die Images lassen sich nicht laden.** `setup.sh` bricht dann ab mit:

> Images konnten nicht geladen werden. Stimmt WQ_IMAGE_PREFIX in .env, und sind die Pakete öffentlich?

Prüfe die Internetverbindung des Geräts. Hast du beim Präfix etwas anderes als Enter eingegeben, korrigiere den Wert bei `WQ_IMAGE_PREFIX` in der Datei `.env` (Standard `ghcr.io/mrhdready/wordquest`). Starte danach `./setup.sh` noch einmal.

**Der Port ist belegt.** Bricht `setup.sh` beim Start mit einer Meldung ab, in der `port is already allocated` steht, nutzt ein anderes Programm den Port 8080. Läuft noch der frühere Schnelltest, beende ihn zuerst (siehe „Früherer Schnelltest“ unten). Sonst trag in `.env` eine Zeile wie `WQ_PORT=9000` ein und starte `./setup.sh` noch einmal. WordQuest läuft dann unter dem neuen Port.

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

Der Befehl erzeugt ein neues Passwort und zeigt es **genau einmal** an; es wird nirgends im Klartext gespeichert. Melde dich damit an und ändere das Passwort danach unter „Konto“. Gibt es kein Elternkonto mit dieser Adresse, meldet er das und ändert nichts. Angemeldete Geräte können ihre Sitzung danach nicht mehr verlängern; wer schon angemeldet ist, bleibt höchstens bis zum Ablauf des aktuellen Zugangs angemeldet (Standard 15 Minuten).

**Die API startet nicht.** `setup.sh` meldet dann:

> Die API ist nach zwei Minuten nicht bereit. Sieh mit `docker compose logs api` nach, was fehlt.

Sieh nach, was die API meldet:

```bash
docker compose logs api
```

Eine Zeile, die mit „Start abgebrochen:“ beginnt, nennt den Grund und den Ausweg, zum Beispiel:

> Start abgebrochen: WQ_JWT_SIGNING_KEY fehlt oder ist ein bekannter Standardwert. Führe `setup.sh` aus oder trage einen eigenen Wert ein.

Fehlt eine Datei in `secrets/`, erzeugt `./setup.sh` sie neu; eine vorhandene Datei lässt es unverändert.

**Früherer Schnelltest.** Hast du WordQuest früher mit der alten Schnelltest-Datei ausprobiert, setzt du es mit dieser Seite neu auf; den alten Test beendest du mit `docker compose -p wordquest-quick down`, seine Daten bleiben in ihrem Docker-Volume, bis du es selbst löschst.

Mit eigener Domain und Zertifikat (nötig, um WordQuest als App aufs Tablet zu legen) gibt es eine Variante für Fortgeschrittene, siehe [README, Variante B](../README.md#variante-b--mit-domain-und-tls-für-fortgeschrittene).
