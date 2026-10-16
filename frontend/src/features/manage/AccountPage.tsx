import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SuccessNote } from '@/components/ui/misc'
import { api, ApiError } from '@/lib/api'
import type { ChangePasswordRequest } from '@/types'

type Errors = Partial<Record<keyof ChangePasswordRequest, string>>

export function AccountPage() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [done, setDone] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErrors({})
    setDone(false)
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
      if (caught instanceof ApiError && caught.errors) {
        setErrors({
          currentPassword: caught.errors.currentPassword?.[0],
          newPassword: caught.errors.newPassword?.[0],
        })
      }
    }
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Passwort ändern</CardTitle>
      </CardHeader>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field id="aktuelles-passwort" label="Aktuelles Passwort" error={errors.currentPassword}>
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          )}
        </Field>
        <Field
          id="neues-passwort"
          label="Neues Passwort"
          hint="Mindestens 8 Zeichen."
          error={errors.newPassword}
        >
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
            />
          )}
        </Field>
        <Field id="passwort-wiederholen" label="Neues Passwort wiederholen">
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
            />
          )}
        </Field>
        <Button type="submit">Passwort ändern</Button>
        {done ? (
          <SuccessNote message="Dein Passwort wurde geändert. Beim nächsten Anmelden gilt das neue Passwort." />
        ) : null}
      </form>
    </Card>
  )
}
