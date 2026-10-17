import { useQuery } from '@tanstack/react-query'
import { Check, Flame, LogOut, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge, EmptyState, ErrorNote, Progress, Spinner } from '@/components/ui/misc'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { avatarFor } from '@/lib/avatars'
import { cn } from '@/lib/utils'
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
  // Ladefehler ist nicht "gibt es nicht" (WR-03): sonst stuenden "Noch keine Vokabeln da"
  // oder "0 Karten fällig" da. Kopfzeile mit "Abmelden" bleibt.
  const loadError =
    (overview.isError && !overview.data ? overview.error : null) ??
    (sets.isError && !sets.data ? sets.error : null)

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-screen-margin pt-screen-top pb-8 safe-top safe-bottom">
      <header className="mb-6 flex items-center gap-4">
        <span className="type-emoji" aria-hidden>
          {avatarFor(undefined)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="type-body-md text-ink">Hallo,</p>
          <p className="break-words type-title">{data?.displayName ?? user?.displayName}</p>
        </div>
        <Button variant="round" size="icon" aria-label="Abmelden" onClick={() => void logout()}>
          <LogOut className="size-5" />
        </Button>
      </header>

      {data ? (
        <Card className="mb-6">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <span className="type-display text-ink">Level {data.level}</span>
            <Badge tone="yellow" className="gap-1">
              <Flame className="size-4" aria-hidden />
              {data.streak} {data.streak === 1 ? 'Tag' : 'Tage'}
            </Badge>
          </div>

          <Progress value={data.levelProgress} label="Fortschritt bis zum nächsten Level" />

          <p className="mt-2 type-body-md text-ink-soft">
            Noch {data.xpToNextLevel} XP bis Level {data.level + 1}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <span className="rounded-full bg-glass-opaque px-2 py-1 type-body-sm text-coin">
              {`🪙 ${data.coins}`}
            </span>
            <span className="type-body-sm text-ink-soft">
              {data.cardsMastered} von {data.cardsTotal} Karten sitzen
            </span>
          </div>
        </Card>
      ) : null}

      {loadError ? (
        <ErrorNote message={loadError.message} />
      ) : availableSets.length === 0 ? (
        <EmptyState
          title="Noch keine Vokabeln da"
          hint="Ein Elternteil kann im Verwaltungsbereich ein Set anlegen."
        />
      ) : (
        <>
          <h2 className="mb-2 type-label-section text-ink uppercase">Was möchtest du üben?</h2>
          <div className="mb-6 flex flex-col gap-2">
            <SetTile
              active={selectedSet === null}
              title="Alles, was heute dran ist"
              detail={`${data?.dueToday ?? 0} Karten fällig`}
              onSelect={() => setSelectedSet(null)}
            />

            {availableSets.map((set) => (
              <SetTile
                key={set.id}
                active={selectedSet === set.id}
                title={set.title}
                detail={`${set.entryCount} Vokabeln`}
                onSelect={() => setSelectedSet(set.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* Primaeraktion unten: mit dem Daumen erreichbar. Status-Flaeche ohne
          Glas, damit sie auch bei reduzierter Transparenz gruen bleibt. */}
      {nothingDue ? (
        <div className="mt-auto flex items-center gap-4 rounded-lg bg-surface-success p-6">
          <Sparkles className="size-6 shrink-0 text-success-text" aria-hidden />
          <p className="type-body-md-strong text-success-text">
            Für heute ist alles erledigt. Morgen geht es weiter!
          </p>
        </div>
      ) : (
        <Button
          size="lg"
          className="sticky bottom-float-bottom mt-auto w-full"
          disabled={availableSets.length === 0}
          onClick={() =>
            navigate(`/lernen${selectedSet ? `?set=${selectedSet}` : ''}`)
          }
        >
          Los geht’s
        </Button>
      )}
    </main>
  )
}

// Auswahl-Kachel als Glas-Kapsel; gewaehlt zusaetzlich mit Haken und
// aria-pressed, damit der Zustand nicht nur an der Flaeche haengt.
function SetTile({
  active,
  title,
  detail,
  onSelect,
}: {
  active: boolean
  title: string
  detail: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        'flex min-h-15 items-center gap-4 rounded-full px-6 py-2 text-left text-ink transition active:scale-[0.98]',
        active ? 'glass-selected' : 'glass',
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="break-words type-headline">{title}</span>
        <span className="type-body-sm text-ink-soft">{detail}</span>
      </span>
      {active ? <Check className="size-6 shrink-0" aria-hidden /> : null}
    </button>
  )
}
