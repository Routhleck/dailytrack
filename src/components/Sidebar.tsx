import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/today', label: 'Today' },
  { to: '/week', label: 'This Week' },
  { to: '/daily', label: 'Daily Notes' },
  { to: '/weekly', label: 'Weekly Notes' },
  { to: '/body', label: 'Body Progress' },
  { to: '/profiles', label: 'Profiles' },
  { to: '/preferences', label: 'Preferences' },
  { to: '/settings', label: 'Settings' },
]

export function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-slate-50 px-4 py-6">
      <p className="mb-6 text-lg font-semibold text-slate-900">DailyTrack</p>
      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `block rounded-md px-3 py-2 text-sm ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
