import type { AuthResponse } from '@/types'

const BASE = '/api/v1'
const ACCESS_KEY = 'wq.access'
const REFRESH_KEY = 'wq.refresh'
const USER_KEY = 'wq.user'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/*
  Tokenhaltung im localStorage.

  Bewusste Abwaegung: httpOnly-Cookies waeren gegen XSS sicherer, aber die App
  muss offline starten und die Sitzung ueberleben, ohne dass der Server
  erreichbar ist. Der Gegenwert ist eine strikte CSP ohne inline-Skripte
  (siehe frontend/nginx.conf) — damit bleibt XSS die Ausnahme statt der Regel.
*/
export const tokenStore = {
  get access() {
    return safeRead(ACCESS_KEY)
  },
  get refresh() {
    return safeRead(REFRESH_KEY)
  },
  get user() {
    const raw = safeRead(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthResponse['user']) : null
  },
  save(auth: AuthResponse) {
    safeWrite(ACCESS_KEY, auth.accessToken)
    safeWrite(REFRESH_KEY, auth.refreshToken)
    safeWrite(USER_KEY, JSON.stringify(auth.user))
  },
  clear() {
    for (const key of [ACCESS_KEY, REFRESH_KEY, USER_KEY]) {
      try {
        localStorage.removeItem(key)
      } catch {
        /* privater Modus oder gesperrter Speicher - kein Grund abzustuerzen */
      }
    }
  },
}

function safeRead(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeWrite(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* siehe oben */
  }
}

let refreshInFlight: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = tokenStore.refresh
  if (!refreshToken) return false

  // Mehrere parallele 401er duerfen nicht mehrere Rotationen ausloesen -
  // die zweite wuerde als Token-Wiederverwendung gewertet und die Sitzung
  // komplett verwerfen.
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })

      if (!response.ok) {
        tokenStore.clear()
        return false
      }

      tokenStore.save((await response.json()) as AuthResponse)
      return true
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

interface RequestOptions {
  method?: string
  body?: unknown
  retryOn401?: boolean
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, retryOn401 = true } = options

  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const access = tokenStore.access
  if (access) headers.Authorization = `Bearer ${access}`

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 401 && retryOn401 && (await refreshAccessToken())) {
    return api<T>(path, { ...options, retryOn401: false })
  }

  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const problem = (await response.json()) as { detail?: string; title?: string }
    return problem.detail ?? problem.title ?? `Fehler ${response.status}`
  } catch {
    return `Fehler ${response.status}`
  }
}
