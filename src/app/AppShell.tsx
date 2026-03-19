import { Outlet } from 'react-router-dom'

import { InitialTemplateSetupModal } from '../components/InitialTemplateSetupModal'
import { useI18n } from '../features/i18n/I18nContext'
import { Sidebar } from '../components/Sidebar'
import { useDataRoot } from '../features/settings/DataRootContext'
import { TutorialGuide } from '../features/tutorial/TutorialGuide'
import { useUpdater } from '../features/updater/UpdaterContext'

export function AppShell() {
  const { t } = useI18n()
  const { baseDataRoot, dataRoot, activeProfile, needsInitialTemplateSetup, loading, error } = useDataRoot()
  const { isBannerVisible, update, installUpdate, installing, dismissUpdate } = useUpdater()

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1400px] border-x border-slate-200 bg-white shadow-sm">
        <Sidebar />
        <main className="flex-1 px-8 py-6">
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
      {needsInitialTemplateSetup ? <InitialTemplateSetupModal /> : null}
      <TutorialGuide blocked={loading || needsInitialTemplateSetup || Boolean(error)} />
    </div>
  )
}
