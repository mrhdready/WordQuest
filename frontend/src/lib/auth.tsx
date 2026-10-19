import { createContext, use, useCallback, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { api, tokenStore } from '@/lib/api'
import type { AuthResponse, AuthUser } from '@/types'

interface AuthContextValue {
  user: AuthUser | null
  isGuardian: boolean
  loginAsGuardian: (email: string, password: string) => Promise<void>
  loginAsLearner: (learnerId: string, pin: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Quelle ist der Speicher: Sitzungsende durch Refresh 400/401 oder einen
  // anderen Tab erreicht so auch die Routensperre (D-07).
  const rawUser = useSyncExternalStore(tokenStore.subscribe, () => tokenStore.rawUser)
  const user = useMemo(() => (rawUser ? (JSON.parse(rawUser) as AuthUser) : null), [rawUser])

  const loginAsGuardian = useCallback(async (email: string, password: string) => {
    const auth = await api<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    tokenStore.save(auth)
  }, [])

  const loginAsLearner = useCallback(async (learnerId: string, pin: string) => {
    const auth = await api<AuthResponse>('/auth/learner-login', {
      method: 'POST',
      body: { learnerId, pin },
    })
    tokenStore.save(auth)
  }, [])

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.refresh
    if (refreshToken) {
      // Abmelden darf nie daran scheitern, dass der Server gerade nicht
      // erreichbar ist - lokal wird der Zugang in jedem Fall geloescht.
      await api('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => undefined)
    }
    tokenStore.clear()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isGuardian: user?.role === 'Guardian' || user?.role === 'Owner',
      loginAsGuardian,
      loginAsLearner,
      logout,
    }),
    [user, loginAsGuardian, loginAsLearner, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext)
  if (!context) throw new Error('useAuth muss innerhalb von <AuthProvider> benutzt werden.')
  return context
}
