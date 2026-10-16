import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ErrorNote } from '@/components/ui/misc'
import { api, ApiError } from '@/lib/api'
import type { CreateLearnerRequest, Learner } from '@/types'

// Spiegelt AccountRules (MaxDisplayNameLength, IsValidPin, Tageslimit 3 bis 15);
// massgeblich bleibt der Server. [0-9] statt \d: nur die Ziffern des Ziffernfelds.
const MAX_NAME_LENGTH = 100
const PIN_PATTERN = /^[0-9]{4,6}$/

interface Errors {
  name?: string
  limit?: string
  pin?: string
}

// Name zaehlt wie auf dem Server nach dem Trimmen.
function validate(name: string, limit: string, pin: string): Errors {
  const errors: Errors = {}
  if (!name.trim()) errors.name = 'Wie soll das Kind heißen? Ein Spitzname genügt.'
  else if (name.trim().length > MAX_NAME_LENGTH)
    errors.name = 'Der Name darf höchstens 100 Zeichen lang sein.'
  const count = Number(limit)
  if (!limit.trim() || !Number.isInteger(count) || count < 3 || count > 15)
    errors.limit = 'Bitte gib eine Zahl von 3 bis 15 ein.'
  if (!pin) errors.pin = 'Bitte gib eine PIN mit 4 bis 6 Ziffern ein.'
  else if (!PIN_PATTERN.test(pin)) errors.pin = 'Die PIN muss aus 4 bis 6 Ziffern bestehen.'
  return errors
}

// Modus "Bearbeiten" folgt in 01-08.
export function ChildFormPage({ mode: _mode }: { mode: 'create' }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [limit, setLimit] = useState('5')
  const [pin, setPin] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const refs = {
    name: useRef<HTMLInputElement>(null),
    limit: useRef<HTMLInputElement>(null),
    pin: useRef<HTMLInputElement>(null),
  }

  function showErrors(found: Errors) {
    setErrors(found)
    const first = (['name', 'limit', 'pin'] as const).find((key) => found[key])
    if (first) refs[first].current?.focus()
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // Ref statt nur disabled: ein zweiter Klick kann vor dem naechsten Rendern ankommen.
    if (busyRef.current) return
    setFailure(null)
    const found = validate(name, limit, pin)
    if (Object.keys(found).length > 0) {
      showErrors(found)
      return
    }
    setErrors({})
    busyRef.current = true
    setBusy(true)
    try {
      await api<Learner>('/learners', {
        method: 'POST',
        body: { displayName: name, pin, dailyNewLimit: Number(limit) } satisfies CreateLearnerRequest,
      })
      void queryClient.invalidateQueries({ queryKey: ['learners'] })
      navigate('/verwalten/kinder', {
        state: { message: 'Das Kind ist angelegt. Es kann sich jetzt mit seiner PIN anmelden.' },
      })
    } catch (caught) {
      // Feldfehler des Servers am Feld, alles ohne Feldbezug im Hinweis ueber dem Button.
      const fieldErrors: Errors =
        caught instanceof ApiError
          ? { name: caught.errors?.displayName?.[0], pin: caught.errors?.pin?.[0] }
          : {}
      if (fieldErrors.name || fieldErrors.pin) showErrors(fieldErrors)
      else setFailure(caught instanceof Error ? caught.message : 'Das hat nicht geklappt. Versuche es noch einmal.')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link to="/verwalten/kinder" className="flex items-center gap-2 self-start type-body-md-strong text-ink">
        <span className="glass-clear flex size-12 items-center justify-center rounded-full">
          <ArrowLeft className="size-5" aria-hidden />
        </span>
        Alle Kinder
      </Link>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Kind anlegen</CardTitle>
        </CardHeader>
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field id="kind-name" label="Name" error={errors.name}>
            {(control) => (
              <Input
                {...control}
                ref={refs.name}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>
          <Field
            id="kind-limit"
            label="Neue Karten pro Tag"
            hint="Zwischen 3 und 15. Mehr neue Wörter heute bedeuten mehr Wiederholungen an den Folgetagen."
            error={errors.limit}
          >
            {(control) => (
              <Input
                {...control}
                ref={refs.limit}
                type="number"
                min={3}
                max={15}
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
              />
            )}
          </Field>
          <Field id="kind-pin" label="PIN" hint="4 bis 6 Ziffern. Sag sie deinem Kind." error={errors.pin}>
            {(control) => (
              <Input
                {...control}
                ref={refs.pin}
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
              />
            )}
          </Field>
          {failure ? <ErrorNote message={failure} /> : null}
          <Button type="submit" disabled={busy}>
            {busy ? 'Einen Moment …' : 'Kind anlegen'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
