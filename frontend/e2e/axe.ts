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

export async function checkPage(page: Page) {
  await expectNoAxeViolations(page)
}
