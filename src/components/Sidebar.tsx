import { NavLink } from 'react-router-dom'

import { PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS } from '../app/navigation'
import { useI18n } from '../features/i18n/I18nContext'
import appLogo from '../assets/dailytrack-logo.png'
import { NavGlyph } from './NavGlyph'

export function Sidebar() {
  const { t } = useI18n()

  return (
    <aside className="h-full w-72 shrink-0 pr-4">
      <div className="dt-panel-soft flex h-full flex-col px-3 py-4">
        <div className="mb-5 flex items-center gap-3 px-2">
          <img src={appLogo} alt="DailyTrack logo" className="h-9 w-9 rounded-xl border border-slate-200/80 bg-white p-1 shadow-sm" />
          <div>
            <p className="text-base font-semibold text-slate-900">DailyTrack</p>
            <p className="text-xs text-slate-500">{t('nav.main')}</p>
          </div>
        </div>

        <div className="px-2 pb-2">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{t('nav.primaryGroup')}</p>
          <nav className="space-y-1">
            {PRIMARY_NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                data-tour={item.tourTarget}
                className={({ isActive }) =>
                  `group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-white hover:text-slate-900 hover:translate-x-0.5'
                  }`
                }
              >
                <NavGlyph
                  name={item.icon}
                  className="h-4 w-4 shrink-0 text-current opacity-85"
                />
                <span>{t(item.labelKey)}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="mt-4 px-2 pb-2">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{t('nav.secondaryGroup')}</p>
          <nav className="space-y-1">
            {SECONDARY_NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                data-tour={item.tourTarget}
                className={({ isActive }) =>
                  `group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-white hover:text-slate-900 hover:translate-x-0.5'
                  }`
                }
              >
                <NavGlyph
                  name={item.icon}
                  className="h-4 w-4 shrink-0 text-current opacity-85"
                />
                <span>{t(item.labelKey)}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  )
}
