import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Delete } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ErrorNote, Spinner } from '@/components/ui/misc'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { avatarFor } from '@/lib/avatars'
import { cn } from '@/lib/utils'
import type { LearnerTile } from '@/types'

// PIN mit genau 4 Ziffern (PAR-02); die vierte Ziffer sendet ab, ohne Tipp
// auf "Los geht’s" (Entscheidung 2026-10-21).
const PIN_LENGTH = 4
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

// keypad-key: Glasfarbe ohne Blur je Taste (viele Blur-Ebenen ruckeln auf
// guenstigen Tablets), deckender Fallback kommt aus glass-flat-clear.
const keyClass =
  'glass-flat-clear flex size-20 items-center justify-center rounded-full type-keypad text-ink ' +
  'transition active:scale-95 disabled:opacity-50'

/**
 * Startbildschirm des Kindes: Avatar antippen, vier Zahlen eingeben, fertig.
 *
 * Kein Passwortfeld: das ist die haeufigste Abbruchstelle bei Lern-Apps
 * (Konzept §3). Eine angeschlossene Tastatur funktioniert trotzdem (FIX-08).
 */
export function ProfilePickerPage() {
  const navigate = useNavigate()
  const { loginAsLearner } = useAuth()

  const [selected, setSelected] = useState<LearnerTile | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Spiegel als Refs: Tasten im selben Takt saehen den State noch vor dem
  // Rendern; so sendet die vierte Ziffer genau einmal und eine fuenfte zaehlt nicht.
  const pinRef = useRef('')
  const busyRef = useRef(false)
  const firstKey = useRef<HTMLButtonElement>(null)
  const tiles = useRef<HTMLDivElement>(null)
  const retried = useRef(false)

  // Nach falscher PIN zurueck an den Anfang des Ziffernfelds. Als Effekt, weil
  // die Tasten erst nach dem Rendern mit busy=false wieder fokussierbar sind.
  useEffect(() => {
    if (error) firstKey.current?.focus()
  }, [error])

  const profiles = useQuery({
    queryKey: ['profiles'],
    queryFn: () => api<LearnerTile[]>('/auth/profiles'),
    retry: false,
  })

  // Nach "Noch einmal" verschwindet der Button: Fokus auf die erste Kachel statt auf body.
  useEffect(() => {
    if (!retried.current || !profiles.isSuccess) return
    retried.current = false
    tiles.current?.querySelector('button')?.focus()
  }, [profiles.isSuccess])

  function updatePin(next: string) {
    pinRef.current = next
    setPin(next)
  }

  async function submit(learnerId: string, entered: string) {
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      await loginAsLearner(learnerId, entered)
      navigate('/', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Das hat nicht geklappt.')
      updatePin('')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  function press(digit: string) {
    if (!selected || busyRef.current || pinRef.current.length >= PIN_LENGTH) return
    updatePin(pinRef.current + digit)
    if (pinRef.current.length === PIN_LENGTH) void submit(selected.id, pinRef.current)
  }

  function removeLast() {
    if (busyRef.current) return
    updatePin(pinRef.current.slice(0, -1))
  }

  function choose(profile: LearnerTile | null) {
    setSelected(profile)
    updatePin('')
    setError(null)
  }

  // Physische Tastatur nur, solange ein Profil gewaehlt ist (T-01-15).
  useEffect(() => {
    if (!selected) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.altKey || event.metaKey) return
      if (/^[0-9]$/.test(event.key)) {
        press(event.key)
      } else if (event.key === 'Backspace') {
        removeLast()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  if (profiles.isLoading) return <Spinner />

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-screen-margin pt-screen-top pb-8 safe-top safe-bottom">
      {!selected ? (
        <>
          <h1 className="mb-8 text-center type-large-title">Wer lernt heute?</h1>

          {/* Ein Kind am Tablet laedt nicht selbst neu: Wiederholen direkt hier. */}
          {profiles.isError ? (
            <div className="mb-8 flex flex-col gap-4">
              <ErrorNote message="Der Server ist gerade nicht erreichbar. Prüfe die Verbindung und versuche es noch einmal." />
              <Button
                type="button"
                variant="secondary"
                disabled={profiles.isFetching}
                onClick={() => {
                  retried.current = true
                  void profiles.refetch()
                }}
              >
                Noch einmal
              </Button>
            </div>
          ) : null}

          <div ref={tiles} className="grid grid-cols-2 gap-4">
            {(profiles.data ?? []).map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => choose(profile)}
                className="animate-pop glass flex flex-col items-center gap-2 rounded-lg p-6 text-ink transition active:scale-95"
              >
                <span className="type-emoji" aria-hidden>
                  {avatarFor(profile.avatarKey)}
                </span>
                <span className="w-full break-words text-center type-headline">
                  {profile.displayName}
                </span>
              </button>
            ))}
          </div>

          {profiles.data?.length === 0 ? (
            <p className="mt-8 text-center type-body-md text-ink">
              Hier ist noch kein Kinderprofil angelegt.
            </p>
          ) : null}

          <Link to="/login" className="mt-auto pt-12 text-center type-body-md-strong text-ink underline">
            Ich bin ein Elternteil
          </Link>
        </>
      ) : (
        <>
          <div>
            <Button
              type="button"
              variant="round"
              size="icon"
              aria-label="Zurück zur Profilwahl"
              onClick={() => choose(null)}
            >
              <ChevronLeft className="size-6" aria-hidden />
            </Button>
          </div>

          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <span className="type-emoji" aria-hidden>
              {avatarFor(selected.avatarKey)}
            </span>
            <h1 className="w-full break-words type-title">Hallo, {selected.displayName}!</h1>
            <p className="type-body-md text-ink">Gib deine Zahlen ein.</p>
          </div>

          <div className="mt-auto flex flex-col gap-4">
            <div data-testid="ziffern-punkte" className="flex justify-center gap-4" aria-hidden>
              {Array.from({ length: PIN_LENGTH }, (_, index) => (
                <span
                  key={index}
                  className={cn(
                    'size-5 rounded-full',
                    index < pin.length ? 'bg-primary' : 'border-2 border-border-control',
                  )}
                />
              ))}
            </div>
            {/* Leer, solange nach einem Fehler noch nichts eingegeben ist: sonst kaeme
                "0 Ziffern eingegeben" als zweite Ansage neben der Fehlermeldung. */}
            <span className="sr-only" role="status">
              {error && pin.length === 0
                ? ''
                : pin.length === 1
                  ? '1 Ziffer eingegeben'
                  : `${pin.length} Ziffern eingegeben`}
            </span>

            {error ? <ErrorNote message={error} /> : null}

            {/* Ziffernfeld im unteren Bildschirmdrittel - mit dem Daumen
                erreichbar, auch auf einem grossen Tablet. */}
            <div className="grid grid-cols-3 justify-items-center gap-4">
              {DIGITS.map((digit) => (
                <button
                  key={digit}
                  ref={digit === '1' ? firstKey : undefined}
                  type="button"
                  className={keyClass}
                  disabled={busy}
                  onClick={() => press(digit)}
                >
                  {digit}
                </button>
              ))}
              <span aria-hidden />
              <button type="button" className={keyClass} disabled={busy} onClick={() => press('0')}>
                0
              </button>
              <button
                type="button"
                aria-label="Letzte Ziffer löschen"
                className="flex size-20 items-center justify-center rounded-full text-ink transition active:scale-95 disabled:opacity-50"
                disabled={busy}
                onClick={removeLast}
              >
                <Delete className="size-8" aria-hidden />
              </button>
            </div>

            {/* Sendet nie selbst: die vierte Ziffer sendet ab, der Button zeigt das Warten. */}
            <Button type="button" size="lg" className="sticky bottom-float-bottom w-full" disabled>
              {busy ? 'Einen Moment …' : 'Los geht’s'}
            </Button>
          </div>
        </>
      )}
    </main>
  )
}
