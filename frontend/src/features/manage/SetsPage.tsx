import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ListGroup, ListRow } from '@/components/ui/list'
import { EmptyState, ErrorNote, Spinner } from '@/components/ui/misc'
import { api } from '@/lib/api'
import type { VocabularySet } from '@/types'

export function SetsPage() {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  // Das Formular oeffnet der "+" neben der Tab-Leiste ueber ?neu=1.
  const [searchParams, setSearchParams] = useSearchParams()
  const showForm = searchParams.has('neu')

  function closeForm() {
    setSearchParams((params) => {
      params.delete('neu')
      return params
    })
  }

  const sets = useQuery({
    queryKey: ['sets'],
    queryFn: () => api<VocabularySet[]>('/sets'),
  })

  const create = useMutation({
    mutationFn: (newTitle: string) =>
      api<VocabularySet>('/sets', { method: 'POST', body: { title: newTitle } }),
    onSuccess: () => {
      setTitle('')
      closeForm()
      void queryClient.invalidateQueries({ queryKey: ['sets'] })
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (title.trim()) create.mutate(title.trim())
  }

  if (sets.isLoading) return <Spinner />

  return (
    <div className="flex flex-col gap-4">
      {showForm ? (
        <Card>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="z. B. Unit 3 — At the zoo"
            />
            {create.isError ? <ErrorNote message="Das Set konnte nicht angelegt werden." /> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={create.isPending}>
                Anlegen
              </Button>
              <Button type="button" variant="ghost" onClick={closeForm}>
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {sets.data?.length === 0 && !showForm ? (
        <EmptyState
          title="Noch keine Vokabelsets"
          hint="Lege ein Set an — zum Beispiel eine Unit aus dem Schulbuch."
        />
      ) : null}

      {sets.data && sets.data.length > 0 ? (
        <ListGroup>
          {sets.data.map((set) => (
            <ListRow key={set.id} asChild>
              <Link to={`/verwalten/sets/${set.id}`}>
                <div className="flex-1">
                  <p className="type-body-lg">{set.title}</p>
                  <p className="type-body-md text-ink-soft">
                    {set.entryCount} {set.entryCount === 1 ? 'Vokabel' : 'Vokabeln'} ·{' '}
                    {set.sourceLanguage.toUpperCase()} → {set.targetLanguage.toUpperCase()}
                  </p>
                </div>
                <ChevronRight className="size-5 text-ink-soft" aria-hidden />
              </Link>
            </ListRow>
          ))}
        </ListGroup>
      ) : null}
    </div>
  )
}
