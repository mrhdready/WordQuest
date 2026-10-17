import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SetDetailPage } from '@/features/manage/SetDetailPage'
import { renderWithProviders } from '@/test/render'

afterEach(() => {
  vi.unstubAllGlobals()
})

// Ohne Daten (Laden, Fehler) keine leere Glas-Gruppe; ListGroup traegt divide-y.
it('Set-Detail zeigt beim Laden und nach einem Fehler keine leere Liste', async () => {
  // Beide Abfragen (/sets und /sets/{id}/entries) haengen, bis fail() sie beantwortet.
  const pending: ((response: Response) => void)[] = []
  const fail = () => pending.forEach((resolve) => resolve(new Response('', { status: 500 })))
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>((resolve) => pending.push(resolve))),
  )
  const { container } = renderWithProviders(<SetDetailPage />, {
    route: '/verwalten/sets/set-1',
    path: '/verwalten/sets/:setId',
  })
  await screen.findByRole('status')
  expect(container.querySelector('.divide-y')).toBeNull()

  expect(pending).toHaveLength(2)
  fail()
  await vi.waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  expect(container.querySelector('.divide-y')).toBeNull()
})

const unit = {
  id: 'set-1',
  title: 'Unit 3',
  description: null,
  sourceLanguage: 'de',
  targetLanguage: 'en',
  entryCount: 0,
}
const setGone = 'Dieses Set gibt es nicht (mehr).'
const titleMissing = 'Ein Set braucht einen Titel.'
const titleTooLong = 'Der Titel darf höchstens 200 Zeichen lang sein.'
const unreachable = 'Der Server ist gerade nicht erreichbar. Prüfe die Verbindung und versuche es noch einmal.'
const generic = 'Das hat nicht geklappt. Versuche es noch einmal.'
const deleteTitle = 'Set „Unit 3“ löschen?'
const deleteDescription =
  'Alle Vokabeln dieses Sets und der Lernstand aller Kinder dazu werden gelöscht. Das lässt sich nicht rückgängig machen.'

const ok = async () => Response.json(unit)
const notFound = async () => Response.json({ title: 'Nicht gefunden', detail: setGone }, { status: 404 })

/**
 * fetch-Stub nach URL und Methode, Anfragen je Methode gezaehlt. GET /sets
 * liefert beim ersten Mal [unit], danach `later` (z. B. ohne das Set nach
 * einem 404 in einem anderen Tab). PATCH und DELETE antworten per `respond`.
 */
function stubSets(respond: () => Promise<Response> = ok, later: unknown[] = [unit]) {
  const calls = { gets: 0, patches: [] as unknown[], deletes: 0 }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        calls.patches.push(JSON.parse(String(init.body)))
        return respond()
      }
      if (init?.method === 'DELETE') {
        calls.deletes += 1
        return respond()
      }
      if (url.endsWith('/entries')) return Response.json([])
      calls.gets += 1
      return Response.json(calls.gets === 1 ? [unit] : later)
    }),
  )
  return calls
}

function renderPage() {
  renderWithProviders(<SetDetailPage />, { route: '/verwalten/sets/set-1', path: '/verwalten/sets/:setId' })
}

// Ein Tick fuer ausstehende Anfragen: ohne ihn waere "keine Anfrage" schon vor dem Senden wahr.
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 20))
}

async function openRename() {
  renderPage()
  const trigger = await screen.findByRole('button', { name: 'Umbenennen' })
  await userEvent.click(trigger)
  const input = screen.getByLabelText('Titel') as HTMLInputElement
  return { trigger, input, dialog: screen.getByRole('dialog', { name: 'Set umbenennen' }) }
}

// Leere Werte werden nicht getippt; paste statt type, damit 200 Zeichen schnell gehen.
async function replaceTitle(input: HTMLInputElement, value: string) {
  await userEvent.clear(input)
  if (value) {
    await userEvent.click(input)
    await userEvent.paste(value)
  }
}

// Feldfehler am Feld verdrahtet, Fokus dort, kein PATCH.
async function expectFieldError(input: HTMLInputElement, message: string, calls: { patches: unknown[] }) {
  const error = await screen.findByText(message)
  expect(error.id).toBe('set-titel-fehler')
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(document.activeElement).toBe(input)
  await settle()
  expect(calls.patches).toHaveLength(0)
}

describe('Set-Seite Kopf', () => {
  it('Liste lädt: Spinner, kein "Umbenennen", kein "Set löschen"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    )
    renderPage()
    expect((await screen.findByRole('status')).textContent).toBe('Lädt …')
    expect(screen.queryByRole('button', { name: 'Umbenennen' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Set löschen' })).toBeNull()
  })

  it('Unbekannte Set-ID: Leerzustand, keine Erfassung', async () => {
    stubSets()
    renderWithProviders(<SetDetailPage />, { route: '/verwalten/sets/gibt-es-nicht', path: '/verwalten/sets/:setId' })
    expect(await screen.findByText(setGone)).toBeTruthy()
    expect(screen.getByText('Gehe zurück zu allen Sets.')).toBeTruthy()
    expect(screen.queryByLabelText('Deutsch')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Umbenennen' })).toBeNull()
  })

  it('Ladefehler der Liste: Fehlertext statt "gibt es nicht"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    )
    renderPage()
    expect((await screen.findByRole('alert')).textContent).toBe(generic)
    expect(screen.queryByText(setGone)).toBeNull()
  })

  it('Set gefunden: Titel als Überschrift, beide Aktionen', async () => {
    stubSets()
    renderPage()
    expect(await screen.findByRole('heading', { level: 2, name: 'Unit 3' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Umbenennen' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Set löschen' })).toBeTruthy()
  })
})

// Hausregel: je Fall genau eine Abweichung, exakte Texte, Enter eigener Pfad, Happy Path zuletzt.
describe('Set umbenennen', () => {
  it('Dialog: Titel, Beschreibung, Feld vorbefüllt und fokussiert', async () => {
    stubSets()
    const { input, dialog } = await openRename()
    const describedBy = dialog.getAttribute('aria-describedby')
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBe(
      'Der Lernstand der Kinder bleibt erhalten.',
    )
    expect(input.value).toBe('Unit 3')
    expect(input.id).toBe('set-titel')
    expect(input.getAttribute('autocomplete')).toBe('off')
    expect(document.activeElement).toBe(input)
  })

  it('1: leer → Feldfehler, kein PATCH', async () => {
    const calls = stubSets()
    const { input } = await openRename()
    await replaceTitle(input, '')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await expectFieldError(input, titleMissing, calls)
  })

  it('2: nur Leerzeichen → Feldfehler, kein PATCH', async () => {
    const calls = stubSets()
    const { input } = await openRename()
    await replaceTitle(input, '   ')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await expectFieldError(input, titleMissing, calls)
  })

  it('3: 201 Zeichen → Feldfehler, kein PATCH', async () => {
    const calls = stubSets()
    const { input } = await openRename()
    await replaceTitle(input, 'a'.repeat(201))
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await expectFieldError(input, titleTooLong, calls)
  })

  it('4: Server 404 → Fehler im Dialog bis zum Schließen, danach Leerzustand und Fokus auf "Alle Sets"', async () => {
    const calls = stubSets(notFound, [])
    const { input } = await openRename()
    await replaceTitle(input, 'Unit 4')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect((await screen.findByRole('alert')).textContent).toBe(setGone)
    expect(screen.getByRole('dialog', { name: 'Set umbenennen' })).toBeTruthy()
    expect(input.value).toBe('Unit 4')
    await settle()
    expect(calls.gets).toBe(1)

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(await screen.findByText('Gehe zurück zu allen Sets.')).toBeTruthy()
    expect(screen.getByText(setGone)).toBeTruthy()
    expect(calls.gets).toBe(2)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Alle Sets' })))
  })

  it('Feldfehler des Servers steht am Feld', async () => {
    const calls = stubSets(async () =>
      Response.json({ title: 'One or more validation errors occurred.', errors: { title: [titleTooLong] } }, { status: 400 }),
    )
    const { input } = await openRename()
    await replaceTitle(input, 'Unit 4')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect((await screen.findByText(titleTooLong)).id).toBe('set-titel-fehler')
    expect(document.activeElement).toBe(input)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(calls.patches).toHaveLength(1)
  })

  it('Server nicht erreichbar: Hinweis im Dialog, Eingabe bleibt', async () => {
    stubSets(async () => {
      throw new TypeError('Failed to fetch')
    })
    const { input } = await openRename()
    await replaceTitle(input, 'Unit 4')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect((await screen.findByRole('alert')).textContent).toBe(unreachable)
    expect(input.value).toBe('Unit 4')
    expect((screen.getByRole('button', { name: 'Speichern' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('5: Enter im Feld sendet genau ein PATCH', async () => {
    const calls = stubSets()
    const { input } = await openRename()
    await replaceTitle(input, 'Unit 4')
    await userEvent.type(input, '{Enter}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await settle()
    expect(calls.patches).toEqual([{ title: 'Unit 4' }])
  })

  it('6: geändert, dann Esc → kein PATCH, alter Titel, Fokus auf "Umbenennen"', async () => {
    const calls = stubSets()
    const { input, trigger } = await openRename()
    await replaceTitle(input, 'Unit 4')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    expect(screen.getByRole('heading', { level: 2, name: 'Unit 3' })).toBeTruthy()
    await settle()
    expect(calls.patches).toHaveLength(0)
  })

  it('6: geändert, dann "Abbrechen" → kein PATCH, Fokus auf "Umbenennen"; erneut geöffnet steht der alte Titel', async () => {
    const calls = stubSets()
    const { input, trigger } = await openRename()
    await replaceTitle(input, 'Unit 4')
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    await userEvent.click(trigger)
    expect((screen.getByLabelText('Titel') as HTMLInputElement).value).toBe('Unit 3')
    await settle()
    expect(calls.patches).toHaveLength(0)
  })

  it('7: genau 200 Zeichen → PATCH gesendet', async () => {
    const calls = stubSets()
    const { input } = await openRename()
    await replaceTitle(input, 'b'.repeat(200))
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() => expect(calls.patches).toEqual([{ title: 'b'.repeat(200) }]))
  })

  it('Doppelklick auf "Speichern": genau ein PATCH, gesperrt, Esc schließt nicht', async () => {
    let release: () => void = () => {}
    const calls = stubSets(
      () =>
        new Promise<Response>((resolve) => {
          release = () => void ok().then(resolve)
        }),
    )
    const { input } = await openRename()
    await replaceTitle(input, 'Unit 4')
    const save = screen.getByRole('button', { name: 'Speichern' })
    await userEvent.dblClick(save)
    expect(save.textContent).toBe('Einen Moment …')
    expect((save as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Abbrechen' }) as HTMLButtonElement).disabled).toBe(true)
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Set umbenennen' })).toBeTruthy()
    release()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(calls.patches).toHaveLength(1)
  })

  it('Neuer Versuch nimmt die alte Erfolgsmeldung weg', async () => {
    stubSets()
    const { input } = await openRename()
    await replaceTitle(input, 'Unit 4')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(await screen.findByText('Der neue Titel ist gespeichert.')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Umbenennen' }))
    await replaceTitle(screen.getByLabelText('Titel') as HTMLInputElement, '')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(await screen.findByText('Ein Set braucht einen Titel.')).toBeTruthy()
    expect(screen.queryByText('Der neue Titel ist gespeichert.')).toBeNull()
  })

  it('8: Happy Path „Unit 3 — At the zoo“: neue Überschrift, Erfolgsmeldung, Fokus auf "Umbenennen"', async () => {
    const renamed = { ...unit, title: 'Unit 3 — At the zoo' }
    const calls = stubSets(async () => Response.json(renamed), [renamed])
    const { input, trigger } = await openRename()
    await replaceTitle(input, '  Unit 3 — At the zoo  ')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Unit 3 — At the zoo' })).toBeTruthy()
    expect(screen.getByText('Der neue Titel ist gespeichert.').getAttribute('role')).toBe('status')
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    expect(calls.patches).toEqual([{ title: 'Unit 3 — At the zoo' }])
  })
})

async function openDelete() {
  renderPage()
  const trigger = await screen.findByRole('button', { name: 'Set löschen' })
  await userEvent.click(trigger)
  return { trigger, dialog: screen.getByRole('alertdialog', { name: deleteTitle }) }
}

const noContent = async () => new Response(null, { status: 204 })

describe('Set löschen', () => {
  it('1: Fokus auf "Abbrechen", Titel und Beschreibung exakt', async () => {
    stubSets(noContent)
    const { dialog } = await openDelete()
    expect(screen.getByRole('heading', { name: deleteTitle })).toBeTruthy()
    const describedBy = dialog.getAttribute('aria-describedby')
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBe(deleteDescription)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abbrechen' }))
  })

  it('2: Enter direkt nach dem Öffnen → kein DELETE, Fokus auf "Set löschen"', async () => {
    const calls = stubSets(noContent)
    const { trigger } = await openDelete()
    await userEvent.keyboard('{Enter}')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    await settle()
    expect(calls.deletes).toBe(0)
  })

  it('3: Esc → kein DELETE, Fokus auf "Set löschen"', async () => {
    const calls = stubSets(noContent)
    const { trigger } = await openDelete()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    await settle()
    expect(calls.deletes).toBe(0)
  })

  it('4: Klick auf die Abdunklung lässt den Dialog offen', async () => {
    stubSets(noContent)
    await openDelete()
    await userEvent.click(document.querySelector('.bg-scrim') as Element)
    expect(screen.getByRole('alertdialog', { name: deleteTitle })).toBeTruthy()
  })

  it('5: Tab bleibt im Dialog', async () => {
    stubSets(noContent)
    await openDelete()
    const cancel = screen.getByRole('button', { name: 'Abbrechen' })
    await userEvent.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Endgültig löschen' }))
    await userEvent.tab()
    expect(document.activeElement).toBe(cancel)
  })

  it('6: Server 404 → Fehler im Dialog bis zum Schließen, Esc → Leerzustand, Fokus auf "Alle Sets"', async () => {
    const calls = stubSets(notFound, [])
    await openDelete()
    await userEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    expect((await screen.findByRole('alert')).textContent).toBe(setGone)
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    await settle()
    expect(calls.gets).toBe(1)

    await userEvent.keyboard('{Escape}')
    expect(await screen.findByText('Gehe zurück zu allen Sets.')).toBeTruthy()
    expect(calls.gets).toBe(2)
    expect(calls.deletes).toBe(1)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Alle Sets' })))
  })

  it('6: Server 500 → Fehler im Dialog, "Abbrechen" gibt den Fokus an "Set löschen"', async () => {
    stubSets(async () => new Response('', { status: 500 }))
    const { trigger } = await openDelete()
    await userEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    expect((await screen.findByRole('alert')).textContent).toBe(generic)
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    expect(screen.getByRole('heading', { level: 2, name: 'Unit 3' })).toBeTruthy()
  })

  it('7: Doppelklick auf "Endgültig löschen" sendet genau ein DELETE', async () => {
    let release: () => void = () => {}
    const calls = stubSets(
      () =>
        new Promise<Response>((resolve) => {
          release = () => void noContent().then(resolve)
        }),
    )
    await openDelete()
    const confirm = screen.getByRole('button', { name: 'Endgültig löschen' })
    await userEvent.dblClick(confirm)
    expect(confirm.textContent).toBe('Einen Moment …')
    release()
    await screen.findByText('/verwalten')
    expect(calls.deletes).toBe(1)
  })

  it('8: Happy Path → /verwalten mit „Das Set „Unit 3“ ist gelöscht.“', async () => {
    const calls = stubSets(noContent)
    await openDelete()
    await userEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    expect(await screen.findByText('/verwalten')).toBeTruthy()
    expect(screen.getByText('Das Set „Unit 3“ ist gelöscht.')).toBeTruthy()
    expect(calls.deletes).toBe(1)
  })
})

// ------------------------------------------------------------ Vokabeln

const entryGone = 'Diese Vokabel gibt es nicht (mehr).'
const sourceMissing = 'Bitte gib das deutsche Wort ein.'
const targetMissing = 'Bitte gib das englische Wort ein.'
const wordTooLong = 'Das Wort darf höchstens 200 Zeichen lang sein.'
const entryDeleteDescription =
  'Der Lernstand aller Kinder zu dieser Vokabel wird mit gelöscht. Das lässt sich nicht rückgängig machen.'

function vocab(id: string, sourceText: string, targetText: string) {
  return {
    id,
    sourceText,
    targetText,
    targetAlternatives: [],
    sourceAlternatives: [],
    partOfSpeech: 'Unknown',
    emoji: null,
    exampleSource: null,
    exampleTarget: null,
    position: 0,
  }
}

const hnud = vocab('e-1', 'Hnud', 'dgo')
const katze = vocab('e-2', 'Katze', 'cat')
const entryNotFound = async () => Response.json({ title: 'Nicht gefunden', detail: entryGone }, { status: 404 })
const offline = async (): Promise<Response> => {
  throw new TypeError('Failed to fetch')
}

/**
 * fetch-Stub der Set-Seite mit Vokabeln. GET /sets liefert [unit]; GET der
 * Vokabelliste beim ersten Mal `list`, danach `later` (z. B. ohne die Vokabel
 * nach einem 404 aus einem anderen Tab). PUT, DELETE und POST antworten per `respond`.
 */
function stubEntries(respond: () => Promise<Response>, list: unknown[] = [hnud, katze], later: unknown[] = list) {
  const calls = { entryGets: 0, puts: [] as unknown[], deletes: 0, posts: [] as unknown[] }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        calls.puts.push(JSON.parse(String(init.body)))
        return respond()
      }
      if (init?.method === 'DELETE') {
        calls.deletes += 1
        return respond()
      }
      if (init?.method === 'POST') {
        calls.posts.push(JSON.parse(String(init.body)))
        return respond()
      }
      if (url.endsWith('/entries')) {
        calls.entryGets += 1
        return Response.json(calls.entryGets === 1 ? list : later)
      }
      return Response.json([unit])
    }),
  )
  return calls
}

const heading = () => screen.getByRole('heading', { level: 2, name: 'Unit 3' })

async function openEdit() {
  renderPage()
  const trigger = await screen.findByRole('button', { name: 'Hnud bearbeiten' })
  await userEvent.click(trigger)
  const dialog = screen.getByRole('dialog', { name: 'Vokabel bearbeiten' })
  // Die Erfassung traegt dieselben Labels: Felder im Dialog suchen.
  const german = within(dialog).getByLabelText('Deutsch') as HTMLInputElement
  const english = within(dialog).getByLabelText('Englisch') as HTMLInputElement
  return { trigger, dialog, german, english }
}

// Feldfehler am Feld verdrahtet, Fokus dort, keine Anfrage der genannten Art.
async function expectWordError(input: HTMLInputElement, message: string, sent: unknown[]) {
  const error = await screen.findByText(message)
  expect(error.id).toBe(`${input.id}-fehler`)
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(document.activeElement).toBe(input)
  await settle()
  expect(sent).toHaveLength(0)
}

// Hausregel: je Fall genau eine Abweichung, exakte Texte, Enter eigener Pfad, Happy Path zuletzt.
describe('Vokabel bearbeiten', () => {
  it('Zeile: Stift vor Papierkorb, Dialog mit Titel, Beschreibung, vorbefüllten Feldern, Fokus Deutsch', async () => {
    stubEntries(async () => Response.json(hnud))
    const { trigger, dialog, german, english } = await openEdit()
    const describedBy = dialog.getAttribute('aria-describedby')
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBe(
      'Der Lernstand der Kinder bleibt erhalten.',
    )
    expect([german.id, german.value, german.getAttribute('autocomplete')]).toEqual(['vokabel-deutsch', 'Hnud', 'off'])
    expect([english.id, english.value, english.getAttribute('autocomplete')]).toEqual(['vokabel-englisch', 'dgo', 'off'])
    expect(document.activeElement).toBe(german)
    expect(trigger.nextElementSibling?.getAttribute('aria-label')).toBe('Hnud löschen')
  })

  it.each([
    ['1: Deutsch leer', 'Deutsch', '', sourceMissing],
    ['2: Deutsch nur Leerzeichen', 'Deutsch', '   ', sourceMissing],
    ['3: Deutsch 201 Zeichen', 'Deutsch', 'a'.repeat(201), wordTooLong],
    ['4: Englisch leer', 'Englisch', '', targetMissing],
    ['5: Englisch nur Leerzeichen', 'Englisch', '   ', targetMissing],
    ['6: Englisch 201 Zeichen', 'Englisch', 'b'.repeat(201), wordTooLong],
  ])('%s → Feldfehler, kein PUT', async (_name, label, value, message) => {
    const calls = stubEntries(async () => Response.json(hnud))
    const { dialog } = await openEdit()
    const input = within(dialog).getByLabelText(label) as HTMLInputElement
    await replaceTitle(input, value)
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await expectWordError(input, message, calls.puts)
  })

  it('beide leer: beide Feldfehler gleichzeitig, Fokus auf Deutsch', async () => {
    const calls = stubEntries(async () => Response.json(hnud))
    const { german, english } = await openEdit()
    await replaceTitle(german, '')
    await replaceTitle(english, '')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(screen.getByText(targetMissing).id).toBe('vokabel-englisch-fehler')
    await expectWordError(german, sourceMissing, calls.puts)
  })

  it('7: Enter im Feld Englisch sendet genau ein PUT', async () => {
    const calls = stubEntries(async () => Response.json({ ...hnud, sourceText: 'Hund', targetText: 'dog' }))
    const { german, english } = await openEdit()
    await replaceTitle(german, 'Hund')
    await replaceTitle(english, 'dog')
    await userEvent.type(english, '{Enter}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await settle()
    expect(calls.puts).toEqual([{ sourceText: 'Hund', targetText: 'dog' }])
  })

  it('8: beide geändert, dann Esc → kein PUT, Zeile unverändert, Fokus auf "Hnud bearbeiten"', async () => {
    const calls = stubEntries(async () => Response.json(hnud))
    const { trigger, german, english } = await openEdit()
    await replaceTitle(german, 'Hund')
    await replaceTitle(english, 'dog')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    expect(screen.getByText('Hnud → dgo')).toBeTruthy()
    await settle()
    expect(calls.puts).toHaveLength(0)
  })

  it('Server 404 → Fehler im Dialog bis zum Schließen, Esc → Zeile weg, Fokus auf der Set-Überschrift', async () => {
    const calls = stubEntries(entryNotFound, [hnud, katze], [katze])
    const { german } = await openEdit()
    await replaceTitle(german, 'Hund')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect((await screen.findByRole('alert')).textContent).toBe(entryGone)
    expect(screen.getByRole('dialog', { name: 'Vokabel bearbeiten' })).toBeTruthy()
    expect(german.value).toBe('Hund')
    await settle()
    expect(calls.entryGets).toBe(1)

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByText('Hnud → dgo')).toBeNull())
    expect(calls.entryGets).toBe(2)
    await waitFor(() => expect(document.activeElement).toBe(heading()))
  })

  it('Feldfehler des Servers steht am Feld', async () => {
    const calls = stubEntries(async () =>
      Response.json({ title: 'One or more validation errors occurred.', errors: { targetText: [wordTooLong] } }, { status: 400 }),
    )
    const { english } = await openEdit()
    await replaceTitle(english, 'dog')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect((await screen.findByText(wordTooLong)).id).toBe('vokabel-englisch-fehler')
    expect(document.activeElement).toBe(english)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(calls.puts).toHaveLength(1)
  })

  it('Server nicht erreichbar: Hinweis im Dialog, Eingaben bleiben', async () => {
    stubEntries(offline)
    const { german, english } = await openEdit()
    await replaceTitle(german, 'Hund')
    await replaceTitle(english, 'dog')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect((await screen.findByRole('alert')).textContent).toBe(unreachable)
    expect([german.value, english.value]).toEqual(['Hund', 'dog'])
    expect(screen.getByText('Hnud → dgo')).toBeTruthy()
  })

  it('Doppelklick auf "Speichern": genau ein PUT, gesperrt, Esc schließt nicht', async () => {
    let release: () => void = () => {}
    const calls = stubEntries(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(Response.json(hnud))
        }),
    )
    await openEdit()
    const save = screen.getByRole('button', { name: 'Speichern' })
    await userEvent.dblClick(save)
    expect(save.textContent).toBe('Einen Moment …')
    expect((save as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Abbrechen' }) as HTMLButtonElement).disabled).toBe(true)
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Vokabel bearbeiten' })).toBeTruthy()
    release()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(calls.puts).toHaveLength(1)
  })

  it('9: Happy Path „Hund“/„dog“: Zeile neu, Erfolgsmeldung, Fokus auf "Hund bearbeiten"', async () => {
    const fixed = { ...hnud, sourceText: 'Hund', targetText: 'dog' }
    const calls = stubEntries(async () => Response.json(fixed), [hnud, katze], [fixed, katze])
    const { german, english } = await openEdit()
    await replaceTitle(german, ' Hund ')
    await replaceTitle(english, 'dog')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(await screen.findByText('Hund → dog')).toBeTruthy()
    expect(screen.getByText('Die Vokabel ist gespeichert.').getAttribute('role')).toBe('status')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Hund bearbeiten' })))
    expect(calls.puts).toEqual([{ sourceText: 'Hund', targetText: 'dog' }])
  })
})

async function openEntryDelete() {
  renderPage()
  const trigger = await screen.findByRole('button', { name: 'Katze löschen' })
  await userEvent.click(trigger)
  return { trigger, dialog: screen.getByRole('alertdialog', { name: '„Katze“ löschen?' }) }
}

describe('Vokabel löschen', () => {
  it('1: Fokus auf "Abbrechen", Titel und Beschreibung exakt', async () => {
    stubEntries(noContent)
    const { dialog } = await openEntryDelete()
    expect(screen.getByRole('heading', { name: '„Katze“ löschen?' })).toBeTruthy()
    const describedBy = dialog.getAttribute('aria-describedby')
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBe(entryDeleteDescription)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abbrechen' }))
  })

  it('2: Enter direkt nach dem Öffnen → kein DELETE, Fokus auf dem Papierkorb', async () => {
    const calls = stubEntries(noContent)
    const { trigger } = await openEntryDelete()
    await userEvent.keyboard('{Enter}')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    await settle()
    expect(calls.deletes).toBe(0)
  })

  it('3: Esc → kein DELETE, Fokus auf dem Papierkorb', async () => {
    const calls = stubEntries(noContent)
    const { trigger } = await openEntryDelete()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    expect(screen.getByText('Katze → cat')).toBeTruthy()
    await settle()
    expect(calls.deletes).toBe(0)
  })

  it('4: Klick auf die Abdunklung lässt den Dialog offen', async () => {
    stubEntries(noContent)
    await openEntryDelete()
    await userEvent.click(document.querySelector('.bg-scrim') as Element)
    expect(screen.getByRole('alertdialog', { name: '„Katze“ löschen?' })).toBeTruthy()
  })

  it('5: Tab bleibt im Dialog', async () => {
    stubEntries(noContent)
    await openEntryDelete()
    const cancel = screen.getByRole('button', { name: 'Abbrechen' })
    await userEvent.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Endgültig löschen' }))
    await userEvent.tab()
    expect(document.activeElement).toBe(cancel)
  })

  it('6: Server 404 → Fehler im Dialog, Zeile bleibt; "Abbrechen" → Zeile weg, Fokus auf der Set-Überschrift', async () => {
    const calls = stubEntries(entryNotFound, [hnud, katze], [hnud])
    await openEntryDelete()
    await userEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    expect((await screen.findByRole('alert')).textContent).toBe(entryGone)
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(screen.getByText('Katze → cat')).toBeTruthy()
    await settle()
    expect(calls.entryGets).toBe(1)

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    await waitFor(() => expect(screen.queryByText('Katze → cat')).toBeNull())
    expect(calls.entryGets).toBe(2)
    await waitFor(() => expect(document.activeElement).toBe(heading()))
  })

  it('6: Server 500 → Fehler im Dialog, "Abbrechen" gibt den Fokus an den Papierkorb', async () => {
    stubEntries(async () => new Response('', { status: 500 }))
    const { trigger } = await openEntryDelete()
    await userEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    expect((await screen.findByRole('alert')).textContent).toBe(generic)
    expect(screen.getByText('Katze → cat')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('7: Doppelklick auf "Endgültig löschen" sendet genau ein DELETE', async () => {
    let release: () => void = () => {}
    const calls = stubEntries(
      () =>
        new Promise<Response>((resolve) => {
          release = () => void noContent().then(resolve)
        }),
      [hnud, katze],
      [hnud],
    )
    await openEntryDelete()
    const confirm = screen.getByRole('button', { name: 'Endgültig löschen' })
    await userEvent.dblClick(confirm)
    expect(confirm.textContent).toBe('Einen Moment …')
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    release()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(calls.deletes).toBe(1)
  })

  it('Letzte Vokabel gelöscht: Erfolgsmeldung über dem Leerzustand', async () => {
    stubEntries(noContent, [katze], [])
    await openEntryDelete()
    await userEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    expect(await screen.findByText('Noch keine Vokabeln in diesem Set')).toBeTruthy()
    expect(screen.getByText('„Katze“ ist gelöscht.').getAttribute('role')).toBe('status')
  })

  it('8: Happy Path → Zeile weg, „„Katze“ ist gelöscht.“, Fokus auf der Set-Überschrift', async () => {
    const calls = stubEntries(noContent, [hnud, katze], [hnud])
    await openEntryDelete()
    await userEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    await waitFor(() => expect(screen.queryByText('Katze → cat')).toBeNull())
    expect(screen.getByText('„Katze“ ist gelöscht.').getAttribute('role')).toBe('status')
    expect(screen.getByText('Hnud → dgo')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(heading()))
    expect(calls.deletes).toBe(1)
  })
})

async function renderCapture() {
  renderPage()
  const german = (await screen.findByLabelText('Deutsch')) as HTMLInputElement
  return { german, english: screen.getByLabelText('Englisch') as HTMLInputElement }
}

const tooLongField = (key: string) => async () =>
  Response.json({ title: 'One or more validation errors occurred.', errors: { [key]: [wordTooLong] } }, { status: 400 })

describe('Erfassung', () => {
  it.each([
    ['1: Deutsch leer', '', 'dog', 'Deutsch', sourceMissing],
    ['2: Deutsch nur Leerzeichen', '   ', 'dog', 'Deutsch', sourceMissing],
    ['3: Englisch leer', 'Hund', '', 'Englisch', targetMissing],
    ['4: Englisch nur Leerzeichen', 'Hund', '   ', 'Englisch', targetMissing],
  ])('%s → Feldfehler, kein POST', async (_name, source, target, label, message) => {
    const calls = stubEntries(async () => Response.json(hnud, { status: 201 }))
    const { german, english } = await renderCapture()
    await replaceTitle(german, source)
    await replaceTitle(english, target)
    await userEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }))
    await expectWordError(screen.getByLabelText(label) as HTMLInputElement, message, calls.posts)
  })

  it('Fehlertext steht unter eintrag-deutsch-fehler', async () => {
    stubEntries(async () => Response.json(hnud, { status: 201 }))
    const { english } = await renderCapture()
    await replaceTitle(english, 'dog')
    await userEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }))
    expect((await screen.findByText(sourceMissing)).id).toBe('eintrag-deutsch-fehler')
  })

  it('5: Deutsch leer, Enter im Feld Englisch → Feldfehler, kein POST', async () => {
    const calls = stubEntries(async () => Response.json(hnud, { status: 201 }))
    const { german, english } = await renderCapture()
    await replaceTitle(english, 'dog')
    await userEvent.type(english, '{Enter}')
    await expectWordError(german, sourceMissing, calls.posts)
  })

  it.each([
    ['6: Deutsch 201 Zeichen', 'a'.repeat(201), 'dog', 'sourceText'],
    ['7: Englisch 201 Zeichen', 'Hund', 'b'.repeat(201), 'targetText'],
  ])('%s → Servertext unter dem Formular', async (_name, source, target, key) => {
    const calls = stubEntries(tooLongField(key))
    const { german, english } = await renderCapture()
    await replaceTitle(german, source)
    await replaceTitle(english, target)
    await userEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }))
    expect((await screen.findByRole('alert')).textContent).toBe(wordTooLong)
    expect(calls.posts).toHaveLength(1)
  })

  it('8: Server nicht erreichbar → Hinweis unter dem Formular', async () => {
    stubEntries(offline)
    const { german, english } = await renderCapture()
    await replaceTitle(german, 'Hund')
    await replaceTitle(english, 'dog')
    await userEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }))
    expect((await screen.findByRole('alert')).textContent).toBe(unreachable)
  })

  it('9: Happy Path „Hund“/„dog“ per Enter: ein POST, Zeile da, Felder leer, keine Fehlertexte', async () => {
    const hund = vocab('e-3', 'Hund', 'dog')
    const calls = stubEntries(async () => Response.json(hund, { status: 201 }), [], [hund])
    const { german, english } = await renderCapture()
    // Erst ein Fehlversuch: der Happy Path muss den Fehlertext wieder wegnehmen.
    await userEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }))
    expect(await screen.findByText(sourceMissing)).toBeTruthy()
    await replaceTitle(german, 'Hund')
    await replaceTitle(english, 'dog')
    await userEvent.type(english, '{Enter}')
    expect(await screen.findByText('Hund → dog')).toBeTruthy()
    expect([german.value, english.value]).toEqual(['', ''])
    expect(screen.queryByText(sourceMissing)).toBeNull()
    expect(screen.queryByText(targetMissing)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(calls.posts).toEqual([{ sourceText: 'Hund', targetText: 'dog' }])
  })
})
