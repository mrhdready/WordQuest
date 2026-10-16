import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ListGroup, ListRow } from '@/components/ui/list'
import { EmptyState, ErrorNote, Spinner } from '@/components/ui/misc'
import { api, ApiError } from '@/lib/api'
import type { VocabularySet } from '@/types'

export function SetsPage() {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)
  // Das Formular oeffnet der "+" neben der Tab-Leiste ueber ?neu=1.
  const [searchParams, setSearchParams] = useSearchParams()
  const showForm = searchParams.has('neu')

  // Beim Schliessen Eingabe und alten Fehler verwerfen: das naechste "+" beginnt leer.
  function closeForm() {
    create.reset()
    setTitle('')
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
      closeForm()
      void queryClient.invalidateQueries({ queryKey: ['sets'] })
    },
    // Fokus auf das fehlerhafte Feld (UI-SPEC "Validierung und Fehleranzeige").
    onError: (error) => {
      if (error instanceof ApiError && error.errors?.title) titleRef.current?.focus()
    },
  })
  // Feldfehler des Servers stehen am Feld, alles andere im Hinweis darunter.
  const titleError = create.error instanceof ApiError ? create.error.errors?.title?.[0] : undefined

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
            <Field id="titel" label="Titel" error={titleError}>
              {(control) => (
                <Input
                  {...control}
                  ref={titleRef}
                  autoFocus
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="z. B. Unit 3 — At the zoo"
                />
              )}
            </Field>
            {create.isError && !titleError ? (
              <ErrorNote message="Das Set konnte nicht angelegt werden." />
            ) : null}
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
                <div className="min-w-0 flex-1">
                  <p className="break-words type-body-lg">{set.title}</p>
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
