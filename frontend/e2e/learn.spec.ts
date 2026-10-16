import { expect, test, type Page, type Response } from '@playwright/test'
import { checkPage } from './axe'

// Demo-Kind aus DemoDataSeeder (Teststack laeuft mit WQ_SEED_DEMO_DATA).
const childName = 'Max'
const demoPin = '1234'

// Fuer den Block "ohne Secure Context" unten: Browser-Optionen gehen nur auf
// Dateiebene (eigener Worker), localhost bleibt davon unberuehrt.
test.use({ launchOptions: { args: ['--host-resolver-rules=MAP wordquest.test 127.0.0.1'] } })

// Rate-Limit "auth": 10 Aufrufe pro Minute je IP, GET /auth/profiles zaehlt mit.
// Diese Datei bleibt bei hoechstens 6 Aufrufen: je Test ein Laden von / und eine Anmeldung.
function expectNotRateLimited(response: Response) {
  expect(response.status(), 'Rate-Limit auth erreicht').not.toBe(429)
}

const isLearnerLogin = (url: string) => url.endsWith('/api/v1/auth/learner-login')

function countLearnerLogins(page: Page) {
  const counter = { count: 0 }
  page.on('request', (request) => {
    if (isLearnerLogin(request.url())) counter.count += 1
  })
  return counter
}

async function openPicker(page: Page) {
  const [profiles] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/profiles')),
    page.goto('/'),
  ])
  expectNotRateLimited(profiles)
  await expect(page.getByRole('heading', { name: 'Wer lernt heute?' })).toBeVisible()
}

// Startet die Anmeldung und wartet auf genau die Antwort von learner-login.
async function sendLogin(page: Page, action: () => Promise<void>) {
  const [response] = await Promise.all([
    page.waitForResponse((candidate) => isLearnerLogin(candidate.url())),
    action(),
  ])
  expectNotRateLimited(response)
}

const status = (page: Page) => page.getByRole('status').filter({ hasText: 'eingegeben' })
const dots = (page: Page) => page.getByTestId('ziffern-punkte').locator('span')
const goButton = (page: Page) => page.getByRole('button', { name: 'Los geht’s' })

// Profil per Tab und Enter, Ziffern ueber die Tastatur, Enter sendet.
// withAxe: checkPage auf Profilwahl, Ziffernfeld und Lern-Startseite.
async function loginByKeyboard(page: Page, withAxe = false) {
  const logins = countLearnerLogins(page)
  if (withAxe) await checkPage(page)
  for (let step = 0; step < 10; step += 1) {
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => document.activeElement?.textContent ?? '')
    if (focused.includes(childName)) break
  }
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: `Hallo, ${childName}!` })).toBeVisible()
  if (withAxe) await checkPage(page)

  for (const digit of demoPin) await page.keyboard.press(digit)
  await expect(status(page)).toHaveText('4 Ziffern eingegeben')
  expect(logins.count, 'Anfrage schon nach der vierten Ziffer').toBe(0)

  await sendLogin(page, () => page.keyboard.press('Enter'))
  await expect(page.getByRole('heading', { name: 'Was möchtest du üben?' })).toBeVisible()
  expect(logins.count).toBe(1)
  if (withAxe) await checkPage(page)
}

test('Anmeldung per Tastatur', async ({ page }) => {
  await openPicker(page)
  await loginByKeyboard(page, true)
})

test('Ziffernfeld-Grenzen und falsche PIN', async ({ page }) => {
  const logins = countLearnerLogins(page)
  await openPicker(page)
  const profileButtons = page.getByRole('main').getByRole('button')
  const profileCount = await profileButtons.count()

  await page.getByRole('button', { name: childName }).click()
  await expect(dots(page)).toHaveCount(4)
  await expect(goButton(page)).toBeDisabled()

  // Unter 4 Ziffern bleibt Enter wirkungslos.
  for (const digit of '123') await page.keyboard.press(digit)
  await expect(status(page)).toHaveText('3 Ziffern eingegeben')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: `Hallo, ${childName}!` })).toBeVisible()
  expect(logins.count).toBe(0)

  // Siebte Ziffer wird ignoriert, die Punkte wachsen bis 6.
  for (const digit of '4567') await page.keyboard.press(digit)
  await expect(status(page)).toHaveText('6 Ziffern eingegeben')
  await expect(dots(page)).toHaveCount(6)
  await page.keyboard.press('Backspace')
  await expect(status(page)).toHaveText('5 Ziffern eingegeben')
  await expect(dots(page)).toHaveCount(5)

  // Jedes Profil beginnt bei 4 Punkten: die Laenge der gespeicherten PIN bleibt geheim.
  await page.getByRole('button', { name: 'Zurück zur Profilwahl' }).click()
  for (let index = 0; index < profileCount; index += 1) {
    await profileButtons.nth(index).click()
    await expect(dots(page)).toHaveCount(4)
    await expect(status(page)).toHaveText('0 Ziffern eingegeben')
    await page.getByRole('button', { name: 'Zurück zur Profilwahl' }).click()
  }

  // Klickpfad: die vierte Ziffer per Maus sendet nichts, erst "Los geht’s".
  await page.getByRole('button', { name: childName }).click()
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole('button', { name: '9', exact: true }).click()
  }
  await expect(status(page)).toHaveText('4 Ziffern eingegeben')
  expect(logins.count, 'Anfrage durch einen Klick auf eine Ziffern-Taste').toBe(0)

  await sendLogin(page, () => goButton(page).click())
  await expect(page.getByText('Die PIN stimmt nicht.')).toBeVisible()
  // Fokus zurueck an den Anfang des Ziffernfelds; keine zweite Ansage neben der Fehlermeldung.
  await expect(page.getByRole('button', { name: '1', exact: true })).toBeFocused()
  await expect(status(page)).toHaveCount(0)
  await page.keyboard.press('1')
  await expect(status(page)).toHaveText('1 Ziffer eingegeben')
  expect(logins.count).toBe(1)
})

// FIX-07: Heimnetz-HTTP mit nicht-lokalem Hostnamen, also ohne Secure Context
// (kein crypto.randomUUID, kein Service Worker). Der Hostname zeigt auf den Teststack.
test.describe('ohne Secure Context', () => {
  test.use({ baseURL: 'http://wordquest.test:18080' })

  const isAnswer = (url: string) => /\/api\/v1\/sessions\/[^/]+\/answers$/.test(url)
  const sendButton = (page: Page) => page.getByRole('button', { name: /^Antwort(en| senden)$/ })

  async function answer(page: Page, action: () => Promise<void>) {
    const [response] = await Promise.all([
      page.waitForResponse((candidate) => isAnswer(candidate.url())),
      action(),
    ])
    expect(response.status()).toBe(200)
    await expect(page.getByRole('button', { name: 'Weiter' })).toBeVisible()
  }

  test('Lernen über HTTP', async ({ page }) => {
    await openPicker(page)
    expect(await page.evaluate(() => window.isSecureContext)).toBe(false)
    await loginByKeyboard(page)

    await goButton(page).click()
    await expect(page).toHaveURL(/\/lernen$/)
    await expect(page.getByRole('textbox')).toBeVisible()
    await checkPage(page)

    // Antwort per Enter.
    await page.getByRole('textbox').fill('falsch')
    await answer(page, () => page.getByRole('textbox').press('Enter'))
    await checkPage(page)

    // Naechste Karte, Antwort per Klick auf den Senden-Button.
    await page.getByRole('button', { name: 'Weiter' }).click()
    await expect(page.getByRole('textbox')).toHaveValue('')
    await page.getByRole('textbox').fill('falsch')
    await answer(page, () => sendButton(page).click())
  })
})
