import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProfilePickerPage } from '@/features/auth/ProfilePickerPage'
import { AuthProvider } from '@/lib/auth'
import { renderWithProviders } from '@/test/render'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

const wrongPin = 'Die PIN stimmt nicht.'
const loggedIn = async () =>
  Response.json({
    accessToken: 'a',
    refreshToken: 'r',
    expiresInSeconds: 900,
    user: { id: 'kind-1', displayName: 'Mia', role: 'Learner', tenantId: 't' },
  })

// Profilwahl mit einem Kind; gesammelt werden die Koerper von learner-login.
function stubLogin(respond: () => Promise<Response>) {
  const logins: unknown[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/profiles')) return Response.json([{ id: 'kind-1', displayName: 'Mia', avatarKey: 'fox' }])
      logins.push(JSON.parse(String(init?.body)))
      return respond()
    }),
  )
  return logins
}

async function openPin() {
  renderWithProviders(
    <AuthProvider>
      <ProfilePickerPage />
    </AuthProvider>,
    { route: '/profil', path: '/profil' },
  )
  await userEvent.click(await screen.findByRole('button', { name: /Mia/ }))
  await screen.findByRole('heading', { name: 'Hallo, Mia!' })
}

const status = () => screen.getByRole('status').textContent
const dots = () => screen.getByTestId('ziffern-punkte').querySelectorAll('span')
const key = (name: string) => screen.getByRole('button', { name })

// Ein Tick fuer ausstehende Anfragen: ohne ihn waere "keine zweite Anfrage" schon vor dem Senden wahr.
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 20))
}

// Entscheidung 2026-10-21: genau 4 Ziffern, die vierte sendet ab (PAR-02, FIX-08).
describe('PIN-Eingabe', () => {
  it('Tippen: die vierte Ziffer sendet genau einmal ab', async () => {
    const logins = stubLogin(loggedIn)
    await openPin()
    expect(dots()).toHaveLength(4)
    // Kein „Los geht’s“ mehr: die vierte Ziffer ist der einzige Weg (Entscheidung 2026-10-21).
    expect(screen.queryByRole('button', { name: /Los geht/ })).toBeNull()
    for (const digit of '123') await userEvent.click(key(digit))
    await settle()
    expect(logins).toHaveLength(0)
    await userEvent.click(key('4'))
    expect(await screen.findByText('/')).toBeTruthy()
    expect(logins).toEqual([{ learnerId: 'kind-1', pin: '1234' }])
  })

  it('Tastatur: schnelles Tippen mit fünfter Ziffer und Enter sendet genau einmal', async () => {
    let release: () => void = () => {}
    const logins = stubLogin(
      () =>
        new Promise<Response>((resolve) => {
          release = () => void loggedIn().then(resolve)
        }),
    )
    await openPin()
    // Alle Tasten im selben Takt, bevor React neu rendert.
    act(() => {
      for (const name of ['1', '2', '3', '4', '5', 'Enter', 'Enter'])
        window.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))
    })
    // Ohne Button sagt die Statuszeile das Warten an.
    await waitFor(() => expect(status()).toBe('Einen Moment …'))
    expect(dots()).toHaveLength(4)
    await userEvent.keyboard('6{Enter}')
    await settle()
    expect(logins).toEqual([{ learnerId: 'kind-1', pin: '1234' }])
    release()
    expect(await screen.findByText('/')).toBeTruthy()
    expect(logins).toHaveLength(1)
  })

  it('Backspace und Löschen-Taste entfernen die letzte Ziffer', async () => {
    const logins = stubLogin(loggedIn)
    await openPin()
    await userEvent.keyboard('123')
    expect(status()).toBe('3 Ziffern eingegeben')
    await userEvent.keyboard('{Backspace}')
    expect(status()).toBe('2 Ziffern eingegeben')
    await userEvent.click(screen.getByRole('button', { name: 'Letzte Ziffer löschen' }))
    expect(status()).toBe('1 Ziffer eingegeben')
    await settle()
    expect(logins).toHaveLength(0)
    await userEvent.keyboard('789')
    expect(await screen.findByText('/')).toBeTruthy()
    expect(logins).toEqual([{ learnerId: 'kind-1', pin: '1789' }])
  })

  // Entscheidung 2026-10-22: Sehende Kinder sehen das Warten, die Ziffernanzahl
  // bleibt eine reine Screenreader-Ansage (die Punkte zeigen sie schon).
  it('Warten ist sichtbar in der Statuszeile und verschwindet nach der Antwort', async () => {
    let release: () => void = () => {}
    stubLogin(
      () =>
        new Promise<Response>((resolve) => {
          release = () =>
            resolve(Response.json({ title: 'Anmeldung fehlgeschlagen', detail: wrongPin }, { status: 401 }))
        }),
    )
    await openPin()
    await userEvent.keyboard('123')
    expect(screen.getByText('3 Ziffern eingegeben').closest('.sr-only')).not.toBeNull()
    await userEvent.keyboard('4')
    const waiting = await screen.findByText('Einen Moment …')
    expect(screen.getByRole('status').contains(waiting)).toBe(true)
    expect(waiting.closest('.sr-only')).toBeNull()
    release()
    expect((await screen.findByRole('alert')).textContent).toBe(wrongPin)
    expect(screen.queryByText('Einen Moment …')).toBeNull()
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('Falsche PIN: Eingabe leer, Meldung bleibt, Fokus auf "1", neuer Versuch sendet wieder', async () => {
    let calls = 0
    const logins = stubLogin(async () =>
      ++calls === 1
        ? Response.json({ title: 'Anmeldung fehlgeschlagen', detail: wrongPin }, { status: 401 })
        : loggedIn(),
    )
    await openPin()
    await userEvent.keyboard('9999')
    expect((await screen.findByRole('alert')).textContent).toBe(wrongPin)
    await waitFor(() => expect(document.activeElement).toBe(key('1')))
    expect(status()).toBe('')
    expect([...dots()].filter((dot) => dot.className.includes('bg-primary'))).toHaveLength(0)
    await userEvent.keyboard('1')
    expect(status()).toBe('1 Ziffer eingegeben')
    expect(screen.getByRole('alert').textContent).toBe(wrongPin)
    // Enter auf der fokussierten Taste "1" haengt keine Ziffer an (Review 261021-p4z).
    await userEvent.keyboard('{Enter}')
    expect(status()).toBe('1 Ziffer eingegeben')
    // Die Leertaste bedient die fokussierte Taste weiter.
    await userEvent.keyboard(' ')
    expect(status()).toBe('2 Ziffern eingegeben')
    await userEvent.keyboard('23')
    expect(await screen.findByText('/')).toBeTruthy()
    expect(logins).toEqual([
      { learnerId: 'kind-1', pin: '9999' },
      { learnerId: 'kind-1', pin: '1123' },
    ])
  })
})

describe('Profilwahl', () => {
  // Kind am Tablet: kein Neuladen noetig, um nach einem Ausfall weiterzukommen (UI-Review Top 1).
  it('Ladefehler nennt den Vertragstext, "Noch einmal" lädt neu', async () => {
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ++calls === 1
          ? new Response('', { status: 500 })
          : Response.json([{ id: 'kind-1', displayName: 'Mia', avatarKey: 'fox' }]),
      ),
    )
    renderWithProviders(
      <AuthProvider>
        <ProfilePickerPage />
      </AuthProvider>,
    )
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Der Server ist gerade nicht erreichbar. Prüfe die Verbindung und versuche es noch einmal.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Noch einmal' }))
    const tile = await screen.findByRole('button', { name: /Mia/ })
    await waitFor(() => expect(document.activeElement).toBe(tile))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(calls).toBe(2)
  })
})
