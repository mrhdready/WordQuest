import { BookOpen, LayoutDashboard, LogOut } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const tabs = [
  { to: '/verwalten', end: true, label: 'Vokabeln', icon: BookOpen },
  { to: '/verwalten/fortschritt', end: false, label: 'Fortschritt', icon: LayoutDashboard },
]

export function ManageLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 py-6 safe-top safe-bottom">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">WordQuest</h1>
          <p className="text-sm text-ink-soft">{user?.displayName}</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Abmelden" onClick={() => void logout()}>
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      <nav className="mb-6 flex gap-2">
        {tabs.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex touch-target items-center gap-2 rounded-2xl px-4 text-sm font-semibold transition',
                isActive
                  ? 'bg-brand text-white'
                  : 'bg-surface-raised text-ink-soft hover:bg-brand-soft',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}
