import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useRef, useState, type FormEvent, type RefObject } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorNote, Spinner, SuccessNote } from '@/components/ui/misc'
import { api, ApiError } from '@/lib/api'
import type { CreateLearnerRequest, Learner, UpdateLearnerSettingsRequest } from '@/types'

// Spiegelt AccountRules (MaxDisplayNameLength, IsValidPin, Tageslimit 3 bis 15);
// massgeblich bleibt der Server. [0-9] statt \d: nur die Ziffern des Ziffernfelds.
const MAX_NAME_LENGTH = 100
const PIN_PATTERN = /^[0-9]{4,6}$/

interface Errors {
  name?: string
  limit?: string
  pin?: string
}

// Name zaehlt wie auf dem Server nach dem Trimmen. Beim Bearbeiten eines Kindes
// mit PIN ist eine leere PIN gueltig (unveraendert), eine aus Leerzeichen nicht.
function validate(name: string, limit: string, pin: string, pinOptional: boolean): Errors {
  const errors: Errors = {}
  if (!name.trim()) errors.name = 'Wie soll das Kind heißen? Ein Spitzname genügt.'
  else if (name.trim().length > MAX_NAME_LENGTH)
    errors.name = 'Der Name darf höchstens 100 Zeichen lang sein.'
  const count = Number(limit)
  if (!limit.trim() || !Number.isInteger(count) || count < 3 || count > 15)
    errors.limit = 'Bitte gib eine Zahl von 3 bis 15 ein.'
  if (!pin) {
    if (!pinOptional) errors.pin = 'Bitte gib eine PIN mit 4 bis 6 Ziffern ein.'
  } else if (!PIN_PATTERN.test(pin)) errors.pin = 'Die PIN muss aus 4 bis 6 Ziffern bestehen.'
  return errors
}

// Ein Formular fuer Anlegen und Bearbeiten (D-08).
export function ChildFormPage({ mode }: { mode: 'create' | 'edit' }) {
  // Fokusziel, wenn das Kind beim Loeschen schon weg war und "Kind loeschen" mit dem Formular verschwindet.
  const backRef = useRef<HTMLAnchorElement>(null)
  return (
    <div className="flex flex-col gap-4">
      <Link ref={backRef} to="/verwalten/kinder" className="flex items-center gap-2 self-start type-body-md-strong text-ink">
        <span className="glass-clear flex size-12 items-center justify-center rounded-full">
          <ArrowLeft className="size-5" aria-hidden />
        </span>
        Alle Kinder
      </Link>
      {mode === 'create' ? <ChildForm /> : <EditChild backRef={backRef} />}
    </div>
  )
}

// Es gibt keinen Einzelabruf: das Kind kommt aus der Liste ['learners'].
function EditChild({ backRef }: { backRef: RefObject<HTMLAnchorElement | null> }) {
  const { learnerId } = useParams()
  const learners = useQuery({
    queryKey: ['learners'],
    queryFn: () => api<Learner[]>('/learners'),
  })

  if (learners.isLoading) return <Spinner />
  // Ladefehler ist nicht "gibt es nicht": sonst haelt man ein vorhandenes Kind fuer geloescht.
  // Nur der Erstladefehler: scheitert spaeter ein Neuladen, bleibt das Formular samt Eingaben stehen.
  if (learners.isError && !learners.data) return <ErrorNote message={learners.error.message} />
  const learner = learners.data?.find((entry) => entry.id === learnerId)
  // Der Weg zurueck ist der Link "Alle Kinder" darueber.
  if (!learner) return <EmptyState title="Dieses Kind gibt es nicht (mehr). Gehe zurück zur Liste." />
  return (
    <>
      <ChildForm key={learner.id} learner={learner} />
      <DeleteChild key={`loeschen-${learner.id}`} learner={learner} backRef={backRef} />
    </>
  )
}

// Ausserhalb des <form>: Enter im Formular oeffnet nie den Loeschdialog.
function DeleteChild({ learner, backRef }: { learner: Learner; backRef: RefObject<HTMLAnchorElement | null> }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 404: das Kind ist schon weg (anderer Tab). Dann verschwindet "Kind loeschen" mit dem Formular.
  const [gone, setGone] = useState(false)
  const busyRef = useRef(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const name = learner.displayName

  function changeOpen(next: boolean) {
    setOpen(next)
    if (next) return
    setError(null)
    // Erst beim Schliessen neu laden: ein Neuladen bei offenem Dialog nimmt das Kind
    // aus der Liste, und das Formular verschwindet samt Dialog und Fehlertext.
    if (gone) {
      void queryClient.invalidateQueries({ queryKey: ['learners'] })
      void queryClient.invalidateQueries({ queryKey: ['profiles'] })
    }
  }

  async function confirm() {
    // Ref statt nur disabled: ein zweiter Klick kann vor dem naechsten Rendern ankommen.
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      await api<void>(`/learners/${learner.id}`, { method: 'DELETE' })
      for (const key of ['learners', 'profiles', 'overview', 'traffic-light']) {
        void queryClient.invalidateQueries({ queryKey: [key] })
      }
      navigate('/verwalten/kinder', { state: { message: `${name} ist gelöscht.` } })
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) setGone(true)
      setError(caught instanceof Error ? caught.message : 'Das hat nicht geklappt. Versuche es noch einmal.')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <div className="flex max-w-md flex-col">
      <Button ref={triggerRef} type="button" variant="danger" className="self-start" onClick={() => changeOpen(true)}>
        <Trash2 className="size-5" aria-hidden />
        Kind löschen
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={changeOpen}
        title={`${name} löschen?`}
        description={`Alle Lernfortschritte, XP und die Serie von ${name} werden gelöscht. Das lässt sich nicht rückgängig machen.`}
        confirmLabel="Endgültig löschen"
        busy={busy}
        error={error}
        onConfirm={() => void confirm()}
        returnFocusRef={gone ? backRef : triggerRef}
      />
    </div>
  )
}

function ChildForm({ learner }: { learner?: Learner }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState(learner?.displayName ?? '')
  const [limit, setLimit] = useState(String(learner?.dailyNewLimit ?? 5))
  // Die bestehende PIN kennt nur der Server als Hash; das Feld startet immer leer.
  const [pin, setPin] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
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

  async function save() {
    if (!learner) {
      await api<Learner>('/learners', {
        method: 'POST',
        body: { displayName: name, pin, dailyNewLimit: Number(limit) } satisfies CreateLearnerRequest,
      })
      void queryClient.invalidateQueries({ queryKey: ['learners'] })
      // Profilwahl auf demselben Geraet soll das neue Kind sofort zeigen (IN-05).
      void queryClient.invalidateQueries({ queryKey: ['profiles'] })
      navigate('/verwalten/kinder', {
        state: { message: 'Das Kind ist angelegt. Es kann sich jetzt mit seiner PIN anmelden.' },
      })
      return
    }
    const body: UpdateLearnerSettingsRequest = { displayName: name.trim(), dailyNewLimit: Number(limit) }
    if (pin) body.pin = pin
    await api<Learner>(`/learners/${learner.id}/settings`, { method: 'PATCH', body })
    setPin('')
    setSaved(
      pin ? 'Die Änderungen sind gespeichert. Die neue PIN gilt ab sofort.' : 'Die Änderungen sind gespeichert.',
    )
    void queryClient.invalidateQueries({ queryKey: ['learners'] })
    void queryClient.invalidateQueries({ queryKey: ['profiles'] })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // Ref statt nur disabled: ein zweiter Klick kann vor dem naechsten Rendern ankommen.
    if (busyRef.current) return
    setFailure(null)
    setSaved(null)
    // Ohne PIN kann sich das Kind nie anmelden: dann ist sie auch beim Bearbeiten Pflicht (WR-02).
    const found = validate(name, limit, pin, learner?.hasPin === true)
    if (Object.keys(found).length > 0) {
      showErrors(found)
      return
    }
    setErrors({})
    busyRef.current = true
    setBusy(true)
    try {
      await save()
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

  const submitLabel = learner ? 'Änderungen speichern' : 'Kind anlegen'
  const pinHint = !learner
    ? '4 bis 6 Ziffern. Sag sie deinem Kind.'
    : learner.hasPin
      ? '4 bis 6 Ziffern. Leer lassen, wenn die PIN gleich bleiben soll.'
      : 'Für dieses Kind ist noch keine PIN gesetzt.'

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>{learner ? 'Kind bearbeiten' : 'Kind anlegen'}</CardTitle>
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
        <Field id="kind-pin" label={learner ? 'Neue PIN' : 'PIN'} hint={pinHint} error={errors.pin}>
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
          {busy ? 'Einen Moment …' : submitLabel}
        </Button>
        {saved ? <SuccessNote message={saved} /> : null}
      </form>
    </Card>
  )
}
