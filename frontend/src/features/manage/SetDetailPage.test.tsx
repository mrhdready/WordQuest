import { screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SetDetailPage } from '@/features/manage/SetDetailPage'
import { renderWithProviders } from '@/test/render'

afterEach(() => {
  vi.unstubAllGlobals()
})

// Ohne Daten (Laden, Fehler) keine leere Glas-Gruppe; ListGroup traegt divide-y.
it('Set-Detail zeigt beim Laden und nach einem Fehler keine leere Liste', async () => {
  // Beide Abfragen (/sets und /sets/{id}/entries) haengen, bis fail() sie beantwortet.
  const pending: ((response: Response) => void)[] = []
  const fail = () => pending.forEach((resolve) => resolve(new Response('', { status: 500 })))
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>((resolve) => pending.push(resolve))),
  )
  const { container } = renderWithProviders(<SetDetailPage />, {
    route: '/verwalten/sets/set-1',
    path: '/verwalten/sets/:setId',
  })
  await screen.findByRole('status')
  expect(container.querySelector('.divide-y')).toBeNull()

  expect(pending).toHaveLength(2)
  fail()
  await vi.waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  expect(container.querySelector('.divide-y')).toBeNull()
})
