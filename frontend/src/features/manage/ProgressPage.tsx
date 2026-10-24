import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge, EmptyState, ErrorNote, Progress, Spinner } from '@/components/ui/misc'
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

  // Ladefehler ist nicht "gibt es nicht" (WR-05, Muster LearnHomePage): sonst fehlte die
  // Karte still, und die Ampel eines geloeschten Kindes saehe aus wie zurueckgesetzt.
  const loadError =
    (overview.isError && !overview.data ? overview.error : null) ??
    (trafficLight.isError && !trafficLight.data ? trafficLight.error : null)

  if (learners.isLoading) return <Spinner />
  // Ladefehler ist nicht "gibt es nicht" (WR-03, Muster ChildFormPage).
  if (learners.isError && !learners.data) return <ErrorNote message={learners.error.message} />

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
        <div className="flex flex-wrap gap-2">
          {learners.data.map((learner) => (
            <button
              key={learner.id}
              onClick={() => setSelected(learner.id)}
              aria-pressed={learner.id === learnerId}
              className={cn(
                'flex min-h-touch-default min-w-0 items-center gap-2 rounded-full px-4 type-body-md-strong transition',
                learner.id === learnerId ? 'glass-selected text-primary' : 'glass text-ink',
              )}
            >
              <span className="type-emoji" aria-hidden>
                {avatarFor(learner.avatarKey)}
              </span>
              <span className="min-w-0 break-words">{learner.displayName}</span>
              {/* Haken zusaetzlich zur Farbe: Auswahl auch ohne Farbsehen erkennbar (WCAG 1.4.1). */}
              {learner.id === learnerId ? <Check className="size-5 shrink-0" aria-hidden /> : null}
            </button>
          ))}
        </div>
      ) : null}

      {loadError ? <ErrorNote message={loadError.message} /> : null}

      {overview.data ? (
        <Card>
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <span className="type-headline">Level {overview.data.level}</span>
            <span className="type-body-md text-ink-soft">
              {overview.data.streak === 0
                ? 'Keine laufende Serie'
                : `🔥 ${overview.data.streak} ${overview.data.streak === 1 ? 'Tag' : 'Tage'}`}
            </span>
          </div>

          <Progress value={overview.data.levelProgress} label="Fortschritt bis zum nächsten Level" />

          {/* Unter sm untereinander: drei Kennzahlen in display-Groesse passen bei 320 px nicht nebeneinander. */}
          <dl className="mt-4 grid gap-4 text-center sm:grid-cols-3">
            <Stat label="heute fällig" value={overview.data.dueToday} />
            <Stat label="neue Wörter frei" value={overview.data.newRemainingToday} />
            <Stat
              label="Wörter sitzen sicher"
              value={`${overview.data.cardsMastered}/${overview.data.cardsTotal}`}
            />
          </dl>
        </Card>
      ) : null}

      {trafficLight.isLoading ? <Spinner /> : null}

      {trafficLight.data?.length ? (
        <Card>
          <h2 className="mb-2 type-headline">Wortschatz</h2>
          <p className="mb-4 type-body-md text-ink-soft">
            Grün heißt: beide Richtungen sitzen — vom Deutschen ins Englische und zurück.
          </p>

          {/* Trennlinien statt ListGroup: kein Glas auf der Glas-Karte (DESIGN.md Don'ts). */}
          <div className="flex flex-col divide-y divide-separator">
            {trafficLight.data.map((row) => (
              <div key={row.entryId} className="flex items-center gap-4 py-2">
                <div className="flex-1">
                  <p className="type-body-lg">
                    {row.sourceText} → {row.targetText}
                  </p>
                  {row.lapses > 0 ? (
                    <p className="type-body-sm text-ink-soft">{row.lapses}× wieder vergessen</p>
                  ) : null}
                </div>
                <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dd className="type-display text-primary">{value}</dd>
      <dt className="type-label-section text-ink-soft">{label}</dt>
    </div>
  )
}
