import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/lib/api'

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
