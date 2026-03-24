import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import {
  MOBILE_HISTORY_ITEMS,
  MOBILE_RECORD_ITEMS,
  MOBILE_TABS,
  type MobileSheetKey,
  getActiveMobileTab,
} from '../app/navigation'
import { useI18n } from '../features/i18n/I18nContext'
import { useMobileKeyboardState } from '../features/mobile/useMobileKeyboardState'
import { MobileGroupSheet } from './MobileGroupSheet'
import { NavGlyph } from './NavGlyph'

export function BottomNav() {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const [openSheet, setOpenSheet] = useState<MobileSheetKey | null>(null)
  const { isKeyboardOpen } = useMobileKeyboardState()
  const activeTab = getActiveMobileTab(location.pathname)
  const highlightedTab = openSheet ?? activeTab

  const sheetTitle = useMemo(() => {
    if (openSheet === 'record') {
      return t('mobile.recordTitle')
    }
    if (openSheet === 'history') {
      return t('mobile.historyTitle')
    }
    return ''
  }, [openSheet, t])

  const sheetDescription = useMemo(() => {
    if (openSheet === 'record') {
      return t('mobile.recordDescription')
    }
    if (openSheet === 'history') {
      return t('mobile.historyDescription')
    }
    return ''
  }, [openSheet, t])

  const sheetItems = openSheet === 'record' ? MOBILE_RECORD_ITEMS : MOBILE_HISTORY_ITEMS

  return (
    <>
      <MobileGroupSheet
        open={Boolean(openSheet)}
        hidden={isKeyboardOpen}
        title={sheetTitle}
        description={sheetDescription}
        items={sheetItems}
        onClose={() => setOpenSheet(null)}
      />

      <nav
        className={`fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-1 transition-all duration-200 md:hidden ${
          isKeyboardOpen ? 'pointer-events-none translate-y-4 opacity-0' : 'translate-y-0 opacity-100'
        }`}
      >
        <ul className="dt-glass grid grid-cols-4 gap-0.5 rounded-2xl px-1 py-1.5">
          {MOBILE_TABS.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                data-tour={item.tourTarget}
                aria-pressed={highlightedTab === item.key}
                className={`block w-full rounded-xl px-1 py-1.5 text-center transition-all duration-200 ${
                  highlightedTab === item.key
                    ? 'scale-[1.02] bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white/90'
                }`}
                onClick={() => {
                  if (item.kind === 'route') {
                    setOpenSheet(null)
                    if (location.pathname !== item.to) {
                      navigate(item.to)
                    }
                    return
                  }
                  setOpenSheet((current) => (current === item.sheet ? null : item.sheet))
                }}
              >
                <span className="mx-auto mb-0.5 block w-fit">
                  <NavGlyph name={item.icon} className="h-4 w-4" />
                </span>
                <span className="block text-[10px] leading-tight">{t(item.labelKey)}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
