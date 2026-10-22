import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

function toDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/*
  Bild mit Anmeldung laden (D-12): <img src> sendet keinen Authorization-Header,
  deshalb holt api() die Bytes (Bearer, Refresh nach 401). Als data-URL statt
  Object-URL, damit nichts freigegeben werden muss. Eine Version aendert ihren
  Inhalt nie, deshalb staleTime Infinity.
*/
export function usePicture(version: string | null) {
  return useQuery({
    queryKey: ['picture', version],
    queryFn: async () => toDataUrl(await api<Blob>(`/pictures/${version}`, { blob: true })),
    enabled: version !== null,
    staleTime: Infinity,
    // Keine Wiederholung: offline pausierte sie (offlineFirst) und der Rahmen bliebe
    // leer; der Rueckfall ist das Emoji.
    retry: false,
  })
}

// DESIGN.md vocab-thumb (48 px, rund) und vocab-picture (160 px).
const frames = {
  thumb: 'size-12 rounded-full',
  large: 'size-40 rounded-sm',
}
const fits = {
  thumb: 'object-cover',
  large: 'object-contain',
}

/*
  Fester Rahmen schon beim Laden, damit nichts springt (Recherche Pitfall 6).
  Scheitert der Abruf, steht der fallback (das Emoji) im selben Rahmen. Der
  Server prueft nur Signatur und Struktur, dekodiert aber nicht (D-16): Scheitert
  der Browser am Bild, gilt derselbe Rueckfall statt eines kaputten Symbols.
  Gemerkt wird die gescheiterte data-URL, so zeigt eine neue Version ohne
  Effekt wieder ein Bild.
*/
export function VocabPicture({
  version,
  alt,
  variant,
  fallback,
}: {
  version: string
  alt: string
  variant: 'thumb' | 'large'
  fallback?: ReactNode
}) {
  const picture = usePicture(version)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const broken = picture.isError || (picture.data !== undefined && picture.data === failedSrc)
  return (
    <span
      data-testid="vokabelbild"
      className={cn('flex shrink-0 items-center justify-center overflow-hidden', frames[variant])}
    >
      {broken ? (
        fallback
      ) : picture.data ? (
        <img
          src={picture.data}
          alt={alt}
          className={cn('size-full', fits[variant])}
          onError={() => setFailedSrc(picture.data ?? null)}
        />
      ) : null}
    </span>
  )
}

// Laengste Kante des gespeicherten Bildes (D-04): scharf im 160-px-Rahmen auch bei dreifacher Pixeldichte.
const MAX_EDGE = 512

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Bild nicht kodierbar'))), type, quality),
  )
}

/*
  Verkleinern im Browser vor dem Hochladen (D-04). Das Neukodieren ueber den
  Canvas laesst EXIF/GPS des Fotos zurueck; die Drehung aus EXIF wird vorher
  angewandt. Safari kodiert kein WebP und liefert still PNG, das bis 900 KB gross
  wuerde (Recherche Pitfall 1); dann JPEG. JPEG kennt keine Transparenz, deshalb
  vorher weiss hinterlegen, sonst wuerden freigestellte Bilder schwarz.
  Scheitert Dekodieren oder Kodieren, wird das Promise abgelehnt.
*/
export async function shrinkPicture(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('Kein Canvas')
  }
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const webp = await encode(canvas, 'image/webp', 0.8)
  if (webp.type === 'image/webp') return webp
  context.globalCompositeOperation = 'destination-over'
  context.fillStyle = 'white'
  context.fillRect(0, 0, canvas.width, canvas.height)
  return encode(canvas, 'image/jpeg', 0.85)
}
