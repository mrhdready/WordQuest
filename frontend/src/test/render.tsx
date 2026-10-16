import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

// Fangroute: zeigt, wohin navigate() gefuehrt hat.
function CurrentPath() {
  const location = useLocation()
  return <p>{location.pathname + location.search}</p>
}

/**
 * Rendert unter einer echten Route mit Pfadmuster, damit useParams die
 * Parameter aus der URL liefert. Neuer QueryClient je Aufruf, ohne Retry,
 * damit Fehlerfaelle sofort sichtbar werden.
 */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', path = '/' }: { route?: string; path?: string } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
          <Route path="*" element={<CurrentPath />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
