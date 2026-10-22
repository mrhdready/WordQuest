import { expect, type Page } from '@playwright/test'

// Echtes, dekodierbares Bild aus dem Browser: links rot, rechts blau. So entstehen
// keine Binaerdateien im Repo, und die Strukturpruefung des Servers (D-16) besteht.
export async function canvasPicture(
  page: Page,
  { type, width, height }: { type: string; width: number; height: number },
): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ({ type, width, height }) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('canvas')
      context.fillStyle = 'red'
      context.fillRect(0, 0, width / 2, height)
      context.fillStyle = 'blue'
      context.fillRect(width / 2, 0, width - width / 2, height)
      return canvas.toDataURL(type)
    },
    { type, width, height },
  )
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
}

export async function accessToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('wq.access'))
  if (!token) throw new Error('kein Zugriffstoken im localStorage')
  return token
}

export async function entryIdOf(page: Page, setId: string, sourceText: string): Promise<string> {
  const response = await page.request.get(`/api/v1/sets/${setId}/entries`, {
    headers: { Authorization: `Bearer ${await accessToken(page)}` },
  })
  expect(response.status()).toBe(200)
  const entries = (await response.json()) as { id: string; sourceText: string }[]
  const entry = entries.find((item) => item.sourceText === sourceText)
  if (!entry) throw new Error(`Vokabel "${sourceText}" fehlt`)
  return entry.id
}

export async function putPicture(
  page: Page,
  setId: string,
  entryId: string,
  bytes: Buffer,
  type: string,
): Promise<string> {
  const response = await page.request.put(`/api/v1/sets/${setId}/entries/${entryId}/picture`, {
    headers: { Authorization: `Bearer ${await accessToken(page)}`, 'Content-Type': type },
    data: bytes,
  })
  expect(response.status()).toBe(200)
  return ((await response.json()) as { pictureVersion: string }).pictureVersion
}
