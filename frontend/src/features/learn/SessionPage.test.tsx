import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionPage } from '@/features/learn/SessionPage'
import { AuthProvider } from '@/lib/auth'
import { renderWithProviders } from '@/test/render'

const item = {
  itemId: 'item-1',
  cardId: 'card-1',
  prompt: 'dog',
  promptType: 'text',
  expectedAnswerType: 'text',
  choices: null,
  emoji: null,
  pictureVersion: null,
  exampleSentence: null,
  isRetry: false,
}
const view = { sessionId: 'session-1', gameKey: 'classic', totalItems: 2, items: [item, { ...item, itemId: 'item-2' }] }
const result = {
  correct: true,
  grade: 'Good',
  correctAnswer: 'Hund',
  message: null,
  hadTypo: false,
  xpAwarded: 10,
  coinsAwarded: 1,
  retryItem: null,
}
const summary = {
  sessionId: 'session-1',
  answered: 1,
  correct: 1,
  xpAwarded: 85,
  coinsAwarded: 1,
  totalXp: 85,
  level: 1,
  levelProgress: 0.8,
  xpToNextLevel: 15,
  coins: 1,
  streak: 1,
  streakSaverUsed: false,
  leveledUp: false,
}

const duplicate = 'Diese Antwort ist schon angekommen. Starte eine neue Runde, um weiterzulernen.'
const foreignCard = 'Diese Karte gehört nicht zu dieser Runde. Starte eine neue Runde.'

// Beliebige Bytes genuegen: jsdom dekodiert nicht, der Typ kommt aus dem Header.
const png = async () => new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), { headers: { 'Content-Type': 'image/png' } })

// Zaehlt die Anfragen je Endpunkt. Die Antwort auf /answers haelt der Test
// selbst zurueck, damit ein zweiter Tipp vor der Antwort ankommt.
function stubFetch(
  answer: () => Promise<Response>,
  { items, picture = png }: { items?: object[]; picture?: () => Promise<Response> } = {},
) {
  const calls = { answers: 0, complete: 0, pictures: 0, bodies: [] as Record<string, unknown>[] }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/pictures/')) {
        calls.pictures += 1
        return picture()
      }
      if (url.endsWith('/answers')) {
        calls.answers += 1
        calls.bodies.push(JSON.parse(init!.body as string) as Record<string, unknown>)
        return answer()
      }
      if (url.endsWith('/complete')) {
        calls.complete += 1
        return Response.json(summary)
      }
      if (url.endsWith('/sessions')) return Response.json(items ? { ...view, totalItems: items.length, items } : view)
      return new Response('', { status: 500 })
    }),
  )
  return calls
}

function held() {
  let release: (response: Response) => void = () => {}
  const pending = new Promise<Response>((resolve) => {
    release = resolve
  })
  return { answer: () => pending, release: (response: Response) => release(response) }
}

const problem = (status: number, detail: string) =>
  new Response(JSON.stringify({ status, detail }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })

function render() {
  renderWithProviders(
    <AuthProvider>
      <SessionPage />
    </AuthProvider>,
    { route: '/lernen', path: '/lernen' },
  )
}

async function typeAnswer() {
  const input = await screen.findByRole('textbox', { name: 'Deine Antwort' })
  fireEvent.change(input, { target: { value: 'Hund' } })
  return input
}

beforeEach(() => {
  // jsdom kennt scrollIntoView nicht.
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.setItem('wq.user', JSON.stringify({ id: 'kind-1', displayName: 'Mia', role: 'Learner', tenantId: 't' }))
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Lernrunde', () => {
  it('Doppelklick auf Senden schickt genau eine Antwort', async () => {
    const answer = held()
    const calls = stubFetch(answer.answer)
    render()
    await typeAnswer()

    const send = screen.getByRole('button', { name: 'Antwort senden' })
    fireEvent.click(send)
    fireEvent.click(send)
    answer.release(Response.json(result))

    await screen.findByText('2 von 2')
    expect(calls.answers).toBe(1)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('Zweimal Enter schickt genau eine Antwort', async () => {
    const answer = held()
    const calls = stubFetch(answer.answer)
    render()
    await typeAnswer()

    const user = userEvent.setup({ delay: null })
    await user.keyboard('{Enter}{Enter}')
    answer.release(Response.json(result))

    await screen.findByText('2 von 2')
    expect(calls.answers).toBe(1)
    expect(screen.queryByRole('alert')).toBeNull()
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Deine Antwort' })
    expect(input.value).toBe('')
    expect(document.activeElement).toBe(input)

    // Enter im leeren Feld der neuen Aufgabe sendet nichts und ueberspringt nichts.
    await user.keyboard('{Enter}')
    expect(calls.answers).toBe(1)
    expect(screen.getByText('2 von 2')).toBeTruthy()
  })

  it('409 zeigt den Server-Text, "Zurück" hat den Fokus', async () => {
    stubFetch(async () => problem(409, duplicate))
    render()
    await typeAnswer()
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }))

    expect((await screen.findByRole('alert')).textContent).toBe(duplicate)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Zurück' }))
  })

  // Ohne Fehlertext (kein Error geworfen) gilt der Vertragstext der UI-SPEC.
  it('Fehler ohne Text zeigt "Das hat nicht geklappt. Versuche es noch einmal."', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: () => Promise.reject('kaputt') }) as unknown as Response),
    )
    render()
    expect((await screen.findByRole('alert')).textContent).toBe('Das hat nicht geklappt. Versuche es noch einmal.')
  })

  it('404 zeigt den Server-Text', async () => {
    stubFetch(async () => problem(404, foreignCard))
    render()
    await typeAnswer()
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }))

    expect((await screen.findByRole('alert')).textContent).toBe(foreignCard)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Zurück' }))
  })

  it('"Schließen" ohne Antwort navigiert nur zurück', async () => {
    const calls = stubFetch(async () => Response.json(result))
    render()
    await typeAnswer()
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))

    expect(await screen.findByText('/')).toBeTruthy()
    expect(calls.complete).toBe(0)
  })

  it('"Schließen" nach einer Antwort schließt die Runde genau einmal ab', async () => {
    const calls = stubFetch(async () => Response.json(result))
    render()
    await typeAnswer()
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }))
    await screen.findByText('2 von 2')
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))

    expect(await screen.findByText('/')).toBeTruthy()
    expect(calls.complete).toBe(1)
  })
})

describe('Weiter nur bei Korrektur', () => {
  const second = { ...item, itemId: 'item-2', prompt: 'cat' }
  const answerField = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Deine Antwort' })

  it('richtig ohne Tippfehler: sofort die naechste Aufgabe, "Richtig! +10 XP" im Statusbereich, Fokus im leeren Feld', async () => {
    stubFetch(async () => Response.json(result), { items: [item, second] })
    render()
    await typeAnswer()
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('')

    await userEvent.setup({ delay: null }).keyboard('{Enter}')

    expect(await screen.findByText('cat')).toBeTruthy()
    expect(screen.getByText('2 von 2')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Weiter' })).toBeNull()
    expect(screen.getByRole('status')).toBe(status)
    expect(status.textContent).toBe('Richtig! +10 XP')
    expect(answerField().value).toBe('')
    expect(document.activeElement).toBe(answerField())
    // Die Bestaetigung schiebt das Feld nach unten; bei 200 % holt es sich zurueck ins Bild.
    expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts).toContain(answerField())
  })

  it('Klick auf "Antwort senden", richtig: Fokus danach im neuen, leeren Antwortfeld', async () => {
    stubFetch(async () => Response.json(result), { items: [item, second] })
    render()
    await typeAnswer()

    await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'Antwort senden' }))

    await screen.findByText('2 von 2')
    expect(answerField().value).toBe('')
    expect(document.activeElement).toBe(answerField())
  })

  it('zweite Antwort traegt Item-ID und Text der neuen Aufgabe, die Bestaetigung ist beim Senden weg', async () => {
    // answerMs zaehlt ab Anzeige der jeweiligen Aufgabe: Start bei 1000, erste Antwort bei 5000.
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const pending = held()
    let answered = 0
    const calls = stubFetch(() => (answered++ === 0 ? Promise.resolve(Response.json(result)) : pending.answer()), {
      items: [item, second],
    })
    render()
    await typeAnswer()
    const user = userEvent.setup({ delay: null })
    now.mockReturnValue(5_000)
    await user.keyboard('{Enter}')
    await screen.findByText('2 von 2')

    now.mockReturnValue(5_300)
    await user.keyboard('Katze{Enter}')

    await waitFor(() => expect(calls.answers).toBe(2))
    expect(calls.bodies[0]).toMatchObject({ itemId: 'item-1', answerMs: 4_000 })
    expect(calls.bodies[1]).toMatchObject({ itemId: 'item-2', clientAnswerId: 'item-2', givenAnswer: 'Katze', answerMs: 300 })
    expect(screen.getByRole('status').textContent).toBe('')
    pending.release(Response.json(result))
    expect(await screen.findByRole('heading', { name: 'Geschafft!' })).toBeTruthy()
  })

  it('letzte Aufgabe richtig: direkt die Zusammenfassung, genau ein /complete', async () => {
    const calls = stubFetch(async () => Response.json(result), { items: [item] })
    render()
    await typeAnswer()
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }))

    expect(await screen.findByRole('heading', { name: 'Geschafft!' })).toBeTruthy()
    expect(calls.complete).toBe(1)
    expect(screen.queryByRole('button', { name: 'Weiter' })).toBeNull()
  })

  it('falsch: "Fast!" mit Loesung, "Weiter" fokussiert, Aufgabe wechselt erst danach', async () => {
    const wrong = {
      ...result,
      correct: false,
      grade: 'Again',
      xpAwarded: 0,
      coinsAwarded: 0,
      retryItem: { ...item, itemId: 'item-3', isRetry: true },
    }
    stubFetch(async () => Response.json(wrong), { items: [item, second] })
    render()
    await typeAnswer()
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }))

    const next = await screen.findByRole('button', { name: 'Weiter' })
    expect(screen.getByText('Fast!')).toBeTruthy()
    expect(screen.getByText('Es heißt: Hund')).toBeTruthy()
    expect(document.activeElement).toBe(next)
    expect(next.getAttribute('aria-describedby')).toBe('rueckmeldung')
    // Die Wiederholung wird wie bisher hinten angehaengt.
    expect(screen.getByText('1 von 3')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('')

    fireEvent.click(next)
    expect(await screen.findByText('2 von 3')).toBeTruthy()
  })

  it('richtig mit Tippfehler: Hinweis mit Schreibweise, "Weiter" fokussiert, Aufgabe wechselt erst danach', async () => {
    const typo = { ...result, hadTypo: true, message: 'Fast perfekt! Richtig geschrieben: Hund' }
    stubFetch(async () => Response.json(typo), { items: [item, second] })
    render()
    await typeAnswer()
    fireEvent.click(screen.getByRole('button', { name: 'Antwort senden' }))

    const next = await screen.findByRole('button', { name: 'Weiter' })
    expect(screen.getByText('Fast perfekt! Richtig geschrieben: Hund')).toBeTruthy()
    expect(document.activeElement).toBe(next)
    expect(screen.getByText('1 von 2')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('Auswahl richtig: naechste Aufgabe sofort, "Richtig!" ohne XP, Fokus auf der ersten Auswahl', async () => {
    const choice = { ...item, expectedAnswerType: 'choice', choices: ['Hund', 'Katze', 'Maus'] }
    const choice2 = { ...choice, itemId: 'item-2', prompt: 'cat', choices: ['Katze', 'Hund', 'Maus'] }
    stubFetch(async () => Response.json({ ...result, xpAwarded: 0 }), { items: [choice, choice2] })
    render()

    await userEvent.setup({ delay: null }).click(await screen.findByRole('button', { name: 'Hund' }))

    await screen.findByText('2 von 2')
    expect(screen.queryByRole('button', { name: 'Weiter' })).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Richtig!')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Katze' }))
  })
})

describe('Vokabelbild', () => {
  const withPicture = { ...item, emoji: '🐶', pictureVersion: 'v1' }
  const frame = () => screen.findByTestId('vokabelbild')
  const answerField = () => screen.findByRole('textbox', { name: 'Deine Antwort' })

  it('Aufgabe mit Bild: Rahmen sofort, dann Bild mit leerem alt, Fokus im Antwortfeld', async () => {
    const picture = held()
    stubFetch(async () => Response.json(result), { items: [withPicture], picture: picture.answer })
    render()

    const box = await frame()
    expect(box.querySelector('img')).toBeNull()
    picture.release(await png())

    await waitFor(() => expect(box.querySelector('img')).not.toBeNull())
    const image = box.querySelector('img')!
    expect(image.getAttribute('alt')).toBe('')
    expect(image.getAttribute('src')).toMatch(/^data:image\/png;base64,/)
    expect(screen.queryByText('🐶')).toBeNull()
    expect(document.activeElement).toBe(await answerField())
  })

  it('Bildabruf 404: Emoji im Rahmen, Fokus im Antwortfeld', async () => {
    stubFetch(async () => Response.json(result), { items: [withPicture], picture: async () => new Response('', { status: 404 }) })
    render()

    const box = await frame()
    await waitFor(() => expect(box.textContent).toBe('🐶'))
    expect(box.querySelector('img')).toBeNull()
    expect(document.activeElement).toBe(await answerField())
  })

  it('HTTP 200, Bild nicht dekodierbar: Emoji im Rahmen, Rahmen behält size-40, Fokus im Antwortfeld', async () => {
    stubFetch(async () => Response.json(result), { items: [withPicture] })
    render()

    const box = await frame()
    await waitFor(() => expect(box.querySelector('img')).not.toBeNull())
    fireEvent.error(box.querySelector('img')!)

    await waitFor(() => expect(box.textContent).toBe('🐶'))
    expect(box.querySelector('img')).toBeNull()
    expect(box.className).toContain('size-40')
    expect(document.activeElement).toBe(await answerField())
  })

  it('Aufgabe ohne Bild mit Emoji: Emoji wie bisher, kein Rahmen, kein Bildabruf', async () => {
    const calls = stubFetch(async () => Response.json(result), { items: [{ ...item, emoji: '🐶' }] })
    render()

    expect(await screen.findByText('🐶')).toBeTruthy()
    expect(screen.queryByTestId('vokabelbild')).toBeNull()
    expect(calls.pictures).toBe(0)
  })
})
