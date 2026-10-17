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

  // Uebernommen aus manage.spec ("Fokus nicht verdeckt bei 640 px"): die lange Set-Liste
  // reicht bei dieser Hoehe unter die Leiste, mindestens ein Ziel muss erst ins Bild rollen.
  test('/verwalten?neu=1', async ({ page }) => {
    await page.goto('/verwalten?neu=1')
    await expect(page.locator('main a[href^="/verwalten/sets/"]').first()).toBeVisible()
    const steps = await expectKeyboardAtZoom(page, '/verwalten?neu=1')
    expect(steps.some((step) => step.startedBelowFold), 'kein Ziel lag anfangs unter dem Bild').toBe(true)
  })
})
