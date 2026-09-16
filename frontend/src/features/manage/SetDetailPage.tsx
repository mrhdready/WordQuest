import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Trash2, Upload } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Badge, EmptyState, ErrorNote, Spinner } from '@/components/ui/misc'
import { api } from '@/lib/api'
import type { ImportPreview, VocabularyEntry } from '@/types'

export function SetDetailPage() {
  const { setId = '' } = useParams()
  const queryClient = useQueryClient()

  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [showImport, setShowImport] = useState(false)

  const entries = useQuery({
    queryKey: ['entries', setId],
    queryFn: () => api<VocabularyEntry[]>(`/sets/${setId}/entries`),
  })

  const addEntry = useMutation({
    mutationFn: () =>
      api<VocabularyEntry>(`/sets/${setId}/entries`, {
        method: 'POST',
        body: { sourceText: source.trim(), targetText: target.trim() },
      }),
    onSuccess: () => {
      setSource('')
      setTarget('')
      void queryClient.invalidateQueries({ queryKey: ['entries', setId] })
      void queryClient.invalidateQueries({ queryKey: ['sets'] })
    },
  })

  const removeEntry = useMutation({
    mutationFn: (entryId: string) =>
      api<void>(`/sets/${setId}/entries/${entryId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['entries', setId] })
      void queryClient.invalidateQueries({ queryKey: ['sets'] })
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (source.trim() && target.trim()) addEntry.mutate()
  }

  return (
    <div className="flex flex-col gap-4">
      <Link to="/verwalten" className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
        <ArrowLeft className="h-4 w-4" />
        Alle Sets
      </Link>

      {/* Schnellerfassung: zwei Felder, Enter, weiter. Alles andere ist
          optional und wuerde das Abtippen eines Vokabelhefts nur bremsen. */}
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="Deutsch"
              aria-label="Deutsch"
            />
            <Input
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="Englisch"
              aria-label="Englisch"
            />
            <Button type="submit" disabled={addEntry.isPending}>
              Hinzufügen
            </Button>
          </form>
        </CardContent>
      </Card>

      <Button variant="ghost" onClick={() => setShowImport((value) => !value)}>
        <Upload className="h-4 w-4" />
        {showImport ? 'Import schließen' : 'Liste importieren (CSV)'}
      </Button>

      {showImport ? (
        <ImportPanel
          setId={setId}
          onDone={() => {
            setShowImport(false)
            void queryClient.invalidateQueries({ queryKey: ['entries', setId] })
            void queryClient.invalidateQueries({ queryKey: ['sets'] })
          }}
        />
      ) : null}

      {entries.isLoading ? <Spinner /> : null}

      {entries.data?.length === 0 ? (
        <EmptyState title="Noch keine Vokabeln in diesem Set" />
      ) : (
        <div className="flex flex-col gap-2">
          {entries.data?.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex items-center gap-3 py-3">
                {entry.emoji ? <span className="text-2xl">{entry.emoji}</span> : null}
                <div className="flex-1">
                  <p className="font-semibold">
                    {entry.sourceText} <span className="text-ink-soft">→</span> {entry.targetText}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${entry.sourceText} löschen`}
                  onClick={() => removeEntry.mutate(entry.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Import in zwei Schritten: erst zeigen, was erkannt wurde, dann schreiben.
 * Ein Import ohne Korrekturansicht ist der Grund, warum Eltern solche
 * Funktionen nach dem ersten Versuch nicht mehr anfassen.
 */
function ImportPanel({ setId, onDone }: { setId: string; onDone: () => void }) {
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)

  const runPreview = useMutation({
    mutationFn: () =>
      api<ImportPreview>('/sets/import/preview', { method: 'POST', body: { content } }),
    onSuccess: setPreview,
  })

  const confirm = useMutation({
    mutationFn: () =>
      api<{ imported: number }>(`/sets/${setId}/import`, {
        method: 'POST',
        body: {
          entries: (preview?.rows ?? [])
            .filter((row) => row.problem === null)
            .map((row) => ({
              sourceText: row.source,
              targetText: row.target,
              emoji: row.emoji,
            })),
        },
      }),
    onSuccess: onDone,
  })

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <Textarea
          rows={6}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={'Hund;dog\nHaus;house\ngehen;to go'}
          className="font-mono text-sm"
        />

        <p className="text-sm text-ink-soft">
          Eine Zeile pro Vokabel: Deutsch, Trennzeichen, Englisch. Semikolon, Komma und Tabulator
          werden erkannt — eine aus Excel exportierte Datei kannst du direkt hier einfügen.
        </p>

        {preview ? (
          <>
            <div className="flex gap-2">
              <Badge tone="green">{preview.validCount} erkannt</Badge>
              {preview.problemCount > 0 ? (
                <Badge tone="yellow">{preview.problemCount} übersprungen</Badge>
              ) : null}
            </div>

            <div className="max-h-64 overflow-y-auto rounded-2xl border border-border-subtle">
              {preview.rows.map((row) => (
                <div
                  key={row.lineNumber}
                  className="flex items-center gap-2 border-b border-border-subtle px-3 py-2 text-sm last:border-b-0"
                >
                  <span className="w-8 shrink-0 text-ink-soft">{row.lineNumber}</span>
                  {row.problem ? (
                    <span className="text-danger">{row.problem}</span>
                  ) : (
                    <span>
                      {row.source} <span className="text-ink-soft">→</span> {row.target}{' '}
                      {row.emoji ?? ''}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : null}

        {confirm.isError ? <ErrorNote message="Der Import ist fehlgeschlagen." /> : null}

        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={content.trim().length === 0 || runPreview.isPending}
            onClick={() => runPreview.mutate()}
          >
            Vorschau
          </Button>
          <Button
            disabled={!preview || preview.validCount === 0 || confirm.isPending}
            onClick={() => confirm.mutate()}
          >
            {preview ? `${preview.validCount} Vokabeln übernehmen` : 'Übernehmen'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
