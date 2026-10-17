import { expect, test, type Page } from '@playwright/test'
import { guardianStorageState } from './global-setup'

// Ersetzt den manuellen Tastatur-Durchgang bei 200 % Zoom (UI-Review Top 2):
// 640 x 400 CSS-px entsprechen 1280 x 800 bei 200 %. Je Seite kein waagerechter
// Scrollbalken (WCAG 1.4.10) und per Tab jedes Ziel im Bild, nicht verdeckt
// (2.4.11, auch nicht von der schwebenden Tab-Leiste) und mit sichtbarem Fokus (2.4.7).
const zoomed = { width: 640, height: 400 }

interface FocusStep {
  name: string
  inViewport: boolean
  covered: boolean
  outline: string
  startedBelowFold: boolean
}

// Tab vom Seitenanfang, bis der Fokus die Seite verlaesst oder wieder vorn ankommt.
async function walkFocus(page: Page): Promise<FocusStep[]> {
  await page.evaluate(() => {
    window.scrollTo(0, 0)
    // Wie bisher in manage.spec: Unterkante unter der schwebenden Leiste bzw. dem Bildrand.
    const bar = document.querySelector('nav[aria-label="Bereiche"]')?.parentElement
    const fold = Math.min(bar?.getBoundingClientRect().top ?? window.innerHeight, window.innerHeight)
    for (const element of document.querySelectorAll('body *')) {
      if (element.getBoundingClientRect().bottom > fold) element.setAttribute('data-below-fold', '')
    }
  })
  const steps: FocusStep[] = []
  const seen = new Set<string>()
  for (let index = 0; index < 80; index += 1) {
    await page.keyboard.press('Tab')
    const step = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null
      if (!element || element === document.body) return null
      if (!element.dataset.focusKey) element.dataset.focusKey = String(Math.random())
      const rect = element.getBoundingClientRect()
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      const label = element.id ? document.querySelector(`label[for="${element.id}"]`) : null
      return {
        key: element.dataset.focusKey,
        name: (element.getAttribute('aria-label') ?? label?.textContent ?? element.textContent ?? '').trim(),
        inViewport:
          rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth,
        covered: !hit || !element.contains(hit),
        outline: `${getComputedStyle(element).outlineStyle} ${getComputedStyle(element).outlineWidth}`,
        startedBelowFold: element.hasAttribute('data-below-fold'),
      }
    })
    if (!step || seen.has(step.key)) break
    seen.add(step.key)
    const { key: _key, ...rest } = step
    steps.push(rest)
  }
  return steps
}

async function expectKeyboardAtZoom(page: Page, path: string) {
  const width = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(width.scroll, `${path}: waagerechter Scrollbalken`).toBeLessThanOrEqual(width.client)

  const steps = await walkFocus(page)
  expect(steps.length, `${path}: nichts per Tab erreichbar`).toBeGreaterThan(0)
  test.info().annotations.push({ type: `Tab-Ziele ${path}`, description: String(steps.length) })
  for (const step of steps) {
    expect(step.inViewport, `${path}: "${step.name}" ausserhalb des Bildes`).toBe(true)
    expect(step.covered, `${path}: "${step.name}" verdeckt`).toBe(false)
    expect(step.outline, `${path}: "${step.name}" ohne sichtbaren Fokus`).not.toMatch(/^none | 0px$/)
  }
  return steps
}

test.describe('ohne Anmeldung', () => {
  test.use({ storageState: { cookies: [], origins: [] }, viewport: zoomed })

  test('/login', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible()
    await expectKeyboardAtZoom(page, '/login')
  })

  test('Profilwahl /', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Wer lernt heute?' })).toBeVisible()
    await expect(page.locator('main button').first()).toBeVisible()
    await expectKeyboardAtZoom(page, '/')
  })
})

test.describe('Elternbereich', () => {
  test.use({ storageState: guardianStorageState, viewport: zoomed })

  test('/verwalten/konto, Enter sendet das Formular', async ({ page }) => {
    await page.goto('/verwalten/konto')
    await expect(page.getByRole('heading', { name: 'Passwort ändern' })).toBeVisible()
    await expectKeyboardAtZoom(page, '/verwalten/konto')

    // Enter im leeren Formular: Client-Pruefung greift, Fokus aufs erste Fehlerfeld.
    await page.getByLabel('Aktuelles Passwort').press('Enter')
    await expect(page.getByText('Bitte gib dein aktuelles Passwort ein.')).toBeVisible()
    await expect(page.getByLabel('Aktuelles Passwort')).toBeFocused()
  })

  test('/verwalten/kinder', async ({ page }) => {
    await page.goto('/verwalten/kinder')
    await expect(page.locator('main a[href^="/verwalten/kinder/"]').first()).toBeVisible()
    await expectKeyboardAtZoom(page, '/verwalten/kinder')
  })

  test('/verwalten/kinder/neu, Enter sendet das Formular', async ({ page }) => {
    await page.goto('/verwalten/kinder/neu')
    await expect(page.getByRole('heading', { name: 'Kind anlegen' })).toBeVisible()
    await expectKeyboardAtZoom(page, '/verwalten/kinder/neu')

    await page.getByLabel('Name').press('Enter')
    await expect(page.getByText('Wie soll das Kind heißen? Ein Spitzname genügt.')).toBeVisible()
    await expect(page.getByLabel('Name')).toBeFocused()
  })

  test('/verwalten/kinder/:id', async ({ page }) => {
    await page.goto('/verwalten/kinder')
    const first = page.locator('main a[href^="/verwalten/kinder/"]:not([href$="/neu"])').first()
    const href = await first.getAttribute('href')
    expect(href).toBeTruthy()
    await page.goto(href!)
    await expect(page.getByRole('heading', { name: 'Kind bearbeiten' })).toBeVisible()
    await expectKeyboardAtZoom(page, '/verwalten/kinder/:id')
  })

  // Eigenes Testkind ("Zz E2E" am Ende der sortierten Liste), am Schluss ueber den Dialog geloescht.
  test('Dialog Kind löschen bei 200 %', async ({ page }) => {
    const name = `Zz E2E Zoom ${Date.now()}`
    await page.goto('/verwalten/kinder/neu')
    await page.getByLabel('Name', { exact: true }).fill(name)
    await page.getByLabel('PIN', { exact: true }).fill('1593')
    await page.getByRole('button', { name: 'Kind anlegen' }).click()
    await page.getByRole('link', { name: new RegExp(name) }).click()
    await expect(page.getByRole('heading', { name: 'Kind bearbeiten' })).toBeVisible()

    const trigger = page.getByRole('button', { name: 'Kind löschen' })
    const dialog = page.getByRole('alertdialog', { name: `${name} löschen?` })
    const cancel = dialog.getByRole('button', { name: 'Abbrechen' })
    const confirm = dialog.getByRole('button', { name: 'Endgültig löschen' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(cancel).toBeFocused()

    // Sheet hoechstens Viewporthoehe minus 2 x sheet-inset (8 px), beide Buttons ganz im Bild.
    const box = await dialog.boundingBox()
    expect(box!.height).toBeLessThanOrEqual(zoomed.height - 16)
    await expect(cancel).toBeInViewport({ ratio: 1 })
    await expect(confirm).toBeInViewport({ ratio: 1 })

    const focusVisible = () =>
      page.evaluate(() => getComputedStyle(document.activeElement as HTMLElement).outlineStyle !== 'none')
    expect(await focusVisible(), 'Abbrechen ohne sichtbaren Fokus').toBe(true)
    await page.keyboard.press('Tab')
    await expect(confirm).toBeFocused()
    expect(await focusVisible(), 'Endgültig löschen ohne sichtbaren Fokus').toBe(true)
    await page.keyboard.press('Tab')
    await expect(cancel).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()

    // Enter auf dem Startfokus "Abbrechen" loescht nichts.
    await page.keyboard.press('Enter')
    await expect(cancel).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await page.goto('/verwalten/kinder')
    await expect(page.getByRole('main').getByText(name, { exact: true })).toBeVisible()

    await page.getByRole('link', { name: new RegExp(name) }).click()
    await page.getByRole('button', { name: 'Kind löschen' }).click()
    await expect(cancel).toBeFocused()

    // Mit Fehlertext (UI-SPEC overflow): Sheet bleibt im Bild, jeder Button per Tab ganz sichtbar.
    await page.route('**/api/v1/learners/*', (route) =>
      route.request().method() === 'DELETE' ? route.fulfill({ status: 500, body: '' }) : route.fallback(),
    )
    await confirm.click()
    await expect(dialog.getByRole('alert')).toHaveText('Das hat nicht geklappt. Versuche es noch einmal.')
    const withError = await dialog.boundingBox()
    expect(withError!.height).toBeLessThanOrEqual(zoomed.height - 16)
    expect(withError!.y).toBeGreaterThanOrEqual(8)
    // WR-03: der gesperrte Button gibt den Fokus an body ab; nach dem Fehler steht er von allein auf "Abbrechen".
    await expect(cancel).toBeFocused()
    await expect(cancel).toBeInViewport({ ratio: 1 })
    await page.keyboard.press('Tab')
    await expect(confirm).toBeFocused()
    await expect(confirm).toBeInViewport({ ratio: 1 })
    await page.unroute('**/api/v1/learners/*')

    await page.keyboard.press('Enter')
    await expect(page.getByRole('status').filter({ hasText: `${name} ist gelöscht.` })).toBeVisible()
  })

  // Eigenes Testset ("Zz E2E" am Ende der sortierten Liste), am Schluss ueber den Dialog geloescht.
  test('Dialoge der Set-Seite bei 200 %', async ({ page }) => {
    const title = `Zz E2E Zoom Set ${Date.now()}`
    await page.goto('/verwalten?neu=1')
    await page.getByLabel('Titel').fill(title)
    await page.getByRole('button', { name: 'Anlegen' }).click()
    await page.getByRole('link').filter({ hasText: title }).click()
    await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible()
    const focusVisible = () =>
      page.evaluate(() => getComputedStyle(document.activeElement as HTMLElement).outlineStyle !== 'none')

    // Umbenennen mit Fehlertext: Sheet im Bild, jeder Button per Tab ganz sichtbar, Fokus bleibt im Dialog.
    const rename = page.getByRole('button', { name: 'Umbenennen' })
    const renameDialog = page.getByRole('dialog', { name: 'Set umbenennen' })
    const field = renameDialog.getByLabel('Titel')
    await rename.focus()
    await page.keyboard.press('Enter')
    await expect(field).toBeFocused()
    await field.fill('')
    await field.press('Enter')
    await expect(renameDialog.getByText('Ein Set braucht einen Titel.')).toBeVisible()
    await expect(field).toBeFocused()
    const box = await renameDialog.boundingBox()
    expect(box!.height).toBeLessThanOrEqual(zoomed.height - 16)
    expect(box!.y).toBeGreaterThanOrEqual(8)
    for (const name of ['Abbrechen', 'Speichern']) {
      await page.keyboard.press('Tab')
      const button = renameDialog.getByRole('button', { name })
      await expect(button).toBeFocused()
      await expect(button).toBeInViewport({ ratio: 1 })
      expect(await focusVisible(), `${name} ohne sichtbaren Fokus`).toBe(true)
    }
    await page.keyboard.press('Tab')
    await expect(field).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(renameDialog).toHaveCount(0)
    await expect(rename).toBeFocused()

    // Set löschen: Startfokus "Abbrechen", Tab bleibt im Dialog, Enter auf "Abbrechen" loescht nichts.
    const trigger = page.getByRole('button', { name: 'Set löschen' })
    const dialog = page.getByRole('alertdialog', { name: `Set „${title}“ löschen?` })
    const cancel = dialog.getByRole('button', { name: 'Abbrechen' })
    const confirm = dialog.getByRole('button', { name: 'Endgültig löschen' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(cancel).toBeFocused()
    const sheet = await dialog.boundingBox()
    expect(sheet!.height).toBeLessThanOrEqual(zoomed.height - 16)
    await expect(cancel).toBeInViewport({ ratio: 1 })
    await expect(confirm).toBeInViewport({ ratio: 1 })
    expect(await focusVisible(), 'Abbrechen ohne sichtbaren Fokus').toBe(true)
    await page.keyboard.press('Tab')
    await expect(confirm).toBeFocused()
    expect(await focusVisible(), 'Endgültig löschen ohne sichtbaren Fokus').toBe(true)
    await page.keyboard.press('Tab')
    await expect(cancel).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible()

    await page.keyboard.press('Enter')
    await expect(cancel).toBeFocused()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status').filter({ hasText: `Das Set „${title}“ ist gelöscht.` })).toBeVisible()
  })

  // Eigenes Testset mit einer Vokabel, am Schluss ueber "Set löschen" entfernt.
  test('Dialoge der Vokabelzeile bei 200 %', async ({ page }) => {
    const title = `Zz E2E Zoom Vokabel ${Date.now()}`
    await page.goto('/verwalten?neu=1')
    await page.getByLabel('Titel').fill(title)
    await page.getByRole('button', { name: 'Anlegen' }).click()
    await page.getByRole('link').filter({ hasText: title }).click()
    await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible()
    await page.getByLabel('Deutsch', { exact: true }).fill('Hund')
    await page.getByLabel('Englisch', { exact: true }).fill('dog')
    await page.getByLabel('Englisch', { exact: true }).press('Enter')
    await expect(page.getByText('Hund → dog')).toBeVisible()
    const focusVisible = () =>
      page.evaluate(() => getComputedStyle(document.activeElement as HTMLElement).outlineStyle !== 'none')

    // Vokabel bearbeiten mit zwei Fehlertexten: Sheet im Bild, jeder Button per Tab ganz sichtbar.
    const edit = page.getByRole('button', { name: 'Hund bearbeiten' })
    const editDialog = page.getByRole('dialog', { name: 'Vokabel bearbeiten' })
    const german = editDialog.getByLabel('Deutsch')
    const english = editDialog.getByLabel('Englisch')
    await edit.focus()
    await page.keyboard.press('Enter')
    await expect(german).toBeFocused()
    await german.fill('')
    await english.fill('')
    await english.press('Enter')
    await expect(editDialog.getByText('Bitte gib das deutsche Wort ein.')).toBeVisible()
    await expect(editDialog.getByText('Bitte gib das englische Wort ein.')).toBeVisible()
    await expect(german).toBeFocused()
    const box = await editDialog.boundingBox()
    expect(box!.height).toBeLessThanOrEqual(zoomed.height - 16)
    expect(box!.y).toBeGreaterThanOrEqual(8)
    for (const name of ['Englisch', 'Abbrechen', 'Speichern']) {
      await page.keyboard.press('Tab')
      const target = name === 'Englisch' ? english : editDialog.getByRole('button', { name })
      await expect(target).toBeFocused()
      await expect(target).toBeInViewport({ ratio: 1 })
      expect(await focusVisible(), `${name} ohne sichtbaren Fokus`).toBe(true)
    }
    await page.keyboard.press('Tab')
    await expect(german).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(editDialog).toHaveCount(0)
    await expect(edit).toBeFocused()
    await expect(page.getByText('Hund → dog')).toBeVisible()

    // Vokabel löschen: Startfokus "Abbrechen", Tab bleibt im Dialog, Enter auf "Abbrechen" loescht nichts.
    const remove = page.getByRole('button', { name: 'Hund löschen' })
    const dialog = page.getByRole('alertdialog', { name: '„Hund“ löschen?' })
    const cancel = dialog.getByRole('button', { name: 'Abbrechen' })
    const confirm = dialog.getByRole('button', { name: 'Endgültig löschen' })
    await remove.focus()
    await page.keyboard.press('Enter')
    await expect(cancel).toBeFocused()
    expect((await dialog.boundingBox())!.height).toBeLessThanOrEqual(zoomed.height - 16)
    await expect(cancel).toBeInViewport({ ratio: 1 })
    await expect(confirm).toBeInViewport({ ratio: 1 })
    expect(await focusVisible(), 'Abbrechen ohne sichtbaren Fokus').toBe(true)
    await page.keyboard.press('Tab')
    await expect(confirm).toBeFocused()
    expect(await focusVisible(), 'Endgültig löschen ohne sichtbaren Fokus').toBe(true)
    await page.keyboard.press('Tab')
    await expect(cancel).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(dialog).toHaveCount(0)
    await expect(remove).toBeFocused()
    await expect(page.getByText('Hund → dog')).toBeVisible()

    // Aufraeumen: das Testset per Tastatur loeschen.
    await page.getByRole('button', { name: 'Set löschen' }).focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status').filter({ hasText: `Das Set „${title}“ ist gelöscht.` })).toBeVisible()
  })

  // Uebernommen aus manage.spec ("Fokus nicht verdeckt bei 640 px"): die lange Set-Liste
  // reicht bei dieser Hoehe unter die Leiste, mindestens ein Ziel muss erst ins Bild rollen.
  test('/verwalten?neu=1', async ({ page }) => {
    await page.goto('/verwalten?neu=1')
    await expect(page.locator('main a[href^="/verwalten/sets/"]').first()).toBeVisible()
    const steps = await expectKeyboardAtZoom(page, '/verwalten?neu=1')
    expect(steps.some((step) => step.startedBelowFold), 'kein Ziel lag anfangs unter dem Bild').toBe(true)
  })
})
