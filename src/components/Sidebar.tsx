import { NavLink } from 'react-router-dom'

import { useI18n } from '../features/i18n/I18nContext'

export function Sidebar() {
  const { language, setLanguage, t } = useI18n()

  const navItems = [
    { to: '/', label: t('nav.dashboard') },
    { to: '/today', label: t('nav.today') },
    { to: '/week', label: t('nav.thisWeek') },
    { to: '/daily', label: t('nav.dailyNotes') },
    { to: '/weekly', label: t('nav.weeklyNotes') },
    { to: '/body', label: t('nav.bodyProgress') },
    { to: '/profiles', label: t('nav.profiles') },
    { to: '/preferences', label: t('nav.preferences') },
    { to: '/settings', label: t('nav.settings') },
  ]

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-slate-50 px-4 py-6">
      <p className="mb-6 text-lg font-semibold text-slate-900">DailyTrack</p>
      <div className="mb-4 rounded-md border border-slate-200 bg-white p-2">
        <p className="mb-1 text-xs text-slate-600">{t('nav.language')}</p>
        <div className="flex gap-1">
          <button
            type="button"
            className={`rounded px-2 py-1 text-xs ${
              language === 'en' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
            }`}
            onClick={() => setLanguage('en')}
          >
            {t('nav.languageEn')}
          </button>
          <button
            type="button"
            className={`rounded px-2 py-1 text-xs ${
              language === 'zh' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
            }`}
            onClick={() => setLanguage('zh')}
          >
            {t('nav.languageZh')}
          </button>
        </div>
      </div>
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
