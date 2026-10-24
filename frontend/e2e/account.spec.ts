import { expect, test, type Page } from '@playwright/test'
import { checkPage } from './axe'
import { guardianStorageState } from './global-setup'

test.use({ storageState: guardianStorageState })

// Gleiche Zugangsdaten wie globalSetup (Demo-Konto oder Install-Smoke 01-07).
const email = process.env.WQ_E2E_GUARDIAN_EMAIL ?? 'demo@wordquest.local'
const password = process.env.WQ_E2E_GUARDIAN_PASSWORD ?? 'demo1234'
const newPassword = 'neues-passwort-1'
const success = 'Dein Passwort wurde geändert. Beim nächsten Anmelden gilt das neue Passwort.'

// Rate-Limit "auth" (10 pro Minute): diese Datei nutzt hoechstens 3 Aufrufe,
// globalSetup einen.
async function changePassword(page: Page, current: string, next: string, via: 'Enter' | 'Klick') {
  await page.getByLabel('Aktuelles Passwort').fill(current)
  await page.getByLabel('Neues Passwort', { exact: true }).fill(next)
  const repeat = page.getByLabel('Neues Passwort wiederholen')
  await repeat.fill(next)
  // Auf die Antwort warten: beim Zuruecksetzen steht der Erfolgstext noch vom ersten Wechsel da.
  const button = page.getByRole('button', { name: 'Passwort ändern' })
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/v1/account/password')),
    via === 'Enter' ? repeat.press('Enter') : button.click(),
  ])
  expect(response.status()).toBe(204)
  await expect(page.getByRole('status').filter({ hasText: success })).toBeVisible()
  await expect(repeat).toHaveValue('')
  // UI-SPEC: nach dem Klick bleibt der Fokus am Button, obwohl er beim Speichern deaktiviert war.
  if (via === 'Klick') await expect(button).toBeFocused()
}

test('Passwort ändern', async ({ page, request }) => {
  await page.goto('/verwalten/konto')
  await expect(page.getByRole('heading', { name: 'Passwort ändern' })).toBeVisible()

  await changePassword(page, password, newPassword, 'Enter')
  const login = await request.post('/api/v1/auth/login', { data: { email, password: newPassword } })
  expect(login.status(), 'Rate-Limit auth erreicht').not.toBe(429)
  expect(login.status()).toBe(200)

  // Zuruecksetzen ueber dasselbe Formular: der Stack bleibt fuer andere Specs gueltig.
  await changePassword(page, newPassword, password, 'Klick')
})

// Kein Aufruf des Rate-Limits "auth": leeres Absenden bleibt im Client.
test('Konto barrierefrei', async ({ page }) => {
  await page.goto('/verwalten/konto')
  await expect(page.getByRole('heading', { name: 'Passwort ändern' })).toBeVisible()
  await checkPage(page)

  // Leeres Absenden: alle drei Feldfehler, je per aria-describedby am Feld.
  await page.getByRole('button', { name: 'Passwort ändern' }).click()
  const expected = [
    ['Aktuelles Passwort', 'Bitte gib dein aktuelles Passwort ein.'],
    ['Neues Passwort', 'Bitte gib ein neues Passwort ein.'],
    ['Neues Passwort wiederholen', 'Bitte wiederhole das neue Passwort.'],
  ] as const
  for (const [label, message] of expected) {
    const field = page.getByLabel(label, { exact: true })
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toHaveAccessibleDescription(new RegExp(message.replace('.', '\\.')))
  }
  await expect(page.getByLabel('Aktuelles Passwort')).toBeFocused()
  await checkPage(page)

  // Tab-Reihenfolge in <main> bei 320 px, kein Ziel unter der Tab-Leiste (WCAG 2.4.11).
  await page.setViewportSize({ width: 320, height: 568 })
  // Start im Kopf: Tab fuehrt von "Abmelden" in den Inhalt.
  await page.getByRole('button', { name: 'Abmelden' }).focus()
  const steps: { name: string; bottom: number; barTop: number }[] = []
  for (let index = 0; index < 20 && steps.length < 4; index += 1) {
    await page.keyboard.press('Tab')
    const step = await page.evaluate(() => {
      const element = document.activeElement
      if (!element?.closest('main')) return null
      const bar = document.querySelector('nav[aria-label="Bereiche"]')?.parentElement
      const label = element.id ? document.querySelector(`label[for="${element.id}"]`) : null
      return {
        name: (label?.textContent ?? element.textContent ?? '').trim(),
        bottom: element.getBoundingClientRect().bottom,
        barTop: bar?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
      }
    })
    if (step) steps.push(step)
  }
  expect(steps.map((step) => step.name)).toEqual([
    'Aktuelles Passwort',
    'Neues Passwort',
    'Neues Passwort wiederholen',
    'Passwort ändern',
  ])
  for (const step of steps) {
    expect(step.bottom, `"${step.name}" unter der Tab-Leiste`).toBeLessThanOrEqual(step.barTop)
  }
})
