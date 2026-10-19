import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, tokenStore } from '@/lib/api'

const unreachable =
  'Der Server ist gerade nicht erreichbar. Prüfe die Verbindung und versuche es noch einmal.'
const generic = 'Das hat nicht geklappt. Versuche es noch einmal.'

// Je Test eigenes fetch-Stub (RESEARCH Pitfall 9).
function respond(status: number, body: string) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status })))
}

async function caught(): Promise<ApiError> {
  try {
    await api('/probe')
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('api() hat nicht geworfen')
}

afterEach(() => {
  vi.unstubAllGlobals()
  tokenStore.clear()
})

describe('api() Fehlerform', () => {
  it('ValidationProblem liefert errors je Feld und die Servertexte als message', async () => {
    respond(
      400,
      JSON.stringify({
        title: 'One or more validation errors occurred.',
        errors: { newPassword: ['X'] },
      }),
    )
    const error = await caught()
    expect(error.status).toBe(400)
    expect(error.errors?.newPassword?.[0]).toBe('X')
    expect(error.message).toContain('X')
    expect(error.message).not.toContain('One or more')
  })

  it('Netzfehler ergibt Status 0 und den deutschen Text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    const error = await caught()
    expect(error.status).toBe(0)
    expect(error.message).toBe(unreachable)
  })

  it('Serverfehler 500 ergibt den allgemeinen Text', async () => {
    respond(500, JSON.stringify({ title: 'An error occurred while processing your request.' }))
    expect((await caught()).message).toBe(generic)
  })

  it('nicht lesbarer Fehlerkoerper ergibt den allgemeinen Text', async () => {
    respond(400, '<html>kaputt</html>')
    expect((await caught()).message).toBe(generic)
  })

  it('detail bleibt vorrangig', async () => {
    respond(404, JSON.stringify({ title: 'Not Found', detail: 'Nicht da.' }))
    const error = await caught()
    expect(error.status).toBe(404)
    expect(error.message).toBe('Nicht da.')
  })

  // Results.NotFound()/Forbid() ohne Koerper: UseStatusCodePages ergaenzt nur einen englischen title (WR-04).
  it('4xx nur mit englischem title ergibt den allgemeinen Text', async () => {
    respond(404, JSON.stringify({ title: 'Not Found', status: 404 }))
    const error = await caught()
    expect(error.status).toBe(404)
    expect(error.message).toBe(generic)
  })

  // Rate-Limit "auth" antwortet ohne Koerper; "Versuche es noch einmal" luede
  // an der PIN-Eingabe zum sofortigen Wiederholen ein.
  it('429 ergibt den Hinweis, eine Minute zu warten', async () => {
    respond(429, '')
    const error = await caught()
    expect(error.status).toBe(429)
    expect(error.message).toBe('Zu viele Versuche. Bitte in einer Minute nochmal probieren.')
  })
})

// FIX-01 (UI-SPEC Token-Refresh): Nur 400/401 der Refresh-Antwort melden ab. Ein
// Limit, ein Serverfehler oder ein Netzfehler zeigt den allgemeinen Text, nicht
// das detail der urspruenglichen 401-Antwort.
describe('Token-Refresh', () => {
  const expired = JSON.stringify({
    title: 'Unauthorized',
    detail: 'Sitzung abgelaufen. Bitte neu anmelden.',
  })

  function signIn() {
    tokenStore.save({
      accessToken: 'alt-access',
      refreshToken: 'alt-refresh',
      expiresInSeconds: 900,
      user: { id: 'u1', displayName: 'Kind', role: 'Learner', tenantId: 't1' },
    })
  }

  // Erste Anfrage 401 mit detail; /auth/refresh antwortet mit refresh() bzw. wirft.
  function stub(refresh: () => Promise<Response>) {
    let refreshCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/auth/refresh')) {
          refreshCalls++
          return refresh()
        }
        return new Response(expired, { status: 401 })
      }),
    )
    return () => refreshCalls
  }

  it.each([429, 503])('Refresh %i: allgemeiner Text, Anmeldung bleibt', async (status) => {
    signIn()
    stub(async () => new Response('', { status }))
    const error = await caught()
    expect(error.message).toBe(generic)
    expect(error.status).toBe(status)
    expect(tokenStore.access).toBe('alt-access')
    expect(tokenStore.refresh).toBe('alt-refresh')
  })

  // IN-04: derselbe Netzfehler wie bei jeder anderen Anfrage, derselbe Text.
  it('Netzfehler beim Refresh: "nicht erreichbar", Status 0, Anmeldung bleibt', async () => {
    signIn()
    stub(async () => {
      throw new TypeError('Failed to fetch')
    })
    const error = await caught()
    expect(error.message).toBe(unreachable)
    expect(error.status).toBe(0)
    expect(tokenStore.refresh).toBe('alt-refresh')
  })

  it('zwei gleichzeitige 401er und Refresh 429: ein Refresh, beide mit allgemeinem Text', async () => {
    signIn()
    const refreshCalls = stub(async () => new Response('', { status: 429 }))
    const results = await Promise.allSettled([api('/probe'), api('/probe')])
    expect(refreshCalls()).toBe(1)
    for (const result of results) {
      expect(result.status).toBe('rejected')
      if (result.status === 'rejected') {
        expect(result.reason).toBeInstanceOf(ApiError)
        expect((result.reason as ApiError).message).toBe(generic)
      }
    }
  })

  it.each([401, 400])('Refresh %i: Abmeldung, Tokens geloescht', async (status) => {
    signIn()
    stub(async () => new Response(expired, { status }))
    const error = await caught()
    expect(error.status).toBe(401)
    expect(error.message).toBe('Sitzung abgelaufen. Bitte neu anmelden.')
    expect(tokenStore.access).toBeNull()
    expect(tokenStore.refresh).toBeNull()
  })

  it('erfolgreicher Refresh: zweite Anfrage mit neuem Token liefert das Ergebnis', async () => {
    signIn()
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/refresh')) {
        return new Response(
          JSON.stringify({
            accessToken: 'neu-access',
            refreshToken: 'neu-refresh',
            expiresInSeconds: 900,
            user: { id: 'u1', displayName: 'Kind', role: 'Learner', tenantId: 't1' },
          }),
          { status: 200 },
        )
      }
      const auth = (init?.headers as Record<string, string>).Authorization
      return auth === 'Bearer neu-access'
        ? new Response(JSON.stringify({ ok: true }), { status: 200 })
        : new Response(expired, { status: 401 })
    })
    vi.stubGlobal('fetch', fetchMock)
    expect(await api('/probe')).toEqual({ ok: true })
    expect(tokenStore.refresh).toBe('neu-refresh')
  })
})

// D-06: Ein Refresh-Fehler leert nur den eigenen Token, nicht den eines anderen Tabs.
describe('Refresh-Fehler und anderer Tab', () => {
  it('Refresh 401, waehrend ein anderer Tab R2 gespeichert hat: R2 bleibt', async () => {
    const auth = {
      accessToken: 'a1',
      refreshToken: 'r1',
      expiresInSeconds: 900,
      user: { id: 'u1', displayName: 'Kind', role: 'Learner' as const, tenantId: 't1' },
    }
    tokenStore.save(auth)
    let answerRefresh: (response: Response) => void = () => {}
    const fetchMock = vi.fn((url: string) =>
      url.endsWith('/auth/refresh')
        ? new Promise<Response>((resolve) => (answerRefresh = resolve))
        : Promise.resolve(new Response('', { status: 401 })),
    )
    vi.stubGlobal('fetch', fetchMock)

    const pending = api('/probe').catch((error: unknown) => error)
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/auth/refresh'))).toBe(true),
    )
    tokenStore.save({ ...auth, accessToken: 'a2', refreshToken: 'r2' })
    answerRefresh(new Response('', { status: 401 }))

    expect(await pending).toBeInstanceOf(ApiError)
    expect(tokenStore.refresh).toBe('r2')
    expect(tokenStore.access).toBe('a2')
  })
})
