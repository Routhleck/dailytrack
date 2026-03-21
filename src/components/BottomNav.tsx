import { NavLink } from 'react-router-dom'

import { useI18n } from '../features/i18n/I18nContext'

export function BottomNav() {
  const { t } = useI18n()

  const navItems = [
    { to: '/today', label: t('nav.today'), tourTarget: 'nav-today' },
    { to: '/week', label: t('nav.thisWeek'), tourTarget: 'nav-week' },
    { to: '/body', label: t('nav.bodyProgress'), tourTarget: 'nav-body' },
    { to: '/sync', label: t('nav.sync') },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur md:hidden">
      <ul className="grid grid-cols-4 gap-1">
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              data-tour={item.tourTarget}
              className={({ isActive }) =>
                `block rounded-md px-2 py-2 text-center text-xs ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
