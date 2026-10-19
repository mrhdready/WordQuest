import type { AuthResponse } from '@/types'

const BASE = '/api/v1'
const ACCESS_KEY = 'wq.access'
const REFRESH_KEY = 'wq.refresh'
const USER_KEY = 'wq.user'
// Kennung einer Anmeldung: bleibt bei der Rotation, neu bei jeder Anmeldung.
const SESSION_KEY = 'wq.session'
// Laufzeit-Cache des Service Workers, gleicher Name wie cacheName in vite.config.ts.
const API_CACHE = 'wq-api'
// Eigenes Fenster-Ereignis nach jedem Schreiben; das storage-Ereignis meldet nur andere Tabs.
const SESSION_EVENT = 'wq-session'

// Deutsche Texte statt englischer Technik-Meldungen (UI-SPEC Copywriting "Error state").
const UNREACHABLE =
  'Der Server ist gerade nicht erreichbar. Prüfe die Verbindung und versuche es noch einmal.'
const GENERIC = 'Das hat nicht geklappt. Versuche es noch einmal.'
// Rate-Limit "auth" (Program.cs) antwortet ohne Koerper, das Zeitfenster ist eine
// Minute. Wortlaut wie die PIN-Sperre in AuthService.
const TOO_MANY = 'Zu viele Versuche. Bitte in einer Minute nochmal probieren.'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    // Feldfehler einer ValidationProblem-Antwort, Schluessel wie im Request.
    readonly errors?: Record<string, string[]>,
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
  // Roher Eintrag als stabiler Snapshot fuer useSyncExternalStore.
  get rawUser() {
    return safeRead(USER_KEY)
  },
  get session() {
    return safeRead(SESSION_KEY)
  },
  save(auth: AuthResponse) {
    safeWrite(ACCESS_KEY, auth.accessToken)
    safeWrite(REFRESH_KEY, auth.refreshToken)
    safeWrite(USER_KEY, JSON.stringify(auth.user))
    window.dispatchEvent(new Event(SESSION_EVENT))
  },
  // Neue Anmeldung: Workbox schreibt Netzantworten im Hintergrund in den Cache;
  // ein GET, der beim Abmelden noch lief, kann ihn neu anlegen. Deshalb loescht
  // auch die naechste Anmeldung, bevor sie speichert (Review 02 MEDIUM).
  async saveLogin(auth: AuthResponse) {
    await dropApiCache()
    // Kein Geheimnis, nur ein Vergleichswert; crypto.randomUUID fehlt ohne HTTPS.
    safeWrite(SESSION_KEY, `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`)
    tokenStore.save(auth)
  },
  clear() {
    for (const key of [ACCESS_KEY, REFRESH_KEY, USER_KEY, SESSION_KEY]) {
      try {
        localStorage.removeItem(key)
      } catch {
        /* privater Modus oder gesperrter Speicher - kein Grund abzustuerzen */
      }
    }
    window.dispatchEvent(new Event(SESSION_EVENT))
    void dropApiCache()
  },
  // Die Oberflaeche folgt dem Speicher, auch wenn ein anderer Tab oder ein
  // gescheiterter Refresh ihn aendert (D-07).
  subscribe(listener: () => void) {
    window.addEventListener(SESSION_EVENT, listener)
    window.addEventListener('storage', listener)
    return () => {
      window.removeEventListener(SESSION_EVENT, listener)
      window.removeEventListener('storage', listener)
    }
  },
}

// Ohne HTTPS gibt es weder Service Worker noch caches; dann passiert nichts (D-15).
async function dropApiCache() {
  if (typeof caches === 'undefined') return
  await caches.delete(API_CACHE).catch(() => false)
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
      let response: Response
      try {
        response = await fetch(`${BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
      } catch {
        // Derselbe Netzfehler wie in api(): derselbe Text (IN-04).
        throw new ApiError(UNREACHABLE, 0)
      }

      // Nur 400/401 heissen "Anmeldung ungueltig". Ein Limit oder ein kurzer
      // Serverausfall ist kein Grund, ein Kind abzumelden, und das detail der
      // urspruenglichen 401-Antwort beschreibt den eigentlichen Fehler nicht;
      // der Fehler geht ueber refreshInFlight an alle wartenden Aufrufer (FIX-01).
      // Die Generation ist der gespeicherte Token selbst: Eine Antwort, die nach
      // Abmelden, neuer Anmeldung oder einer Rotation in einem anderen Tab
      // eintrifft, aendert nichts (D-05, D-06).
      if (response.status === 400 || response.status === 401) {
        if (tokenStore.refresh === refreshToken) tokenStore.clear()
        return false
      }
      if (!response.ok) throw new ApiError(GENERIC, response.status)

      const auth = (await response.json()) as AuthResponse
      if (tokenStore.refresh !== refreshToken) return false
      tokenStore.save(auth)
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

  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    // fetch wirft nur bei Netzfehlern (auch offline), Status 0 wie bei XHR.
    throw new ApiError(UNREACHABLE, 0)
  }

  if (response.status === 401 && retryOn401 && (await refreshAccessToken())) {
    return api<T>(path, { ...options, retryOn401: false })
  }

  if (!response.ok) {
    throw await readError(response)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

async function readError(response: Response): Promise<ApiError> {
  // 5xx-Koerper koennen Technikdetails enthalten; die zeigen wir nicht an.
  if (response.status >= 500) return new ApiError(GENERIC, response.status)
  if (response.status === 429) return new ApiError(TOO_MANY, response.status)
  try {
    const problem = (await response.json()) as {
      detail?: string
      title?: string
      errors?: Record<string, string[]>
    }
    if (problem.detail) return new ApiError(problem.detail, response.status, problem.errors)
    if (problem.errors) {
      // Der title einer ValidationProblem-Antwort ist englisch, die Feldtexte sind es nicht.
      const messages = Object.values(problem.errors).flat().join(' ')
      return new ApiError(messages, response.status, problem.errors)
    }
    // Ohne detail/errors bleibt nur der englische Standardtitel ("Not Found") — nicht anzeigen.
    return new ApiError(GENERIC, response.status)
  } catch {
    return new ApiError(GENERIC, response.status)
  }
}
