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

// PIN mit 4 bis 6 Ziffern (PAR-02). Die Anzeige beginnt immer bei 4 Punkten,
// damit sie die Laenge der gespeicherten PIN nicht verraet (D-09).
const MIN_PIN_LENGTH = 4
const MAX_PIN_LENGTH = 6
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

// keypad-key: Glasfarbe ohne Blur je Taste (viele Blur-Ebenen ruckeln auf
// guenstigen Tablets), deckender Fallback kommt aus glass-flat-clear.
const keyClass =
  'glass-flat-clear flex size-20 items-center justify-center rounded-full type-keypad text-ink ' +
  'transition active:scale-95 disabled:opacity-50'

/**
 * Startbildschirm des Kindes: Avatar antippen, Zahlen eingeben, "Los geht’s".
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
  const firstKey = useRef<HTMLButtonElement>(null)

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

  const canSubmit = !busy && pin.length >= MIN_PIN_LENGTH

  async function submit() {
    if (!selected || !canSubmit) return
    setBusy(true)
    setError(null)
    try {
      await loginAsLearner(selected.id, pin)
      navigate('/', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Das hat nicht geklappt.')
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  function press(digit: string) {
    if (busy) return
    setPin((current) => (current.length >= MAX_PIN_LENGTH ? current : current + digit))
  }

  function removeLast() {
    if (busy) return
    setPin((current) => current.slice(0, -1))
  }

  function choose(profile: LearnerTile | null) {
    setSelected(profile)
    setPin('')
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
      } else if (event.key === 'Enter') {
        // Ein fokussierter Button handelt selbst, sonst wuerde doppelt ausgeloest.
        if (event.target instanceof HTMLButtonElement) return
        event.preventDefault()
        void submit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  if (profiles.isLoading) return <Spinner />

  const dotCount = Math.min(MAX_PIN_LENGTH, Math.max(MIN_PIN_LENGTH, pin.length))

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-screen-margin pt-screen-top pb-8 safe-top safe-bottom">
      {!selected ? (
        <>
          <h1 className="mb-8 text-center type-large-title">Wer lernt heute?</h1>

          {profiles.isError ? (
            <ErrorNote message="Die Profile konnten nicht geladen werden." />
          ) : null}

          <div className="grid grid-cols-2 gap-4">
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
              <ChevronLeft className="size-6" />
            </Button>
          </div>

          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <span className="type-emoji" aria-hidden>
              {avatarFor(selected.avatarKey)}
            </span>
            <h1 className="type-title">Hallo, {selected.displayName}!</h1>
            <p className="type-body-md text-ink">Gib deine Zahlen ein.</p>
          </div>

          <form
            className="mt-auto flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <div data-testid="ziffern-punkte" className="flex justify-center gap-4" aria-hidden>
              {Array.from({ length: dotCount }, (_, index) => (
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
                <Delete className="size-8" />
              </button>
            </div>

            <Button
              type="submit"
              size="lg"
              className="sticky bottom-float-bottom w-full"
              disabled={!canSubmit}
            >
              {busy ? 'Einen Moment …' : 'Los geht’s'}
            </Button>
          </form>
        </>
      )}
    </main>
  )
}
