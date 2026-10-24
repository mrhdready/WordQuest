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
