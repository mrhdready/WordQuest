import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { tokenStore } from '@/lib/api'
import { usePicture, VocabPicture } from '@/lib/picture'

// Beliebige Bytes genuegen: jsdom dekodiert nicht, der Typ kommt aus dem Header.
const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

function picture(status = 200) {
  return status === 200
    ? new Response(bytes, { status, headers: { 'Content-Type': 'image/png' } })
    : new Response('', { status })
}

function stubFetch(respond: () => Promise<Response> = async () => picture()) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => respond())
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client()}>{children}</QueryClientProvider>
}

function renderPicture(version: string, variant: 'thumb' | 'large' = 'large') {
  const queryClient = client()
  const ui = (v: string) => (
    <QueryClientProvider client={queryClient}>
      <VocabPicture version={v} alt="Bild zu Hund" variant={variant} fallback={<span>🐶</span>} />
    </QueryClientProvider>
  )
  const view = render(ui(version))
  return { rerender: (v: string) => view.rerender(ui(v)) }
}

afterEach(() => {
  vi.unstubAllGlobals()
  tokenStore.clear()
})

describe('usePicture', () => {
  it('lädt mit Bearer und liefert eine data-URL', async () => {
    tokenStore.save({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresInSeconds: 900,
      user: { id: 'u1', displayName: 'Mama', role: 'Guardian', tenantId: 't1' },
    })
    const fetchMock = stubFetch()
    const { result } = renderHook(() => usePicture('v1'), { wrapper })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data).toBe('data:image/png;base64,iVBORw==')
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('/api/v1/pictures/v1')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer access-1')
  })

  it('ohne Version keine Anfrage', async () => {
    const fetchMock = stubFetch()
    renderHook(() => usePicture(null), { wrapper })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('VocabPicture', () => {
  it('Rahmen schon beim Laden, ohne Bild', () => {
    stubFetch(() => new Promise<Response>(() => {}))
    renderPicture('v1')
    const frame = screen.getByTestId('vokabelbild')
    expect(frame.className).toContain('size-40')
    expect(frame.querySelector('img')).toBeNull()
  })

  it('mit Daten ein Bild mit dem übergebenen alt', async () => {
    stubFetch()
    renderPicture('v1')
    const image = await screen.findByRole('img', { name: 'Bild zu Hund' })
    expect(image.getAttribute('src')).toBe('data:image/png;base64,iVBORw==')
    expect(screen.getByTestId('vokabelbild').contains(image)).toBe(true)
  })

  it('Abruf 404: fallback im Rahmen', async () => {
    stubFetch(async () => picture(404))
    renderPicture('v1')
    const frame = screen.getByTestId('vokabelbild')
    await waitFor(() => expect(frame.textContent).toBe('🐶'))
    expect(frame.querySelector('img')).toBeNull()
  })

  // D-16: Der Server prueft nur Signatur und Struktur; dekodiert der Browser nicht, gilt der Rueckfall.
  it.each([
    ['large', 'size-40'],
    ['thumb', 'size-12'],
  ] as const)('HTTP 200, Dekodierfehler (%s): fallback im selben Rahmen, Größe bleibt', async (variant, size) => {
    stubFetch()
    renderPicture('v1', variant)
    const frame = screen.getByTestId('vokabelbild')
    fireEvent.error(await screen.findByRole('img', { name: 'Bild zu Hund' }))

    expect(frame.querySelector('img')).toBeNull()
    expect(frame.textContent).toBe('🐶')
    expect(frame.className).toContain(size)
    expect(screen.getByTestId('vokabelbild')).toBe(frame)
  })

  // Review LOW-1: Mit den App-Vorgaben (retry 1, offlineFirst) pausiert die Wiederholung
  // offline; ohne eigene Regel bliebe der Rahmen leer statt das Emoji zu zeigen.
  it('offline mit den App-Vorgaben: Netzfehler zeigt den fallback', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    onlineManager.setOnline(false)
    try {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: 1, networkMode: 'offlineFirst' } },
      })
      render(
        <QueryClientProvider client={queryClient}>
          <VocabPicture version="v1" alt="" variant="thumb" fallback={<span>🐶</span>} />
        </QueryClientProvider>,
      )
      await waitFor(() => expect(screen.getByTestId('vokabelbild').textContent).toBe('🐶'))
    } finally {
      onlineManager.setOnline(true)
    }
  })

  it('neue Version nach einem Dekodierfehler zeigt wieder ein Bild', async () => {
    stubFetch()
    const { rerender } = renderPicture('v1')
    fireEvent.error(await screen.findByRole('img', { name: 'Bild zu Hund' }))
    expect(screen.getByTestId('vokabelbild').querySelector('img')).toBeNull()

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/webp' } })),
    )
    rerender('v2')
    const image = await screen.findByRole('img', { name: 'Bild zu Hund' })
    expect(image.getAttribute('src')).toBe('data:image/webp;base64,AQID')
  })
})
