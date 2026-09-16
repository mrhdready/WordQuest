import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ErrorNote, Label } from '@/components/ui/misc'
import { useAuth } from '@/lib/auth'

export function GuardianLoginPage() {
  const navigate = useNavigate()
  const { loginAsGuardian } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await loginAsGuardian(email, password)
      navigate('/verwalten', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Anmeldung fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-5 py-8 safe-top safe-bottom">
      <Card>
        <CardHeader>
          <CardTitle>Anmelden</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {error ? <ErrorNote message={error} /> : null}

            <Button type="submit" size="lg" disabled={busy}>
              {busy ? 'Einen Moment …' : 'Anmelden'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Link to="/" className="mt-6 text-center text-sm font-semibold text-ink-soft underline">
        Zur Profilauswahl
      </Link>
    </div>
  )
}
