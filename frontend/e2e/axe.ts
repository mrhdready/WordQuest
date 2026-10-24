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
    // Ohne Seitenverlauf darf "incomplete" nur noch von getoenten Buttons kommen
    // (eigener Verlauf, Kontrast per Token belegt). Jeder andere Grund heisst:
    // axe hat nicht gemessen, also scheitern statt still gruen.
    const incomplete = result.incomplete.flatMap((entry) => entry.nodes)
    const unmeasured = incomplete
      .map((node) => ({ target: node.target.join(' '), reason: node.any[0]?.data?.messageKey }))
      .filter((node) => node.reason !== 'bgGradient')
    expect(unmeasured, `nicht gemessener Kontrast auf backdrop-${color}`).toEqual([])
    test.info().annotations.push({
      type: `axe incomplete color-contrast backdrop-${color}`,
      description: String(incomplete.length),
    })
  }
  await page.evaluate(() => {
    document.body.style.backgroundImage = ''
    document.body.style.backgroundColor = ''
  })
}

// Offener Dialog (Dialog und ConfirmDialog tragen aria-modal). Hinter dem Sheet liegt
// je Textzeile anderer Seiteninhalt; axe misst dann nicht ("elmPartiallyObscuring"). Gemessen wird deshalb der Dialog allein: ueber jeder
// Backdrop-Farbe und ueber primary-deep, der dunkelsten Flaeche der Seite darunter.
export async function expectDialogContrast(page: Page) {
  await page.evaluate(() => document.getElementById('root')?.style.setProperty('visibility', 'hidden'))
  await expectGlassContrast(page)
  await page.evaluate(() => {
    document.body.style.backgroundImage = 'none'
    document.body.style.backgroundColor = 'var(--color-primary-deep)'
  })
  const result = await new AxeBuilder({ page }).include('[aria-modal="true"]').withRules(['color-contrast']).analyze()
  expect(result.violations, 'color-contrast ueber primary-deep').toEqual([])
  // Wie in expectGlassContrast: nur getoente Buttons (eigener Verlauf, z. B. "Speichern") duerfen offen bleiben.
  const unmeasured = result.incomplete
    .flatMap((entry) => entry.nodes)
    .filter((node) => node.any[0]?.data?.messageKey !== 'bgGradient')
    .map((node) => node.target.join(' '))
  expect(unmeasured, 'nicht gemessener Kontrast ueber primary-deep').toEqual([])
  expect(result.passes.flatMap((entry) => entry.nodes).length).toBeGreaterThan(0)
  await page.evaluate(() => {
    document.body.style.backgroundImage = ''
    document.body.style.backgroundColor = ''
    document.getElementById('root')?.style.removeProperty('visibility')
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
    // Bedienelemente mit "transition" blenden Blur und Flaeche ueber: gemessen
    // wird der Endzustand, den man sieht, nicht der erste Frame des Uebergangs.
    // Nur Uebergaenge: finish() auf endlosen Animationen (Spinner) wirft InvalidStateError.
    for (const animation of document.getAnimations()) {
      if (animation instanceof CSSTransition) animation.finish()
    }
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
  // Am Seitenende steht die schwebende Tab-Leiste ueber dem Innenabstand von <main>,
  // also ueber Leerraum. Weiter oben verdeckt sie je nach Scrollposition Ziele, die
  // man per Scrollen frei bekommt; axe target-size misst nur die aktuelle Lage.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  // Einblend-Animationen (animate-pop) abwarten: mitten im Uebergang misst axe den
  // halbtransparenten Zwischenstand. Endlose Animationen (Spinner) zaehlen nicht.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== 'running' ||
          animation.effect?.getTiming().iterations === Infinity,
      ),
  )
  await expectNoAxeViolations(page)
  await expectGlassContrast(page)
  await expectOpaqueFallback(page)
  await expectReflow(page)
}
