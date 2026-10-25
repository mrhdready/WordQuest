import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test'

// Sicherheits-Header an jeder Antwort von nginx (Codex-Befund 3, D-12, D-21):
// Eine location mit eigenem add_header erbt die Koepfe des server-Blocks nicht.
// Geprueft gegen das gebaute Web-Image, ohne Browser.

function expectSecurityHeaders(response: APIResponse) {
  const headers = response.headers()
  const path = new URL(response.url()).pathname
  expect(headers['content-security-policy'], path).toContain("default-src 'self'")
  expect(headers['content-security-policy'], path).toContain("frame-ancestors 'none'")
  expect(headers['x-frame-options'], path).toBe('DENY')
  expect(headers['x-content-type-options'], path).toBe('nosniff')
  expect(headers['referrer-policy'], path).toBe('same-origin')
  expect(headers['permissions-policy'], path).toBeTruthy()
  // Kein HSTS: Sonst liesse sich die Zertifikatswarnung auf Geraeten ohne
  // installierte CA nicht mehr wegklicken (OD-2).
  expect(headers['strict-transport-security'], path).toBeUndefined()
}

// expires und add_header setzen je einen Cache-Control-Kopf, deshalb alle zusammen lesen.
function cacheControl(response: APIResponse) {
  return response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === 'cache-control')
    .map((header) => header.value)
    .join(', ')
}

async function firstAsset(request: APIRequestContext) {
  const html = await (await request.get('/')).text()
  const asset = html.match(/\/assets\/[^"']+\.js/)?.[0]
  expect(asset, 'Asset im HTML von /').toBeTruthy()
  return asset as string
}

test('HTML-Pfade tragen Sicherheits-Header und no-cache', async ({ request }) => {
  for (const path of ['/', '/verwalten', '/index.html']) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(200)
    expectSecurityHeaders(response)
    expect(cacheControl(response), path).toContain('no-cache')
  }
})

test('Assets tragen Sicherheits-Header und bleiben immutable', async ({ request }) => {
  const response = await request.get(await firstAsset(request))
  expect(response.status()).toBe(200)
  expectSecurityHeaders(response)
  expect(cacheControl(response)).toContain('max-age=31536000')
  expect(cacheControl(response)).toContain('immutable')
})

test('sw.js traegt Sicherheits-Header und no-store', async ({ request }) => {
  const response = await request.get('/sw.js')
  expect(response.status()).toBe(200)
  expectSecurityHeaders(response)
  expect(cacheControl(response)).toContain('no-store')
})

test('Fehlerantworten tragen Sicherheits-Header', async ({ request }) => {
  // Fehlendes Asset: 404 von nginx selbst.
  const asset = await request.get('/assets/gibt-es-nicht.js')
  expect(asset.status()).toBe(404)
  expectSecurityHeaders(asset)

  // Durchgereichte Fehlerantwort der API.
  const api = await request.get('/api/v1/gibt-es-nicht')
  expect(api.status()).toBe(404)
  expectSecurityHeaders(api)
})

// HTTP leitet auf HTTPS um (OD-2, TLS-03); nur die CA kommt auch ueber HTTP, damit
// ein Geraet sie vor dem ersten Vertrauen laden kann.
const httpBase = process.env.WQ_E2E_HTTP_URL ?? 'http://localhost:18080'

test('HTTP leitet mit 301 auf HTTPS um, Pfad und Query bleiben', async ({ request, baseURL }) => {
  const httpsOrigin = new URL(baseURL as string).origin
  for (const path of ['/', '/verwalten?x=1', '/api/v1/auth/profiles', '/sw.js']) {
    const response = await request.get(httpBase + path, { maxRedirects: 0 })
    expect(response.status(), path).toBe(301)
    expect(response.headers()['location'], path).toBe(httpsOrigin + path)
    expectSecurityHeaders(response)
  }
})

test('CA-Download ueber HTTP und HTTPS gleich, ohne Schluessel', async ({ request }) => {
  const bodies: Buffer[] = []
  for (const url of [`${httpBase}/wordquest-ca.crt`, '/wordquest-ca.crt']) {
    const response = await request.get(url, { maxRedirects: 0 })
    expect(response.status(), url).toBe(200)
    expect(response.headers()['content-type'], url).toBe('application/x-x509-ca-cert')
    expectSecurityHeaders(response)
    const body = await response.body()
    expect(body[0], url).toBe(0x30)
    expect(body.includes('PRIVATE KEY'), url).toBe(false)
    bodies.push(body)
  }
  expect(bodies[0]?.equals(bodies[1] as Buffer)).toBe(true)
})
