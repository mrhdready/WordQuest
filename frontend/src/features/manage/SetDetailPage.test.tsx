import { screen, waitFor } from '@testing-library/react'
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
