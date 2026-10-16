import { expect, test } from '@playwright/test'
import { guardianStorageState } from './global-setup'

test.use({ storageState: guardianStorageState })

const created = 'Das Kind ist angelegt. Es kann sich jetzt mit seiner PIN anmelden.'

// Rate-Limit "auth" (10 pro Minute): diese Datei nutzt hoechstens 3 Aufrufe
// (globalSetup, Profilwahl, learner-login).
test('Kind anlegen und anmelden', async ({ page, browser, baseURL }) => {
  const name = `Testkind ${Date.now()}`
  const pin = '583920'

  await page.goto('/verwalten/kinder')
  await page.getByRole('link', { name: 'Kind anlegen' }).click()
  await expect(page).toHaveURL(/\/verwalten\/kinder\/neu$/)
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Neue Karten pro Tag').fill('7')
  await page.getByLabel('PIN', { exact: true }).fill(pin)
  await page.getByLabel('PIN', { exact: true }).press('Enter')

  await expect(page).toHaveURL(/\/verwalten\/kinder$/)
  await expect(page.getByRole('status').filter({ hasText: created })).toBeVisible()
  const row = page.getByRole('main').getByText(name, { exact: true })
  await expect(row).toBeVisible()
  await expect(row.locator('..')).toContainText('Neue Karten pro Tag: 7')

  // Neuer Kontext ohne Eltern-Sitzung: das Kind meldet sich auf der Profilwahl an.
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
  const child = await context.newPage()
  const [profiles] = await Promise.all([
    child.waitForResponse((response) => response.url().endsWith('/api/v1/auth/profiles')),
    child.goto('/'),
  ])
  expect(profiles.status(), 'Rate-Limit auth erreicht').not.toBe(429)
  await child.getByRole('button', { name }).click()
  await expect(child.getByRole('heading', { name: `Hallo, ${name}!` })).toBeVisible()
  for (const digit of pin) await child.keyboard.press(digit)
  const [login] = await Promise.all([
    child.waitForResponse((response) => response.url().endsWith('/api/v1/auth/learner-login')),
    child.keyboard.press('Enter'),
  ])
  expect(login.status()).toBe(200)
  await expect(child.getByRole('heading', { name: 'Was möchtest du üben?' })).toBeVisible()
  await context.close()
})
