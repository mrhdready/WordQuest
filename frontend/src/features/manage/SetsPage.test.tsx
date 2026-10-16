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

afterEach(() => {
  vi.unstubAllGlobals()
})

// Hausregel: ein Fall je Fehler, exakte Texte, Enter eigener Pfad, Happy Path zuletzt.
describe('Set-Formular "Neues Set"', () => {
  it('1: leerer Titel sendet nichts', async () => {
    const posts = stubApi(async () => Response.json(createdSet, { status: 201 }))
    await openForm()
    await userEvent.click(screen.getByRole('button', { name: 'Anlegen' }))
    expect(posts).toHaveLength(0)
  })

  it('2: Titel nur aus Leerzeichen sendet nichts', async () => {
    const posts = stubApi(async () => Response.json(createdSet, { status: 201 }))
    const input = await openForm()
    await userEvent.type(input, '   ')
    await userEvent.click(screen.getByRole('button', { name: 'Anlegen' }))
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
