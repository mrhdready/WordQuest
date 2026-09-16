import { useQuery } from '@tanstack/react-query'
import { Flame, LogOut, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, Progress, Spinner } from '@/components/ui/misc'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { avatarFor } from '@/lib/avatars'
import type { LearnerOverview, VocabularySet } from '@/types'

export function LearnHomePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [selectedSet, setSelectedSet] = useState<string | null>(null)

  const overview = useQuery({
    queryKey: ['overview', user?.id],
    queryFn: () => api<LearnerOverview>(`/learners/${user!.id}/overview`),
    enabled: Boolean(user),
  })

  const sets = useQuery({
    queryKey: ['sets'],
    queryFn: () => api<VocabularySet[]>('/sets'),
  })

  if (overview.isLoading || sets.isLoading) return <Spinner />

  const data = overview.data
  const availableSets = sets.data ?? []
  const nothingDue = data !== undefined && data.dueToday === 0 && data.newRemainingToday === 0

  return (
    <div className="mx-auto w-full max-w-lg px-5 py-6 safe-top safe-bottom">
      <header className="mb-6 flex items-center gap-3">
        <span className="text-4xl" aria-hidden>
          {avatarFor(undefined)}
        </span>
        <div className="flex-1">
          <p className="text-sm text-ink-soft">Hallo,</p>
          <p className="text-xl font-bold">{data?.displayName ?? user?.displayName}</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Abmelden" onClick={() => void logout()}>
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      {data ? (
        <Card className="mb-5">
          <CardContent className="pt-5">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-brand-strong">Level {data.level}</span>
              <span className="flex items-center gap-1 text-sm font-bold text-warn">
                <Flame className="h-4 w-4" />
                {data.streak} {data.streak === 1 ? 'Tag' : 'Tage'}
              </span>
            </div>

            <Progress value={data.levelProgress} />

            <p className="mt-2 text-sm text-ink-soft">
              Noch {data.xpToNextLevel} XP bis Level {data.level + 1}
            </p>

            <div className="mt-4 flex gap-4 text-sm">
              <span className="font-semibold text-coin">🪙 {data.coins}</span>
              <span className="text-ink-soft">
                {data.cardsMastered} von {data.cardsTotal} Karten sitzen
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {availableSets.length === 0 ? (
        <EmptyState
          title="Noch keine Vokabeln da"
          hint="Ein Elternteil kann im Verwaltungsbereich ein Set anlegen."
        />
      ) : (
        <>
          <h2 className="mb-3 text-sm font-bold text-ink-soft uppercase">Was möchtest du üben?</h2>
          <div className="mb-6 flex flex-col gap-2">
            <button
              onClick={() => setSelectedSet(null)}
              className={tile(selectedSet === null)}
              type="button"
            >
              <span className="font-bold">Alles, was heute dran ist</span>
              <span className="text-sm text-ink-soft">{data?.dueToday ?? 0} Karten fällig</span>
            </button>

            {availableSets.map((set) => (
              <button
                key={set.id}
                onClick={() => setSelectedSet(set.id)}
                className={tile(selectedSet === set.id)}
                type="button"
              >
                <span className="font-bold">{set.title}</span>
                <span className="text-sm text-ink-soft">{set.entryCount} Vokabeln</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Primaeraktion unten: mit dem Daumen erreichbar. */}
      {nothingDue ? (
        <Card className="bg-success-soft">
          <CardContent className="flex items-center gap-3 pt-5">
            <Sparkles className="h-6 w-6 shrink-0 text-success" />
            <p className="font-semibold text-success">
              Für heute ist alles erledigt. Morgen geht es weiter!
            </p>
          </CardContent>
        </Card>
      ) : (
        <Button
          size="xl"
          className="w-full"
          disabled={availableSets.length === 0}
          onClick={() =>
            navigate(`/lernen${selectedSet ? `?set=${selectedSet}` : ''}`)
          }
        >
          Los geht&apos;s
        </Button>
      )}
    </div>
  )
}

function tile(active: boolean) {
  const base =
    'flex touch-target flex-col items-start justify-center rounded-2xl border-2 px-4 py-3 text-left transition active:scale-[0.98]'
  return active
    ? `${base} border-brand bg-brand-soft`
    : `${base} border-border-subtle bg-surface-raised`
}
