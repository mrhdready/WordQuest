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

  // D-12: Bilder laufen ueber denselben Weg, Bearer und Refresh inklusive.
  it('blob: true sendet Bearer und liefert die Bytes als Blob', async () => {
    signIn()
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(bytes, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const blob = await api<Blob>('/x', { blob: true })

    expect((fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>).Authorization).toBe('Bearer alt-access')
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes)
  })

  it('blob: true nach 401 und erfolgreichem Refresh: zweite Anfrage liefert das Blob', async () => {
    signIn()
    const bytes = new Uint8Array([1, 2, 3])
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/refresh')) {
        return Response.json({
          accessToken: 'neu-access',
          refreshToken: 'neu-refresh',
          expiresInSeconds: 900,
          user: { id: 'u1', displayName: 'Kind', role: 'Learner', tenantId: 't1' },
        })
      }
      const auth = (init?.headers as Record<string, string>).Authorization
      return auth === 'Bearer neu-access' ? new Response(bytes) : new Response(expired, { status: 401 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const blob = await api<Blob>('/x', { blob: true })

    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes)
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/v1/x')).toHaveLength(2)
  })

  // D-12: Das Vokabelbild geht als roher Body hoch, der Server liest den Typ aus den Bytes.
  it('Blob als Body: unverändert, Content-Type aus dem Blob, Bearer', async () => {
    signIn()
    const picture = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' })
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ pictureVersion: 'v1' }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await api('/x', { method: 'PUT', body: picture })).toEqual({ pictureVersion: 'v1' })

    const init = fetchMock.mock.calls[0]?.[1]
    const headers = init?.headers as Record<string, string>
    expect(init?.body).toBe(picture)
    expect(headers['Content-Type']).toBe('image/webp')
    expect(headers.Authorization).toBe('Bearer alt-access')
  })

  it('Blob als Body nach 401 und erfolgreichem Refresh: dasselbe Blob noch einmal', async () => {
    signIn()
    const picture = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/refresh')) {
        return Response.json({
          accessToken: 'neu-access',
          refreshToken: 'neu-refresh',
          expiresInSeconds: 900,
          user: { id: 'u1', displayName: 'Mama', role: 'Guardian', tenantId: 't1' },
        })
      }
      const auth = (init?.headers as Record<string, string>).Authorization
      return auth === 'Bearer neu-access' ? Response.json({ pictureVersion: 'v2' }) : new Response(expired, { status: 401 })
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(await api('/x', { method: 'PUT', body: picture })).toEqual({ pictureVersion: 'v2' })

    const sent = fetchMock.mock.calls.filter(([url]) => url === '/api/v1/x').map(([, init]) => init?.body)
    expect(sent).toHaveLength(2)
    for (const body of sent) expect(body).toBe(picture)
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

// Codex-Befund 4 (Clientteil) und Review 02: Zwei Tabs sind zwei Modulinstanzen
// mit gemeinsamem localStorage. 409 heisst "anderer Tab hat eben erneuert" (03.1-01).
describe('Zwei Tabs', () => {
  type Api = typeof import('@/lib/api')
  const kid = { id: 'u1', displayName: 'Kind', role: 'Learner' as const, tenantId: 't1' }
  const first = { accessToken: 'a1', refreshToken: 'r1', expiresInSeconds: 900, user: kid }
  const second = { ...first, accessToken: 'a2', refreshToken: 'r2' }
  const unauthorized = () =>
    new Response(JSON.stringify({ detail: 'Sitzung abgelaufen. Bitte neu anmelden.' }), {
      status: 401,
    })
  const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200 })

  async function tab(): Promise<Api> {
    vi.resetModules()
    return import('@/lib/api')
  }

  function bearer(init?: RequestInit) {
    return (init?.headers as Record<string, string> | undefined)?.Authorization
  }

  afterEach(() => {
    vi.useRealTimers()
  })

  it('gleichzeitiger Refresh: der zweite bekommt 409 und uebernimmt den Token des ersten', async () => {
    await tokenStore.saveLogin(first)
    const tabA = await tab()
    const tabB = await tab()
    let answerFirst: (response: Response) => void = () => {}
    let refreshCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith('/auth/refresh')) {
          refreshCalls++
          if (refreshCalls === 1) return new Promise<Response>((resolve) => (answerFirst = resolve))
          // Erst nach der 409 an den zweiten Tab antwortet der Server dem ersten.
          setTimeout(() => answerFirst(new Response(JSON.stringify(second), { status: 200 })), 0)
          return Promise.resolve(new Response('', { status: 409 }))
        }
        return Promise.resolve(bearer(init) === 'Bearer a2' ? ok() : unauthorized())
      }),
    )

    const results = await Promise.all([tabA.api('/probe'), tabB.api('/probe')])
    expect(results).toEqual([{ ok: true }, { ok: true }])
    expect(refreshCalls).toBe(2)
    expect(tokenStore.refresh).toBe('r2')
    expect(tokenStore.access).toBe('a2')
  })

  it('409 ohne Nachfolger: nach 3 Sekunden nur dieser Tab abgemeldet', async () => {
    vi.useFakeTimers()
    await tokenStore.saveLogin(first)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/auth/refresh') ? new Response('', { status: 409 }) : unauthorized(),
      ),
    )
    const pending = api('/probe').catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(2_900)
    expect(tokenStore.refresh).toBe('r1')
    await vi.advanceTimersByTimeAsync(200)
    const error = await pending
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(401)
    expect(tokenStore.refresh).toBeNull()
    expect(tokenStore.access).toBeNull()
  })

  // Hintergrund-Tabs drosseln Timer: Die Frist misst Zeit, nicht Durchlaeufe (Review LOW 1).
  it('409 ohne Nachfolger: Frist nach Uhrzeit, auch bei gedrosselten Timern', async () => {
    vi.useFakeTimers()
    await tokenStore.saveLogin(first)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/auth/refresh') ? new Response('', { status: 409 }) : unauthorized(),
      ),
    )
    const pending = api('/probe').catch((error: unknown) => error)
    try {
      await vi.advanceTimersByTimeAsync(0)
      vi.setSystemTime(Date.now() + 3_000)
      await vi.advanceTimersByTimeAsync(100)
      expect(tokenStore.refresh).toBeNull()
    } finally {
      // Wartende Schleife auch im Fehlerfall beenden, sonst haengt refreshInFlight.
      await vi.advanceTimersByTimeAsync(3_000)
    }
    expect(await pending).toBeInstanceOf(ApiError)
  })

  it('mehrere verspätete 401er nach einer Rotation: genau ein Refresh', async () => {
    await tokenStore.saveLogin(first)
    const late: ((response: Response) => void)[] = []
    let a1Calls = 0
    let refreshCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith('/auth/refresh')) {
          refreshCalls++
          const next = refreshCalls === 1 ? second : { ...first, accessToken: 'a3', refreshToken: 'r3' }
          return Promise.resolve(new Response(JSON.stringify(next), { status: 200 }))
        }
        if (bearer(init) !== 'Bearer a1') return Promise.resolve(ok())
        if (a1Calls++ === 0) return Promise.resolve(unauthorized())
        return new Promise<Response>((resolve) => late.push(resolve))
      }),
    )

    const calls = [api('/probe'), api('/probe'), api('/probe')]
    expect(await calls[0]).toEqual({ ok: true })
    for (const answer of late) answer(unauthorized())
    expect(await Promise.all(calls)).toEqual([{ ok: true }, { ok: true }, { ok: true }])
    expect(refreshCalls).toBe(1)
    expect(tokenStore.refresh).toBe('r2')
  })

  it('verspätete 401 im anderen Tab: wiederholt mit dem neuen Token, ohne Refresh', async () => {
    await tokenStore.saveLogin(first)
    const tabA = await tab()
    const tabB = await tab()
    let answerB: (response: Response) => void = () => {}
    let a1Calls = 0
    let refreshCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith('/auth/refresh')) {
          refreshCalls++
          return Promise.resolve(new Response(JSON.stringify(second), { status: 200 }))
        }
        if (bearer(init) !== 'Bearer a1') return Promise.resolve(ok())
        if (a1Calls++ === 0) return new Promise<Response>((resolve) => (answerB = resolve))
        return Promise.resolve(unauthorized())
      }),
    )

    const fromB = tabB.api('/probe')
    expect(await tabA.api('/probe')).toEqual({ ok: true })
    answerB(unauthorized())
    expect(await fromB).toEqual({ ok: true })
    expect(refreshCalls).toBe(1)
    expect(tokenStore.refresh).toBe('r2')
  })

  const sibling = {
    accessToken: 'b1',
    refreshToken: 'rb1',
    expiresInSeconds: 900,
    user: { ...kid, id: 'u2', displayName: 'Geschwister' },
  }

  it('neue Anmeldung waehrend der 409-Wartezeit: keine Wiederholung', async () => {
    await tokenStore.saveLogin(first)
    const tabA = await tab()
    let probeCalls = 0
    let siblingSaved = Promise.resolve()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/auth/refresh')) {
          // Waehrend dieser Tab wartet, meldet sich im anderen Tab ein Geschwister an.
          siblingSaved = new Promise((resolve) =>
            setTimeout(() => void tokenStore.saveLogin(sibling).then(resolve), 0),
          )
          return new Response('', { status: 409 })
        }
        probeCalls++
        return bearer(init) === 'Bearer b1' ? ok() : unauthorized()
      }),
    )

    const error = await tabA.api('/probe').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(tabA.ApiError)
    await siblingSaved
    expect(probeCalls).toBe(1)
    expect(tokenStore.refresh).toBe('rb1')
    expect(tokenStore.access).toBe('b1')
  })

  it('neue Anmeldung waehrend eine 401 unterwegs ist: kein Refresh, keine Wiederholung', async () => {
    await tokenStore.saveLogin(first)
    let answer: (response: Response) => void = () => {}
    let refreshCalls = 0
    let probeCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/auth/refresh')) {
          refreshCalls++
          return Promise.resolve(new Response(JSON.stringify(sibling), { status: 200 }))
        }
        // Eine Wiederholung bekaeme sofort 200 unter dem Geschwister-Profil.
        if (probeCalls++ > 0) return Promise.resolve(ok())
        return new Promise<Response>((resolve) => (answer = resolve))
      }),
    )

    const pending = api('/probe').catch((caught: unknown) => caught)
    await vi.waitFor(() => expect(probeCalls).toBe(1))
    await tokenStore.saveLogin(sibling)
    answer(unauthorized())
    expect(await pending).toBeInstanceOf(ApiError)
    expect(refreshCalls).toBe(0)
    expect(probeCalls).toBe(1)
    expect(tokenStore.refresh).toBe('rb1')
  })

  it('Abmelden waehrend eine 401 unterwegs ist: kein Refresh, keine Wiederholung', async () => {
    await tokenStore.saveLogin(first)
    let answer: (response: Response) => void = () => {}
    let refreshCalls = 0
    let probeCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/auth/refresh')) refreshCalls++
        else probeCalls++
        return new Promise<Response>((resolve) => (answer = resolve))
      }),
    )

    const pending = api('/probe').catch((caught: unknown) => caught)
    await vi.waitFor(() => expect(probeCalls).toBe(1))
    tokenStore.clear()
    answer(unauthorized())
    expect(await pending).toBeInstanceOf(ApiError)
    expect(refreshCalls).toBe(0)
    expect(probeCalls).toBe(1)
  })
})
