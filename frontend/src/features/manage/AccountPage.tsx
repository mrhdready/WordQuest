import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ErrorNote, SuccessNote } from '@/components/ui/misc'
import { api, ApiError } from '@/lib/api'
import type { ChangePasswordRequest } from '@/types'

// Spiegelt AccountRules.MinPasswordLength; massgeblich bleibt der Server.
const MIN_LENGTH = 8

interface Errors {
  current?: string
  next?: string
  repeat?: string
}

// Laenge an der unveraenderten Eingabe: Leerzeichen am Rand gehoeren zum Passwort.
function validate(current: string, next: string, repeat: string): Errors {
  const errors: Errors = {}
  if (!current) errors.current = 'Bitte gib dein aktuelles Passwort ein.'
  if (!next.trim()) errors.next = 'Bitte gib ein neues Passwort ein.'
  else if (next.length < MIN_LENGTH)
    errors.next = 'Das neue Passwort muss mindestens 8 Zeichen lang sein.'
  if (!repeat) errors.repeat = 'Bitte wiederhole das neue Passwort.'
  // Abweichung nur bei gueltigem neuem Passwort melden, sonst doppelt fuer einen Fehler.
  else if (!errors.next && repeat !== next)
    errors.repeat = 'Die beiden neuen Passwörter stimmen nicht überein.'
  return errors
}

export function AccountPage() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const refs = {
    current: useRef<HTMLInputElement>(null),
    next: useRef<HTMLInputElement>(null),
    repeat: useRef<HTMLInputElement>(null),
  }
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Fokus bleibt am Button (UI-SPEC): der Browser nimmt ihn einem deaktivierten
  // Button weg, nach dem Speichern kommt er zurueck.
  useEffect(() => {
    if (done && document.activeElement === document.body) buttonRef.current?.focus()
  }, [done])

  function showErrors(found: Errors) {
    setErrors(found)
    const first = (['current', 'next', 'repeat'] as const).find((key) => found[key])
    if (first) refs[first].current?.focus()
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // Ref statt nur disabled: ein zweiter Klick kann vor dem naechsten Rendern ankommen.
    if (busyRef.current) return
    setDone(false)
    setFailure(null)
    const found = validate(current, next, repeat)
    if (Object.keys(found).length > 0) {
      showErrors(found)
      return
    }
    setErrors({})
    busyRef.current = true
    setBusy(true)
    try {
      await api<void>('/account/password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next } satisfies ChangePasswordRequest,
      })
      setCurrent('')
      setNext('')
      setRepeat('')
      setDone(true)
    } catch (caught) {
      // Feldfehler des Servers am Feld, alles ohne Feldbezug im Hinweis ueber dem Button.
      const fieldErrors: Errors =
        caught instanceof ApiError
          ? { current: caught.errors?.currentPassword?.[0], next: caught.errors?.newPassword?.[0] }
          : {}
      if (fieldErrors.current || fieldErrors.next) showErrors(fieldErrors)
      else setFailure(caught instanceof Error ? caught.message : 'Das hat nicht geklappt. Versuche es noch einmal.')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Passwort ändern</CardTitle>
      </CardHeader>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field id="aktuelles-passwort" label="Aktuelles Passwort" error={errors.current}>
          {(control) => (
            <Input
              {...control}
              ref={refs.current}
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          )}
        </Field>
        <Field id="neues-passwort" label="Neues Passwort" hint="Mindestens 8 Zeichen." error={errors.next}>
          {(control) => (
            <Input
              {...control}
              ref={refs.next}
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
            />
          )}
        </Field>
        <Field id="passwort-wiederholen" label="Neues Passwort wiederholen" error={errors.repeat}>
          {(control) => (
            <Input
              {...control}
              ref={refs.repeat}
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
            />
          )}
        </Field>
        {failure ? <ErrorNote message={failure} /> : null}
        <Button ref={buttonRef} type="submit" disabled={busy}>
          {busy ? 'Einen Moment …' : 'Passwort ändern'}
        </Button>
        {done ? (
          <SuccessNote message="Dein Passwort wurde geändert. Beim nächsten Anmelden gilt das neue Passwort." />
        ) : null}
      </form>
    </Card>
  )
}
