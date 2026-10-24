import { expect, test } from '@playwright/test'
import type { SessionView } from '@/types'
import { guardianStorageState } from './global-setup'
import { canvasPicture } from './pictures'

// Nur im seedfreien Install-Smoke (setup-smoke.sh setzt WQ_E2E_FIRST_RUN und die
// Zugangsdaten des dort angelegten Elternkontos). Gegen den Demo-Stack laeuft sie nie:
// dort gibt es schon ein Kind.
test.skip(!process.env.WQ_E2E_FIRST_RUN, 'nur im seedfreien Install-Smoke')
test.use({ storageState: guardianStorageState })

// Rate-Limit "auth" (10 pro Minute, eigener Limiter des Smoke-Stacks): der Smoke
// nutzt vorher 4 Logins, dazu globalSetup, Profilwahl und learner-login, also 7.
test('Erste Installation bis zur Zusammenfassung der ersten Runde', async ({ page, browser, baseURL }) => {
  const childName = 'Erstes Kind'
  const pin = '2468'

  // Frische Installation: kein Demo-Kind.
  await page.goto('/verwalten/kinder')
  await expect(page.getByText('Noch kein Kinderprofil')).toBeVisible()

  await page.getByRole('link', { name: 'Kind anlegen' }).click()
  await page.getByLabel('Name', { exact: true }).fill(childName)
  await page.getByLabel('PIN', { exact: true }).fill(pin)
  await page.getByRole('button', { name: 'Kind anlegen' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Das Kind ist angelegt. Es kann sich jetzt mit seiner PIN anmelden.' }),
  ).toBeVisible()

  // Eigenes Set mit einem Eintrag.
  await page.getByRole('link', { name: 'Vokabeln', exact: true }).click()
  await expect(page.getByText('Noch keine Vokabelsets')).toBeVisible()
  await page.getByRole('link', { name: 'Neues Set' }).click()
  await page.getByLabel('Titel').fill('Erstes Set')
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByRole('link', { name: /Erstes Set/ }).click()
  await expect(page.getByRole('link', { name: 'Alle Sets' })).toBeVisible()
  await page.getByLabel('Deutsch', { exact: true }).fill('Hund')
  await page.getByLabel('Englisch', { exact: true }).fill('dog')
  await page.getByLabel('Englisch', { exact: true }).press('Enter')
  await expect(page.getByRole('main').getByText('Hund → dog', { exact: true })).toBeVisible()

  // Eigenes Bild im Dialog: der ganze Weg ueber nginx im Production-Build. Sicherung,
  // Wiederherstellung und Update im Release-Smoke pruefen genau dieses Bild (D-14).
  await page.getByRole('button', { name: 'Hund bearbeiten' }).click()
  const dialog = page.getByRole('dialog', { name: 'Vokabel bearbeiten' })
  const png = await canvasPicture(page, { type: 'image/png', width: 64, height: 48 })
  // Im Dialog suchen: Die Seite hat ein zweites Datei-Feld fuer den CSV-Import.
  await dialog.locator('input[type="file"]').setInputFiles({ name: 'hund.png', mimeType: 'image/png', buffer: png })
  await expect(dialog.getByRole('status')).toHaveText('Das Bild ist gespeichert.')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  const thumbnail = page.getByRole('button', { name: 'Hund bearbeiten' }).locator('..').getByTestId('vokabelbild').locator('img')
  await expect(thumbnail).toBeVisible()
  await expect.poll(() => thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)

  // Neuer Kontext ohne Eltern-Sitzung: genau eine Kachel, Anmeldung per Tastatur.
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
  const child = await context.newPage()
  const [profiles] = await Promise.all([
    child.waitForResponse((response) => response.url().endsWith('/api/v1/auth/profiles')),
    child.goto('/'),
  ])
  expect(profiles.status(), 'Rate-Limit auth erreicht').toBe(200)
  await expect(child.getByRole('main').getByRole('button')).toHaveCount(1)
  await child.getByRole('button', { name: childName }).click()
  for (const digit of pin.slice(0, -1)) await child.keyboard.press(digit)
  // Die vierte Ziffer sendet ab (PAR-02).
  const [login] = await Promise.all([
    child.waitForResponse((response) => response.url().endsWith('/api/v1/auth/learner-login')),
    child.keyboard.press(pin.slice(-1)),
  ])
  expect(login.status(), 'Rate-Limit auth erreicht').toBe(200)
  await expect(child.getByRole('heading', { name: 'Was möchtest du üben?' })).toBeVisible()

  // Ganze Runde: jede Aufgabe aus der Start-Antwort richtig beantworten, je nach
  // Richtung aus dem Eintrag. Ohne Fehler kommt keine Wiederholung dazu, die
  // Runde endet nach der letzten Aufgabe mit der Zusammenfassung (Muster learn.spec.ts).
  const [started] = await Promise.all([
    child.waitForResponse((response) => response.url().endsWith('/api/v1/sessions')),
    child.getByRole('button', { name: 'Los geht’s' }).click(),
  ])
  const items = ((await started.json()) as SessionView).items
  expect(items.length, 'Runde ohne Frage').toBeGreaterThan(0)
  for (const [index, item] of items.entries()) {
    if (index > 0) await child.getByRole('button', { name: 'Weiter' }).click()
    await expect(child.getByRole('textbox')).toHaveValue('')
    // Jede Karte zeigt das Bild statt des Emojis, dekorativ ohne Alt-Text.
    const picture = child.getByTestId('vokabelbild').locator('img')
    await expect(picture).toHaveAttribute('alt', '')
    await expect.poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
    await child.getByRole('textbox').fill(item.prompt === 'Hund' ? 'dog' : 'Hund')
    const [answered] = await Promise.all([
      child.waitForResponse((response) => /\/api\/v1\/sessions\/[^/]+\/answers$/.test(response.url())),
      child.getByRole('textbox').press('Enter'),
    ])
    expect(answered.status()).toBe(200)
    await expect(child.getByText('Richtig!', { exact: true })).toBeVisible()
  }
  await child.getByRole('button', { name: 'Weiter' }).click()
  await expect(child.getByRole('heading', { name: /Geschafft!|erreicht!/ })).toBeVisible()
  await context.close()
})
