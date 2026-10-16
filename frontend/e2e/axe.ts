import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Tags laut UI-SPEC "axe-Lauf" (WCAG 2.2 AA als Untergrenze).
const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

export async function expectNoAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(wcagTags).analyze()
  expect(result.violations).toEqual([])

  // Glas liegt auf Radialverlaeufen: axe stuft Kontrast dort als "incomplete"
  // ein statt als Verstoss (RESEARCH Pitfall 3). Ausweisen, nicht scheitern.
  const contrastIncomplete = result.incomplete.filter((entry) => entry.id === 'color-contrast')
  const bestPractice = await new AxeBuilder({ page }).withTags(['best-practice']).analyze()
  test.info().annotations.push(
    {
      type: 'axe incomplete color-contrast',
      description: String(contrastIncomplete.reduce((sum, entry) => sum + entry.nodes.length, 0)),
    },
    { type: 'axe best-practice violations', description: String(bestPractice.violations.length) },
  )
}

// Unguenstigster Fall fuer Text auf Glas: jede Backdrop-Farbe einzeln und einfarbig,
// denn auf Verlaeufen meldet axe nur "incomplete" (D-19, RESEARCH Pitfall 3).
const backdropColors = ['base', 'blue', 'cyan', 'pink', 'yellow']

export async function expectGlassContrast(page: Page) {
  for (const color of backdropColors) {
    // CSSOM statt <style>-Tag: bleibt unter der strengen CSP erlaubt.
    await page.evaluate((name) => {
      document.body.style.backgroundImage = 'none'
      document.body.style.backgroundColor = `var(--color-backdrop-${name})`
    }, color)
    const result = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
    expect(result.violations, `color-contrast auf backdrop-${color}`).toEqual([])
    const incomplete = result.incomplete.reduce((sum, entry) => sum + entry.nodes.length, 0)
    test.info().annotations.push({
      type: `axe incomplete color-contrast backdrop-${color}`,
      description: String(incomplete),
    })
  }
  await page.evaluate(() => {
    document.body.style.backgroundImage = ''
    document.body.style.backgroundColor = ''
  })
}

// Alle Glas-Utilities, auch die blur-freien (exakte Klassennamen, keine Farbklassen).
const glassUtilities = [
  'glass',
  'glass-clear',
  'glass-sheet',
  'glass-selected',
  'glass-flat',
  'glass-flat-clear',
  'glass-flat-selected',
]

// Pflicht-Fallback aus DESIGN.md: bei reduzierter Transparenz deckend, ohne Blur.
export async function expectOpaqueFallback(page: Page) {
  // page.emulateMedia kennt prefers-reduced-transparency nicht, CDP schon.
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
  })
  const surfaces = await page.evaluate((classes) => {
    const probe = document.createElement('div')
    probe.style.backgroundColor = 'var(--color-glass-opaque)'
    document.body.append(probe)
    const opaque = getComputedStyle(probe).backgroundColor
    probe.remove()
    return [...document.querySelectorAll<HTMLElement>('[class]')]
      .filter((element) => classes.some((name) => element.classList.contains(name)))
      .map((element) => {
        const style = getComputedStyle(element)
        return {
          classes: element.className,
          backdropFilter: style.backdropFilter,
          backgroundColor: style.backgroundColor,
          opaque,
        }
      })
  }, glassUtilities)
  expect(surfaces.length).toBeGreaterThan(0)
  for (const surface of surfaces) {
    expect(surface.backdropFilter, surface.classes).toBe('none')
    expect(surface.backgroundColor, surface.classes).toBe(surface.opaque)
  }
  await expectNoAxeViolations(page)
  await cdp.send('Emulation.setEmulatedMedia', { features: [] })
  await cdp.detach()
}

// WCAG 1.4.10: bei 320 CSS-px kein horizontales Scrollen.
export async function expectReflow(page: Page) {
  const original = page.viewportSize()
  await page.setViewportSize({ width: 320, height: original?.height ?? 720 })
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth).toBeLessThanOrEqual(320)
  if (original) await page.setViewportSize(original)
}

export async function checkPage(page: Page) {
  await expectNoAxeViolations(page)
  await expectGlassContrast(page)
  await expectOpaqueFallback(page)
  await expectReflow(page)
}
