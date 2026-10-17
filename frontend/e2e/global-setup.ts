import { chromium, expect, type FullConfig } from '@playwright/test'

// Eine Eltern-Anmeldung je Lauf: Rate-Limit "auth" erlaubt im Install-Smoke 10
// pro Minute (Standard), im e2e-Stack 1000 (Auth__RequestsPerMinute).
// Standard ist das Demo-Konto des e2e-Stacks (DemoDataSeeder); der seedfreie
// Install-Smoke setzt eigene Zugangsdaten (01-07).
export const guardianStorageState = 'playwright/.auth/guardian.json'

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL
  const email = process.env.WQ_E2E_GUARDIAN_EMAIL ?? 'demo@wordquest.local'
  const password = process.env.WQ_E2E_GUARDIAN_PASSWORD ?? 'demo1234'

  const browser = await chromium.launch()
  const page = await browser.newPage({ baseURL })
  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByLabel('Passwort').press('Enter')
  await expect(page).toHaveURL(/\/verwalten$/)
  await page.context().storageState({ path: guardianStorageState })
  await browser.close()
}
