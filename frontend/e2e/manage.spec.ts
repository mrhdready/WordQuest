import { expect, test, type Locator, type Page } from '@playwright/test'
import { checkPage, expectDialogContrast, expectNoAxeViolations } from './axe'
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

// 640 px (= 200 % Zoom) prueft keyboard-zoom.spec.ts fuer alle Phase-1-Seiten.

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

test('Eintrag-Formular: unvollständig sendet nichts, Enter und Knopf legen je einen an', async ({ page }) => {
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

  // 3: Deutsch nur Leerzeichen, ueber den Knopf
  const add = page.getByRole('button', { name: 'Hinzufügen' })
  await german.fill('   ')
  await english.fill(`leer-deutsch-${stamp}`)
  await add.click()
  expect(posts).toHaveLength(0)

  // 4: Englisch nur Leerzeichen, ueber den Knopf
  await german.fill(`leer-englisch-${stamp}`)
  await english.fill('   ')
  await add.click()
  expect(posts).toHaveLength(0)

  // Happy Path zuletzt: beide Felder, einmal Enter im Feld Englisch, einmal der Knopf.
  // Die Endzahl 2 belegt zugleich, dass die Faelle 1 bis 4 nichts gesendet haben.
  for (const submit of [() => english.press('Enter'), () => add.click()]) {
    const word = `word${posts.length}-${stamp}`
    await german.fill(`Wort${posts.length}-${stamp}`)
    await english.fill(word)
    const created = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().endsWith('/entries'),
    )
    await submit()
    expect((await created).status()).toBe(201)
    await expect(page.getByText(word)).toBeVisible()
  }
  expect(posts).toHaveLength(2)
})

test('CSV-Import: geöffnet, Vorschau, Fehler, Erfolg', async ({ page }) => {
  await openFirstSet(page)
  await page.getByRole('button', { name: 'Liste importieren (CSV)' }).click()

  // Zustand geöffnet: leeres Textfeld, "Vorschau" deaktiviert
  await expect(page.getByRole('button', { name: 'Vorschau' })).toBeDisabled()
  await checkPage(page)

  // Fehlerzustand Vorschau: Server antwortet mit 500, der deutsche Allgemeintext erscheint
  const stamp = Date.now()
  await page.locator('textarea').fill(`Haus${stamp};house${stamp}\nohneTrennzeichen`)
  const previewUrl = '**/api/v1/sets/import/preview'
  await page.route(previewUrl, (route) => route.fulfill({ status: 500, body: '' }))
  await page.getByRole('button', { name: 'Vorschau' }).click()
  await expect(page.getByRole('alert')).toHaveText('Das hat nicht geklappt. Versuche es noch einmal.')
  await checkPage(page)
  await page.unroute(previewUrl)

  // Zustand Vorschau: eine gültige Zeile, eine ohne Trennzeichen
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

// Eigene Sets beginnen mit "Zz E2E": sie stehen am Ende der sortierten Liste,
// openFirstSet und die anderen Specs oeffnen weiter ein Demo-Set.
async function createAndOpenSet(page: Page, title: string) {
  await page.goto('/verwalten?neu=1')
  await page.getByLabel('Titel').fill(title)
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByRole('link').filter({ hasText: title }).click()
  await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible()
}

test('Set umbenennen', async ({ page }) => {
  const title = `Zz E2E Umbenennen ${Date.now()}`
  const renamed = `${title} neu`
  await createAndOpenSet(page, title)

  const trigger = page.getByRole('button', { name: 'Umbenennen' })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Set umbenennen' })
  const field = dialog.getByLabel('Titel')
  await expect(field).toBeFocused()
  await expect(field).toHaveValue(title)
  await field.fill(renamed)
  await field.press('Enter')

  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 2, name: renamed })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Der neue Titel ist gespeichert.' })).toBeVisible()
  await expect(trigger).toBeFocused()
  await page.goto('/verwalten')
  await expect(page.getByRole('link').filter({ hasText: renamed })).toBeVisible()
})

test('Set löschen', async ({ page }) => {
  const title = `Zz E2E Löschen ${Date.now()}`
  await createAndOpenSet(page, title)
  await page.getByLabel('Deutsch', { exact: true }).fill('Hund')
  await page.getByLabel('Englisch', { exact: true }).fill('dog')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await expect(page.getByText('Hund → dog')).toBeVisible()

  const trigger = page.getByRole('button', { name: 'Set löschen' })
  const dialog = page.getByRole('alertdialog', { name: `Set „${title}“ löschen?` })
  await trigger.click()
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAccessibleDescription(
    'Alle Vokabeln dieses Sets und der Lernstand aller Kinder dazu werden gelöscht. Das lässt sich nicht rückgängig machen.',
  )
  await expect(dialog.getByRole('button', { name: 'Abbrechen' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible()
  await expect(trigger).toBeFocused()

  await trigger.click()
  await dialog.getByRole('button', { name: 'Endgültig löschen' }).click()
  await expect(page).toHaveURL(/\/verwalten$/)
  await expect(page.getByRole('status').filter({ hasText: `Das Set „${title}“ ist gelöscht.` })).toBeVisible()
  await expect(page.getByRole('link').filter({ hasText: title })).toHaveCount(0)
})

// D-09: beide Dialoge offen (Umbenennen mit Fehlertext) und die Set-Liste mit Erfolgsmeldung.
test('Set-Dialoge barrierefrei', async ({ page }) => {
  const title = `Zz E2E Barrierefrei ${Date.now()}`
  await createAndOpenSet(page, title)
  await checkPage(page)

  await page.getByRole('button', { name: 'Umbenennen' }).click()
  const rename = page.getByRole('dialog', { name: 'Set umbenennen' })
  await rename.getByLabel('Titel').fill('')
  await rename.getByRole('button', { name: 'Speichern' }).click()
  await expect(rename.getByText('Ein Set braucht einen Titel.')).toBeVisible()
  await expectNoAxeViolations(page)
  await expectDialogContrast(page)
  await page.keyboard.press('Escape')
  await expect(rename).toHaveCount(0)

  await page.getByRole('button', { name: 'Set löschen' }).click()
  const confirm = page.getByRole('alertdialog', { name: `Set „${title}“ löschen?` })
  await expect(confirm).toBeVisible()
  await expectNoAxeViolations(page)
  await expectDialogContrast(page)
  await confirm.getByRole('button', { name: 'Endgültig löschen' }).click()

  await expect(page).toHaveURL(/\/verwalten$/)
  await expect(page.getByRole('status').filter({ hasText: `Das Set „${title}“ ist gelöscht.` })).toBeVisible()
  await checkPage(page)
})

// Text bricht um statt abgeschnitten zu werden, kein waagerechtes Scrollen (WCAG 1.4.10).
async function expectWraps(page: Page, locator: Locator, text: string) {
  await expect(locator).toBeVisible()
  expect(await locator.textContent()).toBe(text)
  expect(await locator.evaluate((element) => element.scrollWidth <= element.clientWidth), text).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
}

// Unguenstigster Fall (UI-SPEC long-text): 200 Zeichen ohne Leerzeichen in Kopf, Dialogtitel und Erfolgsmeldung.
test('Langer Set-Titel bei 320 px', async ({ page }) => {
  const stamp = `ZzE2E${Date.now()}`
  const long = stamp + 'x'.repeat(200 - stamp.length)
  await createAndOpenSet(page, `Zz E2E Lang ${Date.now()}`)
  await page.getByRole('button', { name: 'Umbenennen' }).click()
  await page.getByLabel('Titel').fill(long)
  await page.getByLabel('Titel').press('Enter')
  const heading = page.getByRole('heading', { level: 2, name: long })
  await expect(heading).toBeVisible()

  await page.setViewportSize({ width: 320, height: 568 })
  await expectWraps(page, heading, long)
  await page.getByRole('button', { name: 'Set löschen' }).click()
  const dialog = page.getByRole('alertdialog', { name: `Set „${long}“ löschen?` })
  await expectWraps(page, dialog.getByRole('heading', { level: 2 }), `Set „${long}“ löschen?`)
  await dialog.getByRole('button', { name: 'Endgültig löschen' }).click()
  await expect(page).toHaveURL(/\/verwalten$/)
  await expectWraps(page, page.getByRole('status').filter({ hasText: 'ist gelöscht.' }), `Das Set „${long}“ ist gelöscht.`)
})

test('Fortschritt: axe 0', async ({ page }) => {
  await page.goto('/verwalten/fortschritt')
  await expect(page.getByText(/^Level \d+$/)).toBeVisible()
  await checkPage(page)
})

// WCAG 1.4.10 mit dem unguenstigsten Inhalt: ein langes Wort ohne Trennstelle als
// Set-Titel, Vokabel und Kindername. Die API-Antwort wird nur im Feld ersetzt.
const longWord = 'Donaudampfschifffahrtsgesellschaftskapitaensmuetze'

type Items = Record<string, unknown>[]

async function rewrite(page: Page, url: RegExp, change: (items: Items) => Items) {
  await page.route(url, async (route) => {
    const response = await route.fetch()
    await route.fulfill({ response, json: change((await response.json()) as Items) })
  })
}

test.describe(() => {
  // Antworten ueber den Service Worker (localhost ist ein sicherer Kontext) sieht
  // page.route nicht; ohne Worker geht jede Anfrage durch die Umschreibung.
  test.use({ serviceWorkers: 'block' })

  test('Reflow bei 320 px mit langem Wort ohne Trennstelle', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    const first = (field: string) => (items: Items) =>
      items.map((item, index) => (index === 0 ? { ...item, [field]: longWord } : item))
    await rewrite(page, /\/api\/v1\/sets$/, first('title'))
    await rewrite(page, /\/api\/v1\/sets\/[^/]+\/entries$/, first('sourceText'))
    // Namen stehen erst ab zwei Kindern als Auswahl da: ein zweites Kind anhaengen.
    await rewrite(page, /\/api\/v1\/learners$/, (items) => [
      ...items,
      { ...items[0], id: '00000000-0000-0000-0000-000000000001', displayName: longWord },
    ])
    for (const path of ['/verwalten', 'set', '/verwalten/fortschritt']) {
      if (path === 'set') await page.locator('main a[href^="/verwalten/sets/"]').first().click()
      else await page.goto(path)
      const word = page.getByText(longWord, { exact: false }).first()
      await expect(word, path).toBeVisible()
      // Das Wort selbst bricht um, statt nur unsichtbar abgeschnitten zu werden.
      const fits = await word.evaluate((element) => element.scrollWidth <= element.clientWidth)
      expect(fits, `${path}: Wort bricht nicht um`).toBe(true)
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(scrollWidth, `${path}: waagerechter Scrollbalken`).toBeLessThanOrEqual(320)
    }
  })
})
