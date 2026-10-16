import { expect, test, type Browser, type Page } from '@playwright/test'
import { checkPage, expectReflow } from './axe'
import { guardianStorageState } from './global-setup'

test.use({ storageState: guardianStorageState })

const created = 'Das Kind ist angelegt. Es kann sich jetzt mit seiner PIN anmelden.'

// Kind meldet sich in einem frischen Kontext ohne Eltern-Sitzung an (2 Aufrufe der Policy "auth").
async function learnerLogin(browser: Browser, baseURL: string | undefined, name: string, pin: string) {
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
}

// Rate-Limit "auth": diese Datei nutzt hoechstens 5 Aufrufe
// (globalSetup, je Anmeldetest Profilwahl und learner-login).
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

  await learnerLogin(browser, baseURL, name, pin)
})

// Nicht das Demo-Kind: learn.spec nutzt dessen PIN.
test('Kind bearbeiten und mit neuer PIN anmelden', async ({ page, browser, baseURL }) => {
  const stamp = Date.now()
  const name = `Bearbeitkind ${stamp}`
  const renamed = `Umbenannt ${stamp}`

  await page.goto('/verwalten/kinder/neu')
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('PIN', { exact: true }).fill('4711')
  await page.getByRole('button', { name: 'Kind anlegen' }).click()
  await expect(page.getByRole('status').filter({ hasText: created })).toBeVisible()

  await page.getByRole('link', { name: new RegExp(name) }).click()
  await expect(page).toHaveURL(/\/verwalten\/kinder\/[0-9a-f-]{36}$/)
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue(name)
  await expect(page.getByLabel('Neue PIN')).toHaveValue('')
  await page.getByLabel('Name', { exact: true }).fill(renamed)
  await page.getByLabel('Neue Karten pro Tag').fill('9')
  await page.getByLabel('Neue PIN').fill('2580')
  await page.getByLabel('Neue PIN').press('Enter')
  await expect(
    page.getByRole('status').filter({ hasText: 'Die Änderungen sind gespeichert. Die neue PIN gilt ab sofort.' }),
  ).toBeVisible()
  await expect(page.getByLabel('Neue PIN')).toHaveValue('')

  await learnerLogin(browser, baseURL, renamed, '2580')
})

// Ungünstigster Fall nach D-15: 100 Zeichen ohne Trennstelle. Kein Aufruf im Rate-Limit "auth".
test('Langer Name', async ({ page }) => {
  const stamp = `Langername${Date.now()}`
  const name = stamp + 'x'.repeat(100 - stamp.length)

  await page.goto('/verwalten/kinder/neu')
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('PIN', { exact: true }).fill('1357')
  await page.getByRole('button', { name: 'Kind anlegen' }).click()
  await expect(page.getByRole('status').filter({ hasText: created })).toBeVisible()

  const shown = page.getByRole('main').getByText(name, { exact: true })
  await expect(shown).toBeVisible()
  await expectReflow(page)
  // Der Name bricht um, statt abgeschnitten zu werden.
  await page.setViewportSize({ width: 320, height: 568 })
  expect(await shown.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  expect(await shown.textContent()).toBe(name)
})

// Kein Aufruf im Rate-Limit "auth": leeres Absenden bleibt im Client.
test('Kinder barrierefrei', async ({ page }) => {
  await page.goto('/verwalten/kinder')
  await expect(page.getByRole('main').getByText('Neue Karten pro Tag: ').first()).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Bereiche' }).getByRole('link')).toHaveText([
    'Vokabeln',
    'Fortschritt',
    'Kinder',
    'Konto',
  ])
  await expect(page.getByRole('link', { name: 'Kinder', exact: true })).toHaveAttribute('aria-current', 'page')
  await checkPage(page)

  await page.goto('/verwalten/kinder/neu')
  await expect(page.getByRole('heading', { name: 'Kind anlegen' })).toBeVisible()
  await checkPage(page)

  // Leeres Absenden: Feldfehler an Name und PIN, je per aria-describedby; Limit hat den Startwert 5.
  await page.getByRole('button', { name: 'Kind anlegen' }).click()
  const expected = [
    ['Name', 'Wie soll das Kind heißen? Ein Spitzname genügt.'],
    ['PIN', 'Bitte gib eine PIN mit 4 bis 6 Ziffern ein.'],
  ] as const
  for (const [label, message] of expected) {
    const field = page.getByLabel(label, { exact: true })
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toHaveAccessibleDescription(new RegExp(message.replace('?', '\\?').replace('.', '\\.')))
  }
  await expect(page.getByLabel('Name', { exact: true })).toBeFocused()
  await checkPage(page)

  await expectFormTabOrder(page, ['Alle Kinder', 'Name', 'Neue Karten pro Tag', 'PIN', 'Kind anlegen'])
})

// Kein Aufruf im Rate-Limit "auth": nur Lesen und Client-Pruefung, das Demo-Kind bleibt unveraendert.
test('Kind bearbeiten barrierefrei', async ({ page }) => {
  await page.goto('/verwalten/kinder')
  await page.locator('main a[href^="/verwalten/kinder/"]:not([href$="/neu"])').first().click()
  await expect(page.getByRole('heading', { name: 'Kind bearbeiten' })).toBeVisible()
  await expect(page.getByLabel('Name', { exact: true })).not.toHaveValue('')
  await checkPage(page)

  await page.getByLabel('Name', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Änderungen speichern' }).click()
  const name = page.getByLabel('Name', { exact: true })
  await expect(name).toHaveAttribute('aria-invalid', 'true')
  await expect(name).toHaveAccessibleDescription('Wie soll das Kind heißen? Ein Spitzname genügt.')
  await expect(name).toBeFocused()
  await checkPage(page)

  await expectFormTabOrder(page, ['Alle Kinder', 'Name', 'Neue Karten pro Tag', 'Neue PIN', 'Änderungen speichern'])

  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/verwalten/kinder/00000000-0000-0000-0000-000000000000')
  await expect(page.getByText('Dieses Kind gibt es nicht (mehr).')).toBeVisible()
  await checkPage(page)
})

// Tab-Reihenfolge in <main> bei 320 px, kein Ziel unter der Tab-Leiste (WCAG 2.4.11).
async function expectFormTabOrder(page: Page, expected: string[]) {
  await page.setViewportSize({ width: 320, height: 568 })
  // Start im Kopf: Tab fuehrt von "Abmelden" in den Inhalt.
  await page.getByRole('button', { name: 'Abmelden' }).focus()
  const steps: { name: string; bottom: number; barTop: number }[] = []
  for (let index = 0; index < 20 && steps.length < expected.length; index += 1) {
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
  expect(steps.map((step) => step.name)).toEqual(expected)
  for (const step of steps) {
    expect(step.bottom, `"${step.name}" unter der Tab-Leiste`).toBeLessThanOrEqual(step.barTop)
  }
}
