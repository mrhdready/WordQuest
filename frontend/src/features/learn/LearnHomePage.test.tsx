import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LearnHomePage } from '@/features/learn/LearnHomePage'
import { AuthProvider } from '@/lib/auth'
import { renderWithProviders } from '@/test/render'

const generic = 'Das hat nicht geklappt. Versuche es noch einmal.'

const overview = {
  displayName: 'Mia',
  level: 2,
  levelProgress: 0.5,
  xpToNextLevel: 40,
  streak: 1,
  coins: 3,
  cardsMastered: 1,
  cardsTotal: 10,
  dueToday: 4,
  newRemainingToday: 2,
}

// Antwortet je Pfad; was fehlt, scheitert mit 500.
function stubFetch(routes: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const match = Object.keys(routes).find((path) => url.endsWith(path))
      return match ? Response.json(routes[match]) : new Response('', { status: 500 })
    }),
  )
}

function render() {
  renderWithProviders(
    <AuthProvider>
      <LearnHomePage />
    </AuthProvider>,
  )
}

beforeEach(() => {
  localStorage.setItem('wq.user', JSON.stringify({ id: 'kind-1', displayName: 'Mia', role: 'Learner', tenantId: 't' }))
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

// Ladefehler ist nicht "gibt es nicht" (WR-03).
describe('Lern-Startseite', () => {
  it('Ladefehler der Sets zeigt den Fehler statt "Noch keine Vokabeln da"', async () => {
    stubFetch({ '/learners/kind-1/overview': overview })
    render()
    expect((await screen.findByRole('alert')).textContent).toBe(generic)
    expect(screen.queryByText('Noch keine Vokabeln da')).toBeNull()
  })

  it('Ladefehler der Übersicht zeigt den Fehler statt "0 Karten fällig"', async () => {
    stubFetch({ '/sets': [{ id: 'set-1', title: 'Tiere', entryCount: 5 }] })
    render()
    expect((await screen.findByRole('alert')).textContent).toBe(generic)
    expect(screen.queryByText('0 Karten fällig')).toBeNull()
  })
})
