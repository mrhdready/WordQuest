import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Trash2, Upload } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { ListGroup, ListRow } from '@/components/ui/list'
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
      <Link to="/verwalten" className="flex items-center gap-2 self-start type-body-md-strong text-ink">
        <span className="glass-clear flex size-12 items-center justify-center rounded-full">
          <ArrowLeft className="size-5" aria-hidden />
        </span>
        Alle Sets
      </Link>

      {/* Schnellerfassung: zwei Felder, Enter, weiter. Alles andere ist
          optional und wuerde das Abtippen eines Vokabelhefts nur bremsen. */}
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <Field id="eintrag-deutsch" label="Deutsch" className="flex-1">
            {(control) => (
              <Input
                {...control}
                value={source}
                onChange={(event) => setSource(event.target.value)}
              />
            )}
          </Field>
          <Field id="eintrag-englisch" label="Englisch" className="flex-1">
            {(control) => (
              <Input
                {...control}
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              />
            )}
          </Field>
          <Button type="submit" disabled={addEntry.isPending}>
            Hinzufügen
          </Button>
        </form>
      </Card>

      <Button variant="ghost" onClick={() => setShowImport((value) => !value)}>
        <Upload className="size-4" aria-hidden />
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

      {entries.data?.length === 0 ? <EmptyState title="Noch keine Vokabeln in diesem Set" /> : null}

      {entries.data && entries.data.length > 0 ? (
        <ListGroup>
          {entries.data.map((entry) => (
            <ListRow key={entry.id} className="py-2">
              {entry.emoji ? (
                <span className="type-title" aria-hidden>
                  {entry.emoji}
                </span>
              ) : null}
              {/* Pfeil im selben Textknoten: allein gestellt kann axe seinen Kontrast nicht messen (nonBmp). */}
              <p className="min-w-0 flex-1 break-words">
                {entry.sourceText} → {entry.targetText}
              </p>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${entry.sourceText} löschen`}
                onClick={() => removeEntry.mutate(entry.id)}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </ListRow>
          ))}
        </ListGroup>
      ) : null}
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
    <Card className="flex flex-col gap-4">
      <Textarea
        rows={6}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={'Hund;dog\nHaus;house\ngehen;to go'}
        aria-labelledby="import-hinweis"
        className="font-mono"
      />

      <p id="import-hinweis" className="type-body-md text-ink-soft">
        Eine Zeile pro Vokabel: Deutsch, Trennzeichen, Englisch. Semikolon, Komma und Tabulator
        werden erkannt — eine aus Excel exportierte Datei kannst du direkt hier einfügen.
      </p>

      {preview ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge tone="green">{preview.validCount} erkannt</Badge>
            {preview.problemCount > 0 ? (
              <Badge tone="yellow">{preview.problemCount} übersprungen</Badge>
            ) : null}
          </div>

          {/* Kein ListGroup: Glas auf der Glas-Karte waere gestapelt (DESIGN.md Don'ts).
              tabIndex, damit die scrollende Liste per Tastatur erreichbar ist. */}
          <div
            tabIndex={0}
            role="region"
            aria-label="Vorschau"
            className="flex max-h-64 flex-col divide-y divide-separator overflow-y-auto rounded-sm border border-separator"
          >
            {preview.rows.map((row) => (
              <div key={row.lineNumber} className="flex items-center gap-2 px-4 py-2 type-body-md">
                <span className="w-8 shrink-0 text-ink-soft">{row.lineNumber}</span>
                {row.problem ? (
                  <span className="text-danger-text">{row.problem}</span>
                ) : (
                  <span>
                    {row.source} → {row.target} {row.emoji ?? ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* ApiError.message ist immer ein deutscher ganzer Satz (lib/api.ts). */}
      {runPreview.isError ? <ErrorNote message={runPreview.error.message} /> : null}
      {confirm.isError ? <ErrorNote message="Der Import ist fehlgeschlagen." /> : null}

      <div className="flex flex-wrap gap-2">
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
    </Card>
  )
}
