import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import type { MobileGroupItem } from '../app/navigation'
import { useI18n } from '../features/i18n/I18nContext'
import { NavGlyph } from './NavGlyph'

function isPathMatch(pathname: string, target: string, end?: boolean): boolean {
  if (end) {
    return pathname === target
  }
  return pathname === target || pathname.startsWith(`${target}/`)
}

type MobileGroupSheetProps = {
  open: boolean
  hidden?: boolean
  title: string
  description: string
  items: MobileGroupItem[]
  onClose: () => void
}

export function MobileGroupSheet({ open, hidden = false, title, description, items, onClose }: MobileGroupSheetProps) {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open || hidden) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        aria-label={t('common.cancelEdit')}
        className="absolute inset-0 bg-slate-950/35"
        onClick={onClose}
      />

      <section className="dt-glass absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] rounded-2xl p-2.5">
        <header className="px-2 pb-2">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-600">{description}</p>
        </header>

        <ul className="space-y-1">
          {items.map((item) => {
            const active = isPathMatch(location.pathname, item.to, item.end)
            return (
              <li key={item.to}>
                <button
                  type="button"
                  data-tour={item.tourTarget}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition ${
                    active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-white/80'
                  }`}
                  onClick={() => {
                    onClose()
                    if (location.pathname !== item.to) {
                      navigate(item.to)
                    }
                  }}
                >
                  <NavGlyph name={item.icon} className="h-4 w-4 shrink-0" />
                  <span>{t(item.labelKey)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
