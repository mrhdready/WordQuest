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
      }
    })
    if (!step) break
    steps.push(step)
  }
  return steps
}

// WCAG 2.4.11: kein per Tab fokussiertes Element liegt unter der schwebenden Leiste.
async function expectFocusNotObscured(page: Page) {
  await page.setViewportSize({ width: 320, height: 568 })
  const steps = await walkTabOrder(page)
  expect(steps.length).toBeGreaterThan(0)
  for (const step of steps.filter((entry) => !entry.inBar)) {
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
  await page.goto('/verwalten')
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
