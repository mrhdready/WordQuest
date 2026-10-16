import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

// Fangroute: zeigt, wohin navigate() gefuehrt hat, samt mitgegebener Meldung.
function CurrentPath() {
  const location = useLocation()
  const message = (location.state as { message?: string } | null)?.message
  return (
    <>
      <p>{location.pathname + location.search}</p>
      {message ? <p>{message}</p> : null}
    </>
  )
}

/**
 * Rendert unter einer echten Route mit Pfadmuster, damit useParams die
 * Parameter aus der URL liefert; state landet als Router-State im
 * Starteintrag. Neuer QueryClient je Aufruf, ohne Retry,
 * damit Fehlerfaelle sofort sichtbar werden.
 */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', path = '/', state }: { route?: string; path?: string; state?: unknown } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      {/* Router-State nur auf Wunsch: ein Objekt-Eintrag kennt kein ?query im pathname. */}
      <MemoryRouter initialEntries={[state === undefined ? route : { pathname: route, state }]}>
        <Routes>
          <Route path={path} element={ui} />
          <Route path="*" element={<CurrentPath />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
