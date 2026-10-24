import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  // WR-05: Ladefehler von Uebersicht und Ampel stehen da, statt still zu fehlen.
  const childGone = 'Dieses Kind gibt es nicht (mehr).'
  function stubLoads(overview: () => Response, trafficLight: () => Response) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/overview')) return overview()
        if (url.endsWith('/traffic-light')) return trafficLight()
        return Response.json([{ id: 'kind-1', displayName: 'Mia', avatarKey: 'fox' }])
      }),
    )
  }

  it('Ladefehler der Übersicht zeigt den Fehler', async () => {
    stubLoads(() => new Response('', { status: 500 }), () => Response.json([]))
    renderWithProviders(<ProgressPage />, { route: '/verwalten/fortschritt', path: '/verwalten/fortschritt' })
    expect((await screen.findByRole('alert')).textContent).toBe('Das hat nicht geklappt. Versuche es noch einmal.')
  })

  it('Ampel 404 (Kind gelöscht) zeigt den Servertext statt einer Wortliste', async () => {
    stubLoads(
      () => Response.json({ level: 1, levelProgress: 0, streak: 0, dueToday: 0, newRemainingToday: 0, cardsMastered: 0, cardsTotal: 0 }),
      () => Response.json({ title: 'Nicht gefunden', detail: childGone }, { status: 404 }),
    )
    renderWithProviders(<ProgressPage />, { route: '/verwalten/fortschritt', path: '/verwalten/fortschritt' })
    expect((await screen.findByRole('alert')).textContent).toBe(childGone)
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
  // WCAG 2.2 SC 1.4.1: Die Auswahl darf nicht nur an der Farbe haengen.
  it('Gewähltes Kind trägt einen Haken, nicht nur eine Farbe (WCAG 1.4.1)', async () => {
    const overview = {
      level: 2,
      levelProgress: 0.5,
      streak: 0,
      dueToday: 4,
      newRemainingToday: 2,
      cardsMastered: 2,
      cardsTotal: 5,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/overview')) return Response.json(overview)
        if (url.endsWith('/traffic-light')) return Response.json([])
        return Response.json([
          { id: 'kind-1', displayName: 'Mia', avatarKey: 'fox' },
          { id: 'kind-2', displayName: 'Ben', avatarKey: 'fox' },
        ])
      }),
    )
    renderWithProviders(<ProgressPage />, { route: '/verwalten/fortschritt', path: '/verwalten/fortschritt' })

    const mia = await screen.findByRole('button', { name: 'Mia', pressed: true })
    expect(mia.querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Ben', pressed: false }).querySelector('svg')).toBeNull()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Ben' }))

    expect(screen.getByRole('button', { name: 'Ben', pressed: true }).querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Mia', pressed: false }).querySelector('svg')).toBeNull()
  })
})
