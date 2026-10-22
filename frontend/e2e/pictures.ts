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

/*
  Kamerafoto im Kleinen: APP1-Segment direkt nach SOI mit EXIF-Orientierung 6
  (90 Grad gedreht) und einem GPS-IFD. So prueft der Test Drehung und das Entfernen
  der Metadaten ohne Binaerdatei im Repo. TIFF big-endian, Offsets ab "MM".
*/
export function withExif(jpeg: Buffer): Buffer {
  const tiff = Buffer.from([
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
    // IFD0 bei 8: zwei Eintraege
    0x00, 0x02,
    // 0x0112 Orientation, SHORT, 1, Wert 6
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00,
    // 0x8825 GPS-IFD-Zeiger, LONG, 1, Offset 38
    0x88, 0x25, 0x00, 0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x26,
    0x00, 0x00, 0x00, 0x00,
    // GPS-IFD bei 38: GPSVersionID, BYTE, 4, 2.2.0.0
    0x00, 0x01,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x04, 0x02, 0x02, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ])
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff])
  const length = payload.length + 2
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, length >> 8, length & 0xff]), payload])
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)])
}

// Gespeicherte Bytes einer Vokabel: Version aus der Liste, Bild mit Anmeldung.
export async function storedPicture(page: Page, setId: string, sourceText: string): Promise<Buffer> {
  const headers = { Authorization: `Bearer ${await accessToken(page)}` }
  const list = await page.request.get(`/api/v1/sets/${setId}/entries`, { headers })
  const entries = (await list.json()) as { sourceText: string; pictureVersion: string | null }[]
  const version = entries.find((item) => item.sourceText === sourceText)?.pictureVersion
  if (!version) throw new Error(`Vokabel "${sourceText}" hat kein Bild`)
  const picture = await page.request.get(`/api/v1/pictures/${version}`, { headers })
  expect(picture.status()).toBe(200)
  return picture.body()
}

export interface DecodedPicture {
  width: number
  height: number
  // RGB bei einem Viertel und drei Vierteln der Breite, halbe Hoehe.
  left: number[]
  right: number[]
}

// Dekodiert im echten Browser, EXIF-Drehung angewandt wie beim Verkleinern.
export async function decodePicture(page: Page, bytes: Buffer): Promise<DecodedPicture> {
  return page.evaluate(async (base64) => {
    const raw = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([raw]), { imageOrientation: 'from-image' })
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas')
    context.drawImage(bitmap, 0, 0)
    const y = Math.floor(bitmap.height / 2)
    const at = (x: number) => [...context.getImageData(Math.floor(x), y, 1, 1).data.slice(0, 3)]
    return { width: bitmap.width, height: bitmap.height, left: at(bitmap.width / 4), right: at((bitmap.width * 3) / 4) }
  }, bytes.toString('base64'))
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
