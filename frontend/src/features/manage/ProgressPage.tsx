import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, EmptyState, Progress, Spinner } from '@/components/ui/misc'
import { api } from '@/lib/api'
import { avatarFor } from '@/lib/avatars'
import { cn } from '@/lib/utils'
import type { Learner, LearnerOverview, TrafficLightRow } from '@/types'

const STATUS_LABEL: Record<TrafficLightRow['status'], string> = {
  green: 'sitzt sicher',
  yellow: 'unsicher',
  red: 'muss wiederholt werden',
  new: 'noch nicht dran',
}

const STATUS_TONE = {
  green: 'green',
  yellow: 'yellow',
  red: 'red',
  new: 'neutral',
} as const

export function ProgressPage() {
  const [selected, setSelected] = useState<string | null>(null)

  const learners = useQuery({
    queryKey: ['learners'],
    queryFn: () => api<Learner[]>('/learners'),
  })

  const learnerId = selected ?? learners.data?.[0]?.id ?? null

  const overview = useQuery({
    queryKey: ['overview', learnerId],
    queryFn: () => api<LearnerOverview>(`/learners/${learnerId}/overview`),
    enabled: Boolean(learnerId),
  })

  const trafficLight = useQuery({
    queryKey: ['traffic-light', learnerId],
    queryFn: () => api<TrafficLightRow[]>(`/learners/${learnerId}/traffic-light`),
    enabled: Boolean(learnerId),
  })

  if (learners.isLoading) return <Spinner />

  if (!learners.data?.length) {
    return (
      <EmptyState
        title="Noch kein Kinderprofil"
        hint="Ohne Profil gibt es nichts auszuwerten."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {learners.data.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {learners.data.map((learner) => (
            <button
              key={learner.id}
              onClick={() => setSelected(learner.id)}
              className={cn(
                'flex touch-target shrink-0 items-center gap-2 rounded-2xl border-2 px-4 font-semibold transition',
                learner.id === learnerId
                  ? 'border-brand bg-brand-soft'
                  : 'border-border-subtle bg-surface-raised',
              )}
            >
              <span aria-hidden>{avatarFor(learner.avatarKey)}</span>
              {learner.displayName}
            </button>
          ))}
        </div>
      ) : null}

      {overview.data ? (
        <Card>
          <CardContent className="pt-5">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-lg font-bold">Level {overview.data.level}</span>
              <span className="text-sm text-ink-soft">🔥 {overview.data.streak} Tage</span>
            </div>

            <Progress value={overview.data.levelProgress} />

            <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
              <Stat label="heute fällig" value={overview.data.dueToday} />
              <Stat label="neue Wörter frei" value={overview.data.newRemainingToday} />
              <Stat
                label="sitzen sicher"
                value={`${overview.data.cardsMastered}/${overview.data.cardsTotal}`}
              />
            </dl>
          </CardContent>
        </Card>
      ) : null}

      {trafficLight.isLoading ? <Spinner /> : null}

      {trafficLight.data?.length ? (
        <Card>
          <CardContent className="pt-5">
            <h2 className="mb-3 font-bold">Wortschatz</h2>
            <p className="mb-4 text-sm text-ink-soft">
              Grün heißt: beide Richtungen sitzen — vom Deutschen ins Englische und zurück.
            </p>

            <div className="flex flex-col divide-y divide-border-subtle">
              {trafficLight.data.map((row) => (
                <div key={row.entryId} className="flex items-center gap-3 py-2">
                  <div className="flex-1">
                    <p className="font-medium">
                      {row.sourceText} <span className="text-ink-soft">→</span> {row.targetText}
                    </p>
                    {row.lapses > 0 ? (
                      <p className="text-xs text-ink-soft">
                        {row.lapses}× wieder vergessen
                      </p>
                    ) : null}
                  </div>
                  <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dd className="text-xl font-black text-brand-strong">{value}</dd>
      <dt className="text-xs text-ink-soft">{label}</dt>
    </div>
  )
}
