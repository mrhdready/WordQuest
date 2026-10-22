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
