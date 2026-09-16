import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorNote, Spinner } from '@/components/ui/misc'
import { api } from '@/lib/api'
import type { VocabularySet } from '@/types'

export function SetsPage() {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [showForm, setShowForm] = useState(false)

  const sets = useQuery({
    queryKey: ['sets'],
    queryFn: () => api<VocabularySet[]>('/sets'),
  })

  const create = useMutation({
    mutationFn: (newTitle: string) =>
      api<VocabularySet>('/sets', { method: 'POST', body: { title: newTitle } }),
    onSuccess: () => {
      setTitle('')
      setShowForm(false)
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
      {sets.data?.length === 0 && !showForm ? (
        <EmptyState
          title="Noch keine Vokabelsets"
          hint="Lege ein Set an — zum Beispiel eine Unit aus dem Schulbuch."
        />
      ) : null}

      {sets.data?.map((set) => (
        <Link key={set.id} to={`/verwalten/sets/${set.id}`}>
          <Card className="transition active:scale-[0.99]">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex-1">
                <p className="font-bold">{set.title}</p>
                <p className="text-sm text-ink-soft">
                  {set.entryCount} {set.entryCount === 1 ? 'Vokabel' : 'Vokabeln'} ·{' '}
                  {set.sourceLanguage.toUpperCase()} → {set.targetLanguage.toUpperCase()}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-ink-soft" />
            </CardContent>
          </Card>
        </Link>
      ))}

      {showForm ? (
        <Card>
          <CardContent className="pt-5">
            <form onSubmit={submit} className="flex flex-col gap-3">
              <Input
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="z. B. Unit 3 — At the zoo"
              />
              {create.isError ? <ErrorNote message="Das Set konnte nicht angelegt werden." /> : null}
              <div className="flex gap-2">
                <Button type="submit" disabled={create.isPending}>
                  Anlegen
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                  Abbrechen
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button variant="secondary" size="lg" onClick={() => setShowForm(true)}>
          <Plus className="h-5 w-5" />
          Neues Set
        </Button>
      )}
    </div>
  )
}
