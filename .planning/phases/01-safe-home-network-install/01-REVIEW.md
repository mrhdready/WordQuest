---
phase: 01-safe-home-network-install
reviewed: 2026-10-16T21:06:30Z
depth: deep
diff_base: 0b49bf2
files_reviewed: 70
files_reviewed_list:
  - .env.example
  - backend/WordQuest.slnx
  - backend/src/WordQuest.Api/AccountCommands.cs
  - backend/src/WordQuest.Api/Auth/AuthService.cs
  - backend/src/WordQuest.Api/Contracts/Contracts.cs
  - backend/src/WordQuest.Api/Endpoints/AccountEndpoints.cs
  - backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs
  - backend/src/WordQuest.Api/Program.cs
  - backend/src/WordQuest.Api/SecretCheck.cs
  - backend/src/WordQuest.Api/appsettings.json
  - backend/src/WordQuest.Infrastructure/AccountService.cs
  - backend/src/WordQuest.Infrastructure/OwnerCreation.cs
  - backend/src/WordQuest.Infrastructure/PasswordChange.cs
  - backend/src/WordQuest.Modules.Identity/Entities/LearnerProfile.cs
  - backend/src/WordQuest.Modules.Identity/Services/AccountRules.cs
  - backend/src/WordQuest.Modules.Identity/Services/LearnerProfileProblem.cs
  - backend/tests/WordQuest.Api.Tests/AccountCommandTests.cs
  - backend/tests/WordQuest.Api.Tests/AccountEndpointTests.cs
  - backend/tests/WordQuest.Api.Tests/AccountRulesTests.cs
  - backend/tests/WordQuest.Api.Tests/ApiFactory.cs
  - backend/tests/WordQuest.Api.Tests/LearnerEndpointTests.cs
  - backend/tests/WordQuest.Api.Tests/RateLimitTests.cs
  - backend/tests/WordQuest.Api.Tests/ResetPasswordCommandTests.cs
  - backend/tests/WordQuest.Api.Tests/SecretCheckTests.cs
  - backend/tests/WordQuest.Api.Tests/WordQuest.Api.Tests.csproj
  - docker-compose.quick.yml
  - docker-compose.yml
  - frontend/e2e/account.spec.ts
  - frontend/e2e/axe.ts
  - frontend/e2e/children.spec.ts
  - frontend/e2e/docker-compose.e2e.yml
  - frontend/e2e/first-run.spec.ts
  - frontend/e2e/global-setup.ts
  - frontend/e2e/learn.spec.ts
  - frontend/e2e/login.spec.ts
  - frontend/e2e/manage.spec.ts
  - frontend/src/App.tsx
  - frontend/src/components/ui/button.tsx
  - frontend/src/components/ui/card.tsx
  - frontend/src/components/ui/field.test.tsx
  - frontend/src/components/ui/field.tsx
  - frontend/src/components/ui/input.tsx
  - frontend/src/components/ui/list.tsx
  - frontend/src/components/ui/misc.test.tsx
  - frontend/src/components/ui/misc.tsx
  - frontend/src/design-tokens.css
  - frontend/src/features/auth/GuardianLoginPage.tsx
  - frontend/src/features/auth/ProfilePickerPage.tsx
  - frontend/src/features/learn/LearnHomePage.tsx
  - frontend/src/features/learn/SessionPage.tsx
  - frontend/src/features/manage/AccountPage.test.tsx
  - frontend/src/features/manage/AccountPage.tsx
  - frontend/src/features/manage/ChildFormPage.test.tsx
  - frontend/src/features/manage/ChildFormPage.tsx
  - frontend/src/features/manage/ChildrenPage.test.tsx
  - frontend/src/features/manage/ChildrenPage.tsx
  - frontend/src/features/manage/ManageLayout.tsx
  - frontend/src/features/manage/ProgressPage.tsx
  - frontend/src/features/manage/SetDetailPage.test.tsx
  - frontend/src/features/manage/SetDetailPage.tsx
  - frontend/src/features/manage/SetsPage.test.tsx
  - frontend/src/features/manage/SetsPage.tsx
  - frontend/src/index.css
  - frontend/src/lib/api.test.ts
  - frontend/src/lib/api.ts
  - frontend/src/test/render.test.tsx
  - frontend/src/test/render.tsx
  - frontend/src/test/setup.ts
  - frontend/src/types.ts
  - setup.sh
findings:
  critical: 0
  high: 1
  medium: 1
  low: 3
  info: 7
  total: 12
status: issues_found
---

# Phase 01: Code Review Report (phasenweit)

**Reviewed:** 2026-10-16T21:06:30Z
**Depth:** deep (planübergreifend, Aufrufketten Backend ↔ Frontend ↔ setup.sh)
**Files Reviewed:** 70
**Status:** issues_found

## Summary

Geprüft wurde `git diff 0b49bf2..HEAD` über Backend, Frontend (`src`, `e2e`), `setup.sh`, Compose-Dateien und `.env.example`. Befunde, die in den „## Review“-Abschnitten von 01-01 bis 01-08 als behoben oder bewusst akzeptiert stehen, sind nicht erneut aufgeführt (u. a. M4 „Prüfen-dann-Einfügen“, „Andere Sitzungen bleiben bei Passwortänderung bestehen“, geteilter Rate-Limit-Topf bis FIX-01, `refreshAccessToken` bei 429).

Die Einzelreviews haben die Pläne gut abgedeckt. Die Lücken liegen an den Nahtstellen zwischen den Plänen. Am schwersten wiegt Folgendes: Die Demo-Daten-Sperre aus 01-02 (T-01-05) prüft nur den Schalter in `.env`, nicht die Datenbank. Bei einer Bestandsinstallation bleibt das Demo-Elternkonto mit öffentlich bekanntem Passwort aktiv, und `setup.sh` meldet trotzdem „Elternkonto ist schon angelegt“. Dazu kommt: Eine neue Kinder-PIN beendet laufende Sitzungen des Kindes nicht.

Severity-Zuordnung: high = BLOCKER, medium/low = WARNING, info = INFO.

## High

### CR-01: Demo-Elternkonto mit bekanntem Passwort überlebt `setup.sh` (T-01-05 umgehbar)

**Klassifikation:** BLOCKER · **Konfidenz:** hoch (Ablauf im Code nachvollzogen, nicht ausgeführt)
**Files:** `setup.sh:75-78`, `setup.sh:109-111`, `backend/src/WordQuest.Infrastructure/AccountService.cs:22-23`, `backend/src/WordQuest.Infrastructure/Seed/DemoDataSeeder.cs:19-21`

**Mechanismus:** Bis `0b49bf2` stand in `.env.example` `WQ_SEED_DEMO_DATA=true` mit dem Hinweis „Nach der Ersteinrichtung auf false setzen“. In `docker-compose.yml` war `${WQ_SEED_DEMO_DATA:-true}` der Standard. Jede Bestandsinstallation hat deshalb `demo@wordquest.local` / `demo1234` (Rolle Owner) und ein Kind mit PIN `1234` in der Datenbank. Das neue `setup.sh` prüft nur den Wert in `.env` (Z. 76). `has-owner` (`AccountService.HasOwnerAsync`) zählt jedes Konto mit Rolle `Owner`, also auch das Demo-Konto.

**Fehlerszenario:**
1. Bestandsinstallation (Traefik-Variante mit `secrets/`, startet mit den neuen Images). Der Betreiber hat wie angewiesen `WQ_SEED_DEMO_DATA=false` gesetzt, oder `setup.sh` bricht nach M1 ab und er setzt den Wert jetzt auf `false`.
2. `./setup.sh` läuft: `.env` bleibt unverändert, die Demo-Prüfung ist bestanden, `has-owner` meldet 0, Ausgabe: „✓ Elternkonto ist schon angelegt — unverändert.“ und „Melde dich dort mit deinem Elternkonto an.“
3. `demo@wordquest.local` / `demo1234` bleibt als Owner gültig, auch über die Domain der Traefik-Variante. Damit hat jeder Zugriff auf alle Familiendaten, der die öffentlich dokumentierten Zugangsdaten kennt (altes `setup.sh` und README haben sie ausgegeben).

Die Abbruchmeldung aus M1 („Setze den Wert in .env auf false und starte setup.sh erneut“) führt genau in diesen Zustand. Das Abschalten des Seeds entfernt keine schon angelegten Daten.

**Fix (minimal):** Ein Startcheck außerhalb von Development, analog `SecretCheck`. Gibt es ein Konto mit `DemoDataSeeder.DemoEmail`, dessen Hash `DemoPassword` verifiziert, bricht die API mit lesbarer Meldung ab und nennt `reset-password demo@wordquest.local`. Alternative: `has-owner` liefert dafür einen eigenen Exit-Code (z. B. 11), und `setup.sh` bricht mit dieser Anweisung ab:

```csharp
// Program.cs, nach MigrateAsync, nur !IsDevelopment()
User? demo = await db.Users.FirstOrDefaultAsync(u => u.Email == DemoDataSeeder.DemoEmail);
if (demo is not null && PasswordHasher.Verify(DemoDataSeeder.DemoPassword, demo.PasswordHash))
{
    Console.Error.WriteLine("Start abgebrochen: Das Demo-Elternkonto hat noch das bekannte Passwort. " +
        "Setze es mit `docker compose exec api dotnet WordQuest.Api.dll reset-password demo@wordquest.local` zurück.");
    Environment.ExitCode = 1; return;
}
```
Achtung: Der e2e-Stack läuft mit `Production` und Demo-Seed. Dort muss der Check über `WQ_SEED_DEMO_DATA=true` ausgenommen sein.

## Medium

### WR-01: Neue Kinder-PIN beendet bestehende Sitzungen des Kindes nicht

**Klassifikation:** WARNING · **Konfidenz:** hoch
**Files:** `backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs:132-138`, `frontend/src/features/manage/ChildFormPage.tsx:113-115`, Vergleich `backend/src/WordQuest.Infrastructure/AccountService.cs:96-103`, `backend/src/WordQuest.Api/Auth/AuthService.cs:154-167`

**Mechanismus:** `PATCH /learners/{id}/settings` setzt `PinHash` neu und hebt die Sperre auf. Die Refresh-Tokens des Kindes bleiben unangetastet. `IssueAsync` vergibt auch an Kinder rotierende Refresh-Tokens mit 30 Tagen Laufzeit. `ResetPasswordAsync` widerruft im selben Fall (Zugangsdaten ersetzt) alle Tokens. Die PIN-Änderung tut das nicht.

**Fehlerszenario:** Ein Geschwisterkind kennt die PIN von Kind A und ist auf seinem eigenen Tablet als A angemeldet. Genau davor soll die PIN schützen (`LearnerProfile.cs`: „Schuetzt gegen Geschwister“). Ein Elternteil vergibt eine neue PIN, die UI meldet „Die neue PIN gilt ab sofort.“ Das Tablet bleibt trotzdem als A angemeldet. Weil jeder Refresh das Token rotiert, gilt das bei regelmäßiger Nutzung ohne Ende, und das Geschwisterkind kann weiter A’s Lernstand verändern.

**Fix:** Im PIN-Zweig dieselbe Schleife wie in `ResetPasswordAsync`. Besser ist eine gemeinsame Methode in einem Service, dann bleibt der Endpoint schlank (AGENTS.md):
```csharp
if (!string.IsNullOrEmpty(request.Pin))
{
    profile.PinHash = PasswordHasher.Hash(request.Pin);
    profile.FailedPinAttempts = 0;
    profile.PinLockedUntil = null;
    await db.RefreshTokens.Where(t => t.UserId == profile.Id && t.RevokedAt == null)
        .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, clock.GetUtcNow()), ct);
}
```
Dazu ein Integrationstest: Kind meldet sich an, Eltern setzen eine neue PIN, `POST /auth/refresh` mit dem alten Token ergibt 401.

## Low

### WR-02: Kind ohne PIN lässt sich speichern, kann sich aber nie anmelden, und jeder Versuch zählt als Fehlversuch

**Klassifikation:** WARNING · **Konfidenz:** hoch (Wirkung nur bei Kindern, die vor dieser Phase direkt per API ohne PIN angelegt wurden)
**Files:** `frontend/src/features/manage/ChildFormPage.tsx:34-36`, `:125`, `:150-154`, `backend/src/WordQuest.Api/Endpoints/LearnerEndpoints.cs:105-106`, `backend/src/WordQuest.Api/Auth/AuthService.cs:79-86`, `backend/src/WordQuest.Modules.Identity/Services/PasswordHasher.cs:33-35`

**Mechanismus:** Beim Bearbeiten ist die PIN immer optional (`editing` → kein `PinMissing`, Server mit `pinRequired: false`), auch wenn `learner.hasPin === false`. Das Formular zeigt dann den Hinweis „Für dieses Kind ist noch keine PIN gesetzt.“, verlangt aber keine PIN. `PasswordHasher.Verify(pin, null)` liefert `false`. `LearnerLoginAsync` zählt das als Fehlversuch und sperrt nach 10 Versuchen für 15 Minuten.

**Fehlerszenario:** Die Eltern ändern bei so einem Kind nur den Namen und speichern („Die Änderungen sind gespeichert.“). Das Kind tippt auf der Profilwahl jede beliebige PIN und bekommt immer „Die PIN stimmt nicht.“, nach 10 Versuchen „Zu viele Versuche…“. Laut 01-04-PLAN (PAR-02) sollen die Eltern solche Kinder in 01-08 über eine neue PIN reparieren. Das Formular lenkt sie aber nicht dorthin.

**Fix:** Im Frontend `validate(name, limit, pin, learner?.hasPin === true)`, also beim Bearbeiten nur dann optional, wenn eine PIN existiert. Im Backend in `UpdateSettingsAsync` `pinRequired: profile.PinHash is null`. Optional zusätzlich: Hat das Profil keinen `PinHash`, antwortet `LearnerLoginAsync` mit eigener Meldung und ohne Fehlversuch-Zähler.

### WR-03: Ladefehler erscheint als „gibt es nicht“ (Fortschritt, Lern-Startseite)

**Klassifikation:** WARNING · **Konfidenz:** hoch
**Files:** `frontend/src/features/manage/ProgressPage.tsx:48-55`, `frontend/src/features/learn/LearnHomePage.tsx:78-82`, `:90`, `:120`. Gegenstück, in 01-08 behoben: `frontend/src/features/manage/ChildFormPage.tsx:64-66`, `ChildrenPage.tsx:27`

**Mechanismus:** 01-08 hat die Regel „Ladefehler ist nicht ‚gibt es nicht‘“ für die Kinderseiten umgesetzt. Die übrigen Leser derselben Abfragen werten `isError` nicht aus. `ProgressPage` liest `['learners']` und zeigt bei einem Fehler „Noch kein Kinderprofil“. `LearnHomePage` zeigt bei einem Fehler von `/sets` „Noch keine Vokabeln da – Ein Elternteil kann im Verwaltungsbereich ein Set anlegen.“ und sperrt „Los geht’s“ ohne Hinweis. Scheitert `overview`, steht dort „0 Karten fällig“.

**Fehlerszenario:** API kurz nicht erreichbar oder 5xx (`retry: 1`). Elternteil oder Kind sehen einen leeren Zustand mit falscher Handlungsanweisung („Set anlegen“, obwohl Sets existieren) statt der Meldung „Der Server ist gerade nicht erreichbar…“ aus `api.ts`.

**Fix:** Dasselbe Muster wie in `ChildFormPage`: `if (learners.isError && !learners.data) return <ErrorNote message={learners.error.message} />` vor dem Leerzustand. In `LearnHomePage` analog für `sets` und `overview`.

### WR-04: Leere 4xx-Antworten erscheinen als englischer Titel („Not Found“, „Forbidden“)

**Klassifikation:** WARNING · **Konfidenz:** mittel (Framework-Verhalten von `AddProblemDetails` + `UseStatusCodePages`, nicht im laufenden Stack gemessen). Bestätigt und konkretisiert den offenen Punkt „api.ts:162“ aus 01-03.
**Files:** `frontend/src/lib/api.ts:166`, `backend/src/WordQuest.Api/Program.cs` (`AddProblemDetails()`, `UseStatusCodePages()`), Quellen: `backend/src/WordQuest.Api/Endpoints/AccountEndpoints.cs:46`, `LearnerEndpoints.cs:101`, `:172`

**Mechanismus:** `Results.NotFound()` und `Results.Forbid()` schreiben keinen Körper. `UseStatusCodePages` ergänzt mit dem registrierten `IProblemDetailsService` ein ProblemDetails mit Standardtitel („Not Found“ bzw. „Forbidden“) ohne `detail`/`errors`. `readError` fällt dann auf `problem.title` zurück.

**Fehlerszenario:** Die in 01-06 und 01-08 neuen Pfade `POST /account/password` → 404 (Konto gelöscht, `UnknownUser`) bzw. `PATCH /learners/{id}/settings` → 404 zeigen im `ErrorNote` „Not Found“. Das widerspricht AGENTS.md („Meldungen an Nutzer auf Deutsch, in ganzen Sätzen“).

**Fix:** In `readError` den `title` nicht anzeigen: `return new ApiError(GENERIC, response.status)` statt `problem.title ?? GENERIC`. Alternativ deutsche `detail`-Texte an den Endpoints (`Results.Problem(detail: "…", statusCode: 404)`). Test in `api.test.ts`: 404 mit `{ title: 'Not Found', status: 404 }` → `GENERIC`.

## Info

### IN-01: Grenzwerte in Endpoint-Texten hartkodiert statt aus `AccountRules`

**Files:** `backend/src/WordQuest.Api/Endpoints/AccountEndpoints.cs:44`, `LearnerEndpoints.cs:154`, `:157`
`AccountCommands.cs:77` nutzt `AccountRules.MinPasswordLength`, die Endpoints schreiben „8“, „100“, „50“ als Literal. Ändert sich eine Regel, laufen Text und Regel auseinander. Fix: `$"… mindestens {AccountRules.MinPasswordLength} Zeichen …"` bzw. `MaxDisplayNameLength`/`MaxAvatarKeyLength`.

### IN-02: `AccountEndpoints` verschluckt unbekannte Ergebnisse als 404

**File:** `backend/src/WordQuest.Api/Endpoints/AccountEndpoints.cs:46`
`_ => Results.NotFound()` deckt `UnknownUser` und jeden künftigen `PasswordChange`-Wert ab. `LearnerEndpoints.cs:158` nutzt bewusst `UnreachableException` (Review 01-07). Fix: `PasswordChange.UnknownUser => Results.NotFound()`, Rest `throw new UnreachableException(...)`.

### IN-03: Abschluss-URL falsch bei `.env` ohne `COMPOSE_FILE`

**File:** `setup.sh:155-163`
Eine Bestands-`.env` (Vorlage vor dieser Phase) hat kein `COMPOSE_FILE`. `docker compose` nimmt dann `docker-compose.yml` (Traefik), `setup.sh` gibt aber `http://<host>:8080` aus. Fix: Ist `compose_file` leer, wie `docker-compose.yml*` behandeln (das ist der Compose-Standard) oder warnen.

### IN-04: Erfolgsmeldung „Kind angelegt“ erscheint nach Neuladen/Zurück erneut

**File:** `frontend/src/features/manage/ChildrenPage.tsx:12-13`
Der Kommentar „ueberlebt kein Neuladen“ stimmt nicht. React Router legt `state` in `history.state` ab, nach F5 oder Browser-Zurück steht die Meldung wieder da. Fix: Nach dem ersten Rendern `navigate('.', { replace: true, state: null })` oder den Kommentar korrigieren.

### IN-05: Profilwahl-Cache wird nach Anlegen/Umbenennen nicht invalidiert

**Files:** `frontend/src/features/manage/ChildFormPage.tsx:103`, `:116`, `frontend/src/features/auth/ProfilePickerPage.tsx:47-51`, `frontend/src/App.tsx:22`
Nur `['learners']` wird invalidiert, `['profiles']` nicht (`staleTime` 30 s). Wird auf demselben Gerät kurz nach dem Anlegen abgemeldet, zeigt die Profilwahl den alten Stand („Hier ist noch kein Kinderprofil angelegt.“ bzw. alten Namen). Fix: zusätzlich `invalidateQueries({ queryKey: ['profiles'] })`.

### IN-06: Veralteter Kommentar zum Rate-Limit im e2e-Setup

**File:** `frontend/e2e/global-setup.ts:3`
„Rate-Limit ‚auth‘ erlaubt 10 pro Minute“. Der Teststack setzt seit 01-08 `Auth__RequestsPerMinute: "1000"` (`e2e/docker-compose.e2e.yml:43`). Für den Smoke-Stack stimmt der Satz. Fix: Kommentar auf „10 im Smoke-Stack, 1000 im e2e-Stack“ anpassen.

### IN-07: Doppelte Längenprüfung des JWT-Schlüssels

**File:** `backend/src/WordQuest.Api/Program.cs:39-45`
Außerhalb von Development prüft `SecretCheck.SigningKeyProblem` die Länge schon vorher mit lesbarer Meldung. Der `throw` greift nur noch in Development. Kein Fehler, aber zwei Stellen für eine Regel. Fix: Kommentar „nur Development“ oder Konstante teilen.

## Geprüft, ohne Befund

- Mandantentrennung neuer Pfade: `ChangePasswordAsync` liest über den gefilterten Kontext mit Id aus dem Token. CLI-Verben nutzen bewusst `SystemTenantContext`, nie im Request-Pfad.
- `reset-password`: 16 Zeichen aus `RandomNumberGenerator`, Passwort und Token-Widerruf in einem `SaveChanges`, keine E-Mail im Log.
- `setup.sh`: Passwort nur per stdin, `IFS=` beim `read`, `pipefail` liefert den Exit-Code von `create-owner`, Secrets erzeugen mit Längenprüfung.
- `SessionPage.close()`/`finish()`: Doppelabschluss durch `finishing`-Phase und gesperrtes „Schließen“ verhindert.
- Testisolation Api.Tests: Klassen mit eigener Factory und `LearnerEndpointTests` mit `IClassFixture` mischen sich nicht. Parallelisierung ist aus.

---

_Reviewed: 2026-10-16T21:06:30Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
