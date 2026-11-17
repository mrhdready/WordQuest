# WordQuest im Heimnetz installieren

Diese Seite führt dich Schritt für Schritt von einem leeren Gerät bis zur ersten Anmeldung mit deinem Elternkonto. Du brauchst dafür kein Vorwissen über Server oder Docker. Jeder Schritt nennt den Befehl und das, was danach zu sehen ist. Teile in spitzen Klammern wie `<Adresse>` sehen bei dir anders aus.

## Voraussetzungen

Zielgerät ist ein **Raspberry Pi 5 mit Raspberry Pi OS (64-bit)**. Ein NAS mit Docker geht ebenso, wenn du dort eine Kommandozeile hast; WordQuest gibt es für ARM (arm64) und für Intel/AMD (x86-64).

Auf dem Gerät brauchst du:

1. **Docker mit Compose.** Für Raspberry Pi OS (64-bit) installierst du Docker nach der offiziellen [Anleitung für Debian](https://docs.docker.com/engine/install/debian/); die [Seite für Raspberry Pi OS](https://docs.docker.com/engine/install/raspberry-pi-os/) verweist für 64-bit selbst dorthin.
2. **Deinen Benutzer in der Gruppe `docker`**, damit die Befehle ohne `sudo` laufen ([Docker-Anleitung](https://docs.docker.com/engine/install/linux-postinstall/)). Melde dich danach einmal ab und wieder an, erst dann wirkt die Gruppe. Die Gruppe `docker` gibt Rechte wie root; nimm deshalb nur deinen eigenen Benutzer auf.

   ```bash
   sudo usermod -aG docker $USER
   ```

3. **curl**, um WordQuest herunterzuladen. Meist ist es schon da; fehlt es, installierst du es so:

   ```bash
   sudo apt install curl
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

Lade die neueste Version von WordQuest herunter und wechsle in den Ordner `wordquest`, der dabei entsteht:

```bash
curl -fsSL https://github.com/mrhdready/WordQuest/releases/latest/download/wordquest.tar.gz | tar xz
cd wordquest
```

Der Download gibt nichts aus, das ist normal. Danach gibt es den Ordner `wordquest`, und du bist schon darin.

Starte die Einrichtung:

```bash
./setup.sh
```

`setup.sh` fragt genau drei Dinge. Zuerst:

1. das **Image-Präfix**. Drück einfach Enter, dann nimmt es den vorgeschlagenen Wert `ghcr.io/mrhdready/wordquest`. Einen anderen Wert brauchst du nur, wenn du eigene Images baust.

Danach lädt es WordQuest in der Version 1.1.0, prüft die Ports (siehe unten), startet WordQuest und legt das Zertifikat für die sichere Verbindung (HTTPS) an; beim ersten Mal kann das ein paar Minuten dauern. Erst dann fragt es nach:

2. der **E-Mail-Adresse** für dein Elternkonto,
3. dem **Passwort** dafür, zweimal, mindestens 8 Zeichen. Die Eingabe bleibt unsichtbar.

Dann legt es dein Elternkonto an. Am Ende siehst du unter anderem diese Zeilen:

```text
✓ .env angelegt.
✓ API ist bereit.
✓ Zertifikat ist bereit.
✓ WordQuest antwortet über HTTPS.
✓ Elternkonto angelegt.
Fertig. WordQuest läuft unter: <Adresse> — Melde dich dort mit <deine E-Mail-Adresse> und deinem Passwort an.
Beim ersten Besuch warnt der Browser vor dem Zertifikat. Prüfe dann den Fingerabdruck, wie es die Installationsanleitung unter „Zertifikat prüfen“ beschreibt:
Fingerabdruck von WordQuest (SHA-256): <Fingerabdruck>
Fingerabdruck der Zertifizierungsstelle (SHA-256): <Fingerabdruck>
Ohne Warnung geht es, wenn du die Zertifizierungsstelle auf dem Gerät installierst: http://<Adresse>/wordquest-ca.crt
Als Nächstes: Lege unter „Kinder“ das erste Kind an, dann unter „Vokabeln“ ein Vokabelset.
Tägliche Sicherungen liegen in: <Ordner>/backups
```

Startest du `./setup.sh` nach einer fertigen Einrichtung ein zweites Mal, steht statt „✓ .env angelegt.“ die Zeile „✓ .env existiert bereits — unverändert.“ und statt „✓ Elternkonto angelegt.“ die Zeile „✓ Elternkonto ist schon angelegt — unverändert.“. Die Zeile „Fertig.“ endet dann mit „Melde dich dort mit deinem Elternkonto an.“

Öffne die Adresse aus der Zeile „Fertig.“ im Browser eines Geräts in deinem Heimnetz, zum Beispiel `https://192.168.178.20`, prüfe beim ersten Besuch den Fingerabdruck (siehe [Zertifikat prüfen](#zertifikat-prüfen)) und melde dich mit deiner E-Mail-Adresse und deinem Passwort an. `setup.sh` nimmt dafür die erste Adresse, die `hostname -I` ausgibt und die nicht zu Docker gehört. Brauchst du die Adresse später wieder, zeigt dir derselbe Befehl sie:

```bash
hostname -I
```

Der Befehl zeigt oft mehrere Einträge. Die Adresse in deinem Heimnetz beginnt meist mit `192.168.`, die anderen Einträge kannst du ignorieren. Beginnt die Adresse in der Zeile „Fertig.“ nicht mit `192.168.`, nimm die aus `hostname -I`, die damit beginnt, und hänge einen Port an, wenn die Zeile „Fertig.“ einen nennt, zum Beispiel `:8443`. Das Zertifikat gilt für die IPv4-Adressen, die `hostname -I` beim letzten Lauf von `./setup.sh` gezeigt hat, außer denen von Docker. Damit sich die Adresse später nicht ändert, richte eine feste Adresse ein, siehe [Feste Adresse im Heimnetz](#feste-adresse-im-heimnetz).

WordQuest nutzt die Ports 80 (HTTP) und 443 (HTTPS). Vor dem Start prüft `setup.sh`, ob beide frei sind. Ist einer belegt, fragt es, ob WordQuest stattdessen 8080 und 8443 nutzen darf. Mit Enter oder `j` trägt es beide Ports in die Datei `.env` ein, und die Adresse endet dann auf `:8443`, zum Beispiel `https://192.168.178.20:8443`. Läuft `setup.sh` ohne Terminal, etwa mit umgeleiteter Eingabe, fragt es nicht, sondern bricht mit einem Hinweis ab. Eigene Ports trägst du in `.env` bei `WQ_HTTP_PORT` und `WQ_HTTPS_PORT` ein (siehe „Der Port ist belegt“ unter Hilfe bei Problemen). Die Datei `.env` beginnt mit einem Punkt und ist deshalb versteckt: `ls` zeigt sie nicht, `ls -a` schon.

Ob alles läuft, zeigt dir jederzeit:

```bash
docker compose ps
```

Die Liste zeigt die fünf Dienste `api`, `backup`, `certs`, `db` und `web`. Der Dienst `certs` legt das Zertifikat an und erneuert es rechtzeitig. In der Spalte `STATUS` beginnt jeder Eintrag mit `Up`. Steht dahinter `(health: starting)`, ist das in der ersten Minute nach dem Start normal.

Im Ordner `wordquest` sind dabei entstanden:

- `secrets/` mit dem Datenbank-Passwort und dem Schlüssel für die Anmeldung, nur für dich lesbar,
- `.env` mit den Einstellungen,
- `backups/` für die täglichen Sicherungen.

Diese Dateien gehören zu deiner Installation. Lösche sie nicht. Ein zweiter Lauf von `./setup.sh` lässt Secrets und Konto unverändert. In `.env` ändert er nur die Zeile `WQ_TLS_NAMES` mit den Namen und Adressen für das Zertifikat, und das nur, wenn sich Name oder Adressen des Geräts geändert haben. Starte `./setup.sh` nicht zweimal gleichzeitig; das wird nicht unterstützt.

Nach der Anmeldung siehst du die Bereiche „Vokabeln“, „Fortschritt“, „Kinder“ und „Konto“. Als Nächstes legst du unter „Kinder“ das erste Kind mit einer PIN an und unter „Vokabeln“ ein Set. Danach wählt das Kind auf der Startseite sein Profil und lernt. Auf einem Gerät, auf dem du als Elternteil angemeldet bist, erscheint die Profilauswahl erst, nachdem du dich abgemeldet hast.

WordQuest läuft im Heimnetz über HTTPS mit einer eigenen Zertifizierungsstelle, die `setup.sh` bei der ersten Einrichtung auf deinem Gerät anlegt. Kein Browser kennt sie von Haus aus, deshalb warnt er beim ersten Besuch (siehe [Zertifikat prüfen](#zertifikat-prüfen)). Tippst du `http://` statt `https://` ein, leitet WordQuest dich automatisch auf die `https://`-Adresse weiter; nur die Datei der Zertifizierungsstelle kommt auch über `http://`. Als App auf das Tablet legen lässt sich WordQuest erst, wenn die Zertifizierungsstelle auf dem Tablet installiert ist; im Browser funktioniert es auch ohne sie vollständig. Installiere die Zertifizierungsstelle nur auf den Geräten deiner Familie: Wer ihren Schlüssel von deinem WordQuest-Gerät stiehlt, kann sich auf diesen Geräten als beliebige Webseite ausgeben. Gib die Ports von WordQuest im Router nicht ins Internet frei, WordQuest ist nur für dein Heimnetz gedacht.

### Zertifikat prüfen

Beim ersten Besuch zeigt der Browser eine Warnung, in Chrome zum Beispiel „Dies ist keine sichere Verbindung“. Sie bedeutet nur: Der Browser kennt die Zertifizierungsstelle von WordQuest noch nicht. Ob du wirklich mit deinem WordQuest verbunden bist, zeigt der Fingerabdruck. Öffne in der Warnung die Angaben zum Zertifikat und vergleiche den Fingerabdruck SHA-256 mit der Zeile „Fingerabdruck von WordQuest (SHA-256)“ aus `setup.sh`. Stimmen beide überein, kannst du weitergehen. Stimmen sie nicht überein, brich ab und gib dort kein Passwort ein.

Die Fingerabdrücke zeigt dir im Ordner `wordquest` jederzeit:

```bash
docker compose exec certs dotnet WordQuest.Api.dll tls show
```

Die Ausgabe sieht so aus:

```text
Fingerabdruck von WordQuest (SHA-256): <Fingerabdruck>
Fingerabdruck der Zertifizierungsstelle (SHA-256): <Fingerabdruck>
```

Der Fingerabdruck von WordQuest ändert sich, sobald das Zertifikat erneuert wird: etwa alle zwei Jahre und wenn sich Name oder Adresse des Geräts ändern. Der Fingerabdruck der Zertifizierungsstelle bleibt gleich. Bis die Zertifizierungsstelle auf dem Gerät installiert ist, warnt der Browser erneut: Chrome merkt sich das Weiterklicken höchstens eine Woche lang und nur für genau dieses Zertifikat; nach einer Erneuerung warnt er sofort wieder. Wie oft Safari und Firefox erneut warnen, ist noch am Gerät zu prüfen. Ohne Warnung geht es erst mit installierter Zertifizierungsstelle, siehe den nächsten Abschnitt.

Wo der Browser den Fingerabdruck in der Warnung zeigt:

- **Chrome und Edge:** (noch am Gerät zu prüfen) Die Hilfeseiten von Google nennen den Weg zu den Angaben des Zertifikats in der Warnung nicht.
- **Firefox:** (noch am Gerät zu prüfen) Die Hilfeseite von Mozilla dazu ließ sich nicht abrufen.
- **Safari auf Mac, iPhone und iPad:** (noch am Gerät zu prüfen) Die Hilfeseiten von Apple nennen den Weg nicht.

### Zertifizierungsstelle auf dem Gerät installieren

Mit installierter und vertrauter Zertifizierungsstelle warnt der Browser nicht mehr (zu Firefox siehe unten), und WordQuest lässt sich als App auf das Gerät legen. Die Datei lädst du auf dem Gerät unter `http://<Adresse>/wordquest-ca.crt` herunter; die genaue Adresse nennt `setup.sh` in der Zeile vor „Als Nächstes:“. Weil die Datei über `http://` kommt, prüfst du **vor dem Vertrauen** ihren Fingerabdruck: Er muss genau der Zeile „Fingerabdruck der Zertifizierungsstelle (SHA-256)“ aus `setup.sh` entsprechen. Doppelpunkte, Leerzeichen sowie Groß- und Kleinschreibung spielen beim Vergleich keine Rolle. Stimmt er nicht, lösche die Datei und installiere sie nicht. Installiere die Zertifizierungsstelle nur auf den Geräten deiner Familie (siehe oben, warum).

Die Schritte stammen aus den verlinkten Hilfeseiten der Hersteller. Was dort nicht steht, ist mit „(noch am Gerät zu prüfen)“ markiert.

**iPhone und iPad.** Öffne die Adresse der Datei in Safari. Danach erscheint die Meldung „Profil geladen“ (dass Safari die Datei als Profil lädt, ist noch am Gerät zu prüfen). Öffne die Einstellungen-App, tippe auf „Profil geladen“ und oben rechts auf „Installieren“, dann folge den Anweisungen auf dem Bildschirm ([Apple: Konfigurationsprofil installieren](https://support.apple.com/de-de/102400)). Installiere das Profil innerhalb von 8 Minuten, sonst löscht das Gerät es; bist du nicht an einem vertrauten Ort, verlangt das iPhone vorher, den Schutz für gestohlene Geräte auszuschalten, und danach schaltest du ihn wieder ein. Wo iPhone und iPad dabei den SHA-256-Fingerabdruck zeigen, nennt Apple nicht (noch am Gerät zu prüfen). Erst wenn er stimmt, schaltest du das Vertrauen ein; findest du den Fingerabdruck nicht, schalte das Vertrauen nicht ein, nutze WordQuest im Browser und prüfe bei der Warnung den Fingerabdruck. Das Vertrauen schaltest du so ein: „Einstellungen“ > „Allgemein“ > „Info“ > „Zertifikatsvertrauenseinstellungen“, dort unter „Volles Vertrauen für Root-Zertifikate aktivieren“ das Vertrauen für die WordQuest-Zertifizierungsstelle ([Apple: Zertifikatsprofilen vertrauen](https://support.apple.com/de-de/102390)). Ohne diesen Schritt warnt Safari weiter.

**Android.** Lade die Datei im Browser herunter. Öffne dann die Einstellungen und tippe auf „Sicherheit & Datenschutz“ > „Weitere Sicherheitseinstellungen“ > „Verschlüsselung & Anmeldedaten“ > „Ein Zertifikat installieren“. Google beschreibt dort nur das WLAN-Zertifikat; für WordQuest brauchst du die Zertifizierungsstelle, deren Eintrag in diesem Menü ist noch am Gerät zu prüfen. Für das WLAN-Zertifikat geht es laut Google so weiter: auf das Dreistrich-Menü tippen, den Ordner wählen, in dem die Datei liegt, auf die Datei tippen, einen Namen eingeben und mit „OK“ bestätigen; ob das für die Zertifizierungsstelle genauso ist, ist noch am Gerät zu prüfen. Hat das Gerät noch keine PIN, kein Muster und kein Passwort, fragt es jetzt danach. Einige Schritte gibt es erst ab Android 14 ([Google: Zertifikate hinzufügen und entfernen](https://support.google.com/pixelphone/answer/2844832?hl=de)). Wo Android den SHA-256-Fingerabdruck vor dem Installieren zeigt, nennt Google nicht (noch am Gerät zu prüfen). Findest du den Fingerabdruck vor dem Installieren nicht, installiere die Zertifizierungsstelle nicht, nutze WordQuest im Browser und prüfe bei der Warnung den Fingerabdruck.

**Windows.** Lade die Datei herunter und prüfe ihren Fingerabdruck in der Eingabeaufforderung im Download-Ordner mit `certutil -hashfile wordquest-ca.crt SHA256` ([Microsoft: certutil](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/certutil)). Weil die Datei genau das Zertifikat enthält, ist ihr SHA-256 der Fingerabdruck der Zertifizierungsstelle. Stimmt er, öffne die Datei und wähle „Install Certificate…“. Im Assistenten wählst du „Next“, dann „Place all certificates in the following store“ und dort „Trusted Root Certification Authorities“, und schließt mit „Finish“ ab; die deutschen Bezeichnungen sind noch am Gerät zu prüfen ([Microsoft: Installing the trusted root certificate](https://learn.microsoft.com/en-us/skype-sdk/sdn/articles/installing-the-trusted-root-certificate), nur auf Englisch). Chrome nutzt die Zertifikate, die das Betriebssystem verwendet ([Google: Sicherheit einer Websiteverbindung überprüfen](https://support.google.com/chrome/answer/95617?hl=de)); ob Edge sie ebenso nutzt, ist noch am Gerät zu prüfen.

**Mac.** Lade die Datei herunter, öffne die App „Schlüsselbundverwaltung“, wähle den Schlüsselbund „Anmeldung“ und bewege die Datei auf die App ([Apple: Zertifikate zu einem Schlüsselbund hinzufügen](https://support.apple.com/de-de/guide/keychain-access/kyca2431/mac)). Ein Doppelklick auf das Zertifikat zeigt seine Angaben ([Apple: Informationen zu einem Zertifikat](https://support.apple.com/de-de/guide/keychain-access/kyca15178/mac)); dass dort der SHA-256-Fingerabdruck steht, ist noch am Gerät zu prüfen. Stimmt er, klicke im selben Fenster auf das Symbol neben „Vertrauen“ und wähle im Einblendmenü, dass dem Zertifikat vertraut wird ([Apple: Vertrauenseinstellungen ändern](https://support.apple.com/de-de/guide/keychain-access/kyca11871/mac)); den genauen Namen der Einstellung bestätigen wir noch am Gerät.

**Firefox.** Firefox nutzt laut Mozilla von sich aus nicht die Zertifikate des Betriebssystems ([Mozilla: Installing Certificates Into Firefox](https://wiki.mozilla.org/CA/AddRootToFirefox), nur auf Englisch). Er kann deshalb weiter warnen, auch wenn die Zertifizierungsstelle auf dem Gerät installiert ist. Den Weg, sie in Firefox selbst zu installieren, prüfen wir noch am Gerät; bis dahin nimm auf diesem Gerät Safari, Chrome oder Edge oder prüfe bei der Warnung den Fingerabdruck.

### Feste Adresse im Heimnetz

Dein Router vergibt die Adressen im Heimnetz automatisch (DHCP). Nach einem Neustart des Routers oder des Geräts, etwa nach einem Stromausfall, kann WordQuest eine andere Adresse bekommen. Lesezeichen auf den Tablets führen dann ins Leere.

Am einfachsten richtest du die feste Adresse im Router ein. Bei einer FRITZ!Box gehst du unter „Heimnetz“ → „Netzwerk“ beim Gerät auf „Bearbeiten“, schaltest die Option „Diesem Netzwerkgerät immer die gleiche IPv4-Adresse zuweisen“ ein und übernimmst die Änderung. Andere Router nennen das „DHCP-Reservierung“, „feste IP-Adresse“ oder „statische Zuordnung“. Stell die Adresse bewusst nicht auf dem Gerät selbst fest ein: Im Router ist es einfacher, und es gibt keinen Konflikt mit den Adressen, die der Router vergibt. Starte das Gerät danach einmal neu und prüfe mit `hostname -I`, ob die Adresse noch dieselbe ist; falls nicht, setz die Lesezeichen neu. Hat das Gerät eine neue Adresse oder einen neuen Namen bekommen, starte `./setup.sh` noch einmal, damit das Zertifikat sie enthält.

Alternativ erreichst du WordQuest über den Namen des Geräts, aber nicht auf jedem Gerät garantiert. Den Gerätenamen zeigt der Befehl `hostname`. Mit einer FRITZ!Box geht `https://<Gerätename>.fritz.box`. Ein Raspberry Pi mit Raspberry Pi OS meldet sich im Heimnetz zusätzlich selbst als `https://<Gerätename>.local`. Die Adresse mit `.local` klappt auf iPhone, iPad und Mac und meist auch unter Windows, auf Android nicht immer und nicht bei aktivem VPN; dann nimm die feste Adresse. Nennt die Zeile „Fertig.“ einen Port, zum Beispiel `:8443`, hängst du ihn auch hier an. Das Zertifikat enthält die Namen nur, wenn der Gerätename aus Kleinbuchstaben, Ziffern und Bindestrichen besteht; sonst warnt `setup.sh` und WordQuest ist nur über die Adresse erreichbar.

Die Anmeldung im Browser gilt nur für die Adresse, unter der du dich angemeldet hast. Wechselst du zum Namen oder zu einer neuen Adresse, meldest du dich dort einmal neu an; Kinder wählen ihr Profil und geben ihre PIN ein.

## Update

Starte das Update, wenn gerade niemand lernt: Was während des Updates gelernt wird, steht nicht in der Sicherung. Wechsle in den Ordner `wordquest` und starte das Update:

```bash
cd wordquest
./upgrade.sh
```

`upgrade.sh` lädt das neueste WordQuest-Paket von GitHub herunter und prüft seine Prüfsumme. Bevor es etwas ändert, sichert es die Datenbank nach `backups/vor-update-<Datum>-<Uhrzeit>.sql.gz` und prüft die Sicherung. Erst danach ersetzt es seine eigenen Dateien durch die aus dem Paket, startet sich mit der neuen Fassung neu, lädt die neue Version, trägt sie in `.env` ein, startet WordQuest damit und wartet, bis es bereit ist. Deine Kinder, Vokabeln und der Lernstand bleiben dabei erhalten. Am Ende siehst du unter anderem diese Zeilen:

```text
Lade das neueste WordQuest-Paket …
✓ Prüfsumme stimmt.
Aktualisiere WordQuest von <alte Version> auf <neue Version>.
✓ Sicherung geprüft: backups/vor-update-<Datum>-<Uhrzeit>.sql.gz
Ersetze die Dateien von WordQuest …
Lade Version <neue Version> …
Starte Version <neue Version> …
Warte auf die API …
✓ API ist bereit.
Fertig. WordQuest läuft jetzt mit Version <neue Version>. Die Sicherung von vorher liegt in <Datei>.
```

Die Sicherung steht danach in der Liste von `./restore.sh` (siehe „Wiederherstellen“). Gibt es keine neue Version, legt `./upgrade.sh` eine weitere Sicherung an und lädt für alle Dienste die Images, die sich seit dem letzten Laden geändert haben; deine Daten bleiben unverändert.

Einstellungen gehören nur in `.env`, zum Beispiel `WQ_HTTPS_PORT=8444` für einen anderen HTTPS-Port. `upgrade.sh` ersetzt seine eigenen Dateien durch die aus dem Paket und lässt `.env`, `secrets/` und `backups/` unverändert; eigene Änderungen an den Compose-Dateien gehen beim Update verloren. Dateien, die eine neue Version nicht mehr braucht, bleiben im Ordner liegen und stören nicht.

Wenn etwas schiefgeht:

- **Das Paket lässt sich nicht laden oder ist nicht in Ordnung.** Dann endet `upgrade.sh`, bevor es etwas sichert oder ersetzt, mit einer dieser Meldungen: „Das WordQuest-Paket ließ sich nicht herunterladen. Prüfe die Internetverbindung und starte upgrade.sh erneut. Es wurde nichts geändert.“, „Die Prüfsumme des WordQuest-Pakets stimmt nicht. Starte upgrade.sh später erneut. Es wurde nichts geändert.“, „Das WordQuest-Paket enthält andere Dateien als erwartet. Es wurde nichts geändert.“ oder „Das WordQuest-Paket ist unvollständig oder nennt keine gültige Version. Es wurde nichts geändert.“ WordQuest läuft dann unverändert weiter; ein späterer Aufruf von `./upgrade.sh` genügt.
- **Die neue Version lässt sich nicht laden.** Dann endet `upgrade.sh` mit dieser Meldung. Die Dateien von WordQuest sind dann schon neu, aber `.env`, deine Daten und das laufende WordQuest bleiben, wie sie waren:

  ```text
  Die Version <neue Version> ließ sich nicht laden. Wenn sie gerade erst erschienen ist, versuche es in einer Viertelstunde erneut; sonst prüfe die Internetverbindung und WQ_IMAGE_PREFIX in .env. WordQuest läuft unverändert mit der bisherigen Version weiter; ein neuer Aufruf von ./upgrade.sh setzt das Update fort. Die Sicherung liegt in <Datei>.
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

Eine Installation mit 1.0.x setzt du für 1.1.0 neu auf: `upgrade.sh` aus 1.0.x lehnt das neue Paket mit „Das WordQuest-Paket enthält andere Dateien als erwartet. Es wurde nichts geändert.“ ab und ändert nichts.

## Sicherung und Wiederherstellung

Der Dienst `backup` sichert die Datenbank jeden Tag in den Ordner `backups/` und hebt 14 tägliche, 8 wöchentliche und 6 monatliche Stände auf. Die Sicherungen enthalten alle Familiendaten, deshalb ist der Ordner nur für dich lesbar.

Auch die Bilder zu den Vokabeln liegen in der Datenbank. Sie stecken deshalb in jeder Sicherung und kommen mit `./restore.sh` zurück. Jedes Bild ist höchstens 300 KB groß. Als Größenordnung: 100 Bilder mit je 50 KB machen eine Sicherung um etwa 6 MB größer.

Eine Sicherung sofort anstoßen:

```bash
docker compose exec backup /backup.sh
```

In der Ausgabe steht:

```text
SQL backup created successfully
```

Danach liegt in `backups/daily/` eine Datei `wordquest-<Datum>.sql.gz`.

Die Zertifizierungsstelle liegt nicht in den Sicherungen, sondern nur auf dem Gerät. Ziehst du WordQuest auf ein neues Gerät um, legt `./setup.sh` dort eine neue an; auf Geräten, die die alte installiert haben, ersetzt du sie durch die neue.

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

Eigene Sicherungen mit der Endung `.sql.gz` kannst du direkt in `backups/` legen, sie stehen dann mit in der Liste; dorthin gehören nur Sicherungen von WordQuest. Der Sicherungsdienst räumt nur seine Ordner `last`, `daily`, `weekly` und `monthly` auf; Dateien direkt in `backups/`, auch die `vor-wiederherstellung-…`- und `vor-update-…`-Dateien, löschst du selbst, wenn du sie nicht mehr brauchst.

Nach der Wiederherstellung müssen sich alle Geräte neu anmelden, Kinder wieder mit Profil und PIN. Wer gerade angemeldet ist, wird spätestens nach rund 15 Minuten abgemeldet. Passwörter und PINs gelten so, wie sie zur Zeit der Sicherung waren. Hast du dein Passwort nach der Sicherung geändert, weil du einen Verdacht hattest, setze es mit dem Befehl unter „Passwort vergessen“ (Hilfe bei Problemen) erneut zurück.

## Hilfe bei Problemen

**Die Images lassen sich nicht laden.** `setup.sh` bricht dann ab mit:

> Images konnten nicht geladen werden. Stimmt WQ_IMAGE_PREFIX in .env, und sind die Pakete öffentlich?

Prüfe die Internetverbindung des Geräts. Hast du beim Präfix etwas anderes als Enter eingegeben, korrigiere den Wert bei `WQ_IMAGE_PREFIX` in der Datei `.env` (Standard `ghcr.io/mrhdready/wordquest`). Starte danach `./setup.sh` noch einmal.

**Der Port ist belegt.** `setup.sh` prüft die Ports vor dem Start. Sind deine eigenen Ports in `.env` belegt oder auch 8080 und 8443, bricht es ab, zum Beispiel mit:

> Auf diesem Gerät ist schon belegt: 80 und 8080. Trage in .env bei WQ_HTTP_PORT und WQ_HTTPS_PORT freie Werte ein, zum Beispiel 8081 und 8444, und starte ./setup.sh noch einmal.

Ohne Terminal fragt es nicht nach 8080 und 8443, sondern meldet:

> Port 80 oder 443 ist auf diesem Gerät schon belegt, und ohne Terminal fragt setup.sh nicht nach. Trage in .env WQ_HTTP_PORT=8080 und WQ_HTTPS_PORT=8443 ein und starte ./setup.sh noch einmal.

Belegt etwas einen Port erst zwischen Prüfung und Start, meldet es:

> Ein Port für WordQuest ist schon belegt: 80 oder 443. Trage in .env bei WQ_HTTP_PORT und WQ_HTTPS_PORT freie Werte ein, zum Beispiel 8081 und 8444, und starte ./setup.sh noch einmal.

Läuft noch der frühere Schnelltest, beende ihn zuerst (siehe „Früherer Schnelltest“ unten). Sonst häng im Ordner `wordquest` mit `echo "WQ_HTTP_PORT=8081" >> .env` und `echo "WQ_HTTPS_PORT=8444" >> .env` die beiden Zeilen an und starte `./setup.sh` noch einmal. Stehen in `.env` schon solche Zeilen, ändere stattdessen deren Werte. WordQuest läuft dann unter dem neuen HTTPS-Port, zum Beispiel `https://192.168.178.20:8444`.

**Die Adresse geht nicht mehr.** Führe auf dem Gerät `hostname -I` aus, nimm den Eintrag, der meist mit `192.168.` beginnt, und starte `./setup.sh` noch einmal, damit das Zertifikat die neue Adresse enthält. Öffne dann `https://` mit dieser Adresse, häng einen Port an, wenn die Zeile „Fertig.“ einen nennt, und setz die Lesezeichen auf den Tablets neu. Damit das nicht wieder passiert, richte eine feste Adresse ein, siehe [Feste Adresse im Heimnetz](#feste-adresse-im-heimnetz).

**Zertifizierungsstelle neu anlegen.** Ist die Zertifizierungsstelle unvollständig, beschädigt oder läuft sie bald ab, ändert WordQuest nichts an ihr. `setup.sh`, `upgrade.sh` und `restore.sh` brechen dann ab, zum Beispiel mit:

> Die Zertifizierungsstelle ist unvollständig (es fehlt: ca/ca.crt). Es wurde nichts geändert. Wie es weitergeht, steht in der Installationsanleitung unter „Zertifizierungsstelle neu anlegen“.

Bei `restore.sh` ist die gewählte Sicherung dann schon eingespielt, bei `upgrade.sh` die neue Version schon installiert; nach dem Neuanlegen läuft WordQuest mit beidem weiter.

Statt „ist unvollständig (…)“ kann dort auch „ist beschädigt (…)“ oder „läuft am <Datum> ab.“ stehen. Dann legst du im Ordner `wordquest` eine neue Zertifizierungsstelle an:

```bash
docker compose down
docker volume rm wordquest_tls-ca wordquest_tls
./setup.sh
```

Deine Kinder, Vokabeln und der Lernstand bleiben dabei erhalten. Danach gibt es neue Fingerabdrücke; auf Geräten, die die alte Zertifizierungsstelle installiert haben, ersetzt du sie durch die neue.

**Der Browser warnt weiter.** Prüfe drei Dinge: Ist die Zertifizierungsstelle auf diesem Gerät installiert (siehe [Zertifizierungsstelle auf dem Gerät installieren](#zertifizierungsstelle-auf-dem-gerät-installieren))? Ist das Vertrauen eingeschaltet, auf iPhone und iPad unter „Zertifikatsvertrauenseinstellungen“? Und nutzt du eine Adresse, die im Zertifikat steht, also die Adresse aus der Zeile „Fertig.“ oder einen der Namen unter [Feste Adresse im Heimnetz](#feste-adresse-im-heimnetz)? Hat das Gerät eine neue Adresse, starte `./setup.sh` noch einmal. In Firefox kann die Warnung trotz installierter Zertifizierungsstelle bleiben (siehe Firefox oben).

**Nach einem Umzug warnt jedes Gerät.** Ziehst du WordQuest auf ein anderes Gerät um, legt `setup.sh` dort eine neue Zertifizierungsstelle an; die alte ist nicht in den Sicherungen. Jedes Gerät warnt dann wieder. Installiere die neue Zertifizierungsstelle auf den Geräten deiner Familie, wie oben beschrieben, und entferne die alte.

**Das Zertifikat ist nicht bereit.** `setup.sh` meldet dann:

> Das Zertifikat ist nach zwei Minuten nicht bereit. Sieh mit `docker compose logs certs` nach, was fehlt.

Sieh nach, was der Dienst `certs` meldet:

```bash
docker compose logs certs
```

Meldet `setup.sh` stattdessen „WordQuest antwortet nicht über HTTPS.“, sieh mit `docker compose logs web` nach und starte `./setup.sh` danach noch einmal.

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
