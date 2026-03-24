import { Link, Outlet, useLocation } from 'react-router-dom'

import { BottomNav } from '../components/BottomNav'
import { InitialTemplateSetupModal } from '../components/InitialTemplateSetupModal'
import { MobileMenu } from '../components/MobileMenu'
import { useI18n } from '../features/i18n/I18nContext'
import { usePreferences } from '../features/preferences/PreferencesContext'
import { Sidebar } from '../components/Sidebar'
import { useDataRoot } from '../features/settings/DataRootContext'
import { TutorialGuide } from '../features/tutorial/TutorialGuide'
import { useUpdater } from '../features/updater/UpdaterContext'
import { MobileSyncBanner } from '../features/webdav/MobileSyncBanner'

export function AppShell() {
  const { t, language, setLanguage } = useI18n()
  const { preferences } = usePreferences()
  const { activeProfile, needsInitialTemplateSetup, loading, error } = useDataRoot()
  const { isBannerVisible, update, installUpdate, installing, dismissUpdate } = useUpdater()
  const showMobileSyncBanner = preferences.ui.mobile.showSyncBanner
  const location = useLocation()

  return (
    <div className="dt-shell-bg h-[100dvh] overflow-hidden text-slate-900">
      <div className="mx-auto flex h-full max-w-[1520px] p-3 md:p-5">
        <div className="hidden h-full md:block">
          <Sidebar />
        </div>

        <div className="dt-glass relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[24px]">
          <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/75 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MobileMenu />
                <p className="text-sm font-semibold tracking-wide text-slate-800 md:text-base">DailyTrack</p>
                {activeProfile ? (
                  <span className="dt-badge hidden sm:inline-flex">
                    {t('shell.profile')}: {activeProfile}
                  </span>
                ) : null}
                {loading ? <span className="dt-badge">{t('shell.initializing')}</span> : null}
              </div>

              <div data-tour="shell-language" className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white/85 p-1">
                <button
                  type="button"
                  className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
                    language === 'en' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  onClick={() => setLanguage('en')}
                >
                  {t('nav.languageEn')}
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
                    language === 'zh' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  onClick={() => setLanguage('zh')}
                >
                  {t('nav.languageZh')}
                </button>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <main className="mx-auto w-full max-w-[1140px] px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-4 md:px-8 md:pb-8 md:pt-6">
              {error ? (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  <span>{t('shell.initError')}: {error}</span>
                  <Link className="ml-2 font-medium underline" to="/settings">
                    {t('nav.settings')}
                  </Link>
                </div>
              ) : null}

              <MobileSyncBanner enabled={showMobileSyncBanner} />

              {isBannerVisible && update ? (
                <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
                  <p className="font-medium">
                    {t('updater.available', { version: update.version })}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      className="dt-btn dt-btn-primary"
                      disabled={installing}
                      onClick={() => void installUpdate()}
                    >
                      {installing ? t('updater.installing') : t('updater.installAndRestart')}
                    </button>
                    <button
                      type="button"
                      className="dt-btn dt-btn-secondary"
                      onClick={dismissUpdate}
                      disabled={installing}
                    >
                      {t('updater.later')}
                    </button>
                  </div>
                </div>
              ) : null}

              <div key={location.pathname} className="dt-route-enter">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </div>
      <BottomNav />
      {needsInitialTemplateSetup ? <InitialTemplateSetupModal /> : null}
      <TutorialGuide blocked={loading || needsInitialTemplateSetup || Boolean(error)} />
    </div>
  )
}
