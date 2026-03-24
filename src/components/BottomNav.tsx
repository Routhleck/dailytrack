import { NavLink } from 'react-router-dom'

import { MOBILE_TAB_ITEMS } from '../app/navigation'
import { useI18n } from '../features/i18n/I18nContext'
import { NavGlyph } from './NavGlyph'

export function BottomNav() {
  const { t } = useI18n()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-1 md:hidden">
      <ul className="dt-glass grid grid-cols-5 gap-0.5 rounded-2xl px-1 py-1.5">
        {MOBILE_TAB_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              data-tour={item.tourTarget}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-xl px-1 py-1.5 text-center ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-white/90'
                }`
              }
            >
              <span className="mx-auto mb-0.5 block w-fit">
                <NavGlyph name={item.icon} className="h-4 w-4" />
              </span>
              <span className="block text-[10px] leading-tight">{t(item.labelKey)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
