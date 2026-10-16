import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { ListGroup, ListRow } from '@/components/ui/list'
import { EmptyState, Spinner, SuccessNote } from '@/components/ui/misc'
import { api } from '@/lib/api'
import { avatarFor } from '@/lib/avatars'
import type { Learner } from '@/types'

export function ChildrenPage() {
  const location = useLocation()
  // Erfolgsmeldung vom Anlege-Formular (Router-State, ueberlebt kein Neuladen).
  const message = (location.state as { message?: string } | null)?.message

  const learners = useQuery({
    queryKey: ['learners'],
    queryFn: () => api<Learner[]>('/learners'),
  })

  if (learners.isLoading) return <Spinner />

  // Ohne Card: ListGroup und EmptyState sind selbst Glas (DESIGN.md: kein Glas auf Glas).
  return (
    <div className="flex flex-col gap-4">
      {message ? <SuccessNote message={message} /> : null}
      <h2 className="type-headline text-ink">Kinder</h2>
      {learners.data?.length === 0 ? (
        <EmptyState title="Noch kein Kinderprofil" hint="Lege das erste Kind an, damit es lernen kann." />
      ) : null}
      {learners.data?.length ? (
        <ListGroup>
          {learners.data.map((learner) => (
            <ListRow key={learner.id}>
              <span className="type-emoji" aria-hidden>
                {avatarFor(learner.avatarKey)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words type-body-lg">{learner.displayName}</p>
                <p className="type-body-md text-ink-soft">Neue Karten pro Tag: {learner.dailyNewLimit}</p>
              </div>
            </ListRow>
          ))}
        </ListGroup>
      ) : null}
    </div>
  )
}
