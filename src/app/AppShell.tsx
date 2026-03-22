import { Link, Outlet } from 'react-router-dom'

import { BottomNav } from '../components/BottomNav'
import { InitialTemplateSetupModal } from '../components/InitialTemplateSetupModal'
import { MobileMenu } from '../components/MobileMenu'
import { useI18n } from '../features/i18n/I18nContext'
import { usePreferences } from '../features/preferences/PreferencesContext'
import { Sidebar } from '../components/Sidebar'
import { useDataRoot } from '../features/settings/DataRootContext'
import { TutorialGuide } from '../features/tutorial/TutorialGuide'
import { useUpdater } from '../features/updater/UpdaterContext'
import { useSyncStatus } from '../features/webdav/useSyncStatus'

export function AppShell() {
  const { t, language, setLanguage } = useI18n()
  const { preferences } = usePreferences()
  const { baseDataRoot, dataRoot, activeProfile, needsInitialTemplateSetup, loading, error } = useDataRoot()
  const { isBannerVisible, update, installUpdate, installing, dismissUpdate } = useUpdater()
  const syncSnapshot = useSyncStatus()
  const showMobileSyncBanner = preferences.ui.mobile.showSyncBanner

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
    <div className="h-[100dvh] overflow-hidden bg-slate-100 text-slate-900">
      <div className="mx-auto flex h-full max-w-[1400px] bg-white md:border-x md:border-slate-200 md:shadow-sm">
        <div className="hidden md:block">
          <Sidebar />
        </div>
        <main className="min-w-0 flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+5rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] md:px-8 md:py-6 md:pb-8">
          <div className="mb-3 flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 md:hidden">
            <div className="flex items-center gap-2">
              <MobileMenu />
              <p className="text-sm font-semibold text-slate-900">DailyTrack</p>
            </div>
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
          {showMobileSyncBanner ? (
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
          ) : null}
          {isBannerVisible && update ? (
            <div className="mb-4 rounded-md border border-teal-300 bg-teal-50 px-4 py-3 text-sm text-teal-900">
              <p className="font-medium">
                {t('updater.available', { version: update.version })}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                  disabled={installing}
                  onClick={() => void installUpdate()}
                >
                  {installing ? t('updater.installing') : t('updater.installAndRestart')}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-teal-400 px-3 py-1.5 text-xs text-teal-900"
                  onClick={dismissUpdate}
                  disabled={installing}
                >
                  {t('updater.later')}
                </button>
              </div>
            </div>
          ) : null}
          <div className="mb-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            {loading && t('shell.initializing')}
            {!loading &&
              !error &&
              `${t('shell.base')}: ${baseDataRoot} | ${t('shell.profile')}: ${activeProfile} | ${t('shell.activeRoot')}: ${dataRoot}`}
            {!loading && error && `${t('shell.initError')}: ${error}`}
          </div>
          <Outlet />
        </main>
      </div>
      <BottomNav />
      {needsInitialTemplateSetup ? <InitialTemplateSetupModal /> : null}
      <TutorialGuide blocked={loading || needsInitialTemplateSetup || Boolean(error)} />
    </div>
  )
}
