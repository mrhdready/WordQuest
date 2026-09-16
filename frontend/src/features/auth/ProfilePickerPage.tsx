import { useQuery } from '@tanstack/react-query'
import { Delete } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ErrorNote, Spinner } from '@/components/ui/misc'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { avatarFor } from '@/lib/avatars'
import type { LearnerTile } from '@/types'

const PIN_LENGTH = 4

/**
 * Startbildschirm des Kindes: Avatar antippen, vierstellige PIN eingeben.
 *
 * Kein Passwortfeld und keine Tastatur — das ist die haeufigste Abbruchstelle
 * bei Lern-Apps (Konzept §3).
 */
export function ProfilePickerPage() {
  const navigate = useNavigate()
  const { loginAsLearner } = useAuth()

  const [selected, setSelected] = useState<LearnerTile | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const profiles = useQuery({
    queryKey: ['profiles'],
    queryFn: () => api<LearnerTile[]>('/auth/profiles'),
    retry: false,
  })

  async function submit(nextPin: string) {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      await loginAsLearner(selected.id, nextPin)
      navigate('/', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Das hat nicht geklappt.')
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  function press(digit: string) {
    if (busy || pin.length >= PIN_LENGTH) return
    const next = pin + digit
    setPin(next)
    if (next.length === PIN_LENGTH) void submit(next)
  }

  if (profiles.isLoading) return <Spinner />

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col px-5 py-8 safe-top safe-bottom">
      {!selected ? (
        <>
          <h1 className="mb-8 text-center text-2xl font-bold">Wer lernt heute?</h1>

          {profiles.isError ? (
            <ErrorNote message="Die Profile konnten nicht geladen werden." />
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            {(profiles.data ?? []).map((profile) => (
              <button
                key={profile.id}
                onClick={() => {
                  setSelected(profile)
                  setPin('')
                  setError(null)
                }}
                className="animate-pop flex flex-col items-center gap-3 rounded-[var(--radius-card)] border-2 border-border-subtle bg-surface-raised p-6 transition active:scale-95"
              >
                <span className="text-6xl" aria-hidden>
                  {avatarFor(profile.avatarKey)}
                </span>
                <span className="text-lg font-bold">{profile.displayName}</span>
              </button>
            ))}
          </div>

          {profiles.data?.length === 0 ? (
            <p className="mt-8 text-center text-sm text-ink-soft">
              Hier ist noch kein Kinderprofil angelegt.
            </p>
          ) : null}

          <div className="mt-auto pt-10 text-center">
            <Link to="/login" className="text-sm font-semibold text-ink-soft underline">
              Ich bin ein Elternteil
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="mb-6 flex flex-col items-center gap-2">
            <span className="text-6xl" aria-hidden>
              {avatarFor(selected.avatarKey)}
            </span>
            <h1 className="text-xl font-bold">Hallo, {selected.displayName}!</h1>
            <p className="text-sm text-ink-soft">Gib deine vier Zahlen ein.</p>
          </div>

          <div className="mb-6 flex justify-center gap-3" aria-label="PIN-Eingabe">
            {Array.from({ length: PIN_LENGTH }, (_, index) => (
              <span
                key={index}
                className={
                  index < pin.length
                    ? 'h-5 w-5 rounded-full bg-brand'
                    : 'h-5 w-5 rounded-full bg-brand-soft'
                }
              />
            ))}
          </div>

          {error ? <ErrorNote message={error} /> : null}

          {/* Ziffernfeld im unteren Bildschirmdrittel — mit dem Daumen
              erreichbar, auch auf einem grossen Tablet. */}
          <div className="mt-auto grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <Button
                key={digit}
                variant="outline"
                size="xl"
                disabled={busy}
                onClick={() => press(digit)}
              >
                {digit}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="xl"
              onClick={() => {
                setSelected(null)
                setPin('')
                setError(null)
              }}
            >
              Zurück
            </Button>
            <Button variant="outline" size="xl" disabled={busy} onClick={() => press('0')}>
              0
            </Button>
            <Button
              variant="ghost"
              size="xl"
              aria-label="Letzte Ziffer löschen"
              disabled={busy}
              onClick={() => setPin(pin.slice(0, -1))}
            >
              <Delete className="h-6 w-6" />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
