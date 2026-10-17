import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProgressPage } from '@/features/manage/ProgressPage'
import { renderWithProviders } from '@/test/render'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Fortschritt', () => {
  // Ladefehler ist nicht "gibt es nicht" (WR-03).
  it('Ladefehler der Kinderliste zeigt den Fehler statt "Noch kein Kinderprofil"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))
    renderWithProviders(<ProgressPage />, { route: '/verwalten/fortschritt', path: '/verwalten/fortschritt' })
    expect((await screen.findByRole('alert')).textContent).toBe('Das hat nicht geklappt. Versuche es noch einmal.')
    expect(screen.queryByText('Noch kein Kinderprofil')).toBeNull()
  })

  // FIX-05/FIX-06: Texte zu den Serverwerten (UI-SPEC zero-one-many).
  function stubOverview(streak: number) {
    const routes: Record<string, unknown> = {
      '/learners': [{ id: 'kind-1', displayName: 'Mia', avatarKey: 'fox' }],
      '/learners/kind-1/overview': {
        level: 2,
        levelProgress: 0.5,
        streak,
        dueToday: 4,
        newRemainingToday: 2,
        cardsMastered: 2,
        cardsTotal: 5,
      },
      '/learners/kind-1/traffic-light': [],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const match = Object.keys(routes).find((path) => url.endsWith(path))
        return match ? Response.json(routes[match]) : new Response('', { status: 500 })
      }),
    )
  }

  it.each([
    [0, 'Keine laufende Serie'],
    [1, '🔥 1 Tag'],
    [4, '🔥 4 Tage'],
  ])('Serie %i zeigt "%s"', async (streak, text) => {
    stubOverview(streak)
    renderWithProviders(<ProgressPage />, { route: '/verwalten/fortschritt', path: '/verwalten/fortschritt' })
    expect(await screen.findByText(text, { exact: true })).toBeTruthy()
  })

  it('Kennzahl "2/5" mit Beschriftung "Wörter sitzen sicher"', async () => {
    stubOverview(1)
    renderWithProviders(<ProgressPage />, { route: '/verwalten/fortschritt', path: '/verwalten/fortschritt' })
    const value = await screen.findByText('2/5')
    expect(value.parentElement?.textContent).toBe('2/5Wörter sitzen sicher')
  })
})
