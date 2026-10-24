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

  // FIX-04: ein noch angemeldetes Geraet eines geloeschten Kindes bekommt einen lesbaren Hinweis.
  it('Gelöschtes Profil: 404 der Übersicht zeigt den Servertext', async () => {
    const profileGone = 'Dieses Profil gibt es nicht mehr. Bitte melde dich ab.'
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/learners/kind-1/overview')
          ? Response.json({ title: 'Nicht gefunden', detail: profileGone }, { status: 404 })
          : Response.json([{ id: 'set-1', title: 'Tiere', entryCount: 5 }]),
      ),
    )
    render()
    expect((await screen.findByRole('alert')).textContent).toBe(profileGone)
  })
})

// FIX-05/FIX-06: Texte zu den Serverwerten, das Frontend rechnet nichts nach (UI-SPEC zero-one-many).
describe('Lern-Startseite: Serie und sicher gelernte Wörter', () => {
  const sets = [{ id: 'set-1', title: 'Tiere', entryCount: 5 }]

  async function renderWith(values: Partial<typeof overview>) {
    stubFetch({ '/learners/kind-1/overview': { ...overview, ...values }, '/sets': sets })
    render()
    await screen.findByText('Level 2')
  }

  it('Serie 0 zeigt "Starte heute deine Serie!" ohne Flamme', async () => {
    await renderWith({ streak: 0 })
    expect(screen.getByText('Starte heute deine Serie!').querySelector('svg')).toBeNull()
  })

  it.each([
    [1, '1 Tag'],
    [3, '3 Tage'],
  ])('Serie %i zeigt "%s" mit Flamme', async (streak, text) => {
    await renderWith({ streak })
    expect(screen.getByText(text).querySelector('svg')).not.toBeNull()
    expect(screen.queryByText('Starte heute deine Serie!')).toBeNull()
  })

  it.each([
    [0, 0, 'Sicher gelernt: 0 von 0 Wörtern'],
    [0, 1, 'Sicher gelernt: 0 von 1 Wort'],
    [2, 5, 'Sicher gelernt: 2 von 5 Wörtern'],
  ])('Wörter %i/%i zeigt "%s"', async (cardsMastered, cardsTotal, text) => {
    await renderWith({ cardsMastered, cardsTotal })
    expect(screen.getByText(text, { exact: true })).toBeTruthy()
  })
})
