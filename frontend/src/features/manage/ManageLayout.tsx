import { BookOpen, KeyRound, LayoutDashboard, LogOut, Plus } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const tabs = [
  { to: '/verwalten', end: true, label: 'Vokabeln', icon: BookOpen },
  { to: '/verwalten/fortschritt', end: false, label: 'Fortschritt', icon: LayoutDashboard },
  { to: '/verwalten/konto', end: false, label: 'Konto', icon: KeyRound },
]

// "+" neben der Tab-Leiste: Ziel und zugaenglicher Name je Seite; ohne Eintrag kein "+".
const createActions: Record<string, { to: string; label: string }> = {
  '/verwalten': { to: '/verwalten?neu=1', label: 'Neues Set' },
}

export function ManageLayout() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const create = createActions[pathname]

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-screen-margin pt-screen-top safe-top safe-bottom">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="type-large-title">WordQuest</h1>
          {/* text-ink statt ink-soft: steht direkt auf dem Backdrop (ink-soft auf backdrop-blue unter 4,5:1). */}
          <p className="type-body-md break-words text-ink">{user?.displayName}</p>
        </div>
        <Button variant="round" size="icon" aria-label="Abmelden" onClick={() => void logout()}>
          <LogOut className="size-5" aria-hidden />
        </Button>
      </header>

      {/* Innenabstand = Leistenhoehe plus float-bottom; gleicher Wert als scroll-padding in index.css. */}
      <main className="flex-1 pb-(--wq-tab-bar-clearance)">
        <Outlet />
      </main>

      <div className="sticky bottom-float-bottom flex items-center gap-2">
        <nav aria-label="Bereiche" className="glass flex min-w-0 flex-1 flex-wrap gap-2 rounded-full p-2">
          {tabs.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex h-13 flex-1 flex-col items-center justify-center gap-1 rounded-full px-4 type-label-tab transition',
                  isActive ? 'glass-selected text-primary' : 'text-ink hover:bg-glass-clear',
                )
              }
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        {create ? (
          <Button asChild variant="roundPrimary" size="icon" className="size-16 shrink-0">
            <Link to={create.to} aria-label={create.label}>
              <Plus className="size-6" aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
