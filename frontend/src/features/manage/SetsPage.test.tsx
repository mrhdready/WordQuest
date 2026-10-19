import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SetsPage } from '@/features/manage/SetsPage'
import { renderWithProviders } from '@/test/render'

const createdSet = {
  id: 'set-1',
  title: 'Unit 9',
  description: null,
  sourceLanguage: 'de',
  targetLanguage: 'en',
  entryCount: 0,
}

// Je Test eigenes fetch-Stub: GET /sets liefert eine leere Liste, POST antwortet per onPost.
function stubApi(onPost: () => Promise<Response>) {
  const posts: unknown[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(JSON.parse(String(init.body)))
        return onPost()
      }
      return Response.json([])
    }),
  )
  return posts
}

// Der Link steht fuer das "+" aus ManageLayout, das ?neu=1 setzt.
async function openForm() {
  renderWithProviders(
    <>
      <SetsPage />
      <Link to="/verwalten?neu=1">Neues Set</Link>
    </>,
    { route: '/verwalten?neu=1', path: '/verwalten' },
  )
  return screen.findByLabelText('Titel')
}

// Ein Tick fuer ausstehende Mutationen: ohne ihn waere "kein POST" schon vor dem Senden wahr.
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 20))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// Hausregel: ein Fall je Fehler, exakte Texte, Enter eigener Pfad, Happy Path zuletzt.
describe('Set-Formular "Neues Set"', () => {
  it('1: leerer Titel sendet nichts', async () => {
    const posts = stubApi(async () => Response.json(createdSet, { status: 201 }))
    await openForm()
    await userEvent.click(screen.getByRole('button', { name: 'Anlegen' }))
    await settle()
    expect(posts).toHaveLength(0)
  })

  it('2: Titel nur aus Leerzeichen sendet nichts', async () => {
    const posts = stubApi(async () => Response.json(createdSet, { status: 201 }))
    const input = await openForm()
    await userEvent.type(input, '   ')
    await userEvent.click(screen.getByRole('button', { name: 'Anlegen' }))
    await settle()
    expect(posts).toHaveLength(0)
  })

  it('3: Serverfehler zum Titel steht am Feld', async () => {
    stubApi(async () =>
      Response.json(
        {
          title: 'One or more validation errors occurred.',
          errors: { title: ['Ein Set braucht einen Titel.'] },
        },
        { status: 400 },
      ),
    )
    const input = await openForm()
    await userEvent.type(input, 'Unit 3')
    await userEvent.click(screen.getByRole('button', { name: 'Anlegen' }))
    const message = await screen.findByText('Ein Set braucht einen Titel.')
    expect(message.id).toBe('titel-fehler')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toContain('titel-fehler')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(document.activeElement).toBe(input)
  })

  it('4: Server nicht erreichbar zeigt den Hinweis, Eingabe bleibt', async () => {
    stubApi(async () => {
      throw new TypeError('Failed to fetch')
    })
    const input = await openForm()
    await userEvent.type(input, 'Unit 3')
    await userEvent.click(screen.getByRole('button', { name: 'Anlegen' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Das Set konnte nicht angelegt werden.',
    )
    expect((input as HTMLInputElement).value).toBe('Unit 3')
  })

  it('5: nach Serverfehler, Abbrechen und "+" ist das Formular wieder leer', async () => {
    stubApi(async () =>
      Response.json({ errors: { title: ['Ein Set braucht einen Titel.'] } }, { status: 400 }),
    )
    const input = await openForm()
    await userEvent.type(input, 'Unit 3')
    await userEvent.click(screen.getByRole('button', { name: 'Anlegen' }))
    await screen.findByText('Ein Set braucht einen Titel.')
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    await waitFor(() => expect(screen.queryByLabelText('Titel')).toBeNull())
    await userEvent.click(screen.getByRole('link', { name: 'Neues Set' }))
    const reopened = await screen.findByLabelText('Titel')
    expect(screen.queryByText('Ein Set braucht einen Titel.')).toBeNull()
    expect(reopened.getAttribute('aria-invalid')).toBeNull()
    expect((reopened as HTMLInputElement).value).toBe('')
  })

  it('6: Enter im Titelfeld sendet genau einmal mit getrimmtem Titel', async () => {
    const posts = stubApi(async () => Response.json(createdSet, { status: 201 }))
    const input = await openForm()
    await userEvent.type(input, '  Unit 9  {Enter}')
    await waitFor(() => expect(screen.queryByLabelText('Titel')).toBeNull())
    expect(posts).toEqual([{ title: 'Unit 9' }])
  })

  it('7: Happy Path schliesst das Formular und entfernt ?neu', async () => {
    const posts = stubApi(async () => Response.json(createdSet, { status: 201 }))
    const input = await openForm()
    await userEvent.type(input, 'Unit 9')
    await userEvent.click(screen.getByRole('button', { name: 'Anlegen' }))
    // Das Formular haengt allein am Suchparameter neu: weg heisst Parameter entfernt.
    await waitFor(() => expect(screen.queryByLabelText('Titel')).toBeNull())
    expect(posts).toEqual([{ title: 'Unit 9' }])
  })
})

// Ladefehler der Set-Liste sichtbar statt leerer Flaeche (Codex-Befund 11, D-14).
describe('Ladefehler der Set-Liste', () => {
  it('500 zeigt die allgemeine Meldung', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 500 })),
    )
    renderWithProviders(<SetsPage />, { route: '/verwalten', path: '/verwalten' })
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Das hat nicht geklappt. Versuche es noch einmal.',
    )
  })

  it('Netzfehler zeigt die Meldung zur Verbindung', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    renderWithProviders(<SetsPage />, { route: '/verwalten', path: '/verwalten' })
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Der Server ist gerade nicht erreichbar. Prüfe die Verbindung und versuche es noch einmal.',
    )
  })

  it('Formular "Neues Set" bleibt neben der Meldung nutzbar', async () => {
    const posts: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)))
          return Response.json(createdSet, { status: 201 })
        }
        return new Response(null, { status: 500 })
      }),
    )
    const input = await openForm()
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Das hat nicht geklappt. Versuche es noch einmal.',
    )
    await userEvent.type(input, 'Unit 9')
    await userEvent.click(screen.getByRole('button', { name: 'Anlegen' }))
    await waitFor(() => expect(posts).toEqual([{ title: 'Unit 9' }]))
  })
})

// UI-SPEC empty: nach dem Loeschen des letzten Sets steht die Meldung ueber dem Leerzustand.
it('Erfolgsmeldung nach "Set löschen" steht über "Noch keine Vokabelsets"', async () => {
  stubApi(async () => Response.json(createdSet, { status: 201 }))
  renderWithProviders(<SetsPage />, {
    route: '/verwalten',
    path: '/verwalten',
    state: { message: 'Das Set „Zz E2E“ ist gelöscht.' },
  })
  const empty = await screen.findByText('Noch keine Vokabelsets')
  const note = screen.getByRole('status')
  expect(note.textContent).toBe('Das Set „Zz E2E“ ist gelöscht.')
  expect(note.compareDocumentPosition(empty) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
