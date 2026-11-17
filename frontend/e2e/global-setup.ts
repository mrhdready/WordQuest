import { createHash, X509Certificate } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { get as httpsGet } from 'node:https'
import { isIP } from 'node:net'
import { resolve } from 'node:path'
import { connect as tlsConnect } from 'node:tls'
import { chromium, expect, type FullConfig } from '@playwright/test'

// Eine Eltern-Anmeldung je Lauf: Rate-Limit "auth" erlaubt im Install-Smoke 10
// pro Minute (Standard), im e2e-Stack 1000 (Auth__RequestsPerMinute).
// Standard ist das Demo-Konto des e2e-Stacks (DemoDataSeeder); der seedfreie
// Install-Smoke setzt eigene Zugangsdaten (01-07).
export const guardianStorageState = 'playwright/.auth/guardian.json'
// CA des Stacks als PEM, fuer Node-Anfragen der Worker (NODE_EXTRA_CA_CERTS).
export const caFile = 'playwright/.auth/wordquest-ca.pem'

// certs braucht nach dem Start einen Moment fuer CA und Server-Zertifikat.
async function retry<T>(action: () => Promise<T>) {
  const deadline = Date.now() + 30_000
  for (;;) {
    try {
      return await action()
    } catch (error) {
      if (Date.now() > deadline) throw error
      await new Promise((done) => setTimeout(done, 1_000))
    }
  }
}

function serverCertificate(url: URL) {
  return new Promise<X509Certificate>((done, fail) => {
    const socket = tlsConnect({
      host: url.hostname,
      port: Number(url.port || 443),
      servername: isIP(url.hostname) ? undefined : url.hostname,
      // Nur lesen; ob das Zertifikat von der CA stammt, prueft verify() unten.
      rejectUnauthorized: false,
    })
    socket.once('secureConnect', () => {
      const certificate = socket.getPeerX509Certificate()
      socket.destroy()
      if (certificate) done(certificate)
      else fail(new Error('Kein Server-Zertifikat erhalten.'))
    })
    socket.once('error', fail)
  })
}

function download(url: URL) {
  return new Promise<Buffer>((done, fail) => {
    httpsGet(url, { rejectUnauthorized: false }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => chunks.push(chunk))
      response.on('end', () =>
        response.statusCode === 200
          ? done(Buffer.concat(chunks))
          : fail(new Error(`${url.href}: HTTP ${response.statusCode}`)),
      )
    }).once('error', fail)
  })
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL
  if (!baseURL?.startsWith('https://')) {
    throw new Error(`Die e2e-Suite laeuft ueber HTTPS; baseURL ist ${baseURL}.`)
  }
  const email = process.env.WQ_E2E_GUARDIAN_EMAIL ?? 'demo@wordquest.local'
  const password = process.env.WQ_E2E_GUARDIAN_PASSWORD ?? 'demo1234'

  // Vertraut wird genau dem Schluessel (SPKI) des ausgelieferten Server-Zertifikats,
  // und nur, wenn die CA des Stacks dieses Zertifikat signiert hat. Ein pauschales --ignore-certificate-errors wuerde
  // jeden Zertifikatsfehler verdecken und den Service Worker trotzdem zulassen;
  // so sieht der Browser denselben Zustand wie ein Geraet mit installierter CA.
  const url = new URL(baseURL)
  const server = await retry(() => serverCertificate(url))
  const ca = new X509Certificate(await retry(() => download(new URL('/wordquest-ca.crt', url))))
  if (!server.verify(ca.publicKey)) {
    throw new Error('Das Server-Zertifikat stammt nicht von der CA unter /wordquest-ca.crt.')
  }
  const spki = createHash('sha256')
    .update(server.publicKey.export({ type: 'spki', format: 'der' }))
    .digest('base64')
  mkdirSync(resolve(caFile, '..'), { recursive: true })
  writeFileSync(caFile, ca.toString())
  // Die Worker starten erst nach dem globalSetup und erben diese Umgebung.
  process.env.WQ_E2E_SPKI = spki
  process.env.NODE_EXTRA_CA_CERTS = resolve(caFile)

  const browser = await chromium.launch({ args: [`--ignore-certificate-errors-spki-list=${spki}`] })
  const page = await browser.newPage({ baseURL })
  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByLabel('Passwort').press('Enter')
  await expect(page).toHaveURL(/\/verwalten$/)
  await page.context().storageState({ path: guardianStorageState })
  await browser.close()
}
