import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProfilePickerPage } from '@/features/auth/ProfilePickerPage'
import { AuthProvider } from '@/lib/auth'
import { renderWithProviders } from '@/test/render'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Profilwahl', () => {
  // Kind am Tablet: kein Neuladen noetig, um nach einem Ausfall weiterzukommen (UI-Review Top 1).
  it('Ladefehler nennt den Vertragstext, "Noch einmal" lädt neu', async () => {
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ++calls === 1
          ? new Response('', { status: 500 })
          : Response.json([{ id: 'kind-1', displayName: 'Mia', avatarKey: 'fox' }]),
      ),
    )
    renderWithProviders(
      <AuthProvider>
        <ProfilePickerPage />
      </AuthProvider>,
    )
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Der Server ist gerade nicht erreichbar. Prüfe die Verbindung und versuche es noch einmal.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Noch einmal' }))
    const tile = await screen.findByRole('button', { name: /Mia/ })
    await waitFor(() => expect(document.activeElement).toBe(tile))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(calls).toBe(2)
  })
})
