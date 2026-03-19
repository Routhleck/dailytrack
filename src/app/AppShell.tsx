import { Outlet } from 'react-router-dom'

import { InitialTemplateSetupModal } from '../components/InitialTemplateSetupModal'
import { useI18n } from '../features/i18n/I18nContext'
import { Sidebar } from '../components/Sidebar'
import { useDataRoot } from '../features/settings/DataRootContext'
import { TutorialGuide } from '../features/tutorial/TutorialGuide'

export function AppShell() {
  const { t } = useI18n()
  const { baseDataRoot, dataRoot, activeProfile, needsInitialTemplateSetup, loading, error } = useDataRoot()

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1400px] border-x border-slate-200 bg-white shadow-sm">
        <Sidebar />
        <main className="flex-1 px-8 py-6">
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
