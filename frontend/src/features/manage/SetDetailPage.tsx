import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog, Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { ListGroup, ListRow } from '@/components/ui/list'
import { Badge, EmptyState, ErrorNote, Spinner, SuccessNote } from '@/components/ui/misc'
import { api, ApiError } from '@/lib/api'
import { useGone } from '@/lib/gone'
import type { ImportPreview, VocabularyEntry, VocabularySet } from '@/types'

// Spiegelt ContentRules.MaxTextLength (Titel und Woerter); massgeblich bleibt der Server.
const MAX_TEXT_LENGTH = 200
const GENERIC = 'Das hat nicht geklappt. Versuche es noch einmal.'
const SOURCE_MISSING = 'Bitte gib das deutsche Wort ein.'
const TARGET_MISSING = 'Bitte gib das englische Wort ein.'
const WORD_TOO_LONG = 'Das Wort darf höchstens 200 Zeichen lang sein.'

export function SetDetailPage() {
  const { setId = '' } = useParams()
  const queryClient = useQueryClient()

  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [captureErrors, setCaptureErrors] = useState<WordErrors>({})
  const sourceRef = useRef<HTMLInputElement>(null)
  const targetRef = useRef<HTMLInputElement>(null)
  const [showImport, setShowImport] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  // Fokusziel, wenn das Set schon weg war und die Buttons im Kopf mit ihm verschwinden.
  const backRef = useRef<HTMLAnchorElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  // Stift und Papierkorb gibt es je Zeile: der angeklickte Button ist das Fokusziel beim
  // Schliessen; verschwindet die Zeile (geloescht, 404), wird es die Set-Ueberschrift.
  const rowFocusRef = useRef<HTMLElement | null>(null)
  const [editing, setEditing] = useState<VocabularyEntry | null>(null)
  const [deleting, setDeleting] = useState<VocabularyEntry | null>(null)

  // Kein Einzelabruf: der Titel kommt aus der Liste ['sets'] (Muster ChildFormPage).
  const sets = useQuery({
    queryKey: ['sets'],
    queryFn: () => api<VocabularySet[]>('/sets'),
  })
  const set = sets.data?.find((entry) => entry.id === setId)

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

  function submit(event: FormEvent) {
    event.preventDefault()
    addEntry.reset()
    // Die Meldung gehoert zur letzten Aktion: ein neuer Versuch nimmt die alte weg.
    setSaved(null)
    // Nur "leer" prueft die Seite selbst; die Laenge meldet der Server (ErrorNote unter dem Formular).
    const found = {
      sourceText: source.trim() ? undefined : SOURCE_MISSING,
      targetText: target.trim() ? undefined : TARGET_MISSING,
    }
    setCaptureErrors(found)
    if (found.sourceText) sourceRef.current?.focus()
    else if (found.targetText) targetRef.current?.focus()
    else addEntry.mutate()
  }

  const back = (
    <Link ref={backRef} to="/verwalten" className="flex items-center gap-2 self-start type-body-md-strong text-ink">
      <span className="glass-clear flex size-12 items-center justify-center rounded-full">
        <ArrowLeft className="size-5" aria-hidden />
      </span>
      Alle Sets
    </Link>
  )

  // Ohne Set nur der Kopf: Erfassung, Import und Liste erst, wenn das Set feststeht.
  if (!set) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        {sets.isLoading ? (
          <Spinner />
        ) : sets.isError && !sets.data ? (
          // Ladefehler ist nicht "gibt es nicht": sonst haelt man ein vorhandenes Set fuer geloescht.
          <ErrorNote message={sets.error.message} />
        ) : (
          <EmptyState title="Dieses Set gibt es nicht (mehr)." hint="Gehe zurück zu allen Sets." />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {back}

      <div className="flex flex-col gap-2">
        <h2 ref={headingRef} tabIndex={-1} className="type-headline break-words text-ink">
          {set.title}
        </h2>
        <div className="flex flex-wrap gap-2">
          <RenameSet key={set.id} set={set} backRef={backRef} onSaved={setSaved} />
          <DeleteSet key={`loeschen-${set.id}`} set={set} backRef={backRef} />
        </div>
      </div>

      {saved ? <SuccessNote message={saved} /> : null}

      {/* Schnellerfassung: zwei Felder, Enter, weiter. Alles andere ist
          optional und wuerde das Abtippen eines Vokabelhefts nur bremsen. */}
      <Card className="flex flex-col gap-4">
        {/* Oben ausgerichtet, damit ein Fehlertext unter einem Feld das andere nicht verschiebt. */}
        <form noValidate onSubmit={submit} className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Field id="eintrag-deutsch" label="Deutsch" className="flex-1" error={captureErrors.sourceText}>
            {(control) => (
              <Input
                {...control}
                ref={sourceRef}
                value={source}
                onChange={(event) => setSource(event.target.value)}
              />
            )}
          </Field>
          <Field id="eintrag-englisch" label="Englisch" className="flex-1" error={captureErrors.targetText}>
            {(control) => (
              <Input
                {...control}
                ref={targetRef}
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              />
            )}
          </Field>
          {/* Label (18) + Abstand (8) + Feld (52) = label-row (18) + Button (60): unten buendig mit den Feldern (DESIGN.md Layout). */}
          <Button type="submit" className="sm:mt-label-row" disabled={addEntry.isPending}>
            Hinzufügen
          </Button>
        </form>
        {/* ApiError.message ist ein deutscher Satz, bei zu langen Woertern der Feldtext des Servers. */}
        {addEntry.isError ? <ErrorNote message={addEntry.error.message} /> : null}
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
                aria-label={`${entry.sourceText} bearbeiten`}
                onClick={(event) => {
                  rowFocusRef.current = event.currentTarget
                  setEditing(entry)
                }}
              >
                <Pencil className="size-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${entry.sourceText} löschen`}
                onClick={(event) => {
                  rowFocusRef.current = event.currentTarget
                  setDeleting(entry)
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </ListRow>
          ))}
        </ListGroup>
      ) : null}

      {editing ? (
        <EditEntry
          key={editing.id}
          setId={setId}
          entry={editing}
          returnFocusRef={rowFocusRef}
          onRowGone={() => {
            rowFocusRef.current = headingRef.current
          }}
          onSaved={setSaved}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {deleting ? (
        <DeleteEntry
          key={deleting.id}
          setId={setId}
          entry={deleting}
          returnFocusRef={rowFocusRef}
          onRowGone={() => {
            rowFocusRef.current = headingRef.current
          }}
          onDeleted={setSaved}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </div>
  )
}

interface WordErrors {
  sourceText?: string
  targetText?: string
}

function titleError(title: string): string | undefined {
  if (!title.trim()) return 'Ein Set braucht einen Titel.'
  if (title.trim().length > MAX_TEXT_LENGTH) return 'Der Titel darf höchstens 200 Zeichen lang sein.'
  return undefined
}

function wordError(text: string, missing: string): string | undefined {
  if (!text.trim()) return missing
  if (text.trim().length > MAX_TEXT_LENGTH) return WORD_TOO_LONG
  return undefined
}

// Umbenennen an Ort und Stelle (PAR-04, D-08): gleiche Set-ID, der Lernstand bleibt.
function RenameSet({
  set,
  backRef,
  onSaved,
}: {
  set: VocabularySet
  backRef: RefObject<HTMLAnchorElement | null>
  onSaved: (message: string | null) => void
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(set.title)
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const stale = useGone(['sets'])
  const busyRef = useRef(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  // Der gesperrte "Speichern" gibt den Fokus an body ab (WR-03); nach einem Fehler ohne Feldbezug zurueck in den Dialog.
  useEffect(() => {
    if (error) cancelRef.current?.focus()
  }, [error])

  function changeOpen(next: boolean) {
    // Waehrend der Anfrage schliessen weder Esc noch "Abbrechen".
    if (busyRef.current) return
    if (next) {
      setTitle(set.title)
      setFieldError(undefined)
      setError(null)
      stale.reset()
    } else stale.closed()
    setOpen(next)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    // Ref statt nur disabled: ein zweiter Klick kann vor dem naechsten Rendern ankommen.
    if (busyRef.current) return
    setError(null)
    // Wie ChildForm: ein neuer Versuch nimmt die alte Erfolgsmeldung weg.
    onSaved(null)
    const found = titleError(title)
    setFieldError(found)
    if (found) {
      inputRef.current?.focus()
      return
    }
    busyRef.current = true
    setBusy(true)
    try {
      await api<VocabularySet>(`/sets/${set.id}`, { method: 'PATCH', body: { title: title.trim() } })
      busyRef.current = false
      setOpen(false)
      onSaved('Der neue Titel ist gespeichert.')
      void queryClient.invalidateQueries({ queryKey: ['sets'] })
    } catch (caught) {
      stale.noteError(caught)
      // Feldfehler des Servers am Feld, alles andere im Hinweis ueber den Buttons.
      const fieldMessage = caught instanceof ApiError ? caught.errors?.title?.[0] : undefined
      if (fieldMessage) {
        setFieldError(fieldMessage)
        inputRef.current?.focus()
      } else setError(caught instanceof Error ? caught.message : GENERIC)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <>
      <Button ref={triggerRef} type="button" variant="secondary" size="sm" onClick={() => changeOpen(true)}>
        <Pencil className="size-4" aria-hidden />
        Umbenennen
      </Button>
      <Dialog
        open={open}
        onOpenChange={changeOpen}
        title="Set umbenennen"
        description="Der Lernstand der Kinder bleibt erhalten."
        returnFocusRef={stale.gone ? backRef : triggerRef}
      >
        <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <Field id="set-titel" label="Titel" error={fieldError}>
            {(control) => (
              <Input
                {...control}
                ref={inputRef}
                autoComplete="off"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            )}
          </Field>
          {error ? <ErrorNote message={error} /> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              ref={cancelRef}
              type="button"
              variant="secondary"
              className="flex-auto"
              disabled={busy}
              onClick={() => changeOpen(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" className="flex-auto" disabled={busy}>
              {busy ? 'Einen Moment …' : 'Speichern'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}

// Korrigiert Deutsch und Englisch an Ort und Stelle (PAR-04, D-08): gleiche IDs, der Lernstand bleibt.
function EditEntry({
  setId,
  entry,
  returnFocusRef,
  onRowGone,
  onSaved,
  onClose,
}: {
  setId: string
  entry: VocabularyEntry
  returnFocusRef: RefObject<HTMLElement | null>
  onRowGone: () => void
  onSaved: (message: string | null) => void
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [source, setSource] = useState(entry.sourceText)
  const [target, setTarget] = useState(entry.targetText)
  const [fieldErrors, setFieldErrors] = useState<WordErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const stale = useGone(['entries', setId])
  const busyRef = useRef(false)
  const sourceRef = useRef<HTMLInputElement>(null)
  const targetRef = useRef<HTMLInputElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  // Wie RenameSet (WR-03): nach einem Fehler ohne Feldbezug steht der Fokus auf "Abbrechen".
  useEffect(() => {
    if (error) cancelRef.current?.focus()
  }, [error])

  function changeOpen(next: boolean) {
    // Waehrend der Anfrage schliessen weder Esc noch "Abbrechen".
    if (next || busyRef.current) return
    stale.closed()
    onClose()
  }

  function showFieldErrors(found: WordErrors) {
    setFieldErrors(found)
    if (found.sourceText) sourceRef.current?.focus()
    else if (found.targetText) targetRef.current?.focus()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    // Ref statt nur disabled: ein zweiter Klick kann vor dem naechsten Rendern ankommen.
    if (busyRef.current) return
    setError(null)
    onSaved(null)
    const found = { sourceText: wordError(source, SOURCE_MISSING), targetText: wordError(target, TARGET_MISSING) }
    showFieldErrors(found)
    if (found.sourceText || found.targetText) return
    busyRef.current = true
    setBusy(true)
    try {
      await api<VocabularyEntry>(`/sets/${setId}/entries/${entry.id}`, {
        method: 'PUT',
        body: { sourceText: source.trim(), targetText: target.trim() },
      })
      busyRef.current = false
      onClose()
      onSaved('Die Vokabel ist gespeichert.')
      for (const key of [['entries', setId], ['traffic-light']]) {
        void queryClient.invalidateQueries({ queryKey: key })
      }
    } catch (caught) {
      if (stale.noteError(caught)) onRowGone()
      // Feldfehler des Servers am Feld, alles andere im Hinweis ueber den Buttons.
      const server = caught instanceof ApiError ? caught.errors : undefined
      const fromServer = { sourceText: server?.sourceText?.[0], targetText: server?.targetText?.[0] }
      if (fromServer.sourceText || fromServer.targetText) showFieldErrors(fromServer)
      else setError(caught instanceof Error ? caught.message : GENERIC)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={changeOpen}
      title="Vokabel bearbeiten"
      description="Der Lernstand der Kinder bleibt erhalten."
      returnFocusRef={returnFocusRef}
    >
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <Field id="vokabel-deutsch" label="Deutsch" error={fieldErrors.sourceText}>
          {(control) => (
            <Input
              {...control}
              ref={sourceRef}
              autoComplete="off"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            />
          )}
        </Field>
        <Field id="vokabel-englisch" label="Englisch" error={fieldErrors.targetText}>
          {(control) => (
            <Input
              {...control}
              ref={targetRef}
              autoComplete="off"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
          )}
        </Field>
        {error ? <ErrorNote message={error} /> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            className="flex-auto"
            disabled={busy}
            onClick={() => changeOpen(false)}
          >
            Abbrechen
          </Button>
          <Button type="submit" className="flex-auto" disabled={busy}>
            {busy ? 'Einen Moment …' : 'Speichern'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// Loescht die Vokabel samt Lernstand aller Kinder dazu (FIX-02, D-17), deshalb mit Bestaetigung.
function DeleteEntry({
  setId,
  entry,
  returnFocusRef,
  onRowGone,
  onDeleted,
  onClose,
}: {
  setId: string
  entry: VocabularyEntry
  returnFocusRef: RefObject<HTMLElement | null>
  onRowGone: () => void
  onDeleted: (message: string | null) => void
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stale = useGone(['entries', setId])
  const busyRef = useRef(false)

  function changeOpen(next: boolean) {
    if (next) return
    stale.closed()
    onClose()
  }

  async function confirm() {
    // Ref statt nur disabled: ein zweiter Klick kann vor dem naechsten Rendern ankommen.
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    onDeleted(null)
    try {
      await api<void>(`/sets/${setId}/entries/${entry.id}`, { method: 'DELETE' })
      // Die Zeile verschwindet mitsamt Papierkorb, der Fokus geht auf die Set-Ueberschrift.
      onRowGone()
      onDeleted(`„${entry.sourceText}“ ist gelöscht.`)
      // Wortzahl und Meisterschaft aendern sich mit der Vokabel.
      for (const key of [['entries', setId], ['sets'], ['traffic-light'], ['overview']]) {
        void queryClient.invalidateQueries({ queryKey: key })
      }
      busyRef.current = false
      onClose()
    } catch (caught) {
      if (stale.noteError(caught)) onRowGone()
      setError(caught instanceof Error ? caught.message : GENERIC)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={changeOpen}
      title={`„${entry.sourceText}“ löschen?`}
      description="Der Lernstand aller Kinder zu dieser Vokabel wird mit gelöscht. Das lässt sich nicht rückgängig machen."
      confirmLabel="Endgültig löschen"
      busy={busy}
      error={error}
      onConfirm={() => void confirm()}
      returnFocusRef={returnFocusRef}
    />
  )
}

// Loescht Vokabeln und Lernstand aller Kinder dazu (FIX-02, D-17), deshalb mit Bestaetigung.
function DeleteSet({ set, backRef }: { set: VocabularySet; backRef: RefObject<HTMLAnchorElement | null> }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stale = useGone(['sets'])
  const busyRef = useRef(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  function changeOpen(next: boolean) {
    setOpen(next)
    if (next) return
    setError(null)
    stale.closed()
  }

  async function confirm() {
    // Ref statt nur disabled: ein zweiter Klick kann vor dem naechsten Rendern ankommen.
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      await api<void>(`/sets/${set.id}`, { method: 'DELETE' })
      // Meisterschaft und Wortzahl aendern sich mit dem Set.
      for (const key of ['sets', 'traffic-light', 'overview']) {
        void queryClient.invalidateQueries({ queryKey: [key] })
      }
      queryClient.removeQueries({ queryKey: ['entries', set.id] })
      navigate('/verwalten', { state: { message: `Das Set „${set.title}“ ist gelöscht.` } })
    } catch (caught) {
      stale.noteError(caught)
      setError(caught instanceof Error ? caught.message : GENERIC)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <>
      <Button ref={triggerRef} type="button" variant="danger" size="sm" onClick={() => changeOpen(true)}>
        <Trash2 className="size-4" aria-hidden />
        Set löschen
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={changeOpen}
        title={`Set „${set.title}“ löschen?`}
        description="Alle Vokabeln dieses Sets und der Lernstand aller Kinder dazu werden gelöscht. Das lässt sich nicht rückgängig machen."
        confirmLabel="Endgültig löschen"
        busy={busy}
        error={error}
        onConfirm={() => void confirm()}
        returnFocusRef={stale.gone ? backRef : triggerRef}
      />
    </>
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
        onChange={(event) => {
          setContent(event.target.value)
          // Die Vorschau gilt fuer den alten Text: sonst uebernaehme der Button nicht das, was da steht.
          setPreview(null)
        }}
        // Waehrend der Vorschau gesperrt: sonst kaeme danach die Auswertung des alten Textes an.
        readOnly={runPreview.isPending}
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
                {/* min-w-0 und break-words: ein langes Wort bricht um, statt die Liste waagerecht scrollen zu lassen (WCAG 1.4.10). */}
                {row.problem ? (
                  // Mit dem betroffenen Wort: sonst muessten Eltern die Zeile per Nummer im Textfeld suchen.
                  <span className="min-w-0 flex-1 break-words">
                    <span className="block text-danger-text">{row.problem}</span>
                    {row.source || row.target ? (
                      <span className="block text-ink-soft">
                        {[row.source, row.target].filter(Boolean).join(' → ')}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="min-w-0 flex-1 break-words">
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
      {confirm.isError ? <ErrorNote message={confirm.error.message} /> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={content.trim().length === 0 || runPreview.isPending}
          onClick={() => runPreview.mutate()}
        >
          {runPreview.isPending ? 'Einen Moment …' : 'Vorschau'}
        </Button>
        <Button
          disabled={!preview || preview.validCount === 0 || confirm.isPending}
          onClick={() => confirm.mutate()}
        >
          {confirm.isPending
            ? 'Einen Moment …'
            : preview
              ? `${preview.validCount} ${preview.validCount === 1 ? 'Vokabel' : 'Vokabeln'} übernehmen`
              : 'Übernehmen'}
        </Button>
      </div>
    </Card>
  )
}
