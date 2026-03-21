import { useState } from 'react'
import { NavLink } from 'react-router-dom'

import { useI18n } from '../features/i18n/I18nContext'

export function MobileMenu() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  const navItems = [
    { to: '/', label: t('nav.dashboard') },
    { to: '/daily', label: t('nav.dailyNotes') },
    { to: '/weekly', label: t('nav.weeklyNotes') },
    { to: '/reports', label: t('nav.reports') },
    { to: '/profiles', label: t('nav.profiles') },
    { to: '/preferences', label: t('nav.preferences') },
    { to: '/settings', label: t('nav.settings') },
  ]

  return (
    <div className="relative md:hidden">
      {open ? (
        <button
          type="button"
          aria-label={t('nav.menu')}
          className="fixed inset-0 z-40 bg-transparent"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <button
        type="button"
        className="relative z-50 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {t('nav.menu')}
      </button>
      {open ? (
        <div className="absolute left-0 top-9 z-50 w-48 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block rounded px-2 py-1.5 text-xs ${
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  )
}
