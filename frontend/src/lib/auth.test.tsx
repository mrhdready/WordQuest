import { render, screen } from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '@/App'
import { api, tokenStore } from '@/lib/api'
import { AuthProvider, useAuth } from '@/lib/auth'
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

// Pruefkomponente am echten AuthProvider: zeigt den Nutzer und loest Anfragen aus.
function Probe() {
  const { user, logout, loginAsGuardian } = useAuth()
  const [loaded, setLoaded] = useState(false)
  return (
    <>
      <p>{user?.displayName ?? 'abgemeldet'}</p>
      {loaded ? <p>geladen</p> : null}
      <button
        onClick={() =>
          void api('/probe')
            .catch(() => undefined)
            .finally(() => setLoaded(true))
        }
      >
        Laden
      </button>
      <button onClick={() => void logout()}>Abmelden</button>
      <button
        onClick={() => void loginAsGuardian('mama@example.org', 'geheim12345').catch(() => undefined)}
      >
        Anmelden
      </button>
    </>
  )
}

function renderProbe() {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
  return userEvent.setup()
}

const rotated: AuthResponse = { ...guardian, accessToken: 'a2', refreshToken: 'r2' }

// D-05: Abmelden ist endgueltig, auch gegen eine Refresh-Antwort, die spaeter eintrifft.
describe('Abmelden ist endgueltig', () => {
  it('Refresh-Antwort nach dem Abmelden speichert nichts', async () => {
    tokenStore.save(guardian)
    let answerRefresh: (response: Response) => void = () => {}
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/auth/refresh'))
        return new Promise<Response>((resolve) => (answerRefresh = resolve))
      if (url.endsWith('/auth/logout')) return Promise.resolve(new Response(null, { status: 204 }))
      return Promise.resolve(new Response(expired, { status: 401 }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = renderProbe()

    await user.click(screen.getByRole('button', { name: 'Laden' }))
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/auth/refresh'))).toBe(true),
    )
    await user.click(screen.getByRole('button', { name: 'Abmelden' }))
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/auth/logout'))).toBe(true),
    )
    answerRefresh(new Response(JSON.stringify(rotated), { status: 200 }))

    // Erst wenn die Anfrage samt Refresh-Antwort fertig ist, den Speicher pruefen.
    expect(await screen.findByText('geladen')).toBeTruthy()
    expect(tokenStore.refresh).toBeNull()
    expect(tokenStore.access).toBeNull()
    expect(tokenStore.rawUser).toBeNull()
    expect(screen.getByText('abgemeldet')).toBeTruthy()
  })
})

// D-15: Sitzungsende und neue Anmeldung leeren den API-Cache des Service Workers.
describe('Cache wq-api', () => {
  function stubCaches() {
    const refreshAtDelete: (string | null)[] = []
    const remove = vi.fn(async (_name: string) => {
      refreshAtDelete.push(tokenStore.refresh)
      return true
    })
    vi.stubGlobal('caches', { delete: remove })
    return { remove, refreshAtDelete }
  }

  it('Abmelden loescht wq-api', async () => {
    tokenStore.save(guardian)
    const { remove } = stubCaches()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    const user = renderProbe()
    await user.click(screen.getByRole('button', { name: 'Abmelden' }))
    await screen.findByText('abgemeldet')
    expect(remove).toHaveBeenCalledWith('wq-api')
  })

  it('Refresh 401 loescht wq-api', async () => {
    tokenStore.save(guardian)
    const { remove } = stubCaches()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(expired, { status: 401 })))
    const user = renderProbe()
    await user.click(screen.getByRole('button', { name: 'Laden' }))
    await screen.findByText('abgemeldet')
    expect(remove).toHaveBeenCalledWith('wq-api')
  })

  it('neue Anmeldung loescht wq-api, bevor sie speichert', async () => {
    const { remove, refreshAtDelete } = stubCaches()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(guardian), { status: 200 })))
    const user = renderProbe()
    await user.click(screen.getByRole('button', { name: 'Anmelden' }))
    await screen.findByText('Mama')
    expect(remove).toHaveBeenCalledWith('wq-api')
    expect(refreshAtDelete).toEqual([null])
  })

  it('ohne caches werfen weder Abmelden noch Anmelden', async () => {
    expect(typeof caches).toBe('undefined')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/auth/login')
          ? new Response(JSON.stringify(guardian), { status: 200 })
          : new Response(null, { status: 204 }),
      ),
    )
    const user = renderProbe()
    await user.click(screen.getByRole('button', { name: 'Anmelden' }))
    await screen.findByText('Mama')
    await user.click(screen.getByRole('button', { name: 'Abmelden' }))
    await screen.findByText('abgemeldet')
    expect(tokenStore.refresh).toBeNull()
  })
})
