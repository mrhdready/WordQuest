import { expect, test, type Page, type Response } from '@playwright/test'
import type { AnswerResult, SessionItem, SessionView } from '@/types'
import { checkPage, expectGlassContrast, expectNoAxeViolations, expectReflow } from './axe'

// Demo-Kind aus DemoDataSeeder (Teststack laeuft mit WQ_SEED_DEMO_DATA).
const childName = 'Max'
const demoPin = '1234'

// Fuer den Block "ohne Secure Context" unten: Browser-Optionen gehen nur auf
// Dateiebene (eigener Worker), localhost bleibt davon unberuehrt.
test.use({ launchOptions: { args: ['--host-resolver-rules=MAP wordquest.test 127.0.0.1'] } })

// Rate-Limit "auth": 10 Aufrufe pro Minute je IP, GET /auth/profiles zaehlt mit.
// Diese Datei bleibt bei hoechstens 8 Aufrufen: je Test ein Laden von / und eine Anmeldung.
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

// Seiten ohne Glasflaeche (Fehler, "alles erledigt"): der Fallback-Teil von
// checkPage verlangt mindestens eine Glasflaeche und greift hier nicht.
async function checkPageWithoutGlass(page: Page) {
  await expectNoAxeViolations(page)
  await expectGlassContrast(page)
  await expectReflow(page)
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

// Sitzungs-Endpunkte gemockt: Max' echter Lernstand bleibt fuer "Lernen über HTTP"
// unberuehrt (das Tagesbudget neuer Karten reicht fuer genau eine Runde).
test('Schließen in einer angefangenen Runde und Fehlerzustand', async ({ page }) => {
  const item = {
    itemId: 'item-1',
    cardId: 'card-1',
    prompt: 'dog',
    promptType: 'text',
    expectedAnswerType: 'text',
    choices: null,
    emoji: null,
    exampleSentence: null,
    isRetry: false,
  }
  const view = {
    sessionId: 'session-1',
    gameKey: 'classic',
    totalItems: 2,
    items: [item, { ...item, itemId: 'item-2' }],
  }
  const result = {
    correct: false,
    grade: 'Again',
    correctAnswer: 'Hund',
    message: null,
    hadTypo: false,
    xpAwarded: 0,
    coinsAwarded: 0,
    retryItem: null,
  }
  const summary = {
    sessionId: 'session-1',
    answered: 1,
    correct: 0,
    xpAwarded: 0,
    coinsAwarded: 0,
    totalXp: 0,
    level: 1,
    levelProgress: 0,
    xpToNextLevel: 100,
    coins: 0,
    streak: 1,
    streakSaverUsed: false,
    leveledUp: false,
  }
  let completes = 0
  await page.route(/\/api\/v1\/sessions$/, (route) => route.fulfill({ json: view }))
  await page.route(/\/api\/v1\/sessions\/[^/]+\/answers$/, (route) => route.fulfill({ json: result }))
  await page.route(/\/api\/v1\/sessions\/[^/]+\/complete$/, (route) => {
    completes += 1
    return route.fulfill({ json: summary })
  })

  await openPicker(page)
  await loginByKeyboard(page)
  const home = page.getByRole('heading', { name: 'Was möchtest du üben?' })
  const close = page.getByRole('button', { name: 'Schließen' })

  // Ohne beantwortete Karte: nur zurueck, kein Abschluss.
  await goButton(page).click()
  await expect(page.getByRole('textbox')).toBeVisible()
  await close.click()
  await expect(home).toBeVisible()
  expect(completes).toBe(0)

  // Nach einer Antwort schliesst "Schließen" die Runde regulaer ab (Entscheidung 2026-10-16).
  await goButton(page).click()
  await page.getByRole('textbox').fill('falsch')
  await page.getByRole('textbox').press('Enter')
  await expect(page.getByRole('button', { name: 'Weiter' })).toBeVisible()
  await close.click()
  await expect(home).toBeVisible()
  expect(completes).toBe(1)

  // Fehlerzustand: Start der Runde scheitert am Server.
  await page.unroute(/\/api\/v1\/sessions$/)
  await page.route(/\/api\/v1\/sessions$/, (route) => route.fulfill({ status: 500, body: '' }))
  await goButton(page).click()
  await expect(page.getByRole('alert')).toHaveText('Das hat nicht geklappt. Versuche es noch einmal.')
  await checkPageWithoutGlass(page)
})

// FIX-07: Heimnetz-HTTP mit nicht-lokalem Hostnamen, also ohne Secure Context
// (kein crypto.randomUUID, kein Service Worker). Der Hostname zeigt auf den Teststack.
test.describe('ohne Secure Context', () => {
  test.use({ baseURL: 'http://wordquest.test:18080' })

  const isAnswer = (url: string) => /\/api\/v1\/sessions\/[^/]+\/answers$/.test(url)
  const sendButton = (page: Page) => page.getByRole('button', { name: /^Antwort(en| senden)$/ })

  // Prueft die angezeigte Rueckmeldung gegen die Serverantwort; "Weiter" (hat
  // nach der Antwort den Fokus) beschreibt sie per aria-describedby (WCAG 4.1.3).
  async function answer(page: Page, action: () => Promise<void>) {
    const [response] = await Promise.all([
      page.waitForResponse((candidate) => isAnswer(candidate.url())),
      action(),
    ])
    expect(response.status()).toBe(200)
    const result = (await response.json()) as AnswerResult
    const headline = result.correct ? 'Richtig!' : 'Fast!'
    const weiter = page.getByRole('button', { name: 'Weiter' })
    await expect(weiter).toBeFocused()
    await expect(page.getByText(headline, { exact: true })).toBeVisible()
    await expect(weiter).toHaveAccessibleDescription(new RegExp(`^${headline}`))
    if (!result.correct) {
      await expect(page.getByText(`Es heißt: ${result.correctAnswer}`)).toBeVisible()
      await expect(weiter).toHaveAccessibleDescription(new RegExp(`Es heißt: ${result.correctAnswer}`))
    }
    return result
  }

  test('Lernen über HTTP', async ({ page }) => {
    await openPicker(page)
    expect(await page.evaluate(() => window.isSecureContext)).toBe(false)
    await loginByKeyboard(page)

    // Reihenfolge der Karten wie im Client: Startliste plus nachgereichte Wiederholungen.
    const [started] = await Promise.all([
      page.waitForResponse((candidate) => candidate.url().endsWith('/api/v1/sessions')),
      goButton(page).click(),
    ])
    const queue = ((await started.json()) as SessionView).items
    const solutions = new Map<string, string>()
    const record = (item: SessionItem, result: AnswerResult) => {
      solutions.set(item.cardId, result.correctAnswer)
      if (result.retryItem) queue.push(result.retryItem)
    }

    await expect(page).toHaveURL(/\/lernen$/)
    await expect(page.getByRole('textbox')).toBeVisible()
    await checkPage(page)

    // Antwort per Enter.
    await page.getByRole('textbox').fill('falsch')
    record(queue[0]!, await answer(page, () => page.getByRole('textbox').press('Enter')))
    await checkPage(page)

    // Naechste Karte, Antwort per Klick auf den Senden-Button.
    await page.getByRole('button', { name: 'Weiter' }).click()
    await expect(page.getByRole('textbox')).toHaveValue('')
    await page.getByRole('textbox').fill('falsch')
    record(queue[1]!, await answer(page, () => sendButton(page).click()))

    // Rest der Runde: unbekannte Karten falsch, Wiederholungen richtig.
    // Danach steht jede Karte in "Review", fuer heute ist nichts mehr faellig.
    for (let index = 2; index < queue.length; index += 1) {
      await page.getByRole('button', { name: 'Weiter' }).click()
      const item = queue[index]!
      await page.getByRole('textbox').fill(solutions.get(item.cardId) ?? 'falsch')
      record(item, await answer(page, () => page.getByRole('textbox').press('Enter')))
    }

    await page.getByRole('button', { name: 'Weiter' }).click()
    await expect(page.getByRole('heading', { name: /Geschafft!|erreicht!/ })).toBeVisible()
    await checkPage(page)

    await page.getByRole('button', { name: 'Fertig' }).click()
    await expect(page.getByText('Für heute ist alles erledigt. Morgen geht es weiter!')).toBeVisible()
    await checkPage(page)

    await page.goto('/lernen')
    await expect(page.getByText('Für heute ist alles erledigt.')).toBeVisible()
    await checkPageWithoutGlass(page)
  })
})
