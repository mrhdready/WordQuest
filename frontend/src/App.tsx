import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { GuardianLoginPage } from '@/features/auth/GuardianLoginPage'
import { ProfilePickerPage } from '@/features/auth/ProfilePickerPage'
import { LearnHomePage } from '@/features/learn/LearnHomePage'
import { SessionPage } from '@/features/learn/SessionPage'
import { ManageLayout } from '@/features/manage/ManageLayout'
import { ProgressPage } from '@/features/manage/ProgressPage'
import { SetDetailPage } from '@/features/manage/SetDetailPage'
import { SetsPage } from '@/features/manage/SetsPage'
import { AuthProvider, useAuth } from '@/lib/auth'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Offline ist der Normalfall, nicht die Ausnahme: lieber veraltete
      // Daten zeigen als eine leere Seite (Konzept §13).
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
      networkMode: 'offlineFirst',
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

function AppRoutes() {
  const { user, isGuardian } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={<GuardianLoginPage />} />

      <Route
        path="/"
        element={
          user ? (
            isGuardian ? (
              <Navigate to="/verwalten" replace />
            ) : (
              <LearnHomePage />
            )
          ) : (
            <ProfilePickerPage />
          )
        }
      />

      <Route
        path="/lernen"
        element={
          <RequireAuth>
            <SessionPage />
          </RequireAuth>
        }
      />

      <Route
        path="/verwalten"
        element={
          <RequireGuardian>
            <ManageLayout />
          </RequireGuardian>
        }
      >
        <Route index element={<SetsPage />} />
        <Route path="sets/:setId" element={<SetDetailPage />} />
        <Route path="fortschritt" element={<ProgressPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function RequireAuth({ children }: { children: ReactElement }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/" replace />
}

function RequireGuardian({ children }: { children: ReactElement }) {
  const { user, isGuardian } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return isGuardian ? children : <Navigate to="/" replace />
}
