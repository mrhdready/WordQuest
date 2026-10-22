import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SetDetailPage } from '@/features/manage/SetDetailPage'
import { shrinkPicture } from '@/lib/picture'
import { renderWithProviders } from '@/test/render'

// jsdom hat keinen Canvas (Recherche Pitfall 9): Verkleinern ist in picture.test.tsx belegt.
vi.mock('@/lib/picture', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/picture')>()),
  shrinkPicture: vi.fn(),
}))

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
    stubSets(offlineAfterBlur)
    const { input } = await openRename()
    await replaceTitle(input, 'Unit 4')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect((await screen.findByRole('alert')).textContent).toBe(unreachable)
    expect(input.value).toBe('Unit 4')
    expect((screen.getByRole('button', { name: 'Speichern' }) as HTMLButtonElement).disabled).toBe(false)
    // WR-03: der gesperrte "Speichern" verliert den Fokus, nach dem Fehler steht er auf "Abbrechen".
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abbrechen' })))
  })

  it('Enter im Feld, Server nicht erreichbar: Fokus bleibt im Feld', async () => {
    stubSets(offline)
    const { input } = await openRename()
    await replaceTitle(input, 'Unit 4')
    await userEvent.type(input, '{Enter}')
    expect((await screen.findByRole('alert')).textContent).toBe(unreachable)
    await settle()
    expect(document.activeElement).toBe(input)
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
// jsdom kennt die Focus-Fixup-Regel nicht: wie Chromium beim Sperren des geklickten
// Buttons faellt der Fokus auf body (gemessen im e2e-Stack, WR-03).
const offlineAfterBlur = async (): Promise<Response> => {
  const active = document.activeElement as HTMLElement | null
  active?.blur()
  return offline()
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
    stubEntries(offlineAfterBlur)
    const { german, english } = await openEdit()
    await replaceTitle(german, 'Hund')
    await replaceTitle(english, 'dog')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect((await screen.findByRole('alert')).textContent).toBe(unreachable)
    expect([german.value, english.value]).toEqual(['Hund', 'dog'])
    expect(screen.getByText('Hnud → dgo')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abbrechen' })))
  })

  it('Enter im Feld Englisch, Server nicht erreichbar: Fokus bleibt im Feld', async () => {
    stubEntries(offline)
    const { english } = await openEdit()
    await userEvent.type(english, '{Enter}')
    expect((await screen.findByRole('alert')).textContent).toBe(unreachable)
    await settle()
    expect(document.activeElement).toBe(english)
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

  it('Zweimal Absenden im selben Takt: genau ein PUT (Ref-Riegel, nicht nur disabled)', async () => {
    const calls = stubEntries(() => new Promise<Response>(() => {}))
    const { dialog } = await openEdit()
    const form = dialog.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)
    fireEvent.submit(form)
    await settle()
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

  it('Hinzufügen nimmt eine alte Erfolgsmeldung weg', async () => {
    stubEntries(noContent, [hnud, katze], [hnud])
    await openEntryDelete()
    await userEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    expect(await screen.findByText('„Katze“ ist gelöscht.')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }))
    expect(await screen.findByText(sourceMissing)).toBeTruthy()
    expect(screen.queryByText('„Katze“ ist gelöscht.')).toBeNull()
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

const importRow = (lineNumber: number, source: string, target: string, problem: string | null = null) => ({
  lineNumber,
  source,
  target,
  emoji: null,
  problem,
})
type ImportRowStub = ReturnType<typeof importRow>
const previewOf = (rows: ImportRowStub[]) => ({
  delimiter: ';',
  hadHeader: false,
  validCount: rows.filter((row) => row.problem === null).length,
  problemCount: rows.filter((row) => row.problem !== null).length,
  rows,
})
const hundRow = importRow(1, 'Hund', 'dog')
const katzeRow = importRow(2, 'Katze', 'cat')
const noDelimiter = 'Zeile hat keine zwei befüllten Spalten.'

/**
 * fetch-Stub fuer den CSV-Import. Die Vorschau antwortet per `preview`, das
 * Uebernehmen per `confirm`; gezaehlt werden die Koerper beider Anfragen.
 */
function stubImport(
  rows: ImportRowStub[],
  {
    preview = async () => Response.json(previewOf(rows)),
    confirm = async () => Response.json({ imported: rows.length }),
  }: { preview?: () => Promise<Response>; confirm?: () => Promise<Response> } = {},
) {
  const calls = { previews: [] as unknown[], imports: [] as unknown[] }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/import/preview')) {
        calls.previews.push(JSON.parse(String(init?.body)))
        return preview()
      }
      if (url.endsWith('/import')) {
        calls.imports.push(JSON.parse(String(init?.body)))
        return confirm()
      }
      if (url.endsWith('/entries')) return Response.json([])
      return Response.json([unit])
    }),
  )
  return calls
}

async function openImport(text: string) {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Liste importieren (CSV)' }))
  const textarea = screen.getByRole('textbox', { name: /^Eine Zeile pro Vokabel/ }) as HTMLTextAreaElement
  await userEvent.click(textarea)
  await userEvent.paste(text)
  return textarea
}

async function runPreview(text: string) {
  const textarea = await openImport(text)
  await userEvent.click(screen.getByRole('button', { name: 'Vorschau' }))
  await screen.findByRole('region', { name: 'Vorschau' })
  return textarea
}

function held() {
  let release: (response: Response) => void = () => {}
  const pending = new Promise<Response>((resolve) => {
    release = resolve
  })
  return { answer: () => pending, release: (response: Response) => release(response) }
}

describe('CSV-Import', () => {
  it.each([
    [[hundRow], '1 Vokabel übernehmen'],
    [[hundRow, katzeRow], '2 Vokabeln übernehmen'],
  ])('%#: Anzahl im Button mit Singular und Plural', async (rows, label) => {
    stubImport(rows)
    await runPreview('Hund;dog')
    expect(screen.getByRole('button', { name: label })).toBeTruthy()
  })

  it('Problemzeile nennt das betroffene Wort', async () => {
    stubImport([hundRow, importRow(2, 'ohneTrennzeichen', '', noDelimiter)])
    await runPreview('Hund;dog\nohneTrennzeichen')
    const region = screen.getByRole('region', { name: 'Vorschau' })
    expect(within(region).getByText(noDelimiter)).toBeTruthy()
    expect(within(region).getByText('ohneTrennzeichen')).toBeTruthy()
  })

  it('Übernehmen scheitert: Servertext statt „Der Import ist fehlgeschlagen.“', async () => {
    stubImport([hundRow, katzeRow], { confirm: notFound })
    await runPreview('Hund;dog\nKatze;cat')
    await userEvent.click(screen.getByRole('button', { name: '2 Vokabeln übernehmen' }))
    expect((await screen.findByRole('alert')).textContent).toBe(setGone)
  })

  it('Text nach einem Fehler geändert: der alte Fehlertext verschwindet mit der Vorschau', async () => {
    stubImport([hundRow, katzeRow], { confirm: notFound })
    const textarea = await runPreview('Hund;dog\nKatze;cat')
    await userEvent.click(screen.getByRole('button', { name: '2 Vokabeln übernehmen' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    await userEvent.type(textarea, 'x')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('Vorschau läuft: „Einen Moment …“, gesperrt', async () => {
    const answer = held()
    stubImport([hundRow], { preview: answer.answer })
    const textarea = await openImport('Hund;dog')
    await userEvent.click(screen.getByRole('button', { name: 'Vorschau' }))
    const busy = await screen.findByRole('button', { name: 'Einen Moment …' })
    expect((busy as HTMLButtonElement).disabled).toBe(true)
    // Sonst kaeme die Vorschau des alten Textes nach einer Aenderung noch an.
    expect(textarea.readOnly).toBe(true)
    answer.release(Response.json(previewOf([hundRow])))
    expect(await screen.findByRole('button', { name: 'Vorschau' })).toBeTruthy()
    expect(textarea.readOnly).toBe(false)
  })

  it('Übernehmen läuft: „Einen Moment …“, gesperrt', async () => {
    const answer = held()
    stubImport([hundRow, katzeRow], { confirm: answer.answer })
    await runPreview('Hund;dog\nKatze;cat')
    await userEvent.click(screen.getByRole('button', { name: '2 Vokabeln übernehmen' }))
    const busy = await screen.findByRole('button', { name: 'Einen Moment …' })
    expect((busy as HTMLButtonElement).disabled).toBe(true)
    // Sonst liefe der Import mit den alten Zeilen, waehrend das Feld schon anderes zeigt.
    expect((screen.getByRole('textbox', { name: /^Eine Zeile pro Vokabel/ }) as HTMLTextAreaElement).readOnly).toBe(true)
    answer.release(Response.json({ imported: 2 }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Vorschau' })).toBeNull())
  })

  it('Text nach der Vorschau geändert: Vorschau verworfen, Übernehmen gesperrt, kein Import', async () => {
    const calls = stubImport([hundRow])
    const textarea = await runPreview('Hund;dog')
    await userEvent.type(textarea, '\nKatze;cat')
    expect(screen.queryByRole('region', { name: 'Vorschau' })).toBeNull()
    expect(screen.queryByText('1 erkannt')).toBeNull()
    const confirm = screen.getByRole('button', { name: 'Übernehmen' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    await userEvent.click(confirm)
    await settle()
    expect(calls.imports).toHaveLength(0)
  })
})

// „Löwe;lion“ als Bytes: der Umlaut entscheidet, ob die Kodierung stimmt.
const loeweUtf8 = [...new TextEncoder().encode('Löwe;lion')]
const loeweWindows1252 = [0x4c, 0xf6, 0x77, 0x65, ...new TextEncoder().encode(';lion')]
// UTF-16 mit BOM; Excel „Unicode-Text (*.txt)“ speichert so als UTF-16LE.
const utf16 = (text: string, littleEndian: boolean) => [
  ...(littleEndian ? [0xff, 0xfe] : [0xfe, 0xff]),
  ...[...text].flatMap((char) => {
    const unit = char.charCodeAt(0)
    return littleEndian ? [unit & 0xff, unit >> 8] : [unit >> 8, unit & 0xff]
  }),
]
const fileTooBig = 'Die Datei ist zu groß. Eine Vokabelliste darf höchstens 1 MB groß sein.'
const fileUnreadable = 'Die Datei ließ sich nicht lesen. Wähle sie noch einmal aus oder füge den Text ein.'

async function openImportFile() {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Liste importieren (CSV)' }))
  expect(screen.getByRole('button', { name: 'Datei wählen' })).toBeTruthy()
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  expect(input.accept).toBe('.csv,.txt,text/csv,text/plain')
  const textarea = screen.getByRole('textbox', { name: /^Eine Zeile pro Vokabel/ }) as HTMLTextAreaElement
  return { input, textarea }
}

const csvFile = (bytes: number[] | Uint8Array, name = 'loewe.csv') =>
  new File([new Uint8Array(bytes)], name, { type: 'text/csv' })

describe('CSV-Import: Datei wählen', () => {
  it.each([
    ['UTF-8', loeweUtf8],
    ['UTF-8 mit BOM', [0xef, 0xbb, 0xbf, ...loeweUtf8]],
    ['Windows-1252', loeweWindows1252],
    ['UTF-16LE', utf16('Löwe;lion', true)],
    ['UTF-16BE', utf16('Löwe;lion', false)],
  ])('%s: „Löwe;lion“ im Textfeld, Statusmeldung', async (_name, bytes) => {
    stubImport([hundRow])
    const { input, textarea } = await openImportFile()
    await userEvent.upload(input, csvFile(bytes))
    expect((await screen.findByRole('status')).textContent).toBe('Die Datei „loewe.csv“ ist eingelesen.')
    expect(textarea.value).toBe('Löwe;lion')
  })

  it('Excel „Unicode-Text“ (UTF-16LE, Tab): Zeilen mit Tab im Textfeld', async () => {
    stubImport([hundRow])
    const { input, textarea } = await openImportFile()
    await userEvent.upload(input, csvFile(utf16('Löwe\tlion\r\nHund\tdog\r\n', true), 'vokabeln.txt'))
    expect((await screen.findByRole('status')).textContent).toBe('Die Datei „vokabeln.txt“ ist eingelesen.')
    expect(textarea.value).toBe('Löwe\tlion\nHund\tdog\n')
  })

  it('Vorschau schickt den Dateiinhalt als Text', async () => {
    const calls = stubImport([hundRow])
    const { input } = await openImportFile()
    await userEvent.upload(input, csvFile(loeweWindows1252))
    await userEvent.click(await screen.findByRole('button', { name: 'Vorschau' }))
    await screen.findByRole('region', { name: 'Vorschau' })
    expect(calls.previews).toEqual([{ content: 'Löwe;lion' }])
  })

  it('Datei über 1 MB: Fehlertext, Textfeld bleibt leer', async () => {
    stubImport([hundRow])
    const { input, textarea } = await openImportFile()
    await userEvent.upload(input, csvFile(new Uint8Array(1024 * 1024 + 1), 'gross.csv'))
    expect((await screen.findByRole('alert')).textContent).toBe(fileTooBig)
    expect(textarea.value).toBe('')
  })

  it('Datei nicht lesbar: Fehlertext, Textfeld bleibt leer', async () => {
    stubImport([hundRow])
    const { input, textarea } = await openImportFile()
    const file = csvFile(loeweUtf8)
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => Promise.reject(new DOMException('weg', 'NotReadableError')),
    })
    await userEvent.upload(input, file)
    expect((await screen.findByRole('alert')).textContent).toBe(fileUnreadable)
    expect(textarea.value).toBe('')
  })

  it('Leere Datei: wie ein leeres Textfeld, „Vorschau“ gesperrt, keine Meldung', async () => {
    stubImport([hundRow])
    const { input, textarea } = await openImportFile()
    await userEvent.click(textarea)
    await userEvent.paste('Hund;dog')
    await userEvent.upload(input, csvFile([], 'leer.csv'))
    await waitFor(() => expect(textarea.value).toBe(''))
    expect((screen.getByRole('button', { name: 'Vorschau' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('Datei wird gelesen: Textfeld und „Vorschau“ gesperrt, „Datei wählen“ behält den Fokus', async () => {
    stubImport([hundRow])
    const { input, textarea } = await openImportFile()
    await userEvent.click(textarea)
    await userEvent.paste('Hund;dog')
    let release: (bytes: ArrayBuffer) => void = () => {}
    const file = csvFile(loeweUtf8)
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => new Promise<ArrayBuffer>((resolve) => (release = resolve)),
    })
    await userEvent.upload(input, file)
    // Sonst liefe eine Vorschau des alten Textes, deren Zeilen nach dem Lesen uebernommen wuerden.
    expect((screen.getByRole('button', { name: 'Vorschau' }) as HTMLButtonElement).disabled).toBe(true)
    // Nicht gesperrt: ein gesperrter Button gaebe den Fokus an body ab (gemessen im e2e-Stack).
    expect((screen.getByRole('button', { name: 'Datei wählen' }) as HTMLButtonElement).disabled).toBe(false)
    expect(textarea.readOnly).toBe(true)
    release(new Uint8Array(loeweUtf8).buffer)
    await waitFor(() => expect(textarea.value).toBe('Löwe;lion'))
    expect((screen.getByRole('button', { name: 'Vorschau' }) as HTMLButtonElement).disabled).toBe(false)
    expect(textarea.readOnly).toBe(false)
  })

  it('Dateifehler nach einem Vorschau-Fehler: nur die neue Meldung steht da', async () => {
    stubImport([hundRow], { preview: async () => new Response('', { status: 500 }) })
    const { input, textarea } = await openImportFile()
    await userEvent.click(textarea)
    await userEvent.paste('Hund;dog')
    await userEvent.click(screen.getByRole('button', { name: 'Vorschau' }))
    expect((await screen.findByRole('alert')).textContent).toBe(generic)
    await userEvent.upload(input, csvFile(new Uint8Array(1024 * 1024 + 1), 'gross.csv'))
    await waitFor(() => expect(screen.getAllByRole('alert').map((alert) => alert.textContent)).toEqual([fileTooBig]))
  })

  it('Text geändert: die Dateimeldung verschwindet', async () => {
    stubImport([hundRow])
    const { input, textarea } = await openImportFile()
    await userEvent.upload(input, csvFile(loeweUtf8))
    expect(await screen.findByRole('status')).toBeTruthy()
    await userEvent.type(textarea, 'x')
    expect(screen.queryByRole('status')).toBeNull()
  })
})

// D-03, D-16: Vorschaubild statt Emoji; scheitert Abruf oder Dekodieren, steht das Emoji im Rahmen.
describe('Vorschaubild', () => {
  const hund = { ...vocab('e-1', 'Hund', 'dog'), emoji: '🐶', pictureVersion: 'pv-1' }
  const katzeMitEmoji = { ...vocab('e-2', 'Katze', 'cat'), emoji: '🐱', pictureVersion: null }

  function stubPictures(picture: () => Promise<Response>) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/entries')) return Response.json([hund, katzeMitEmoji])
        if (url.includes('/pictures/')) return picture()
        return Response.json([unit])
      }),
    )
  }
  const png = async () =>
    new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), { headers: { 'Content-Type': 'image/png' } })

  async function hundRow() {
    const text = await screen.findByText('Hund → dog')
    const row = text.parentElement as HTMLElement
    return { text, row, frame: within(row).getByTestId('vokabelbild') }
  }

  it('Zeile mit Bild: img mit leerem alt vor dem Text, kein Emoji', async () => {
    stubPictures(png)
    renderPage()
    const { text, row, frame } = await hundRow()
    await waitFor(() => expect(frame.querySelector('img')).not.toBeNull())
    const image = frame.querySelector('img') as HTMLImageElement
    expect(image.getAttribute('alt')).toBe('')
    expect(image.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(row.textContent).not.toContain('🐶')
  })

  it('Zeile ohne Bild mit Emoji: Emoji wie bisher', async () => {
    stubPictures(png)
    renderPage()
    const row = (await screen.findByText('Katze → cat')).parentElement as HTMLElement
    expect(within(row).queryByTestId('vokabelbild')).toBeNull()
    expect(row.textContent).toContain('🐱')
  })

  it('Bildabruf 500: Emoji als Rückfall im Rahmen', async () => {
    stubPictures(async () => new Response('', { status: 500 }))
    renderPage()
    const { frame } = await hundRow()
    await waitFor(() => expect(frame.textContent).toBe('🐶'))
    expect(frame.querySelector('img')).toBeNull()
  })

  it('Dekodierfehler am img: Emoji im Rahmen', async () => {
    stubPictures(png)
    renderPage()
    const { frame } = await hundRow()
    await waitFor(() => expect(frame.querySelector('img')).not.toBeNull())
    fireEvent.error(frame.querySelector('img') as HTMLImageElement)
    expect(frame.querySelector('img')).toBeNull()
    expect(frame.textContent).toBe('🐶')
  })
})

// D-03 bis D-05: Abschnitt „Bild“ im Dialog „Vokabel bearbeiten“; Aenderungen gelten sofort.
// Hausregel: je Fall genau eine Abweichung, exakte Texte, Tastatur eigener Pfad, Happy Path zuletzt.
describe('Vokabelbild', () => {
  const hund = { ...vocab('e-1', 'Hund', 'dog'), pictureVersion: null as string | null }
  const small = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' })
  const photo = () => new File([new Uint8Array([0xff, 0xd8, 0xff])], 'hund.jpg', { type: 'image/jpeg' })
  const pictureUrl = '/api/v1/sets/set-1/entries/e-1/picture'

  /**
   * fetch-Stub fuer den Abschnitt: PUT und DELETE auf …/picture antworten per
   * `respond`, Bildabrufe mit einem PNG, die Vokabelliste beim ersten Mal mit
   * `list`, danach mit `later`.
   */
  function stubPicture(
    respond: () => Promise<Response>,
    list: unknown[] = [hund],
    later: unknown[] = list,
  ) {
    const calls = { puts: [] as { url: string; body: unknown }[], deletes: [] as string[], entryGets: 0 }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          calls.puts.push({ url, body: init.body })
          return respond()
        }
        if (init?.method === 'DELETE') {
          calls.deletes.push(url)
          return respond()
        }
        // Je Version andere Bytes (die URL selbst): so ist erkennbar, welche Version ein img zeigt.
        if (url.includes('/pictures/')) {
          return new Response(new TextEncoder().encode(url), { headers: { 'Content-Type': 'image/png' } })
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

  async function openPicture() {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Hund bearbeiten' }))
    const dialog = screen.getByRole('dialog', { name: 'Vokabel bearbeiten' })
    const choose = within(dialog).getByRole('button', { name: 'Bild wählen' })
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement
    return { dialog, choose, input }
  }

  // Wie der Browser nach der Dateiauswahl: files gesetzt, dann change. Ohne Datei = abgebrochen.
  function pick(input: HTMLInputElement, ...files: File[]) {
    Object.defineProperty(input, 'files', { configurable: true, value: files })
    fireEvent.change(input)
  }

  beforeEach(() => {
    vi.mocked(shrinkPicture).mockReset()
    vi.mocked(shrinkPicture).mockResolvedValue(small)
  })

  it('Tastatur: Enter und Leertaste auf „Bild wählen“ öffnen die Dateiauswahl; Datei-Feld nur für Bilder, nicht im Tab-Fluss', async () => {
    stubPicture(async () => Response.json({ pictureVersion: 'pv-1' }))
    const { choose, input } = await openPicture()
    const click = vi.spyOn(input, 'click')
    choose.focus()
    await userEvent.keyboard('{Enter}')
    expect(click).toHaveBeenCalledTimes(1)
    await userEvent.keyboard(' ')
    expect(click).toHaveBeenCalledTimes(2)
    expect(input.accept).toBe('image/*')
    expect(input.hidden).toBe(true)
    expect(input.hasAttribute('capture')).toBe(false)
  })

  // Review L-2: Wer per Tab auf die Buttons springt, hoert, dass Bildaenderungen sofort gelten.
  it('„Bild wählen“ und „Bild entfernen“ nennen den Hinweis als Beschreibung', async () => {
    stubPicture(async () => Response.json({ pictureVersion: 'pv-1' }), [{ ...hund, pictureVersion: 'pv-alt' }])
    const { dialog, choose } = await openPicture()
    const remove = within(dialog).getByRole('button', { name: 'Bild entfernen' })
    for (const button of [choose, remove]) {
      const describedBy = button.getAttribute('aria-describedby')
      expect(describedBy && document.getElementById(describedBy)?.textContent).toBe(
        'Ein Bild hilft beim Merken. Änderungen am Bild gelten sofort.',
      )
    }
  })

  const unreadable = 'Diese Datei lässt sich nicht als Bild öffnen. Wähle ein Foto oder ein anderes Bild aus.'
  const notAPicture = 'Das Bild muss eine vollständige WebP-, JPEG- oder PNG-Datei sein.'
  const tooBig = 'Das Bild ist zu groß. Erlaubt sind höchstens 300 KB.'
  const conflict = 'Das Bild wurde gerade gleichzeitig geändert. Versuche es noch einmal.'
  const problem = (status: number, detail: string) => async () => Response.json({ title: 'x', detail }, { status })

  // Fehler: Text im Dialog, kein Bild, Fokus bleibt auf „Bild wählen“.
  async function expectPictureError(message: string, choose: HTMLElement) {
    const dialog = screen.getByRole('dialog', { name: 'Vokabel bearbeiten' })
    expect((await within(dialog).findByRole('alert')).textContent).toBe(message)
    expect(within(dialog).queryByRole('img')).toBeNull()
    expect(document.activeElement).toBe(choose)
  }

  it('1: Auswahl abgebrochen → kein PUT, keine Meldung', async () => {
    const calls = stubPicture(async () => Response.json({ pictureVersion: 'pv-1' }))
    const { dialog, input } = await openPicture()
    pick(input)
    await settle()
    expect(vi.mocked(shrinkPicture)).not.toHaveBeenCalled()
    expect(calls.puts).toHaveLength(0)
    expect(within(dialog).queryByRole('alert')).toBeNull()
    expect(within(dialog).queryByRole('status')).toBeNull()
  })

  it.each([
    ['2: PDF', new File(['%PDF-1.7'], 'liste.pdf', { type: 'application/pdf' })],
    ['3: kaputtes Bild', new File([new Uint8Array([0xff, 0xd8, 0x00])], 'kaputt.jpg', { type: 'image/jpeg' })],
  ])('%s (nicht dekodierbar) → „nicht als Bild öffnen“, kein PUT', async (_name, file) => {
    vi.mocked(shrinkPicture).mockRejectedValue(new DOMException('The source image could not be decoded.'))
    const calls = stubPicture(async () => Response.json({ pictureVersion: 'pv-1' }))
    const { choose, input } = await openPicture()
    choose.focus()
    pick(input, file)
    await expectPictureError(unreadable, choose)
    expect(calls.puts).toHaveLength(0)
  })

  it.each([
    ['4: Server 400', async () => Response.json({ title: 'x', errors: { picture: [notAPicture] } }, { status: 400 }), notAPicture],
    ['5: Server 413 vom Endpoint (Problem-JSON)', problem(413, tooBig), tooBig],
    // nginx antwortet ueber 1 MB selbst, mit einer HTML-Seite statt Problem-JSON.
    [
      '6: Server 413 von nginx (HTML)',
      async () =>
        new Response('<html><head><title>413 Request Entity Too Large</title></head></html>', {
          status: 413,
          headers: { 'Content-Type': 'text/html' },
        }),
      tooBig,
    ],
    ['8: Server 409', problem(409, conflict), conflict],
    ['9: Server nicht erreichbar', offline, unreachable],
  ])('%s → exakter Text, ein PUT', async (_name, respond, message) => {
    const calls = stubPicture(respond)
    const { choose, input } = await openPicture()
    choose.focus()
    pick(input, photo())
    await expectPictureError(message, choose)
    expect(calls.puts).toHaveLength(1)
  })

  it('7: Server 404 → Text im Dialog; Esc → Zeile weg, Fokus auf der Set-Überschrift', async () => {
    const calls = stubPicture(entryNotFound, [hund, katze], [katze])
    const { choose, input } = await openPicture()
    choose.focus()
    pick(input, photo())
    await expectPictureError(entryGone, choose)
    await settle()
    expect(calls.entryGets).toBe(1)

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByText('Hund → dog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(heading()))
  })

  it('10: zwei Auswahlen im selben Takt → genau ein PUT; Esc schließt während der Anfrage nicht', async () => {
    let release: () => void = () => {}
    const calls = stubPicture(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(Response.json({ pictureVersion: 'pv-1' }))
        }),
    )
    const { dialog, input } = await openPicture()
    pick(input, photo())
    pick(input, photo())
    await waitFor(() => expect(within(dialog).getByRole('status').textContent).toBe('Einen Moment …'))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Vokabel bearbeiten' })).toBeTruthy()
    release()
    expect(await within(dialog).findByText('Das Bild ist gespeichert.')).toBeTruthy()
    expect(calls.puts).toHaveLength(1)
  })

  it('11: Ersetzen bei vorhandenem Bild → zweites Bild, Vorschau mit der neuen Version', async () => {
    const withPicture = { ...hund, pictureVersion: 'pv-alt' }
    const calls = stubPicture(async () => Response.json({ pictureVersion: 'pv-neu' }), [withPicture])
    const pictureGets = () =>
      vi.mocked(fetch).mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/pictures/'))
    const { dialog, input } = await openPicture()
    expect(await within(dialog).findByRole('img', { name: 'Bild zu „Hund“' })).toBeTruthy()
    pick(input, photo())
    expect(await within(dialog).findByText('Das Bild ist gespeichert.')).toBeTruthy()
    await waitFor(() => expect(pictureGets()).toContain('/api/v1/pictures/pv-neu'))
    expect(await within(dialog).findByRole('img', { name: 'Bild zu „Hund“' })).toBeTruthy()
    expect(calls.puts).toEqual([{ url: pictureUrl, body: small }])
  })

  // Review L-1 / Hinweis LOW-2 aus 03.1.1-01: gleichzeitige Ersetzungen bekommen beide 200,
  // der letzte Upload gewinnt. Die Vorschau zeigt nach dem Neuladen den gespeicherten Stand.
  it('Gleichzeitig ersetzt: Liste nennt danach eine andere Version → Vorschau zeigt die gespeicherte', async () => {
    stubPicture(async () => Response.json({ pictureVersion: 'pv-meins' }), [hund], [{ ...hund, pictureVersion: 'pv-anderer' }])
    const { dialog, input } = await openPicture()
    pick(input, photo())
    expect(await within(dialog).findByText('Das Bild ist gespeichert.')).toBeTruthy()
    const stored = `data:image/png;base64,${btoa('/api/v1/pictures/pv-anderer')}`
    await waitFor(() =>
      expect(within(dialog).getByRole('img', { name: 'Bild zu „Hund“' }).getAttribute('src')).toBe(stored),
    )
  })

  it('Neue Auswahl nimmt die alte Meldung weg', async () => {
    vi.mocked(shrinkPicture).mockRejectedValueOnce(new Error('kaputt'))
    stubPicture(() => new Promise<Response>(() => {}))
    const { dialog, input } = await openPicture()
    pick(input, photo())
    expect((await within(dialog).findByRole('alert')).textContent).toBe(unreadable)
    pick(input, photo())
    await waitFor(() => expect(within(dialog).queryByRole('alert')).toBeNull())
  })

  describe('Bild entfernen', () => {
    const withPicture = { ...hund, pictureVersion: 'pv-alt' }

    async function openRemove(respond: () => Promise<Response>, later: unknown[] = [withPicture]) {
      const calls = stubPicture(respond, [withPicture], later)
      const opened = await openPicture()
      const remove = within(opened.dialog).getByRole('button', { name: 'Bild entfernen' })
      return { ...opened, remove, calls }
    }

    it('nur mit Bild sichtbar', async () => {
      stubPicture(async () => new Response(null, { status: 204 }))
      const { dialog } = await openPicture()
      expect(within(dialog).queryByRole('button', { name: 'Bild entfernen' })).toBeNull()
    })

    it('Server 404 → „Diese Vokabel gibt es nicht (mehr).“, Bild bleibt', async () => {
      const { dialog, remove, calls } = await openRemove(entryNotFound)
      await userEvent.click(remove)
      expect((await within(dialog).findByRole('alert')).textContent).toBe(entryGone)
      expect(calls.deletes).toEqual([pictureUrl])
      expect(within(dialog).getByRole('button', { name: 'Bild entfernen' })).toBe(remove)
    })

    it('Server nicht erreichbar → Verbindungstext, Bild bleibt', async () => {
      const { dialog, remove } = await openRemove(offline)
      await userEvent.click(remove)
      expect((await within(dialog).findByRole('alert')).textContent).toBe(unreachable)
      expect(within(dialog).getByRole('img', { name: 'Bild zu „Hund“' })).toBeTruthy()
    })

    it('Doppelklick → genau ein DELETE; Esc schließt während der Anfrage nicht', async () => {
      let release: () => void = () => {}
      const { dialog, remove, calls } = await openRemove(
        () =>
          new Promise<Response>((resolve) => {
            release = () => resolve(new Response(null, { status: 204 }))
          }),
      )
      fireEvent.click(remove)
      fireEvent.click(remove)
      await userEvent.keyboard('{Escape}')
      expect(screen.getByRole('dialog', { name: 'Vokabel bearbeiten' })).toBeTruthy()
      release()
      expect(await within(dialog).findByText('Das Bild ist entfernt.')).toBeTruthy()
      expect(calls.deletes).toHaveLength(1)
    })

    it('Klick → ein DELETE, „Das Bild ist entfernt.“, keine Vorschau, Fokus auf „Bild wählen“, Liste neu', async () => {
      const { dialog, choose, remove, calls } = await openRemove(
        async () => new Response(null, { status: 204 }),
        [hund],
      )
      expect(await within(dialog).findByRole('img', { name: 'Bild zu „Hund“' })).toBeTruthy()
      await userEvent.click(remove)
      const removed = await within(dialog).findByText('Das Bild ist entfernt.')
      expect(removed.getAttribute('role')).toBe('status')
      expect(within(dialog).queryByRole('img')).toBeNull()
      expect(within(dialog).queryByRole('button', { name: 'Bild entfernen' })).toBeNull()
      expect(document.activeElement).toBe(choose)
      expect(calls.deletes).toEqual([pictureUrl])
      await waitFor(() => expect(calls.entryGets).toBe(2))
    })
  })

  it('Happy Path: Bild hinzufügen → PUT mit dem verkleinerten Blob, Vorschau, Meldung, Fokus, Liste neu', async () => {
    const calls = stubPicture(async () => Response.json({ pictureVersion: 'pv-neu' }))
    const { dialog, choose, input } = await openPicture()
    expect(within(dialog).queryByRole('img')).toBeNull()
    const file = photo()
    choose.focus()
    pick(input, file)

    const saved = await within(dialog).findByText('Das Bild ist gespeichert.')
    expect(saved.getAttribute('role')).toBe('status')
    expect(await within(dialog).findByRole('img', { name: 'Bild zu „Hund“' })).toBeTruthy()
    expect(vi.mocked(shrinkPicture)).toHaveBeenCalledWith(file)
    expect(calls.puts).toEqual([{ url: pictureUrl, body: small }])
    expect(calls.puts[0]?.body).toBe(small)
    expect(document.activeElement).toBe(choose)
    await waitFor(() => expect(calls.entryGets).toBe(2))
  })
})
