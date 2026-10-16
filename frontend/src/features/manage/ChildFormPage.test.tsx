import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChildFormPage } from '@/features/manage/ChildFormPage'
import { renderWithProviders } from '@/test/render'

const valid = { name: 'Mia', limit: '5', pin: '1234' }
const nameMissing = 'Wie soll das Kind heißen? Ein Spitzname genügt.'
const limitInvalid = 'Bitte gib eine Zahl von 3 bis 15 ein.'
const pinMissing = 'Bitte gib eine PIN mit 4 bis 6 Ziffern ein.'
const pinInvalid = 'Die PIN muss aus 4 bis 6 Ziffern bestehen.'
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
    { title: 'PIN 7 Ziffern', values: { pin: '1234567' }, field: 'pin', message: pinInvalid },
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
    { title: 'Grenze PIN 6 Ziffern angenommen', values: { pin: '987654' }, body: { pin: '987654' } },
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

  it('Happy Path: Umlaut und Emoji, Weiterleitung mit Erfolgsmeldung', async () => {
    const bodies = stubFetch(created)
    const f = await fill({ name: 'Jürgen 🦊', limit: '7', pin: '123456' })
    await userEvent.click(f.button)
    await screen.findByText('/verwalten/kinder')
    expect(screen.getByText(success)).toBeTruthy()
    expect(bodies).toEqual([{ displayName: 'Jürgen 🦊', pin: '123456', dailyNewLimit: 7 }])
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
    { title: 'PIN 7 Ziffern', values: { pin: '1234567' }, field: 'pin', message: pinInvalid },
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
    { title: 'Grenze PIN 6 Ziffern angenommen', values: { pin: '987654' }, body: { pin: '987654' } },
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
    expect(screen.getByText('4 bis 6 Ziffern. Leer lassen, wenn die PIN gleich bleiben soll.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Kind bearbeiten' })).toBeTruthy()
  })

  it('Kind ohne PIN: Hilfetext nennt das', async () => {
    stubEdit()
    renderEdit('kind-2')
    const f = await editFields()
    expect(f.name.value).toBe('Ole')
    expect(screen.getByText('Für dieses Kind ist noch keine PIN gesetzt.')).toBeTruthy()
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
