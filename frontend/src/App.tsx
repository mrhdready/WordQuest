import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, type ReactElement } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { GuardianLoginPage } from '@/features/auth/GuardianLoginPage'
import { ProfilePickerPage } from '@/features/auth/ProfilePickerPage'
import { LearnHomePage } from '@/features/learn/LearnHomePage'
import { SessionPage } from '@/features/learn/SessionPage'
import { AccountPage } from '@/features/manage/AccountPage'
import { ChildFormPage } from '@/features/manage/ChildFormPage'
import { ChildrenPage } from '@/features/manage/ChildrenPage'
import { ManageLayout } from '@/features/manage/ManageLayout'
import { ProgressPage } from '@/features/manage/ProgressPage'
import { SetDetailPage } from '@/features/manage/SetDetailPage'
import { SetsPage } from '@/features/manage/SetsPage'
import { retryQuery, tokenStore } from '@/lib/api'
import { AuthProvider, useAuth } from '@/lib/auth'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Offline ist der Normalfall, nicht die Ausnahme: lieber veraltete
      // Daten zeigen als eine leere Seite (Konzept §13).
      staleTime: 30_000,
      retry: retryQuery,
      refetchOnWindowFocus: false,
      networkMode: 'offlineFirst',
    },
  },
})

export function App() {
  // Neue oder beendete Anmeldung (Abmelden, Refresh 400/401, anderer Tab):
  // Daten der vorigen gehoeren nicht zum naechsten Profil (03.1-02 INFO 8).
  // Im Ereignis selbst, damit schon das erste Rendern danach nichts Altes zeigt.
  useEffect(() => {
    let session = currentSession()
    return tokenStore.subscribe(() => {
      if (currentSession() === session) return
      session = currentSession()
      queryClient.clear()
    })
  }, [])

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

// Kennung der Anmeldung, null heisst abgemeldet. Eine Rotation aendert sie nicht.
// Anmeldungen von vor wq.session haben keine Kennung, sind aber angemeldet.
function currentSession(): string | null {
  return tokenStore.refresh ? (tokenStore.session ?? '') : null
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
        <Route path="kinder" element={<ChildrenPage />} />
        <Route path="kinder/neu" element={<ChildFormPage mode="create" />} />
        <Route path="kinder/:learnerId" element={<ChildFormPage mode="edit" />} />
        <Route path="konto" element={<AccountPage />} />
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
