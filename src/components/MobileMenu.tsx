import { useState } from 'react'
import { NavLink } from 'react-router-dom'

import { MOBILE_MORE_ITEMS } from '../app/navigation'
import { useI18n } from '../features/i18n/I18nContext'
import { NavGlyph } from './NavGlyph'

export function MobileMenu() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

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
        className="relative z-50 inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <NavGlyph name="more" className="h-3.5 w-3.5" />
        {t('nav.menu')}
      </button>
      {open ? (
        <div className="dt-glass absolute left-0 top-10 z-50 w-56 rounded-2xl p-1.5">
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">{t('nav.secondaryGroup')}</p>
          {MOBILE_MORE_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-tour={item.tourTarget}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs ${
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-white'
                }`
              }
            >
              <NavGlyph name={item.icon} className="h-3.5 w-3.5 shrink-0" />
              <span>{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  )
}
