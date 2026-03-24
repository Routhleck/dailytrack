import { NavLink } from 'react-router-dom'

import { PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS } from '../app/navigation'
import { useI18n } from '../features/i18n/I18nContext'
import appLogo from '../assets/dailytrack-logo.png'
import { NavGlyph } from './NavGlyph'

export function Sidebar() {
  const { language, setLanguage, t } = useI18n()

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
                  `group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-white hover:text-slate-900'
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
                  `group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-white hover:text-slate-900'
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

        <div className="mt-auto px-2">
          <p className="mb-1 text-xs text-slate-500">{t('nav.language')}</p>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white/85 p-1">
            <button
              type="button"
              className={`rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                language === 'en' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
              onClick={() => setLanguage('en')}
            >
              {t('nav.languageEn')}
            </button>
            <button
              type="button"
              className={`rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                language === 'zh' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
              onClick={() => setLanguage('zh')}
            >
              {t('nav.languageZh')}
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
