import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { api, ApiError } from '@/lib/api'
import type { CreateLearnerRequest, Learner } from '@/types'

interface Errors {
  name?: string
  limit?: string
  pin?: string
}

// Modus "Bearbeiten" folgt in 01-08.
export function ChildFormPage({ mode: _mode }: { mode: 'create' }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [limit, setLimit] = useState('5')
  const [pin, setPin] = useState('')
  const [errors, setErrors] = useState<Errors>({})

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
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
      if (caught instanceof ApiError)
        setErrors({ name: caught.errors?.displayName?.[0], pin: caught.errors?.pin?.[0] })
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
              <Input {...control} value={name} onChange={(event) => setName(event.target.value)} />
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
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
              />
            )}
          </Field>
          <Button type="submit">Kind anlegen</Button>
        </form>
      </Card>
    </div>
  )
}
