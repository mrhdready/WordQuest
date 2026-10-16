import { expect, test, type Page } from '@playwright/test'
import { checkPage } from './axe'
import { guardianStorageState } from './global-setup'

test.use({ storageState: guardianStorageState })

interface FocusStep {
  name: string
  href: string | null
  inBar: boolean
  bottom: number
  barTop: number
  startBottom: number | null
}

// Tab von Dokumentanfang bis zum Ende; je Schritt Name, Ziel und Lage zur Leiste.
async function walkTabOrder(page: Page): Promise<FocusStep[]> {
  const steps: FocusStep[] = []
  for (let index = 0; index < 80; index += 1) {
    await page.keyboard.press('Tab')
    const step = await page.evaluate(() => {
      const element = document.activeElement
      if (!element || element === document.body) return null
      const bar = document.querySelector('nav[aria-label="Bereiche"]')?.parentElement
      return {
        name: (element.getAttribute('aria-label') ?? element.textContent ?? '').trim(),
        href: element.getAttribute('href'),
        inBar: bar?.contains(element) ?? false,
        bottom: element.getBoundingClientRect().bottom,
        barTop: bar?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
        startBottom: element.hasAttribute('data-start-bottom')
          ? Number(element.getAttribute('data-start-bottom'))
          : null,
      }
    })
    if (!step) break
    steps.push(step)
  }
  return steps
}

// WCAG 2.4.11: kein per Tab fokussiertes Element liegt unter der schwebenden Leiste.
// Bei Scroll 0 merkt sich jedes Element seine Unterkante; mindestens ein Ziel muss
// dort unter der Leiste beginnen, sonst prueft der Test nur den trivialen Fall.
async function expectFocusNotObscured(page: Page) {
  await page.setViewportSize({ width: 320, height: 568 })
  const startBarTop = await page.evaluate(() => {
    window.scrollTo(0, 0)
    for (const element of document.querySelectorAll('main *')) {
      element.setAttribute('data-start-bottom', String(element.getBoundingClientRect().bottom))
    }
    const bar = document.querySelector('nav[aria-label="Bereiche"]')?.parentElement
    return bar?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY
  })
  const steps = await walkTabOrder(page)
  const inContent = steps.filter((entry) => !entry.inBar)
  const coveredAtStart = inContent.filter((entry) => (entry.startBottom ?? 0) > startBarTop)
  expect(coveredAtStart.length, 'kein Ziel lag bei Scroll 0 unter der Leiste').toBeGreaterThan(0)
  for (const step of inContent) {
    expect(step.bottom, `"${step.name}" unter der Tab-Leiste`).toBeLessThanOrEqual(step.barTop)
  }
}

test('/verwalten: axe 0', async ({ page }) => {
  await page.goto('/verwalten')
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Bereiche' })).toBeVisible()
  await checkPage(page)
})

test('Tab-Reihenfolge: Kopf, Inhalt, Tabs, "+"', async ({ page }) => {
  await page.goto('/verwalten')
  await expect(page.locator('main a[href^="/verwalten/sets/"]').first()).toBeVisible()
  const steps = await walkTabOrder(page)
  const names = steps.map((step) => step.name)

  const logout = names.indexOf('Abmelden')
  const firstSet = steps.findIndex((step) => step.href?.startsWith('/verwalten/sets/'))
  const vocabTab = names.indexOf('Vokabeln')
  const plus = names.indexOf('Neues Set')
  expect(logout, names.join(' | ')).toBeGreaterThanOrEqual(0)
  expect(firstSet, names.join(' | ')).toBeGreaterThan(logout)
  expect(vocabTab, names.join(' | ')).toBeGreaterThan(firstSet)
  expect(plus, names.join(' | ')).toBeGreaterThan(vocabTab)

  await expect(page.getByRole('link', { name: 'Vokabeln', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('Fokus nicht verdeckt bei 320 px', async ({ page }) => {
  // Mit offenem Formular reicht die Set-Liste bei 320 x 568 unter die Leiste.
  await page.goto('/verwalten?neu=1')
  await expect(page.locator('main a[href^="/verwalten/sets/"]').first()).toBeVisible()
  await expectFocusNotObscured(page)
})

test('"+" öffnet das Set-Formular', async ({ page }) => {
  await page.goto('/verwalten')
  await page.getByRole('link', { name: 'Neues Set' }).click()
  await expect(page).toHaveURL(/[?&]neu=1/)
  await expect(page.locator('main form input').first()).toBeFocused()
  await checkPage(page)
})

async function openFirstSet(page: Page) {
  await page.goto('/verwalten')
  await page.locator('main a[href^="/verwalten/sets/"]').first().click()
  await expect(page.getByRole('link', { name: 'Alle Sets' })).toBeVisible()
  await expect(page.getByRole('button', { name: /löschen$/ }).first()).toBeVisible()
}

test('Set-Detail: axe 0, Fokus nicht verdeckt', async ({ page }) => {
  await openFirstSet(page)
  await checkPage(page)
  await expectFocusNotObscured(page)
})

test('Eintrag-Formular: unvollständig sendet nichts, Enter legt genau einen an', async ({ page }) => {
  const posts: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/api\/v1\/sets\/[^/]+\/entries$/.test(request.url())) {
      posts.push(request.url())
    }
  })
  await openFirstSet(page)
  const german = page.getByLabel('Deutsch', { exact: true })
  const english = page.getByLabel('Englisch', { exact: true })
  const stamp = Date.now()

  // 1: nur Englisch
  await english.fill(`nur-englisch-${stamp}`)
  await english.press('Enter')
  await expect(page.getByText(`nur-englisch-${stamp}`, { exact: false })).toHaveCount(0)
  expect(posts).toHaveLength(0)
  await english.fill('')

  // 2: nur Deutsch
  await german.fill(`nur-deutsch-${stamp}`)
  await english.press('Enter')
  expect(posts).toHaveLength(0)

  // Happy Path zuletzt: beide Felder, Enter im Feld Englisch
  await german.fill(`Wort${stamp}`)
  await english.fill(`word${stamp}`)
  const created = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/entries'),
  )
  await english.press('Enter')
  expect((await created).status()).toBe(201)
  await expect(page.getByText(`word${stamp}`)).toBeVisible()
  expect(posts).toHaveLength(1)
})

test('CSV-Import: geöffnet, Vorschau, Fehler, Erfolg', async ({ page }) => {
  await openFirstSet(page)
  await page.getByRole('button', { name: 'Liste importieren (CSV)' }).click()

  // Zustand geöffnet: leeres Textfeld, "Vorschau" deaktiviert
  await expect(page.getByRole('button', { name: 'Vorschau' })).toBeDisabled()
  await checkPage(page)

  // Zustand Vorschau: eine gültige Zeile, eine ohne Trennzeichen
  const stamp = Date.now()
  await page.locator('textarea').fill(`Haus${stamp};house${stamp}\nohneTrennzeichen`)
  await page.getByRole('button', { name: 'Vorschau' }).click()
  await expect(page.getByText('1 erkannt')).toBeVisible()
  await expect(page.getByText('1 übersprungen')).toBeVisible()
  await expect(page.getByText('Zeile hat keine zwei befuellten Spalten.')).toBeVisible()
  await checkPage(page)

  // Fehlerzustand: Server antwortet beim Übernehmen mit 500
  const importUrl = '**/api/v1/sets/*/import'
  await page.route(importUrl, (route) => route.fulfill({ status: 500, body: '' }))
  await page.getByRole('button', { name: '1 Vokabeln übernehmen' }).click()
  await expect(page.getByText('Der Import ist fehlgeschlagen.')).toBeVisible()
  await checkPage(page)

  // Happy Path zuletzt: Route entfernen, erneut übernehmen
  await page.unroute(importUrl)
  await page.getByRole('button', { name: '1 Vokabeln übernehmen' }).click()
  await expect(page.getByRole('button', { name: 'Vorschau' })).toHaveCount(0)
  await expect(page.getByText(`house${stamp}`)).toBeVisible()
})

test('Fortschritt: axe 0', async ({ page }) => {
  await page.goto('/verwalten/fortschritt')
  await expect(page.getByText(/^Level \d+$/)).toBeVisible()
  await checkPage(page)
})
