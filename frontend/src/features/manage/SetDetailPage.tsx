import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, FileUp, ImagePlus, Pencil, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type RefObject } from 'react'
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
import { shrinkPicture, VocabPicture } from '@/lib/picture'
import type { ImportPreview, VocabularyEntry, VocabularySet } from '@/types'

// Spiegelt ContentRules.MaxTextLength (Titel und Woerter); massgeblich bleibt der Server.
const MAX_TEXT_LENGTH = 200
const GENERIC = 'Das hat nicht geklappt. Versuche es noch einmal.'
const SOURCE_MISSING = 'Bitte gib das deutsche Wort ein.'
const TARGET_MISSING = 'Bitte gib das englische Wort ein.'
const WORD_TOO_LONG = 'Das Wort darf höchstens 200 Zeichen lang sein.'
// Eine Vokabelliste hat Hunderte Zeilen zu je rund 20 Bytes; 1 MB faengt nur Fehlgriffe
// ab (Foto, PDF), bevor sie gelesen werden und das Textfeld lahmlegen.
const MAX_FILE_BYTES = 1024 * 1024
const FILE_TOO_BIG = 'Die Datei ist zu groß. Eine Vokabelliste darf höchstens 1 MB groß sein.'
const FILE_UNREADABLE = 'Die Datei ließ sich nicht lesen. Wähle sie noch einmal aus oder füge den Text ein.'
const PICTURE_UNREADABLE = 'Diese Datei lässt sich nicht als Bild öffnen. Wähle ein Foto oder ein anderes Bild aus.'
const PICTURE_TOO_BIG = 'Das Bild ist zu groß. Erlaubt sind höchstens 300 KB.'

function pictureError(caught: unknown): string {
  // nginx bleibt bewusst beim Standard von 1 MB und antwortet darueber selbst mit einer
  // HTML-Seite, bevor die API die Anfrage sieht; api() kennte dann nur den allgemeinen
  // Text. Jede 413 bekommt deshalb denselben Satz wie die 413 des Endpoints (D-08).
  if (caught instanceof ApiError && caught.status === 413) return PICTURE_TOO_BIG
  return caught instanceof ApiError ? caught.message : GENERIC
}

// UTF-16 nur am BOM erkennbar (Excel „Unicode-Text“ ist UTF-16LE). Sonst erst strikt UTF-8;
// scheitert das, ist es fast immer eine CSV aus Excel unter Windows, also windows-1252.
// Den BOM entfernt der jeweilige Decoder selbst.
function decodeCsv(bytes: ArrayBuffer): string {
  const [first, second] = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength))
  if (first === 0xff && second === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (first === 0xfe && second === 0xff) return new TextDecoder('utf-16be').decode(bytes)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

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
      {entries.isError && !entries.data ? <ErrorNote message={entries.error.message} /> : null}

      {entries.data?.length === 0 ? <EmptyState title="Noch keine Vokabeln in diesem Set" /> : null}

      {entries.data && entries.data.length > 0 ? (
        <ListGroup>
          {entries.data.map((entry) => (
            <ListRow key={entry.id} className="py-2">
              {/* Das Vorschaubild ist dekorativ: die Zeile nennt beide Woerter (alt leer). */}
              {entry.pictureVersion ? (
                <VocabPicture
                  version={entry.pictureVersion}
                  alt=""
                  variant="thumb"
                  fallback={
                    entry.emoji ? (
                      <span className="type-title" aria-hidden>
                        {entry.emoji}
                      </span>
                    ) : null
                  }
                />
              ) : entry.emoji ? (
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
          // Aktueller Listenstand, sobald neu geladen: der Abschnitt „Bild“ zeigt dann das gespeicherte Bild.
          entry={entries.data?.find((item) => item.id === editing.id) ?? editing}
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
  // Der gesperrte "Speichern" gibt den Fokus an body ab (WR-03); nach einem Fehler ohne Feldbezug
  // zurueck in den Dialog. Nach Enter steht er noch im Feld und bleibt dort.
  useEffect(() => {
    if (error && document.activeElement === document.body) cancelRef.current?.focus()
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
  // Wie RenameSet (WR-03): war der Fokus verloren, steht er nach einem Fehler auf "Abbrechen".
  useEffect(() => {
    if (error && document.activeElement === document.body) cancelRef.current?.focus()
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
      <EntryPicture
        setId={setId}
        entry={entry}
        busyRef={busyRef}
        onGone={(caught) => {
          if (stale.noteError(caught)) onRowGone()
        }}
      />
    </Dialog>
  )
}

/*
  Abschnitt „Bild“ im Dialog „Vokabel bearbeiten“ (D-03, D-05). Ausserhalb des
  Woerter-Formulars: der Startfokus bleibt auf „Deutsch“, und „Abbrechen“/„Speichern“
  betreffen nur die Woerter. Bildaenderungen gelten sofort, damit es keinen halben
  Stand gibt (Woerter gespeichert, Bild nicht). Teilt busyRef mit EditEntry: waehrend
  einer Anfrage schliessen Esc und „Abbrechen“ nicht, und doppeltes Ausloesen sendet
  genau eine Anfrage.
*/
function EntryPicture({
  setId,
  entry,
  busyRef,
  onGone,
}: {
  setId: string
  entry: VocabularyEntry
  busyRef: RefObject<boolean>
  onGone: (caught: unknown) => void
}) {
  const queryClient = useQueryClient()
  // Zuerst die Version aus der eigenen Antwort, nicht aus dem alten Listenstand. Bringt das
  // Neuladen der Liste eine andere Version (gleichzeitig ersetzt, der letzte Upload gewinnt),
  // gilt die gespeicherte.
  const [version, setVersion] = useState(entry.pictureVersion)
  const [listed, setListed] = useState(entry.pictureVersion)
  if (entry.pictureVersion !== listed) {
    setListed(entry.pictureVersion)
    setVersion(entry.pictureVersion)
  }
  const [note, setNote] = useState<{ ok: boolean; message: string } | null>(null)
  const [working, setWorking] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const chooseRef = useRef<HTMLButtonElement>(null)

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Leeren, damit dasselbe Foto nach einem Fehler erneut ein change ausloest.
    event.target.value = ''
    if (!file || busyRef.current) return
    busyRef.current = true
    setWorking(true)
    // Die Meldung gehoert zur letzten Aktion.
    setNote(null)
    try {
      let picture: Blob
      try {
        picture = await shrinkPicture(file)
      } catch {
        // Kein Bild (PDF) oder eines, das der Browser nicht dekodiert: nichts hochladen.
        setNote({ ok: false, message: PICTURE_UNREADABLE })
        return
      }
      const saved = await api<{ pictureVersion: string }>(`/sets/${setId}/entries/${entry.id}/picture`, {
        method: 'PUT',
        body: picture,
      })
      setVersion(saved.pictureVersion)
      setNote({ ok: true, message: 'Das Bild ist gespeichert.' })
      // Gleichzeitige Ersetzungen: der letzte Upload gewinnt; die Liste zeigt den gespeicherten Stand.
      void queryClient.invalidateQueries({ queryKey: ['entries', setId] })
    } catch (caught) {
      onGone(caught)
      setNote({ ok: false, message: pictureError(caught) })
    } finally {
      busyRef.current = false
      setWorking(false)
    }
  }

  // Ohne Rueckfrage: das Original liegt noch auf dem Geraet, neu waehlen stellt es wieder her.
  async function remove() {
    if (busyRef.current) return
    busyRef.current = true
    setWorking(true)
    setNote(null)
    try {
      await api<void>(`/sets/${setId}/entries/${entry.id}/picture`, { method: 'DELETE' })
      // „Bild entfernen“ verschwindet mit dem Bild: der Fokus bleibt im Abschnitt.
      chooseRef.current?.focus()
      setVersion(null)
      setNote({ ok: true, message: 'Das Bild ist entfernt.' })
      void queryClient.invalidateQueries({ queryKey: ['entries', setId] })
    } catch (caught) {
      onGone(caught)
      setNote({ ok: false, message: pictureError(caught) })
    } finally {
      busyRef.current = false
      setWorking(false)
    }
  }

  return (
    <section aria-labelledby="vokabel-bild" className="flex flex-col gap-4">
      <h3 id="vokabel-bild" className="type-headline text-ink">
        Bild
      </h3>
      <p id="vokabel-bild-hinweis" className="type-body-sm text-ink-soft">
        Ein Bild hilft beim Merken. Änderungen am Bild gelten sofort.
      </p>
      {version ? <VocabPicture version={version} alt={`Bild zu „${entry.sourceText}“`} variant="large" /> : null}
      {/* Natives Datei-Feld wie beim CSV-Import, nur fuer Bilder und ohne capture: auf dem Handy
          bietet der Browser Kamera und Galerie an (D-05). Nicht im Tab-Fluss. */}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => void choose(event)} />
      <div className="flex flex-wrap gap-2">
        {/* Waehrend der Anfrage nicht gesperrt: der fokussierte Button gaebe den Fokus sonst an body ab. */}
        <Button
          ref={chooseRef}
          type="button"
          variant="secondary"
          className="flex-auto"
          aria-describedby="vokabel-bild-hinweis"
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="size-4" aria-hidden />
          Bild wählen
        </Button>
        {version ? (
          <Button
            type="button"
            variant="secondary"
            className="flex-auto"
            aria-describedby="vokabel-bild-hinweis"
            onClick={() => void remove()}
          >
            <Trash2 className="size-4" aria-hidden />
            Bild entfernen
          </Button>
        ) : null}
      </div>
      {working ? (
        <Spinner label="Einen Moment …" />
      ) : note ? (
        note.ok ? <SuccessNote message={note.message} /> : <ErrorNote message={note.message} />
      ) : null}
    </section>
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
  // Meldung zur gewaehlten Datei; eine neue Eingabe nimmt sie weg.
  const [fileNote, setFileNote] = useState<{ ok: boolean; message: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [reading, setReading] = useState(false)
  // Ref statt nur State: eine zweite Auswahl kann vor dem naechsten Rendern ankommen.
  const readingRef = useRef(false)

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
  // Auch waehrend die Datei gelesen wird: sonst liefe eine Vorschau des alten Textes, und
  // „Übernehmen“ naehme danach deren Zeilen statt der aus der Datei.
  const busy = reading || runPreview.isPending || confirm.isPending

  function changeContent(text: string) {
    setContent(text)
    setFileNote(null)
    // Vorschau und Fehlertexte gelten fuer den alten Text: sonst uebernaehme der Button nicht das, was da steht.
    setPreview(null)
    runPreview.reset()
    confirm.reset()
  }

  // Die Datei wird nur im Browser gelesen; zum Server geht wie beim Einfuegen der Text.
  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Leeren, damit dieselbe Datei nach einer Korrektur erneut ein change ausloest.
    event.target.value = ''
    // Waehrend eine Datei gelesen wird, zaehlt keine zweite: sonst gaebe die erste die
    // Vorschau frei, waehrend die zweite noch liest (Codex-Review).
    if (!file || readingRef.current) return
    // Die Meldung gehoert zur letzten Aktion: alte Fehler aus Vorschau und Import gehen weg.
    runPreview.reset()
    confirm.reset()
    if (file.size > MAX_FILE_BYTES) {
      setFileNote({ ok: false, message: FILE_TOO_BIG })
      return
    }
    let text: string
    readingRef.current = true
    setReading(true)
    try {
      text = decodeCsv(await file.arrayBuffer())
    } catch {
      setFileNote({ ok: false, message: FILE_UNREADABLE })
      return
    } finally {
      readingRef.current = false
      setReading(false)
    }
    changeContent(text)
    // Leere Datei: wie ein leeres Feld, ohne Erfolgsmeldung.
    if (text.trim()) setFileNote({ ok: true, message: `Die Datei „${file.name}“ ist eingelesen.` })
  }

  return (
    <Card className="flex flex-col gap-4">
      {/* Natives Datei-Feld, ausgeloest ueber einen Button aus dem Bestand: Name, Fokusring und
          Mindesthoehe kommen vom Button, das Feld selbst ist nicht im Tab-Fluss. */}
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        hidden
        onChange={(event) => void readFile(event)}
      />
      {/* Waehrend des Lesens nicht gesperrt: der fokussierte Button gaebe den Fokus sonst an body ab. */}
      <Button
        variant="secondary"
        className="self-start"
        disabled={runPreview.isPending || confirm.isPending}
        onClick={() => fileRef.current?.click()}
      >
        <FileUp className="size-4" aria-hidden />
        Datei wählen
      </Button>

      <Textarea
        rows={6}
        value={content}
        onChange={(event) => changeContent(event.target.value)}
        // Waehrend der Anfragen gesperrt: sonst kaeme danach die Auswertung des alten Textes an
        // bzw. liefe der Import mit Zeilen, die nicht mehr im Feld stehen.
        readOnly={busy}
        placeholder={'Hund;dog\nHaus;house\ngehen;to go'}
        aria-labelledby="import-hinweis"
        className="font-mono"
      />

      <p id="import-hinweis" className="type-body-md text-ink-soft">
        Eine Zeile pro Vokabel: Deutsch, Trennzeichen, Englisch. Semikolon, Komma und Tabulator
        werden erkannt — eine aus Excel exportierte CSV-Datei kannst du mit „Datei wählen“ laden
        oder ihren Inhalt hier einfügen.
      </p>

      {fileNote ? (
        fileNote.ok ? <SuccessNote message={fileNote.message} /> : <ErrorNote message={fileNote.message} />
      ) : null}

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
          disabled={content.trim().length === 0 || busy}
          onClick={() => runPreview.mutate()}
        >
          {runPreview.isPending ? 'Einen Moment …' : 'Vorschau'}
        </Button>
        <Button
          disabled={!preview || preview.validCount === 0 || busy}
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
