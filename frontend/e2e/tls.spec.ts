import { X509Certificate } from 'node:crypto'
import { connect as tlsConnect, type TLSSocket } from 'node:tls'
import { expect, test } from '@playwright/test'

// HTTPS mit eigener Zertifizierungsstelle (TLS-01, TLS-04): Die CA kommt ueber
// HTTP vom App-Host und ist der einzige Vertrauensanker fuer den Handshake auf
// 8443. Nur Node-Bordmittel, kein Browser.

const httpsUrl = new URL(process.env.WQ_E2E_HTTPS_URL ?? 'https://localhost:18443')
const dayMs = 24 * 60 * 60 * 1000

function connect(ca: string) {
  return new Promise<TLSSocket>((resolve, reject) => {
    const socket = tlsConnect({
      host: '127.0.0.1',
      port: Number(httpsUrl.port || 443),
      servername: 'localhost',
      ca,
      // authorized wird selbst geprueft, damit ein Fehler den Grund zeigt.
      rejectUnauthorized: false,
    })
    socket.once('secureConnect', () => resolve(socket))
    socket.once('error', reject)
  })
}

// certs braucht fuer den RSA-3072-Schluessel einen Moment nach dem Start.
async function connectWithRetry(ca: string) {
  const deadline = Date.now() + 30_000
  for (;;) {
    try {
      return await connect(ca)
    } catch (error) {
      if (Date.now() > deadline) throw error
      await new Promise((resolve) => setTimeout(resolve, 1_000))
    }
  }
}

function lifetimeDays(certificate: X509Certificate) {
  return (Date.parse(certificate.validTo) - Date.parse(certificate.validFrom)) / dayMs
}

test('HTTPS liefert das Zertifikat der eigenen CA', async ({ request }) => {
  let response = await request.get('/wordquest-ca.crt')
  // Die Datei entsteht erst nach dem Start von certs.
  for (let attempt = 0; response.status() === 404 && attempt < 30; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1_000))
    response = await request.get('/wordquest-ca.crt')
  }
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toBe('application/x-x509-ca-cert')
  const ca = new X509Certificate(await response.body())

  const socket = await connectWithRetry(ca.toString())
  try {
    expect(socket.authorizationError ?? null).toBeNull()
    expect(socket.authorized).toBe(true)
    const server = socket.getPeerX509Certificate()
    expect(server).toBeDefined()
    if (!server) return

    const san = server.subjectAltName ?? ''
    expect(san).toContain('DNS:localhost')
    expect(san).toContain('DNS:wordquest.test')
    expect(san).toContain('IP Address:127.0.0.1')
    expect(server.checkIssued(ca)).toBe(true)
    expect(server.ca).toBe(false)
    expect(lifetimeDays(server)).toBeLessThanOrEqual(825)
    expect(server.keyUsage).toContain('1.3.6.1.5.5.7.3.1')
    expect(server.publicKey.asymmetricKeyType).toBe('rsa')
    expect(server.publicKey.asymmetricKeyDetails?.modulusLength).toBe(2048)

    expect(ca.ca).toBe(true)
    expect(ca.publicKey.asymmetricKeyType).toBe('rsa')
    expect(ca.publicKey.asymmetricKeyDetails?.modulusLength).toBe(3072)
    expect(lifetimeDays(ca)).toBeGreaterThanOrEqual(3650)
  } finally {
    socket.destroy()
  }
})
