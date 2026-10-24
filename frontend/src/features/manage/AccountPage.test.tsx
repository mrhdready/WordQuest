import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccountPage } from '@/features/manage/AccountPage'
import { renderWithProviders } from '@/test/render'

const valid = { current: 'altes-passwort', next: 'neues-passwort-1' }
const success = 'Dein Passwort wurde geändert. Beim nächsten Anmelden gilt das neue Passwort.'

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

const noContent = async () => new Response(null, { status: 204 })

function fieldError(key: string, message: string) {
  return async () =>
    Response.json(
      { title: 'One or more validation errors occurred.', errors: { [key]: [message] } },
      { status: 400 },
    )
}

function fields() {
  return {
    current: screen.getByLabelText('Aktuelles Passwort') as HTMLInputElement,
    next: screen.getByLabelText('Neues Passwort') as HTMLInputElement,
    repeat: screen.getByLabelText('Neues Passwort wiederholen') as HTMLInputElement,
    button: screen.getByRole('button', { name: 'Passwort ändern' }),
  }
}

// Leere Werte werden nicht getippt; userEvent.type mit '' ist nicht erlaubt.
async function fill(values: { current?: string; next?: string; repeat?: string }) {
  renderWithProviders(<AccountPage />, { route: '/verwalten/konto', path: '/verwalten/konto' })
  const f = fields()
  const { current = valid.current, next = valid.next, repeat = next } = values
  if (current) await userEvent.type(f.current, current)
  if (next) await userEvent.type(f.next, next)
  if (repeat) await userEvent.type(f.repeat, repeat)
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
describe('Passwort ändern', () => {
  it('1: aktuelles Passwort leer', async () => {
    const bodies = stubFetch(noContent)
    const f = await fill({ current: '' })
    await userEvent.click(f.button)
    await expectClientError(f.current, 'Bitte gib dein aktuelles Passwort ein.', bodies)
  })

  it('2: aktuelles Passwort falsch (Server)', async () => {
    stubFetch(fieldError('currentPassword', 'Das aktuelle Passwort stimmt nicht.'))
    const f = await fill({ current: 'falsches-passwort' })
    await userEvent.click(f.button)
    const error = await screen.findByText('Das aktuelle Passwort stimmt nicht.')
    expect(error.id).toBe('aktuelles-passwort-fehler')
    expect(f.current.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(f.current)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('3: neues Passwort leer', async () => {
    const bodies = stubFetch(noContent)
    const f = await fill({ next: '', repeat: valid.next })
    await userEvent.click(f.button)
    await expectClientError(f.next, 'Bitte gib ein neues Passwort ein.', bodies)
  })

  it('4: neues Passwort nur aus Leerzeichen', async () => {
    const bodies = stubFetch(noContent)
    const f = await fill({ next: '        ' })
    await userEvent.click(f.button)
    await expectClientError(f.next, 'Bitte gib ein neues Passwort ein.', bodies)
  })

  it('5: neues Passwort zu kurz', async () => {
    const bodies = stubFetch(noContent)
    const f = await fill({ next: 'kurz123' })
    await userEvent.click(f.button)
    await expectClientError(f.next, 'Das neue Passwort muss mindestens 8 Zeichen lang sein.', bodies)
  })

  it('6: Wiederholung leer', async () => {
    const bodies = stubFetch(noContent)
    const f = await fill({ repeat: '' })
    await userEvent.click(f.button)
    await expectClientError(f.repeat, 'Bitte wiederhole das neue Passwort.', bodies)
  })

  it('7: Wiederholung weicht ab', async () => {
    const bodies = stubFetch(noContent)
    const f = await fill({ repeat: 'neues-passwort-2' })
    await userEvent.click(f.button)
    await expectClientError(f.repeat, 'Die beiden neuen Passwörter stimmen nicht überein.', bodies)
  })

  it('8: Server nicht erreichbar zeigt den Hinweis, Eingaben bleiben', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    const f = await fill({})
    await userEvent.click(f.button)
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Der Server ist gerade nicht erreichbar. Prüfe die Verbindung und versuche es noch einmal.',
    )
    expect(f.current.value).toBe(valid.current)
    expect(f.next.value).toBe(valid.next)
    expect(f.repeat.value).toBe(valid.next)
    expect((f.button as HTMLButtonElement).disabled).toBe(false)
  })

  it('9: Enter im letzten Feld sendet genau einmal ab', async () => {
    const bodies = stubFetch(noContent)
    const f = await fill({})
    await userEvent.type(f.repeat, '{Enter}')
    await screen.findByText(success)
    expect(bodies).toEqual([{ currentPassword: valid.current, newPassword: valid.next }])
  })

  it('10: Doppelklick sendet genau eine Anfrage', async () => {
    let release: () => void = () => {}
    const bodies = stubFetch(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(new Response(null, { status: 204 }))
        }),
    )
    const f = await fill({})
    await userEvent.dblClick(f.button)
    expect(f.button.textContent).toBe('Einen Moment …')
    release()
    await screen.findByText(success)
    expect(bodies).toHaveLength(1)
  })

  it('12: neues Passwort vom Server abgelehnt steht am Feld', async () => {
    stubFetch(fieldError('newPassword', 'Das neue Passwort muss mindestens 8 Zeichen lang sein.'))
    const f = await fill({})
    await userEvent.click(f.button)
    const error = await screen.findByText('Das neue Passwort muss mindestens 8 Zeichen lang sein.')
    expect(error.id).toBe('neues-passwort-fehler')
    expect(f.next.getAttribute('aria-invalid')).toBe('true')
    expect(f.next.getAttribute('aria-describedby')).toContain('neues-passwort-fehler')
    expect(document.activeElement).toBe(f.next)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('13: zu viele Versuche (429) zeigt den Hinweis ohne Feldfehler', async () => {
    stubFetch(async () => new Response(null, { status: 429 }))
    const f = await fill({})
    await userEvent.click(f.button)
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Zu viele Versuche. Bitte in einer Minute nochmal probieren.',
    )
    expect(document.querySelectorAll('[id$="-fehler"]')).toHaveLength(0)
    expect(f.current.value).toBe(valid.current)
  })

  it('14: Enter im ersten Feld sendet genau einmal ab', async () => {
    const bodies = stubFetch(noContent)
    const f = await fill({})
    await userEvent.type(f.current, '{Enter}')
    await screen.findByText(success)
    expect(bodies).toEqual([{ currentPassword: valid.current, newPassword: valid.next }])
  })

  it('11: Happy Path zeigt den Erfolg und leert die Felder', async () => {
    const bodies = stubFetch(noContent)
    const f = await fill({})
    await userEvent.click(f.button)
    const status = await screen.findByRole('status')
    expect(status.textContent).toBe(success)
    await waitFor(() => expect(f.current.value).toBe(''))
    expect(f.next.value).toBe('')
    expect(f.repeat.value).toBe('')
    expect(document.activeElement).toBe(f.button)
    expect(bodies).toEqual([{ currentPassword: valid.current, newPassword: valid.next }])
  })
})
