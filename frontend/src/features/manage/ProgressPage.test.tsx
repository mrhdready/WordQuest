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
})
