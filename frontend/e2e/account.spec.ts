import { expect, test, type Page } from '@playwright/test'
import { guardianStorageState } from './global-setup'

test.use({ storageState: guardianStorageState })

// Gleiche Zugangsdaten wie globalSetup (Demo-Konto oder Install-Smoke 01-07).
const email = process.env.WQ_E2E_GUARDIAN_EMAIL ?? 'demo@wordquest.local'
const password = process.env.WQ_E2E_GUARDIAN_PASSWORD ?? 'demo1234'
const newPassword = 'neues-passwort-1'
const success = 'Dein Passwort wurde geändert. Beim nächsten Anmelden gilt das neue Passwort.'

// Rate-Limit "auth" (10 pro Minute): diese Datei nutzt hoechstens 3 Aufrufe,
// globalSetup einen.
async function changePassword(page: Page, current: string, next: string) {
  await page.getByLabel('Aktuelles Passwort').fill(current)
  await page.getByLabel('Neues Passwort', { exact: true }).fill(next)
  const repeat = page.getByLabel('Neues Passwort wiederholen')
  await repeat.fill(next)
  // Auf die Antwort warten: beim Zuruecksetzen steht der Erfolgstext noch vom ersten Wechsel da.
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/v1/account/password')),
    repeat.press('Enter'),
  ])
  expect(response.status()).toBe(204)
  await expect(page.getByRole('status').filter({ hasText: success })).toBeVisible()
}

test('Passwort ändern', async ({ page, request }) => {
  await page.goto('/verwalten/konto')
  await expect(page.getByRole('heading', { name: 'Passwort ändern' })).toBeVisible()

  await changePassword(page, password, newPassword)
  const login = await request.post('/api/v1/auth/login', { data: { email, password: newPassword } })
  expect(login.status(), 'Rate-Limit auth erreicht').not.toBe(429)
  expect(login.status()).toBe(200)

  // Zuruecksetzen ueber dasselbe Formular: der Stack bleibt fuer andere Specs gueltig.
  await changePassword(page, newPassword, password)
})
