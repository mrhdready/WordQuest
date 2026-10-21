import { expect, test, type Page, type Response } from '@playwright/test'
import type { AnswerResult, SessionItem, SessionView } from '@/types'
import { checkPage, expectGlassContrast, expectNoAxeViolations, expectReflow } from './axe'
import { guardianStorageState } from './global-setup'

// Demo-Kind aus DemoDataSeeder (Teststack laeuft mit WQ_SEED_DEMO_DATA).
const childName = 'Max'
const demoPin = '1234'

// Fuer den Block "ohne Secure Context" unten: Browser-Optionen gehen nur auf
// Dateiebene (eigener Worker), localhost bleibt davon unberuehrt.
test.use({ launchOptions: { args: ['--host-resolver-rules=MAP wordquest.test 127.0.0.1'] } })

// Rate-Limit "auth": GET /auth/profiles zaehlt mit, je Test ein Laden von / und eine
// Anmeldung. Der Teststack hebt das Limit an (Auth__RequestsPerMinute in
// docker-compose.e2e.yml); bei 429 schlaegt der Test sichtbar fehl.
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

// Profil per Tab und Enter, Ziffern ueber die Tastatur, die vierte sendet ab;
// ein Enter direkt danach loest keine zweite Anfrage aus.
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

  for (const digit of demoPin.slice(0, 3)) await page.keyboard.press(digit)
  await expect(status(page)).toHaveText('3 Ziffern eingegeben')
  expect(logins.count, 'Anfrage schon vor der vierten Ziffer').toBe(0)

  await sendLogin(page, async () => {
    await page.keyboard.press(demoPin.slice(3))
    await page.keyboard.press('Enter')
  })
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

  // Unter 4 Ziffern bleibt Enter wirkungslos; Backspace loescht, es bleiben 4 Punkte.
  for (const digit of '123') await page.keyboard.press(digit)
  await expect(status(page)).toHaveText('3 Ziffern eingegeben')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: `Hallo, ${childName}!` })).toBeVisible()
  expect(logins.count).toBe(0)
  await page.keyboard.press('Backspace')
  await expect(status(page)).toHaveText('2 Ziffern eingegeben')
  await expect(dots(page)).toHaveCount(4)

  // Jedes Profil beginnt bei 4 leeren Punkten.
  await page.getByRole('button', { name: 'Zurück zur Profilwahl' }).click()
  for (let index = 0; index < profileCount; index += 1) {
    await profileButtons.nth(index).click()
    await expect(dots(page)).toHaveCount(4)
    await expect(status(page)).toHaveText('0 Ziffern eingegeben')
    await page.getByRole('button', { name: 'Zurück zur Profilwahl' }).click()
  }

  // Klickpfad: der Klick auf die vierte Ziffer sendet ab, "Los geht’s" bleibt gesperrt.
  await page.getByRole('button', { name: childName }).click()
  const nine = page.getByRole('button', { name: '9', exact: true })
  for (let step = 0; step < 3; step += 1) await nine.click()
  await expect(status(page)).toHaveText('3 Ziffern eingegeben')
  expect(logins.count, 'Anfrage vor der vierten Ziffer').toBe(0)
  await expect(goButton(page)).toBeDisabled()

  await sendLogin(page, () => nine.click())
  await expect(page.getByText('Die PIN stimmt nicht.')).toBeVisible()
  // Fokus zurueck an den Anfang des Ziffernfelds; keine zweite Ansage neben der Fehlermeldung.
  await expect(page.getByRole('button', { name: '1', exact: true })).toBeFocused()
  await expect(status(page)).toHaveCount(0)
  await page.keyboard.press('1')
  await expect(status(page)).toHaveText('1 Ziffer eingegeben')
  await expect(page.getByText('Die PIN stimmt nicht.')).toBeVisible()
  expect(logins.count).toBe(1)

  // Schnelles Tippen: fuenfte Ziffer und Enter direkt hinterher ergeben genau eine Anfrage.
  // Neu gewaehlt, damit der Fokus auf keiner Taste liegt (Enter dort waere ein Klick).
  await page.getByRole('button', { name: 'Zurück zur Profilwahl' }).click()
  await page.getByRole('button', { name: childName }).click()
  await sendLogin(page, async () => {
    await page.keyboard.type('88885')
    await page.keyboard.press('Enter')
  })
  await expect(page.getByText('Die PIN stimmt nicht.')).toBeVisible()
  await expect(status(page)).toHaveCount(0)
  expect(logins.count).toBe(2)
})

// FIX-05: beide Zustaende des Serien-Badges ohne Verstoss. Nur das Feld streak der
// echten Uebersicht wird ersetzt; page.route sieht Antworten ueber den Service
// Worker nicht, deshalb ohne Worker (Muster manage.spec "Reflow").
test.describe(() => {
  test.use({ serviceWorkers: 'block' })

  test('Startseite: axe 0 mit Serie 0 und Serie 3', async ({ page }) => {
    let streak = 0
    await page.route(/\/api\/v1\/learners\/[^/]+\/overview$/, async (route) => {
      const response = await route.fetch()
      await route.fulfill({ response, json: { ...((await response.json()) as object), streak } })
    })

    await openPicker(page)
    await loginByKeyboard(page)
    await expect(page.getByText('Starte heute deine Serie!', { exact: true })).toBeVisible()
    await checkPage(page)

    streak = 3
    await page.reload()
    await expect(page.getByText('3 Tage', { exact: true })).toBeVisible()
    await checkPage(page)
  })
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

// FIX-04: gleichzeitige Doppel-Antwort, Server antwortet 409. Sitzungs-Endpunkte
// gemockt, Max' Lernstand bleibt unberuehrt.
test('Fehleransicht bei gleichzeitiger Doppel-Antwort', async ({ page }) => {
  const detail = 'Diese Antwort ist schon angekommen. Starte eine neue Runde, um weiterzulernen.'
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
  await page.route(/\/api\/v1\/sessions$/, (route) =>
    route.fulfill({ json: { sessionId: 'session-1', gameKey: 'classic', totalItems: 1, items: [item] } }),
  )
  await page.route(/\/api\/v1\/sessions\/[^/]+\/answers$/, (route) =>
    route.fulfill({
      status: 409,
      contentType: 'application/problem+json',
      body: JSON.stringify({ title: 'Schon beantwortet', status: 409, detail }),
    }),
  )

  await openPicker(page)
  await loginByKeyboard(page)
  await goButton(page).click()
  await page.getByRole('textbox').fill('Hund')
  await page.getByRole('textbox').press('Enter')

  await expect(page.getByRole('alert')).toHaveText(detail)
  await expect(page.getByRole('button', { name: 'Zurück' })).toBeFocused()
  await checkPageWithoutGlass(page)
})

// FIX-03/FIX-09 im gebauten Stack: eigenes Kind, damit das Tagesbudget des
// Demo-Kinds fuer "Lernen über HTTP" unberuehrt bleibt.
test('Abgebrochene Runde: dieselbe neue Karte kommt wieder', async ({ page, browser, baseURL }) => {
  const name = `Abbruchkind ${Date.now()}`
  const pin = '4711'

  const guardian = await browser.newContext({ baseURL, storageState: guardianStorageState })
  const manage = await guardian.newPage()
  await manage.goto('/verwalten/kinder/neu')
  await manage.getByLabel('Name', { exact: true }).fill(name)
  await manage.getByLabel('Neue Karten pro Tag').fill('5')
  await manage.getByLabel('PIN', { exact: true }).fill(pin)
  await manage.getByLabel('PIN', { exact: true }).press('Enter')
  await expect(manage).toHaveURL(/\/verwalten\/kinder$/)
  await guardian.close()

  await openPicker(page)
  await page.getByRole('button', { name }).click()
  await expect(page.getByRole('heading', { name: `Hallo, ${name}!` })).toBeVisible()
  for (const digit of pin.slice(0, -1)) await page.keyboard.press(digit)
  await sendLogin(page, () => page.keyboard.press(pin.slice(-1)))
  const home = page.getByRole('heading', { name: 'Was möchtest du üben?' })
  await expect(home).toBeVisible()

  const isStart = (url: string) => url.endsWith('/api/v1/sessions')
  const [first] = await Promise.all([
    page.waitForResponse((candidate) => isStart(candidate.url())),
    goButton(page).click(),
  ])
  const firstCard = ((await first.json()) as SessionView).items[0]?.cardId
  expect(firstCard).toBeTruthy()
  await expect(page.getByRole('textbox')).toBeVisible()

  // Ohne Antwort schliessen: nur Navigation, nichts gewertet.
  await page.getByRole('button', { name: 'Schließen' }).click()
  await expect(home).toBeVisible()

  const [second] = await Promise.all([
    page.waitForResponse((candidate) => isStart(candidate.url())),
    goButton(page).click(),
  ])
  expect(((await second.json()) as SessionView).items[0]?.cardId).toBe(firstCard)
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
