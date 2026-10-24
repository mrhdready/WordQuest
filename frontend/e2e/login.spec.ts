import { expect, test, type Page } from '@playwright/test'
import { checkPage } from './axe'

// Zugang aus DemoDataSeeder (Teststack laeuft mit WQ_SEED_DEMO_DATA).
const demoEmail = 'demo@wordquest.local'
const demoPassword = 'demo1234'

test('Login: Token-Design, axe 0, Anmeldung per Enter', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible()

  const design = await page.evaluate(() => {
    const body = getComputedStyle(document.body)
    return {
      fontFamily: body.fontFamily,
      backgroundImage: body.backgroundImage,
      primary: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
    }
  })
  expect(design.fontFamily.startsWith('-apple-system')).toBe(true)
  expect(design.backgroundImage).toContain('radial-gradient')
  // Exportwert von primary aus DESIGN.md (src/design-tokens.css).
  expect(design.primary).toBe('#274fbe')

  await checkPage(page)

  // Genau eine Anmeldung: Rate-Limit "auth" erlaubt 10 pro Minute.
  await page.getByLabel('E-Mail').fill(demoEmail)
  await page.getByLabel('Passwort').fill(demoPassword)
  await page.getByLabel('Passwort').press('Enter')
  await expect(page).toHaveURL(/\/verwalten$/)
})

test('Login: Tastatur mit sichtbarem Fokus', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible()

  const expected = [
    page.getByLabel('E-Mail'),
    page.getByLabel('Passwort'),
    page.getByRole('button', { name: 'Anmelden' }),
  ]
  for (const target of expected) {
    await page.keyboard.press('Tab')
    await expect(target).toBeFocused()
    const outline = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element)
      return { style: style.outlineStyle, width: style.outlineWidth }
    })
    expect(outline).toEqual({ style: 'solid', width: '3px' })
  }
})

async function loginByForm(page: Page) {
  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(demoEmail)
  await page.getByLabel('Passwort').fill(demoPassword)
  await page.getByLabel('Passwort').press('Enter')
  await expect(page).toHaveURL(/\/verwalten$/)
}

function apiCacheEntries(page: Page) {
  return page.evaluate(async () =>
    (await caches.has('wq-api')) ? (await (await caches.open('wq-api')).keys()).length : 0,
  )
}

// D-15 mit aktivem Service Worker (localhost ist ein Secure Context): Abmelden
// leert wq-api, und ein Eintrag, den der Worker danach noch schreibt, erreicht
// die naechste Anmeldung nicht (Review 02 MEDIUM).
test('Abmelden: Tokens und wq-api weg, spaeter Eintrag ueberlebt die Anmeldung nicht', async ({ page }) => {
  await loginByForm(page)
  if (!(await page.evaluate(() => navigator.serviceWorker.controller !== null))) {
    await page.reload()
  }
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true)
  // Verwaltungsseite laden, bis der Worker eine API-Antwort cacht (sonst ohne Aussage).
  await page.reload()
  await expect.poll(() => apiCacheEntries(page)).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Abmelden' }).click()
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => caches.has('wq-api'))).toBe(false)
  expect(await page.evaluate(() => localStorage.getItem('wq.refresh'))).toBeNull()

  // Stellvertreter fuer einen GET, den der Worker nach dem Abmelden noch schreibt.
  await page.evaluate(async () => {
    const cache = await caches.open('wq-api')
    await cache.put('/api/v1/spaet', new Response('{"alt":true}'))
  })
  await loginByForm(page)
  expect(await page.evaluate(async () => (await caches.match('/api/v1/spaet')) === undefined)).toBe(
    true,
  )
})

// D-07: Der zweite Tab folgt dem Speicher ohne Neuladen.
test('Abmelden in Tab A zeigt Tab B die Anmeldung', async ({ page, context }) => {
  await loginByForm(page)
  const tabB = await context.newPage()
  await tabB.goto('/verwalten')
  await expect(tabB.getByRole('button', { name: 'Abmelden' })).toBeVisible()

  await page.getByRole('button', { name: 'Abmelden' }).click()
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible()
  await expect(tabB.getByRole('heading', { name: 'Anmelden' })).toBeVisible()
})
