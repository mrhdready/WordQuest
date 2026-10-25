import { expect, test, type Browser, type Page, type Response } from '@playwright/test'
import type { AnswerResult, SessionItem, SessionView } from '@/types'
import { checkPage, expectGlassContrast, expectNoAxeViolations, expectReflow } from './axe'
import { guardianStorageState } from './global-setup'
import { accessToken, canvasPicture, putPicture } from './pictures'

// Demo-Kind aus DemoDataSeeder (Teststack laeuft mit WQ_SEED_DEMO_DATA).
const childName = 'Max'
const demoPin = '1234'

// Warnpfad fuer die ganze Datei: Der Browser vertraut der CA nicht (keine
// SPKI-Liste aus global-setup, launchOptions ersetzt die der Konfiguration), die
// Warnung ist weggeklickt (ignoreHTTPSErrors). So sieht ein Geraet aus, auf dem die
// Eltern die CA nicht installiert haben: kein Service Worker, Lernen muss trotzdem
// gehen. Browser-Optionen gehen nur auf Dateiebene (eigener Worker).
test.use({
  ignoreHTTPSErrors: true,
  launchOptions: { args: ['--host-resolver-rules=MAP wordquest.test 127.0.0.1'] },
})

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
  await expect(goButton(page)).toHaveCount(0)

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

  // Klickpfad: der Klick auf die vierte Ziffer sendet ab; ein „Los geht’s“ gibt es hier nicht.
  await page.getByRole('button', { name: childName }).click()
  const nine = page.getByRole('button', { name: '9', exact: true })
  for (let step = 0; step < 3; step += 1) await nine.click()
  await expect(status(page)).toHaveText('3 Ziffern eingegeben')
  expect(logins.count, 'Anfrage vor der vierten Ziffer').toBe(0)
  await expect(goButton(page)).toHaveCount(0)

  await sendLogin(page, () => nine.click())
  await expect(page.getByText('Die PIN stimmt nicht.')).toBeVisible()
  // Fokus zurueck an den Anfang des Ziffernfelds; keine zweite Ansage neben der Fehlermeldung.
  await expect(page.getByRole('button', { name: '1', exact: true })).toBeFocused()
  await expect(status(page)).toHaveCount(0)
  await page.keyboard.press('1')
  await expect(status(page)).toHaveText('1 Ziffer eingegeben')
  await expect(page.getByText('Die PIN stimmt nicht.')).toBeVisible()
  expect(logins.count).toBe(1)

  // Enter auf der fokussierten Taste "1" haengt keine Ziffer an.
  await page.keyboard.press('Enter')
  await expect(status(page)).toHaveText('1 Ziffer eingegeben')
  await page.keyboard.press('Backspace')

  // Schnelles Tippen: fuenfte Ziffer und Enter direkt hinterher ergeben genau eine Anfrage.
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

// Sitzungs-Endpunkte gemockt: Max' echter Lernstand bleibt fuer "Lernen ohne vertrautes Zertifikat"
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
// Demo-Kinds fuer "Lernen ohne vertrautes Zertifikat" unberuehrt bleibt.
test('Abgebrochene Runde: dieselbe neue Karte kommt wieder', async ({ page, browser, baseURL }) => {
  const name = `Abbruchkind ${Date.now()}`
  const pin = '4711'

  const guardian = await browser.newContext({ baseURL, storageState: guardianStorageState, ignoreHTTPSErrors: true })
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

// Heimnetz-Adresse mit nicht-lokalem Hostnamen ueber HTTPS, Zertifikatswarnung
// weggeklickt: Chromium registriert dann keinen Service Worker, die App laeuft als
// reine Browser-App. Der Hostname zeigt auf den Teststack. Den Ersatz fuer
// crypto.randomUUID (FIX-07) behaelt der Code fuer Seiten ohne Secure Context; hier
// ist der Kontext sicher, den Ersatz prueft QA2-05.
test.describe('Zertifikat nicht vertraut', () => {
  test.use({ baseURL: 'https://wordquest.test:18443' })

  // Kein Service Worker, auch nicht nach dem Neuladen (eine erfolgreiche
  // Registrierung aus dem ersten Laden waere dann sichtbar).
  async function expectNoServiceWorker(page: Page) {
    const workers = () =>
      page.evaluate(async () => ({
        controller: navigator.serviceWorker.controller !== null,
        registrations: (await navigator.serviceWorker.getRegistrations()).length,
      }))
    expect(await workers()).toEqual({ controller: false, registrations: 0 })
    await page.reload({ waitUntil: 'load' })
    expect(await workers()).toEqual({ controller: false, registrations: 0 })
  }

  const isAnswer = (url: string) => /\/api\/v1\/sessions\/[^/]+\/answers$/.test(url)
  const sendButton = (page: Page) => page.getByRole('button', { name: /^Antwort(en| senden)$/ })

  // "Weiter" gibt es nur, wenn das Kind etwas korrigiert sehen muss.
  const needsWeiter = (result: AnswerResult) => !result.correct || result.hadTypo

  // Prueft die angezeigte Rueckmeldung gegen die Serverantwort; "Weiter" (hat
  // nach der Antwort den Fokus) beschreibt sie per aria-describedby (WCAG 4.1.3).
  // Richtig ohne Tippfehler prueft expectAdvanced.
  async function answer(page: Page, action: () => Promise<void>) {
    const [response] = await Promise.all([
      page.waitForResponse((candidate) => isAnswer(candidate.url())),
      action(),
    ])
    expect(response.status()).toBe(200)
    const result = (await response.json()) as AnswerResult
    if (!needsWeiter(result)) return result
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

  // Richtig ohne Tippfehler: ohne Tipp die naechste Aufgabe, die Bestaetigung mit den XP
  // steht im Statusbereich ueber dem leeren, fokussierten Antwortfeld; nach der letzten
  // Aufgabe kommt direkt die Zusammenfassung.
  async function expectAdvanced(page: Page, result: AnswerResult, last: boolean) {
    if (last) {
      await expect(page.getByRole('heading', { name: /Geschafft!|erreicht!/ })).toBeVisible()
    } else {
      await expect(page.getByRole('status')).toHaveText(
        result.xpAwarded > 0 ? `Richtig! +${result.xpAwarded} XP` : 'Richtig!',
      )
      const field = page.getByRole('textbox', { name: 'Deine Antwort' })
      await expect(field).toBeFocused()
      await expect(field).toHaveValue('')
    }
    await expect(page.getByRole('button', { name: 'Weiter' })).toHaveCount(0)
  }

  test('Lernen ohne vertrautes Zertifikat', async ({ page }) => {
    await openPicker(page)
    await expectNoServiceWorker(page)
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
    let result = await answer(page, () => sendButton(page).click())
    record(queue[1]!, result)

    // Rest der Runde: unbekannte Karten falsch, Wiederholungen richtig.
    // Danach steht jede Karte in "Review", fuer heute ist nichts mehr faellig.
    let advanced = false
    for (let index = 2; index < queue.length; index += 1) {
      if (needsWeiter(result)) {
        await page.getByRole('button', { name: 'Weiter' }).click()
      } else {
        await expectAdvanced(page, result, false)
        advanced = true
      }
      const item = queue[index]!
      await page.getByRole('textbox').fill(solutions.get(item.cardId) ?? 'falsch')
      result = await answer(page, () => page.getByRole('textbox').press('Enter'))
      record(item, result)
    }
    expect(advanced, 'keine automatische Weiterschaltung').toBe(true)

    // Die letzte Aufgabe ist eine richtig beantwortete Wiederholung: ohne "Weiter" zur Zusammenfassung.
    expect(needsWeiter(result)).toBe(false)
    await expectAdvanced(page, result, true)
    await checkPage(page)

    await page.getByRole('button', { name: 'Fertig' }).click()
    await expect(page.getByText('Für heute ist alles erledigt. Morgen geht es weiter!')).toBeVisible()
    await checkPage(page)

    await page.goto('/lernen')
    await expect(page.getByText('Für heute ist alles erledigt.')).toBeVisible()
    await checkPageWithoutGlass(page)
  })

  /*
    IMG-01 (D-11, D-12): eigenes Kind wie in "Abgebrochene Runde", damit das Tagesbudget
    des Demo-Kinds fuer "Lernen ohne vertrautes Zertifikat" unberuehrt bleibt, und ein Set mit genau einer
    Vokabel, damit jede Karte der Runde ein Bild traegt. Der Eltern-Kontext laeuft auf der
    baseURL des Projekts (dort gilt guardianStorageState) und meldet sich nicht neu an.
    Anmelde-Budget: je Test zwei Anfragen der Policy "auth" (/ mit GET /auth/profiles,
    learner-login), wie "Abgebrochene Runde".
  */
  async function startWithPicture(
    page: Page,
    browser: Browser,
    entry: { sourceText: string; targetText: string; emoji: string | null },
    viewport?: { width: number; height: number },
  ) {
    const stamp = Date.now()
    const name = `Bildkind ${stamp}`
    const title = `Bildset ${stamp}`
    const pin = '4711'

    const guardian = await browser.newContext({
      baseURL: test.info().project.use.baseURL,
      storageState: guardianStorageState,
      ignoreHTTPSErrors: true,
    })
    const manage = await guardian.newPage()
    await manage.goto('/verwalten/kinder/neu')
    await manage.getByLabel('Name', { exact: true }).fill(name)
    await manage.getByLabel('Neue Karten pro Tag').fill('5')
    await manage.getByLabel('PIN', { exact: true }).fill(pin)
    await manage.getByLabel('PIN', { exact: true }).press('Enter')
    await expect(manage).toHaveURL(/\/verwalten\/kinder$/)

    const headers = { Authorization: `Bearer ${await accessToken(manage)}` }
    const set = await manage.request.post('/api/v1/sets', {
      headers,
      data: { title, description: null, sourceLanguage: null, targetLanguage: null },
    })
    expect(set.status()).toBe(201)
    const setId = ((await set.json()) as { id: string }).id
    const created = await manage.request.post(`/api/v1/sets/${setId}/entries`, { headers, data: entry })
    expect(created.status()).toBe(201)
    const entryId = ((await created.json()) as { id: string }).id
    const png = await canvasPicture(manage, { type: 'image/png', width: 64, height: 48 })
    await putPicture(manage, setId, entryId, png, 'image/png')
    await guardian.close()

    await openPicker(page)
    await expectNoServiceWorker(page)
    await page.getByRole('button', { name }).click()
    await expect(page.getByRole('heading', { name: `Hallo, ${name}!` })).toBeVisible()
    for (const digit of pin.slice(0, -1)) await page.keyboard.press(digit)
    await sendLogin(page, () => page.keyboard.press(pin.slice(-1)))
    await expect(page.getByRole('heading', { name: 'Was möchtest du üben?' })).toBeVisible()

    await page.getByRole('button', { name: title }).click()
    if (viewport) await page.setViewportSize(viewport)
    const [started] = await Promise.all([
      page.waitForResponse((candidate) => candidate.url().endsWith('/api/v1/sessions')),
      goButton(page).click(),
    ])
    expect(started.status()).toBe(200)
    return ((await started.json()) as SessionView).items
  }

  // Bild im Rahmen fester Hoehe (160 px), dekodiert, ohne Alt-Text; Fokus im Antwortfeld.
  async function expectPictureCard(page: Page) {
    const frame = page.getByTestId('vokabelbild')
    const image = frame.locator('img')
    await expect(image).toHaveAttribute('alt', '')
    await expect(image).toHaveAttribute('src', /^data:image\/png;base64,/)
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
    // Die Karte skaliert beim Erscheinen (animate-pop); gemessen wird nach der Animation.
    await expect.poll(async () => (await frame.boundingBox())?.height).toBe(160)
    await expect(page.getByRole('textbox', { name: 'Deine Antwort' })).toBeFocused()
  }

  test('Lernen mit Bild ohne vertrautes Zertifikat', async ({ page, browser }) => {
    // Die erste Karte erscheint bei 200 % (640 x 400 CSS-px), wie bei einem Kind mit
    // Zoom: kein waagerechter Scrollbalken, das Antwortfeld hat den Fokus und ist im
    // Bild. Der Rahmen steht schon vor dem Bild, der Fokus scrollt also nicht ins Leere.
    const original = page.viewportSize()
    const queue = await startWithPicture(
      page,
      browser,
      { sourceText: 'Hund', targetText: 'dog', emoji: null },
      { width: 640, height: 400 },
    )
    await expectPictureCard(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(640)
    await expect(page.getByRole('textbox', { name: 'Deine Antwort' })).toBeInViewport({ ratio: 1 })
    if (original) await page.setViewportSize(original)
    // checkPage enthaelt expectReflow (320 px).
    await checkPage(page)

    // Reihenfolge wie im Client: Startliste plus nachgereichte Wiederholungen.
    const solutions = new Map<string, string>()
    const record = (item: SessionItem, result: AnswerResult) => {
      solutions.set(item.cardId, result.correctAnswer)
      if (result.retryItem) queue.push(result.retryItem)
    }

    // Ganze Runde per Tastatur: neue Karten falsch, Wiederholungen richtig, jeweils
    // Enter im Antwortfeld; Enter auf "Weiter" (hat den Fokus) holt nach einer falschen
    // Antwort die naechste Karte, nach einer richtigen kommt sie von selbst.
    let retryChecked = false
    let zoomChecked = false
    let result: AnswerResult | null = null
    for (let index = 0; index < queue.length; index += 1) {
      const item = queue[index]!
      if (result && needsWeiter(result)) {
        await page.keyboard.press('Enter')
        await expectPictureCard(page)
        if (item.isRetry && !retryChecked) {
          await checkPage(page)
          retryChecked = true
        }
      } else if (result) {
        await expectAdvanced(page, result, false)
        await expectPictureCard(page)
        if (!zoomChecked) {
          // 200 %: Bestaetigung und fokussiertes Antwortfeld im Bild, kein waagerechtes
          // Scrollen; danach axe, Kontrast und Reflow auf genau diesem Zustand.
          await expect(page.getByRole('textbox', { name: 'Deine Antwort' })).toBeInViewport({ ratio: 1 })
          await expect(page.getByRole('status')).toBeInViewport({ ratio: 1 })
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(640)
          if (original) await page.setViewportSize(original)
          await checkPage(page)
          zoomChecked = true
        }
      }
      const solution = solutions.get(item.cardId)
      // Das Kind mit Zoom tippt die Antwort, die gleich automatisch weiterschaltet, bei 200 %.
      if (solution && !zoomChecked && index < queue.length - 1) await page.setViewportSize({ width: 640, height: 400 })
      await page.keyboard.type(solution ?? 'falsch')
      result = await answer(page, () => page.keyboard.press('Enter'))
      record(item, result)
    }
    expect(retryChecked).toBe(true)
    expect(zoomChecked, '200 % nach automatischer Weiterschaltung nicht geprueft').toBe(true)

    // Letzte Aufgabe richtig: die Zusammenfassung kommt ohne Enter auf "Weiter".
    expect(needsWeiter(result!)).toBe(false)
    await expectAdvanced(page, result!, true)
    await checkPage(page)
  })

  // D-16: Der Server dekodiert nicht; ein Bild, an dem der Browser nach HTTP 200
  // scheitert, erzeugt deshalb page.route (ohne Service Worker sieht es jede Antwort).
  test('Bild nicht dekodierbar: Emoji im selben Rahmen', async ({ page, browser }) => {
    await page.route('**/api/v1/pictures/**', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: 'kaputt' }),
    )
    await startWithPicture(page, browser, { sourceText: 'Katze', targetText: 'cat', emoji: '🐱' })

    const frame = page.getByTestId('vokabelbild')
    await expect(frame).toHaveText('🐱')
    await expect(frame.locator('img')).toHaveCount(0)
    await expect.poll(async () => (await frame.boundingBox())?.height).toBe(160)
    await expect(page.getByRole('textbox', { name: 'Deine Antwort' })).toBeFocused()
    await checkPage(page)
  })
})
