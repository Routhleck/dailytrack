import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { PageHeader } from '../components/PageHeader'
import { useI18n } from '../features/i18n/I18nContext'
import { useDataRoot } from '../features/settings/DataRootContext'
import { emitTutorialOpen } from '../features/tutorial/tutorial.events'
import { useUpdater } from '../features/updater/UpdaterContext'
import { exportDataBundle, importDataBundle } from '../lib/fs/fileApi'
import { emitDataChanged } from '../lib/liveSync'

function parentPath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
  const index = normalized.lastIndexOf('/')
  if (index <= 0) {
    return normalized
  }

  return normalized.slice(0, index)
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

function isNestedPath(parent: string, child: string): boolean {
  if (!parent || !child) {
    return false
  }
  if (parent === child) {
    return false
  }
  return child.startsWith(`${parent}/`)
}

export function SettingsPage() {
  const { t } = useI18n()
  const {
    configured: updaterConfigured,
    resolved: updaterResolved,
    currentVersion,
    autoCheckEnabled,
    checking: updaterChecking,
    installing: updaterInstalling,
    update: availableUpdate,
    status: updaterStatus,
    error: updaterError,
    downloadPercent,
    setAutoCheckEnabled,
    checkForUpdates,
    installUpdate,
  } = useUpdater()
  const {
    baseDataRoot,
    dataRoot,
    activeProfile,
    migrateDataRoot,
    resetTrackerData,
    refresh,
    loading,
  } = useDataRoot()

  const defaultExportDir = useMemo(() => {
    if (!dataRoot) {
      return ''
    }
    return parentPath(dataRoot)
  }, [dataRoot])

  const [exportDir, setExportDir] = useState(defaultExportDir)
  const [exportMessage, setExportMessage] = useState('')
  const [exportBusy, setExportBusy] = useState(false)

  const [importSource, setImportSource] = useState('')
  const [overwriteImport, setOverwriteImport] = useState(true)
  const [importMessage, setImportMessage] = useState('')
  const [importBusy, setImportBusy] = useState(false)

  const [migrateTarget, setMigrateTarget] = useState('')
  const [overwriteMigrate, setOverwriteMigrate] = useState(false)
  const [migrateMessage, setMigrateMessage] = useState('')
  const [migrateBusy, setMigrateBusy] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resetMessage, setResetMessage] = useState('')
  const [resetBusy, setResetBusy] = useState(false)

  const normalizedBaseRoot = useMemo(() => normalizePath(baseDataRoot ?? ''), [baseDataRoot])
  const normalizedMigrateTarget = useMemo(() => normalizePath(migrateTarget.trim()), [migrateTarget])
  const migrateValidationMessage = useMemo(() => {
    if (!normalizedMigrateTarget || !normalizedBaseRoot) {
      return ''
    }
    if (normalizedMigrateTarget === normalizedBaseRoot) {
      return t('settings.migrateSame')
    }
    if (
      isNestedPath(normalizedBaseRoot, normalizedMigrateTarget) ||
      isNestedPath(normalizedMigrateTarget, normalizedBaseRoot)
    ) {
      return t('settings.migrateNested')
    }
    return ''
  }, [normalizedBaseRoot, normalizedMigrateTarget, t])

  useEffect(() => {
    if (!exportDir) {
      setExportDir(defaultExportDir)
    }
  }, [defaultExportDir, exportDir])

  useEffect(() => {
    if (!baseDataRoot || migrateTarget) {
      return
    }

    const suggested = baseDataRoot.replace(/life-tracker-data$/, 'dailytrack-data')
    setMigrateTarget(suggested === baseDataRoot ? `${baseDataRoot}-migrated` : suggested)
  }, [baseDataRoot, migrateTarget])

  async function handleExport(event: FormEvent) {
    event.preventDefault()

    if (!dataRoot) {
      setExportMessage(t('settings.dataRootNotReady'))
      return
    }

    const destination = exportDir.trim()
    if (!destination) {
      setExportMessage(t('settings.exportDestinationRequired'))
      return
    }

    setExportBusy(true)
    setExportMessage('')

    try {
      const bundlePath = await exportDataBundle(dataRoot, destination)
      setExportMessage(t('settings.exportCompleted', { path: bundlePath }))
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.exportFailed')
      setExportMessage(text)
    } finally {
      setExportBusy(false)
    }
  }

  async function handleMigrate(event: FormEvent) {
    event.preventDefault()

    if (!baseDataRoot) {
      setMigrateMessage(t('settings.dataRootNotReady'))
      return
    }

    const destination = migrateTarget.trim()
    if (!destination) {
      setMigrateMessage(t('settings.migrateDestinationRequired'))
      return
    }
    if (migrateValidationMessage) {
      setMigrateMessage(migrateValidationMessage)
      return
    }

    setMigrateBusy(true)
    setMigrateMessage('')

    try {
      await migrateDataRoot(destination, overwriteMigrate)
      setMigrateMessage(t('settings.migrateCompleted'))
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.migrateFailed')
      setMigrateMessage(text)
    } finally {
      setMigrateBusy(false)
    }
  }

  async function handleImport(event: FormEvent) {
    event.preventDefault()

    if (!dataRoot) {
      setImportMessage(t('settings.dataRootNotReady'))
      return
    }

    const source = importSource.trim()
    if (!source) {
      setImportMessage(t('settings.importSourceRequired'))
      return
    }

    setImportBusy(true)
    setImportMessage('')

    try {
      await importDataBundle(source, dataRoot, overwriteImport)
      await refresh()
      emitDataChanged({ scope: 'all' })
      setImportMessage(t('settings.importCompleted'))
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.importFailed')
      setImportMessage(text)
    } finally {
      setImportBusy(false)
    }
  }

  async function handleReset(event: FormEvent) {
    event.preventDefault()

    if (!baseDataRoot) {
      setResetMessage(t('settings.dataRootNotReady'))
      return
    }
    if (resetConfirmText.trim() !== 'RESET') {
      setResetMessage(t('settings.resetConfirmMismatch'))
      return
    }

    setResetBusy(true)
    setResetMessage('')

    try {
      await resetTrackerData()
      setResetConfirmText('')
      setResetMessage(t('settings.resetCompleted'))
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.resetFailed')
      setResetMessage(text)
    } finally {
      setResetBusy(false)
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={t('settings.title')}
        description={t('settings.description')}
      />

      <div className="max-w-3xl rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p>
          {t('settings.activeProfile')}: <span className="font-medium">{activeProfile || '-'}</span>
        </p>
        <p>
          {t('settings.baseDataRootPath')}: <span className="font-medium">{baseDataRoot || '-'}</span>
        </p>
        <p>
          {t('settings.activeProfileRoot')}: <span className="font-medium">{dataRoot || '-'}</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">{t('settings.migrateOnlyHint')}</p>
        <div className="mt-4 border-t border-slate-200 pt-3">
          <p className="text-sm font-medium text-slate-900">{t('settings.tutorial')}</p>
          <p className="mt-1 text-sm text-slate-600">{t('settings.tutorialDescription')}</p>
          <button
            type="button"
            className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-white"
            onClick={() => emitTutorialOpen('settings')}
          >
            {t('settings.startTutorial')}
          </button>
        </div>
      </div>

      <section className="max-w-3xl space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('settings.updater')}</h2>
        <p className="text-sm text-slate-600">{t('settings.updaterDescription')}</p>
        <p className="text-sm text-slate-700">
          {t('settings.currentVersion')}: <span className="font-medium">{currentVersion}</span>
        </p>
        <p className="text-sm text-slate-700">
          {t('settings.updaterConfigured')}:{' '}
          <span className={`font-medium ${updaterConfigured ? 'text-teal-700' : 'text-amber-700'}`}>
            {updaterResolved ? (updaterConfigured ? t('common.yes') : t('common.no')) : t('common.loading')}
          </span>
        </p>
        {!updaterConfigured && updaterResolved ? (
          <p className="text-sm text-amber-700">{t('updater.notConfigured')}</p>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={autoCheckEnabled}
            onChange={(event) => setAutoCheckEnabled(event.target.checked)}
            disabled={!updaterConfigured || updaterInstalling}
          />
          {t('settings.autoCheckUpdates')}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            disabled={!updaterConfigured || updaterChecking || updaterInstalling}
            onClick={() => void checkForUpdates(true)}
          >
            {updaterChecking ? t('updater.checking') : t('settings.checkUpdatesNow')}
          </button>
          {availableUpdate ? (
            <button
              type="button"
              className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={updaterInstalling || updaterChecking}
              onClick={() => void installUpdate()}
            >
              {updaterInstalling ? t('updater.installing') : t('updater.installAndRestart')}
            </button>
          ) : null}
        </div>
        {downloadPercent != null ? (
          <p className="text-sm text-slate-700">{t('updater.downloadProgress', { percent: downloadPercent })}</p>
        ) : null}
        {availableUpdate ? (
          <p className="text-sm text-slate-700">
            {t('settings.latestVersion')}: <span className="font-medium">{availableUpdate.version}</span>
          </p>
        ) : null}
        {updaterStatus ? <p className="text-sm text-slate-700">{updaterStatus}</p> : null}
        {updaterError ? <p className="text-sm text-rose-700">{updaterError}</p> : null}
      </section>

      <form onSubmit={handleMigrate} className="max-w-3xl space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('settings.migrateDataRoot')}</h2>
        <p className="text-sm text-slate-600">
          {t('settings.migrateDescription')}
        </p>
        <label className="block text-sm font-medium text-slate-700" htmlFor="migrate-target">
          {t('settings.migrateDestination')}
        </label>
        <input
          id="migrate-target"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
          value={migrateTarget}
          onChange={(event) => setMigrateTarget(event.target.value)}
          placeholder="/Users/you/dailytrack-data"
          disabled={loading || migrateBusy}
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={overwriteMigrate}
            onChange={(event) => setOverwriteMigrate(event.target.checked)}
            disabled={loading || migrateBusy}
          />
          {t('settings.overwriteConflicts')}
        </label>
        <button
          type="submit"
          disabled={loading || migrateBusy || !migrateTarget.trim() || Boolean(migrateValidationMessage)}
          className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {migrateBusy ? t('settings.migrating') : t('settings.migrateAndSwitch')}
        </button>
        {migrateValidationMessage ? <p className="text-sm text-rose-700">{migrateValidationMessage}</p> : null}
        {migrateMessage ? <p className="break-all text-sm text-slate-600">{migrateMessage}</p> : null}
      </form>

      <form onSubmit={handleExport} className="max-w-3xl space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('settings.exportData')}</h2>
        <p className="text-sm text-slate-600">
          {t('settings.exportDescription')}
        </p>
        <label className="block text-sm font-medium text-slate-700" htmlFor="export-dir">
          {t('settings.exportDestination')}
        </label>
        <input
          id="export-dir"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
          value={exportDir}
          onChange={(event) => setExportDir(event.target.value)}
          placeholder="/Users/you/Desktop"
          disabled={loading || exportBusy}
        />
        <button
          type="submit"
          disabled={loading || exportBusy}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {exportBusy ? t('settings.exporting') : t('settings.export')}
        </button>
        {exportMessage ? <p className="break-all text-sm text-slate-600">{exportMessage}</p> : null}
      </form>

      <form onSubmit={handleImport} className="max-w-3xl space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('settings.importData')}</h2>
        <p className="text-sm text-slate-600">
          {t('settings.importDescription')}
        </p>
        <label className="block text-sm font-medium text-slate-700" htmlFor="import-source">
          {t('settings.importSource')}
        </label>
        <input
          id="import-source"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
          value={importSource}
          onChange={(event) => setImportSource(event.target.value)}
          placeholder="/Users/you/Desktop/dailytrack-export-123456789"
          disabled={loading || importBusy}
        />

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={overwriteImport}
            onChange={(event) => setOverwriteImport(event.target.checked)}
            disabled={loading || importBusy}
          />
          {t('settings.overwriteExisting')}
        </label>

        <button
          type="submit"
          disabled={loading || importBusy}
          className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {importBusy ? t('settings.importing') : t('settings.import')}
        </button>
        {importMessage ? <p className="break-all text-sm text-slate-600">{importMessage}</p> : null}
      </form>

      <form onSubmit={handleReset} className="max-w-3xl space-y-3 rounded-lg border border-rose-300 bg-rose-50/40 p-4">
        <h2 className="text-base font-semibold text-rose-800">{t('settings.resetSection')}</h2>
        <p className="text-sm text-rose-700">{t('settings.resetDescription')}</p>
        <p className="break-all text-xs text-rose-700">
          {t('settings.resetTarget')}: {baseDataRoot || '-'}
        </p>

        <label className="block text-sm font-medium text-rose-800" htmlFor="reset-confirm">
          {t('settings.resetTypeToConfirm')}
        </label>
        <input
          id="reset-confirm"
          className="w-full rounded-md border border-rose-300 bg-white px-3 py-2 text-sm shadow-sm"
          value={resetConfirmText}
          onChange={(event) => setResetConfirmText(event.target.value)}
          placeholder="RESET"
          disabled={loading || resetBusy}
        />

        <button
          type="submit"
          disabled={loading || resetBusy || resetConfirmText.trim() !== 'RESET'}
          className="rounded-md bg-rose-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {resetBusy ? t('settings.resetting') : t('settings.resetAction')}
        </button>
        {resetMessage ? <p className="break-all text-sm text-rose-800">{resetMessage}</p> : null}
      </form>
    </section>
  )
}
