import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChildFormPage } from '@/features/manage/ChildFormPage'
import { renderWithProviders } from '@/test/render'

const valid = { name: 'Mia', limit: '5', pin: '1234' }
const nameMissing = 'Wie soll das Kind heißen? Ein Spitzname genügt.'
const limitInvalid = 'Bitte gib eine Zahl von 3 bis 15 ein.'
const pinMissing = 'Bitte gib eine PIN mit 4 Ziffern ein.'
const pinInvalid = 'Die PIN muss aus genau 4 Ziffern bestehen.'
const nameTooLong = 'Der Name darf höchstens 100 Zeichen lang sein.'
const unreachable = 'Der Server ist gerade nicht erreichbar. Prüfe die Verbindung und versuche es noch einmal.'
const success = 'Das Kind ist angelegt. Es kann sich jetzt mit seiner PIN anmelden.'

// Je Test eigenes fetch-Stub; liefert die Koerper aller Aufrufe.
function stubFetch(respond: () => Promise<Response>) {
  const bodies: unknown[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)))
      return respond()
    }),
  )
  return bodies
}

const created = async () =>
  Response.json(
    {
      id: 'kind-1',
      displayName: 'Mia',
      avatarKey: 'fox',
      dailyNewLimit: 5,
      speed: 'Relaxed',
      soundEnabled: true,
      hasPin: true,
    },
    { status: 201 },
  )

function fields() {
  return {
    name: screen.getByLabelText('Name') as HTMLInputElement,
    limit: screen.getByLabelText('Neue Karten pro Tag') as HTMLInputElement,
    pin: screen.getByLabelText('PIN') as HTMLInputElement,
    button: screen.getByRole('button', { name: 'Kind anlegen' }) as HTMLButtonElement,
  }
}

// Leere Werte werden nicht getippt; userEvent.type mit '' ist nicht erlaubt.
async function fill(values: { name?: string; limit?: string; pin?: string }) {
  renderWithProviders(<ChildFormPage mode="create" />, {
    route: '/verwalten/kinder/neu',
    path: '/verwalten/kinder/neu',
  })
  const f = fields()
  const { name = valid.name, limit = valid.limit, pin = valid.pin } = values
  if (name) await userEvent.type(f.name, name)
  await userEvent.clear(f.limit)
  if (limit) await userEvent.type(f.limit, limit)
  if (pin) await userEvent.type(f.pin, pin)
  return f
}

// Ein Tick fuer ausstehende Anfragen: ohne ihn waere "kein fetch" schon vor dem Senden wahr.
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 20))
}

// Genau ein Feldfehler, am erwarteten Feld verdrahtet, Fokus dort, keine Anfrage.
async function expectClientError(input: HTMLInputElement, message: string, bodies: unknown[]) {
  const error = await screen.findByText(message)
  expect(error.id).toBe(`${input.id}-fehler`)
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(input.getAttribute('aria-describedby')).toContain(`${input.id}-fehler`)
  expect(document.activeElement).toBe(input)
  expect(document.querySelectorAll('[id$="-fehler"]')).toHaveLength(1)
  await settle()
  expect(bodies).toHaveLength(0)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// Hausregel: je Fall genau ein Feld falsch, exakte Texte, Enter eigener Pfad, Happy Path zuletzt.
describe('Kind anlegen', () => {
  const clientCases: { title: string; values: Parameters<typeof fill>[0]; field: 'name' | 'limit' | 'pin'; message: string }[] = [
    { title: 'Name leer', values: { name: '' }, field: 'name', message: nameMissing },
    { title: 'Name nur Leerzeichen', values: { name: '   ' }, field: 'name', message: nameMissing },
    { title: 'Name 101 Zeichen', values: { name: 'a'.repeat(101) }, field: 'name', message: nameTooLong },
    { title: 'Limit leer', values: { limit: '' }, field: 'limit', message: limitInvalid },
    { title: 'Limit 2', values: { limit: '2' }, field: 'limit', message: limitInvalid },
    { title: 'Limit 16', values: { limit: '16' }, field: 'limit', message: limitInvalid },
    { title: 'Limit 5.5', values: { limit: '5.5' }, field: 'limit', message: limitInvalid },
    { title: 'Limit keine Zahl', values: { limit: 'abc' }, field: 'limit', message: limitInvalid },
    { title: 'PIN leer', values: { pin: '' }, field: 'pin', message: pinMissing },
    { title: 'PIN 3 Ziffern', values: { pin: '123' }, field: 'pin', message: pinInvalid },
    { title: 'PIN 5 Ziffern', values: { pin: '12345' }, field: 'pin', message: pinInvalid },
    { title: 'PIN 6 Ziffern', values: { pin: '123456' }, field: 'pin', message: pinInvalid },
    { title: 'PIN mit Buchstaben', values: { pin: '12a4' }, field: 'pin', message: pinInvalid },
    { title: 'PIN ١٢٣٤ (arabisch-indische Ziffern)', values: { pin: '١٢٣٤' }, field: 'pin', message: pinInvalid },
  ]

  for (const { title, values, field, message } of clientCases) {
    it(title, async () => {
      const bodies = stubFetch(created)
      const f = await fill(values)
      await userEvent.click(f.button)
      await expectClientError(f[field], message, bodies)
    })
  }

  const boundaries: { title: string; values: Parameters<typeof fill>[0]; body: object }[] = [
    { title: 'Grenze Limit 3 angenommen', values: { limit: '3' }, body: { dailyNewLimit: 3 } },
    { title: 'Grenze Limit 15 angenommen', values: { limit: '15' }, body: { dailyNewLimit: 15 } },
    { title: 'Grenze PIN 4 Ziffern angenommen', values: { pin: '0000' }, body: { pin: '0000' } },
    {
      title: 'Grenze Name 100 Zeichen angenommen',
      values: { name: 'n'.repeat(100) },
      body: { displayName: 'n'.repeat(100) },
    },
  ]

  for (const { title, values, body } of boundaries) {
    it(title, async () => {
      const bodies = stubFetch(created)
      const f = await fill(values)
      await userEvent.click(f.button)
      await screen.findByText('/verwalten/kinder')
      expect(bodies).toHaveLength(1)
      expect(bodies[0]).toMatchObject(body)
    })
  }

  it('Leeres Absenden zeigt alle Fehler, Fokus auf dem Namen', async () => {
    const bodies = stubFetch(created)
    const f = await fill({ name: '', limit: '', pin: '' })
    await userEvent.click(f.button)
    await screen.findByText(nameMissing)
    expect(screen.getByText(limitInvalid).id).toBe(`${f.limit.id}-fehler`)
    expect(screen.getByText(pinMissing).id).toBe(`${f.pin.id}-fehler`)
    expect(document.activeElement).toBe(f.name)
    await settle()
    expect(bodies).toHaveLength(0)
  })

  it('PIN vom Server abgelehnt steht am Feld', async () => {
    stubFetch(async () =>
      Response.json(
        { title: 'One or more validation errors occurred.', errors: { pin: [pinInvalid] } },
        { status: 400 },
      ),
    )
    const f = await fill({})
    await userEvent.click(f.button)
    const error = await screen.findByText(pinInvalid)
    expect(error.id).toBe(`${f.pin.id}-fehler`)
    expect(f.pin.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(f.pin)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('Name vom Server abgelehnt steht am Feld', async () => {
    stubFetch(async () =>
      Response.json(
        { title: 'One or more validation errors occurred.', errors: { displayName: [nameTooLong] } },
        { status: 400 },
      ),
    )
    const f = await fill({})
    await userEvent.click(f.button)
    const error = await screen.findByText(nameTooLong)
    expect(error.id).toBe(`${f.name.id}-fehler`)
    expect(f.name.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(f.name)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('Server nicht erreichbar zeigt den Hinweis, Eingaben bleiben', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    const f = await fill({})
    await userEvent.click(f.button)
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Der Server ist gerade nicht erreichbar. Prüfe die Verbindung und versuche es noch einmal.',
    )
    expect(f.name.value).toBe(valid.name)
    expect(f.limit.value).toBe(valid.limit)
    expect(f.pin.value).toBe(valid.pin)
    expect(f.button.disabled).toBe(false)
  })

  it('Enter im PIN-Feld sendet genau einmal ab, Limit als Zahl', async () => {
    const bodies = stubFetch(created)
    const f = await fill({ limit: '7' })
    await userEvent.type(f.pin, '{Enter}')
    await screen.findByText('/verwalten/kinder')
    expect(bodies).toEqual([{ displayName: valid.name, pin: valid.pin, dailyNewLimit: 7 }])
  })

  it('Doppelklick sendet genau eine Anfrage', async () => {
    let release: () => void = () => {}
    const bodies = stubFetch(
      () =>
        new Promise<Response>((resolve) => {
          release = () => void created().then(resolve)
        }),
    )
    const f = await fill({})
    await userEvent.dblClick(f.button)
    expect(f.button.textContent).toBe('Einen Moment …')
    expect(f.button.disabled).toBe(true)
    release()
    await screen.findByText('/verwalten/kinder')
    expect(bodies).toHaveLength(1)
  })

  it('Hinweis nennt genau 4 Ziffern', async () => {
    await fill({})
    expect(screen.getByText('Genau 4 Ziffern. Sag sie deinem Kind.')).toBeTruthy()
  })

  it('Happy Path: Umlaut und Emoji, Weiterleitung mit Erfolgsmeldung', async () => {
    const bodies = stubFetch(created)
    const f = await fill({ name: 'Jürgen 🦊', limit: '7', pin: '2580' })
    await userEvent.click(f.button)
    await screen.findByText('/verwalten/kinder')
    expect(screen.getByText(success)).toBeTruthy()
    expect(bodies).toEqual([{ displayName: 'Jürgen 🦊', pin: '2580', dailyNewLimit: 7 }])
  })
})

// --- Kind bearbeiten (PAR-01) ----------------------------------------------

const saved = 'Die Änderungen sind gespeichert.'
const savedWithPin = 'Die Änderungen sind gespeichert. Die neue PIN gilt ab sofort.'
const unknownChild = 'Dieses Kind gibt es nicht (mehr). Gehe zurück zur Liste.'
const editValid = { name: 'Mia', limit: '7' }

const children = [
  { id: 'kind-1', displayName: 'Mia', avatarKey: 'fox', dailyNewLimit: 7, speed: 'Relaxed', soundEnabled: true, hasPin: true },
  { id: 'kind-2', displayName: 'Ole', avatarKey: 'owl', dailyNewLimit: 5, speed: 'Relaxed', soundEnabled: true, hasPin: false },
]

const patched = async () => Response.json(children[0])

// GET liefert die Liste (oder list()), PATCH antwortet mit patch(); gesammelt werden die PATCH-Koerper.
function stubEdit(patch: () => Promise<Response> = patched, list: () => Promise<Response> = async () => Response.json(children)) {
  const bodies: unknown[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'GET') return list()
      bodies.push(JSON.parse(String(init?.body)))
      return patch()
    }),
  )
  return bodies
}

function renderEdit(id = 'kind-1') {
  renderWithProviders(<ChildFormPage mode="edit" />, {
    route: `/verwalten/kinder/${id}`,
    path: '/verwalten/kinder/:learnerId',
  })
}

async function editFields() {
  return {
    name: (await screen.findByLabelText('Name')) as HTMLInputElement,
    limit: screen.getByLabelText('Neue Karten pro Tag') as HTMLInputElement,
    pin: screen.getByLabelText('Neue PIN') as HTMLInputElement,
    button: screen.getByRole('button', { name: 'Änderungen speichern' }) as HTMLButtonElement,
  }
}

// Ersetzt nur die genannten Felder; ohne Angabe bleiben die vorbefuellten Werte.
async function fillEdit(values: { name?: string; limit?: string; pin?: string }) {
  renderEdit()
  const f = await editFields()
  if (values.name !== undefined) {
    await userEvent.clear(f.name)
    if (values.name) await userEvent.type(f.name, values.name)
  }
  if (values.limit !== undefined) {
    await userEvent.clear(f.limit)
    if (values.limit) await userEvent.type(f.limit, values.limit)
  }
  if (values.pin) await userEvent.type(f.pin, values.pin)
  return f
}

describe('Kind bearbeiten', () => {
  const clientCases: { title: string; values: Parameters<typeof fillEdit>[0]; field: 'name' | 'limit' | 'pin'; message: string }[] = [
    { title: 'Name leer', values: { name: '' }, field: 'name', message: nameMissing },
    { title: 'Name nur Leerzeichen', values: { name: '   ' }, field: 'name', message: nameMissing },
    { title: 'Name 101 Zeichen', values: { name: 'a'.repeat(101) }, field: 'name', message: nameTooLong },
    { title: 'Limit leer', values: { limit: '' }, field: 'limit', message: limitInvalid },
    { title: 'Limit 2', values: { limit: '2' }, field: 'limit', message: limitInvalid },
    { title: 'Limit 16', values: { limit: '16' }, field: 'limit', message: limitInvalid },
    { title: 'Limit 5.5', values: { limit: '5.5' }, field: 'limit', message: limitInvalid },
    { title: 'Limit keine Zahl', values: { limit: 'abc' }, field: 'limit', message: limitInvalid },
    { title: 'PIN 3 Ziffern', values: { pin: '123' }, field: 'pin', message: pinInvalid },
    { title: 'PIN 5 Ziffern', values: { pin: '12345' }, field: 'pin', message: pinInvalid },
    { title: 'PIN 6 Ziffern', values: { pin: '123456' }, field: 'pin', message: pinInvalid },
    { title: 'PIN mit Buchstaben', values: { pin: '12a4' }, field: 'pin', message: pinInvalid },
    { title: 'PIN mit Leerzeichen', values: { pin: '12 34' }, field: 'pin', message: pinInvalid },
    { title: 'PIN nur Leerzeichen', values: { pin: '    ' }, field: 'pin', message: pinInvalid },
    { title: 'PIN ١٢٣٤ (arabisch-indische Ziffern)', values: { pin: '١٢٣٤' }, field: 'pin', message: pinInvalid },
  ]

  for (const { title, values, field, message } of clientCases) {
    it(title, async () => {
      const bodies = stubEdit()
      const f = await fillEdit(values)
      await userEvent.click(f.button)
      await expectClientError(f[field], message, bodies)
    })
  }

  const boundaries: { title: string; values: Parameters<typeof fillEdit>[0]; body: object }[] = [
    { title: 'Grenze Limit 3 angenommen', values: { limit: '3' }, body: { dailyNewLimit: 3 } },
    { title: 'Grenze Limit 15 angenommen', values: { limit: '15' }, body: { dailyNewLimit: 15 } },
    { title: 'Grenze PIN 4 Ziffern angenommen', values: { pin: '0000' }, body: { pin: '0000' } },
    {
      title: 'Grenze Name 100 Zeichen angenommen',
      values: { name: 'n'.repeat(100) },
      body: { displayName: 'n'.repeat(100) },
    },
  ]

  for (const { title, values, body } of boundaries) {
    it(title, async () => {
      const bodies = stubEdit()
      const f = await fillEdit(values)
      await userEvent.click(f.button)
      await screen.findByText(values.pin ? savedWithPin : saved)
      expect(bodies).toHaveLength(1)
      expect(bodies[0]).toMatchObject(body)
    })
  }

  it('Laden zeigt den Spinner, danach vorbefuellte Felder und leere PIN', async () => {
    let release: () => void = () => {}
    stubEdit(patched, () => new Promise<Response>((resolve) => (release = () => resolve(Response.json(children)))))
    renderEdit()
    expect(screen.getByRole('status').textContent).toBe('Lädt …')
    expect(screen.queryByLabelText('Name')).toBeNull()
    release()
    const f = await editFields()
    expect(f.name.value).toBe('Mia')
    expect(f.limit.value).toBe('7')
    expect(f.pin.value).toBe('')
    expect(screen.getByText('Genau 4 Ziffern. Leer lassen, wenn die PIN gleich bleiben soll.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Kind bearbeiten' })).toBeTruthy()
  })

  it('Kind ohne PIN: Hilfetext nennt das', async () => {
    stubEdit()
    renderEdit('kind-2')
    const f = await editFields()
    expect(f.name.value).toBe('Ole')
    expect(screen.getByText('Für dieses Kind ist noch keine PIN gesetzt.')).toBeTruthy()
  })

  // Ohne PIN kann sich das Kind nie anmelden: Speichern verlangt dann eine (WR-02).
  it('Kind ohne PIN: Speichern ohne PIN verlangt die PIN', async () => {
    const bodies = stubEdit()
    renderEdit('kind-2')
    const f = await editFields()
    await userEvent.click(f.button)
    await expectClientError(f.pin, pinMissing, bodies)
  })

  it('Unbekannte ID: Hinweis und Link zur Liste, kein Formular', async () => {
    stubEdit()
    renderEdit('gibt-es-nicht')
    expect(await screen.findByText(unknownChild)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Alle Kinder' }).getAttribute('href')).toBe('/verwalten/kinder')
    expect(screen.queryByRole('button', { name: 'Änderungen speichern' })).toBeNull()
  })

  const loadFailures: { title: string; list: () => Promise<Response>; message: string }[] = [
    {
      title: 'Ladefehler 500: Meldung statt "gibt es nicht"',
      list: async () => new Response('', { status: 500 }),
      message: 'Das hat nicht geklappt. Versuche es noch einmal.',
    },
    {
      title: 'Ladefehler Netz: Meldung statt "gibt es nicht"',
      list: async () => {
        throw new TypeError('Failed to fetch')
      },
      message: unreachable,
    },
  ]

  for (const { title, list, message } of loadFailures) {
    it(title, async () => {
      stubEdit(patched, list)
      renderEdit()
      expect((await screen.findByRole('alert')).textContent).toBe(message)
      expect(screen.queryByText(unknownChild)).toBeNull()
      expect(screen.queryByLabelText('Name')).toBeNull()
    })
  }

  it('Scheitert das Neuladen nach dem Speichern, bleiben Formular und Erfolgsmeldung', async () => {
    let loads = 0
    stubEdit(patched, async () => (++loads === 1 ? Response.json(children) : new Response('', { status: 500 })))
    const f = await fillEdit({ limit: '9' })
    await userEvent.click(f.button)
    await screen.findByText(saved)
    await waitFor(() => expect(loads).toBe(2))
    expect(screen.getByText(saved)).toBeTruthy()
    expect((screen.getByLabelText('Neue Karten pro Tag') as HTMLInputElement).value).toBe('9')
  })

  it('PIN leer: Anfrage ohne pin, Erfolg ohne PIN-Hinweis', async () => {
    const bodies = stubEdit()
    const f = await fillEdit({})
    await userEvent.click(f.button)
    expect((await screen.findByText(saved)).getAttribute('role')).toBe('status')
    expect(bodies).toEqual([{ displayName: 'Mia', dailyNewLimit: 7 }])
  })

  it('PIN vom Server abgelehnt steht am Feld', async () => {
    stubEdit(async () =>
      Response.json(
        { title: 'One or more validation errors occurred.', errors: { pin: [pinInvalid] } },
        { status: 400 },
      ),
    )
    const f = await fillEdit({ pin: '1234' })
    await userEvent.click(f.button)
    const error = await screen.findByText(pinInvalid)
    expect(error.id).toBe(`${f.pin.id}-fehler`)
    expect(f.pin.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(f.pin)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('Server nicht erreichbar zeigt den Hinweis, Eingaben bleiben', async () => {
    stubEdit(async () => {
      throw new TypeError('Failed to fetch')
    })
    const f = await fillEdit({ limit: '9', pin: '2580' })
    await userEvent.click(f.button)
    expect((await screen.findByRole('alert')).textContent).toBe(unreachable)
    expect(f.name.value).toBe(editValid.name)
    expect(f.limit.value).toBe('9')
    expect(f.pin.value).toBe('2580')
    expect(f.button.disabled).toBe(false)
  })

  it('Enter in "Neue PIN" sendet genau einmal ab', async () => {
    const bodies = stubEdit()
    const f = await fillEdit({ pin: '4711' })
    await userEvent.type(f.pin, '{Enter}')
    await screen.findByText(savedWithPin)
    expect(bodies).toEqual([{ displayName: 'Mia', dailyNewLimit: 7, pin: '4711' }])
  })

  it('Doppelklick sendet genau eine Anfrage', async () => {
    let release: () => void = () => {}
    const bodies = stubEdit(
      () =>
        new Promise<Response>((resolve) => {
          release = () => void patched().then(resolve)
        }),
    )
    const f = await fillEdit({})
    await userEvent.dblClick(f.button)
    expect(f.button.textContent).toBe('Einen Moment …')
    expect(f.button.disabled).toBe(true)
    release()
    await screen.findByText(saved)
    expect(bodies).toHaveLength(1)
  })

  it('Happy Path: Umlaut und Emoji, neue PIN, PIN-Feld danach leer', async () => {
    const bodies = stubEdit()
    const f = await fillEdit({ name: 'Jürgen 🦊', limit: '9', pin: '2580' })
    await userEvent.click(f.button)
    expect((await screen.findByText(savedWithPin)).getAttribute('role')).toBe('status')
    expect(bodies).toEqual([{ displayName: 'Jürgen 🦊', dailyNewLimit: 9, pin: '2580' }])
    expect(f.pin.value).toBe('')
    expect(f.name.value).toBe('Jürgen 🦊')
  })
})

// --- Kind loeschen (PAR-03) ------------------------------------------------

const deleteTitle = 'Mia löschen?'
const deleteDescription =
  'Alle Lernfortschritte, XP und die Serie von Mia werden gelöscht. Das lässt sich nicht rückgängig machen.'
const childGone = 'Dieses Kind gibt es nicht (mehr).'
const noContent = async () => new Response(null, { status: 204 })

// Zaehlt GET /learners und DELETE; ab dem zweiten GET liefert die Liste later (Kind in anderem Tab geloescht).
function stubDelete(remove: () => Promise<Response> = noContent, later = children) {
  const calls = { gets: 0, deletes: 0 }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        calls.deletes += 1
        return remove()
      }
      calls.gets += 1
      return Response.json(calls.gets === 1 ? children : later)
    }),
  )
  return calls
}

async function openDelete() {
  renderEdit()
  const trigger = await screen.findByRole('button', { name: 'Kind löschen' })
  await userEvent.click(trigger)
  return { trigger, dialog: screen.getByRole('alertdialog', { name: deleteTitle }) }
}

describe('Kind löschen', () => {
  it('Anlegen zeigt kein "Kind löschen"', () => {
    renderWithProviders(<ChildFormPage mode="create" />, {
      route: '/verwalten/kinder/neu',
      path: '/verwalten/kinder/neu',
    })
    expect(screen.getByRole('button', { name: 'Kind anlegen' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Kind löschen' })).toBeNull()
  })

  it('Unbekannte ID zeigt kein "Kind löschen"', async () => {
    stubDelete()
    renderEdit('gibt-es-nicht')
    expect(await screen.findByText(unknownChild)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Kind löschen' })).toBeNull()
  })

  it('Ladefehler zeigt kein "Kind löschen"', async () => {
    stubEdit(patched, async () => new Response('', { status: 500 }))
    renderEdit()
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Kind löschen' })).toBeNull()
  })

  it('"Kind löschen" liegt außerhalb des Formulars', async () => {
    stubDelete()
    renderEdit()
    const trigger = await screen.findByRole('button', { name: 'Kind löschen' })
    expect(trigger.closest('form')).toBeNull()
    expect(trigger.getAttribute('type')).toBe('button')
  })

  it('Dialog: Titel und Beschreibung exakt, Fokus auf "Abbrechen"', async () => {
    stubDelete()
    const { dialog } = await openDelete()
    expect(screen.getByRole('heading', { name: deleteTitle })).toBeTruthy()
    const describedBy = dialog.getAttribute('aria-describedby')
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBe(deleteDescription)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abbrechen' }))
  })

  it('"Abbrechen": keine DELETE-Anfrage, Fokus zurück auf "Kind löschen"', async () => {
    const calls = stubDelete()
    const { trigger } = await openDelete()
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    await settle()
    expect(calls.deletes).toBe(0)
  })

  it('Server 404: Fehler im Dialog bis zum Schließen, danach Leerzustand und Fokus auf "Alle Kinder"', async () => {
    const calls = stubDelete(
      async () => Response.json({ title: 'Nicht gefunden', detail: childGone }, { status: 404 }),
      children.slice(1),
    )
    await openDelete()
    await userEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    expect((await screen.findByRole('alert')).textContent).toBe(childGone)
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    await settle()
    expect(calls.gets).toBe(1)
    expect(screen.getByRole('alert').textContent).toBe(childGone)

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(await screen.findByText(unknownChild)).toBeTruthy()
    expect(calls.gets).toBe(2)
    expect(calls.deletes).toBe(1)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Alle Kinder' })))
  })

  it('Server 500: Fehler im Dialog, "Abbrechen" gibt den Fokus an "Kind löschen"', async () => {
    stubDelete(async () => new Response('', { status: 500 }))
    const { trigger } = await openDelete()
    await userEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Das hat nicht geklappt. Versuche es noch einmal.')
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Endgültig löschen' }) as HTMLButtonElement).disabled).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    expect(screen.getByLabelText('Name')).toBeTruthy()
  })

  it('Server nicht erreichbar: Hinweis im Dialog', async () => {
    stubDelete(async () => {
      throw new TypeError('Failed to fetch')
    })
    await openDelete()
    await userEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    expect((await screen.findByRole('alert')).textContent).toBe(unreachable)
    expect(screen.getByRole('alertdialog')).toBeTruthy()
  })

  it('Doppelklick auf "Endgültig löschen" sendet genau eine Anfrage', async () => {
    let release: () => void = () => {}
    const calls = stubDelete(
      () =>
        new Promise<Response>((resolve) => {
          release = () => void noContent().then(resolve)
        }),
    )
    await openDelete()
    const confirm = screen.getByRole('button', { name: 'Endgültig löschen' })
    await userEvent.dblClick(confirm)
    expect(confirm.textContent).toBe('Einen Moment …')
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    release()
    await screen.findByText('/verwalten/kinder')
    expect(calls.deletes).toBe(1)
  })

  it('Happy Path: Kinderliste mit "Mia ist gelöscht."', async () => {
    const calls = stubDelete()
    await openDelete()
    await userEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    expect(await screen.findByText('/verwalten/kinder')).toBeTruthy()
    expect(screen.getByText('Mia ist gelöscht.')).toBeTruthy()
    expect(calls.deletes).toBe(1)
  })
})
