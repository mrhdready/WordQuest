import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '@/App'
import { tokenStore } from '@/lib/api'
import type { AuthResponse } from '@/types'

const expired = JSON.stringify({
  title: 'Unauthorized',
  detail: 'Sitzung abgelaufen. Bitte neu anmelden.',
})

const guardian: AuthResponse = {
  accessToken: 'a1',
  refreshToken: 'r1',
  expiresInSeconds: 900,
  user: { id: 'g1', displayName: 'Mama', role: 'Owner', tenantId: 't1' },
}

function renderAppAt(path: string) {
  window.history.pushState({}, '', path)
  return render(<App />)
}

afterEach(() => {
  vi.unstubAllGlobals()
  tokenStore.clear()
})

// D-07: Die Oberflaeche folgt dem Speicher, nicht nur dem Stand beim Start.
describe('Sitzungsende zeigt die Anmeldung', () => {
  it('Refresh 401 in /verwalten: Anmeldung ohne Neuladen, Tokens weg', async () => {
    tokenStore.save(guardian)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(expired, { status: 401 })),
    )
    renderAppAt('/verwalten')

    expect(await screen.findByRole('heading', { name: 'Anmelden' })).toBeTruthy()
    expect(tokenStore.refresh).toBeNull()
  })

  it('anderer Tab leert den Speicher: Anmeldung ohne Neuladen', async () => {
    tokenStore.save(guardian)
    // Anfragen bleiben offen: Der Fall prueft nur das storage-Ereignis.
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    renderAppAt('/verwalten')
    expect(await screen.findByRole('button', { name: 'Abmelden' })).toBeTruthy()

    localStorage.clear()
    window.dispatchEvent(new StorageEvent('storage', { key: 'wq.user' }))

    expect(await screen.findByRole('heading', { name: 'Anmelden' })).toBeTruthy()
  })

  it('Anmelden setzt den Nutzer sofort', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/auth/login')
          ? new Response(JSON.stringify(guardian), { status: 200 })
          : new Promise<Response>(() => {}),
      ),
    )
    renderAppAt('/login')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('E-Mail'), 'mama@example.org')
    await user.type(screen.getByLabelText('Passwort'), 'geheim12345')
    await user.click(screen.getByRole('button', { name: 'Anmelden' }))

    expect(await screen.findByText('Mama')).toBeTruthy()
    expect(window.location.pathname).toBe('/verwalten')
  })
})
