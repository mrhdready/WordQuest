import { expect, test } from '@playwright/test'
import { checkPage } from './axe'

// Zugang aus DemoDataSeeder (Teststack laeuft mit WQ_SEED_DEMO_DATA).
const demoEmail = 'demo@wordquest.local'
const demoPassword = 'demo1234'

test('Login: Token-Design, axe 0, Anmeldung per Enter', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible()

  const design = await page.evaluate(() => {
    const body = getComputedStyle(document.body)
    return {
      fontFamily: body.fontFamily,
      backgroundImage: body.backgroundImage,
      primary: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
    }
  })
  expect(design.fontFamily.startsWith('-apple-system')).toBe(true)
  expect(design.backgroundImage).toContain('radial-gradient')
  // Exportwert von primary aus DESIGN.md (src/design-tokens.css).
  expect(design.primary).toBe('#274fbe')

  await checkPage(page)

  // Genau eine Anmeldung: Rate-Limit "auth" erlaubt 10 pro Minute.
  await page.getByLabel('E-Mail').fill(demoEmail)
  await page.getByLabel('Passwort').fill(demoPassword)
  await page.getByLabel('Passwort').press('Enter')
  await expect(page).toHaveURL(/\/verwalten$/)
})

test('Login: Tastatur mit sichtbarem Fokus', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible()

  const expected = [
    page.getByLabel('E-Mail'),
    page.getByLabel('Passwort'),
    page.getByRole('button', { name: 'Anmelden' }),
  ]
  for (const target of expected) {
    await page.keyboard.press('Tab')
    await expect(target).toBeFocused()
    const outline = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element)
      return { style: style.outlineStyle, width: style.outlineWidth }
    })
    expect(outline).toEqual({ style: 'solid', width: '3px' })
  }
})
