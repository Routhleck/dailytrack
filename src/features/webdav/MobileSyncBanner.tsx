import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useI18n } from '../i18n/I18nContext'
import { useSyncStatus } from './useSyncStatus'

const MOBILE_MEDIA_QUERY = '(max-width: 767px)'

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_MEDIA_QUERY).matches)

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY)
    const onChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches)
    }

    mediaQuery.addEventListener('change', onChange)
    return () => {
      mediaQuery.removeEventListener('change', onChange)
    }
  }, [])

  return isMobile
}

function MobileSyncBannerContent() {
  const { t } = useI18n()
  const syncSnapshot = useSyncStatus()

  const mobileSyncLabel = (() => {
    if (!syncSnapshot.online) {
      return t('mobileSync.offline')
    }
    if (!syncSnapshot.webdavEnabled) {
      return t('mobileSync.disabled')
    }
    if (syncSnapshot.status?.conflictsCount) {
      return t('mobileSync.conflicts', { count: syncSnapshot.status.conflictsCount })
    }
    if (syncSnapshot.status?.pendingChanges) {
      return t('mobileSync.pending', { count: syncSnapshot.status.pendingChanges })
    }
    return t('mobileSync.synced')
  })()

  const mobileSyncNext = !syncSnapshot.webdavEnabled || !syncSnapshot.autoPullEnabled
    ? t('mobileSync.autoPullOff')
    : syncSnapshot.nextAutoPullInSec == null || syncSnapshot.nextAutoPullInSec <= 0
      ? t('mobileSync.nextNow')
      : t('mobileSync.nextIn', { seconds: syncSnapshot.nextAutoPullInSec })

  return (
    <Link
      to="/sync"
      className="mb-3 block rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 md:hidden"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate">
          {t('mobileSync.title')}: {mobileSyncLabel}
        </p>
        <span className="text-[11px] text-slate-500">{mobileSyncNext}</span>
      </div>
      {syncSnapshot.error ? <p className="mt-1 text-[11px] text-rose-700">{syncSnapshot.error}</p> : null}
    </Link>
  )
}

export function MobileSyncBanner({ enabled }: { enabled: boolean }) {
  const isMobile = useIsMobileViewport()

  if (!enabled || !isMobile) {
    return null
  }

  return <MobileSyncBannerContent />
}
