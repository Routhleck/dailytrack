import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { PageHeader } from '../components/PageHeader'
import { useI18n } from '../features/i18n/I18nContext'
import { useDataRoot } from '../features/settings/DataRootContext'
import { emitTutorialOpen } from '../features/tutorial/tutorial.events'
import { useUpdater } from '../features/updater/UpdaterContext'
import {
  deleteWebdavSnapshot,
  exportDataBundle,
  getWebdavConfig,
  importDataBundle,
  listWebdavSnapshots,
  pullWebdavSnapshot,
  pushWebdavSnapshot,
  saveWebdavConfig,
  testWebdavConnection,
  type CopySummary,
  type WebdavConfig,
  type WebdavSnapshot,
} from '../lib/fs/fileApi'
import { emitDataChanged } from '../lib/liveSync'
import {
  defaultWebdavConfig,
  formatSnapshotSize,
  formatSnapshotTime,
  normalizeWebdavConfig,
} from '../features/webdav/webdav.service'

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

function formatCopySummary(
  summary: CopySummary,
  t: (key: 'settings.copySummary', params: Record<string, string | number>) => string,
): string {
  return t('settings.copySummary', {
    copied: summary.copiedFiles,
    overwritten: summary.overwrittenFiles,
    skipped: summary.skippedFiles,
    dirs: summary.createdDirs,
  })
}

type WebdavNumericField = 'autoPushIntervalMin' | 'requestTimeoutSec' | 'maxSnapshots'
type WebdavTextField = 'remoteBaseUrl' | 'username' | 'password'

function webdavConfigSignature(config: WebdavConfig): string {
  return JSON.stringify(normalizeWebdavConfig(config))
}

export function SettingsPage() {
  const { t } = useI18n()
  const {
    supported: updaterSupported,
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

  const [webdavConfig, setWebdavConfig] = useState<WebdavConfig>(defaultWebdavConfig())
  const [webdavSnapshots, setWebdavSnapshots] = useState<WebdavSnapshot[]>([])
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('')
  const [webdavMessage, setWebdavMessage] = useState('')
  const [webdavConfigMessage, setWebdavConfigMessage] = useState('')
  const [webdavLoading, setWebdavLoading] = useState(true)
  const [webdavSaving, setWebdavSaving] = useState(false)
  const [webdavTesting, setWebdavTesting] = useState(false)
  const [webdavPushing, setWebdavPushing] = useState(false)
  const [webdavPulling, setWebdavPulling] = useState(false)
  const [webdavRefreshing, setWebdavRefreshing] = useState(false)
  const [webdavDeleting, setWebdavDeleting] = useState(false)
  const [webdavSnapshotNote, setWebdavSnapshotNote] = useState('')
  const [webdavBackupBeforePull, setWebdavBackupBeforePull] = useState(true)
  const webdavSaveTimerRef = useRef<number | null>(null)
  const webdavLastSavedSignatureRef = useRef('')

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

  function clearWebdavSaveTimer() {
    if (webdavSaveTimerRef.current != null) {
      window.clearTimeout(webdavSaveTimerRef.current)
      webdavSaveTimerRef.current = null
    }
  }

  async function persistWebdavConfig(showSavedMessage = true): Promise<boolean> {
    const normalized = normalizeWebdavConfig(webdavConfig)
    const signature = webdavConfigSignature(normalized)
    if (signature === webdavLastSavedSignatureRef.current) {
      return true
    }

    setWebdavSaving(true)
    try {
      const saved = normalizeWebdavConfig(await saveWebdavConfig(normalized))
      const savedSignature = webdavConfigSignature(saved)
      webdavLastSavedSignatureRef.current = savedSignature
      setWebdavConfig((current) => (webdavConfigSignature(current) === savedSignature ? current : saved))
      emitDataChanged({ scope: 'settings' })
      if (showSavedMessage) {
        setWebdavConfigMessage(t('settings.webdavAutosaved'))
      }
      return true
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.webdavSaveFailed')
      setWebdavConfigMessage(text)
      return false
    } finally {
      setWebdavSaving(false)
    }
  }

  async function ensureWebdavConfigSaved(): Promise<boolean> {
    clearWebdavSaveTimer()
    return persistWebdavConfig(false)
  }

  async function refreshWebdavSnapshots(skipSave = false) {
    setWebdavRefreshing(true)
    try {
      if (!skipSave) {
        const saved = await ensureWebdavConfigSaved()
        if (!saved) {
          return
        }
      }
      const snapshots = await listWebdavSnapshots()
      setWebdavSnapshots(snapshots)
      if (snapshots.length === 0) {
        setSelectedSnapshotId('')
      } else if (!snapshots.some((item) => item.id === selectedSnapshotId)) {
        setSelectedSnapshotId(snapshots[0].id)
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.webdavListFailed')
      setWebdavMessage(text)
    } finally {
      setWebdavRefreshing(false)
    }
  }

  useEffect(() => {
    let disposed = false

    void (async () => {
      try {
        const loaded = await getWebdavConfig()
        if (!disposed) {
          const normalized = normalizeWebdavConfig(loaded)
          setWebdavConfig(normalized)
          webdavLastSavedSignatureRef.current = webdavConfigSignature(normalized)
          await refreshWebdavSnapshots(true)
        }
      } catch (error) {
        if (!disposed) {
          const text = error instanceof Error ? error.message : t('settings.webdavLoadFailed')
          setWebdavMessage(text)
        }
      } finally {
        if (!disposed) {
          setWebdavLoading(false)
        }
      }
    })()

    return () => {
      disposed = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (webdavLoading) {
      return
    }

    const signature = webdavConfigSignature(webdavConfig)
    if (signature === webdavLastSavedSignatureRef.current) {
      return
    }

    setWebdavConfigMessage(t('settings.webdavAutosaving'))
    clearWebdavSaveTimer()
    webdavSaveTimerRef.current = window.setTimeout(() => {
      void persistWebdavConfig(true)
    }, 700)

    return clearWebdavSaveTimer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webdavConfig, webdavLoading, t])

  useEffect(
    () => () => {
      if (webdavSaveTimerRef.current != null) {
        window.clearTimeout(webdavSaveTimerRef.current)
        webdavSaveTimerRef.current = null
      }
    },
    [],
  )

  function setWebdavTextField(field: WebdavTextField, value: string) {
    setWebdavConfig((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function setWebdavNumericField(field: WebdavNumericField, value: string) {
    const parsed = Number.parseInt(value, 10)
    setWebdavConfig((current) => ({
      ...current,
      [field]: Number.isFinite(parsed) ? parsed : 0,
    }))
  }

  async function handleTestWebdav() {
    setWebdavTesting(true)
    setWebdavMessage('')
    try {
      const saved = await ensureWebdavConfigSaved()
      if (!saved) {
        return
      }
      const result = await testWebdavConnection()
      setWebdavMessage(result.message || t('settings.webdavTestPassed'))
      await refreshWebdavSnapshots(true)
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.webdavTestFailed')
      setWebdavMessage(text)
    } finally {
      setWebdavTesting(false)
    }
  }

  async function handlePushWebdav() {
    if (!baseDataRoot) {
      setWebdavMessage(t('settings.dataRootNotReady'))
      return
    }

    setWebdavPushing(true)
    setWebdavMessage('')
    try {
      const saved = await ensureWebdavConfigSaved()
      if (!saved) {
        return
      }
      const result = await pushWebdavSnapshot(baseDataRoot, webdavSnapshotNote.trim() || undefined)
      setWebdavSnapshotNote('')
      setWebdavMessage(
        `${t('settings.webdavPushSucceeded', { id: result.snapshot.id })}` +
          (result.prunedSnapshotIds.length > 0
            ? ` ${t('settings.webdavPruned', { count: result.prunedSnapshotIds.length })}`
            : ''),
      )
      await refreshWebdavSnapshots(true)
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.webdavPushFailed')
      setWebdavMessage(text)
    } finally {
      setWebdavPushing(false)
    }
  }

  async function pullSnapshot(snapshotId?: string) {
    if (!baseDataRoot) {
      setWebdavMessage(t('settings.dataRootNotReady'))
      return
    }

    if (!window.confirm(t('settings.webdavPullConfirm'))) {
      return
    }

    setWebdavPulling(true)
    setWebdavMessage('')

    try {
      const saved = await ensureWebdavConfigSaved()
      if (!saved) {
        return
      }
      const result = await pullWebdavSnapshot(baseDataRoot, snapshotId, true, webdavBackupBeforePull)
      await refresh()
      emitDataChanged({ scope: 'all' })
      setWebdavMessage(
        `${t('settings.webdavPullSucceeded', { id: result.snapshot.id })} ${formatCopySummary(result.summary, t)}` +
          (result.backupPath ? ` ${t('settings.webdavBackupPath', { path: result.backupPath })}` : ''),
      )
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.webdavPullFailed')
      setWebdavMessage(text)
    } finally {
      setWebdavPulling(false)
    }
  }

  async function handleDeleteSnapshot() {
    if (!selectedSnapshotId) {
      return
    }

    if (!window.confirm(t('settings.webdavDeleteConfirm'))) {
      return
    }

    setWebdavDeleting(true)
    setWebdavMessage('')

    try {
      const saved = await ensureWebdavConfigSaved()
      if (!saved) {
        return
      }
      const result = await deleteWebdavSnapshot(selectedSnapshotId)
      if (result.deleted) {
        setWebdavMessage(t('settings.webdavDeleteSucceeded'))
      } else {
        setWebdavMessage(t('settings.webdavDeleteNoop'))
      }
      await refreshWebdavSnapshots(true)
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.webdavDeleteFailed')
      setWebdavMessage(text)
    } finally {
      setWebdavDeleting(false)
    }
  }

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
      const result = await exportDataBundle(dataRoot, destination)
      setExportMessage(
        `${t('settings.exportCompleted', { path: result.bundlePath })} ${formatCopySummary(result.summary, t)}`,
      )
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
      const summary = await migrateDataRoot(destination, overwriteMigrate)
      setMigrateMessage(`${t('settings.migrateCompleted')} ${formatCopySummary(summary, t)}`)
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
      const result = await importDataBundle(source, dataRoot, overwriteImport)
      await refresh()
      emitDataChanged({ scope: 'all' })
      setImportMessage(`${t('settings.importCompleted')} ${formatCopySummary(result.summary, t)}`)
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
    <section className="space-y-4 md:space-y-6">
      <PageHeader
        title={t('settings.title')}
        description={t('settings.description')}
      />

      <div className="w-full max-w-3xl rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 sm:p-4">
        <p>
          {t('settings.activeProfile')}: <span className="font-medium break-all">{activeProfile || '-'}</span>
        </p>
        <p>
          {t('settings.baseDataRootPath')}: <span className="font-medium break-all">{baseDataRoot || '-'}</span>
        </p>
        <p>
          {t('settings.activeProfileRoot')}: <span className="font-medium break-all">{dataRoot || '-'}</span>
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

      <section className="w-full max-w-3xl space-y-3 rounded-lg border border-slate-200 p-3 sm:p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('settings.updater')}</h2>
        <p className="text-sm text-slate-600">{t('settings.updaterDescription')}</p>
        <p className="text-sm text-slate-700">
          {t('settings.currentVersion')}: <span className="font-medium">{currentVersion}</span>
        </p>
        <p className="text-sm text-slate-700">
          {t('settings.updaterSupported')}:{' '}
          <span className={`font-medium ${updaterSupported ? 'text-teal-700' : 'text-slate-500'}`}>
            {updaterResolved ? (updaterSupported ? t('common.yes') : t('common.no')) : t('common.loading')}
          </span>
        </p>
        <p className="text-sm text-slate-700">
          {t('settings.updaterConfigured')}:{' '}
          <span className={`font-medium ${updaterConfigured ? 'text-teal-700' : 'text-amber-700'}`}>
            {updaterResolved ? (updaterConfigured ? t('common.yes') : t('common.no')) : t('common.loading')}
          </span>
        </p>
        {!updaterSupported && updaterResolved ? (
          <p className="text-sm text-slate-600">{t('updater.notSupported')}</p>
        ) : null}
        {!updaterConfigured && updaterSupported && updaterResolved ? (
          <p className="text-sm text-amber-700">{t('updater.notConfigured')}</p>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={autoCheckEnabled}
            onChange={(event) => setAutoCheckEnabled(event.target.checked)}
            disabled={!updaterSupported || !updaterConfigured || updaterInstalling}
          />
          {t('settings.autoCheckUpdates')}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="w-full rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 sm:w-auto"
            disabled={!updaterSupported || !updaterConfigured || updaterChecking || updaterInstalling}
            onClick={() => void checkForUpdates(true)}
          >
            {updaterChecking ? t('updater.checking') : t('settings.checkUpdatesNow')}
          </button>
          {availableUpdate ? (
            <button
              type="button"
              className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 sm:w-auto"
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

      <section className="w-full max-w-3xl space-y-3 rounded-lg border border-slate-200 p-3 sm:p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('settings.webdavTitle')}</h2>
        <p className="text-sm text-slate-600">{t('settings.webdavDescription')}</p>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={webdavConfig.enabled}
            onChange={(event) => setWebdavConfig((current) => ({ ...current, enabled: event.target.checked }))}
            disabled={webdavLoading || webdavSaving}
          />
          {t('settings.webdavEnabled')}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={webdavConfig.autoPullEnabled}
            onChange={(event) =>
              setWebdavConfig((current) => ({ ...current, autoPullEnabled: event.target.checked }))
            }
            disabled={webdavLoading || webdavSaving}
          />
          {t('settings.webdavAutoPullEnabled')}
        </label>

        <label className="block text-sm font-medium text-slate-700" htmlFor="webdav-url">
          {t('settings.webdavBaseUrl')}
        </label>
        <input
          id="webdav-url"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
          value={webdavConfig.remoteBaseUrl}
          onChange={(event) => setWebdavTextField('remoteBaseUrl', event.target.value)}
          placeholder="https://cloud.example.com/remote.php/dav/files/<user>/dailytrack"
          disabled={webdavLoading || webdavSaving}
        />

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="webdav-username">
              {t('settings.webdavUsername')}
            </label>
            <input
              id="webdav-username"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
              value={webdavConfig.username}
              onChange={(event) => setWebdavTextField('username', event.target.value)}
              disabled={webdavLoading || webdavSaving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="webdav-password">
              {t('settings.webdavPassword')}
            </label>
            <input
              id="webdav-password"
              type="password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
              value={webdavConfig.password}
              onChange={(event) => setWebdavTextField('password', event.target.value)}
              disabled={webdavLoading || webdavSaving}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="webdav-interval">
              {t('settings.webdavInterval')}
            </label>
            <input
              id="webdav-interval"
              type="number"
              min={0}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
              value={webdavConfig.autoPushIntervalMin}
              onChange={(event) => setWebdavNumericField('autoPushIntervalMin', event.target.value)}
              disabled={webdavLoading || webdavSaving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="webdav-timeout">
              {t('settings.webdavTimeout')}
            </label>
            <input
              id="webdav-timeout"
              type="number"
              min={10}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
              value={webdavConfig.requestTimeoutSec}
              onChange={(event) => setWebdavNumericField('requestTimeoutSec', event.target.value)}
              disabled={webdavLoading || webdavSaving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="webdav-max-snapshots">
              {t('settings.webdavMaxSnapshots')}
            </label>
            <input
              id="webdav-max-snapshots"
              type="number"
              min={1}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
              value={webdavConfig.maxSnapshots}
              onChange={(event) => setWebdavNumericField('maxSnapshots', event.target.value)}
              disabled={webdavLoading || webdavSaving}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={webdavConfig.verifyTls}
            onChange={(event) => setWebdavConfig((current) => ({ ...current, verifyTls: event.target.checked }))}
            disabled={webdavLoading || webdavSaving}
          />
          {t('settings.webdavVerifyTls')}
        </label>

        <p className="text-xs text-slate-500">{t('settings.webdavCredentialsHint')}</p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={webdavLoading || webdavTesting || webdavSaving}
            className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60 sm:w-auto"
            onClick={() => void handleTestWebdav()}
          >
            {webdavTesting ? t('settings.webdavTesting') : t('settings.webdavTest')}
          </button>
          <button
            type="button"
            disabled={webdavLoading || webdavRefreshing || webdavSaving}
            className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60 sm:w-auto"
            onClick={() => void refreshWebdavSnapshots()}
          >
            {webdavRefreshing ? t('settings.webdavRefreshing') : t('settings.webdavRefresh')}
          </button>
        </div>

        {webdavConfigMessage ? (
          <p className="break-all text-xs text-slate-500">{webdavConfigMessage}</p>
        ) : null}

        <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <label className="block text-sm font-medium text-slate-700" htmlFor="webdav-note">
            {t('settings.webdavPushNote')}
          </label>
          <input
            id="webdav-note"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
            value={webdavSnapshotNote}
            onChange={(event) => setWebdavSnapshotNote(event.target.value)}
            placeholder={t('settings.webdavPushNotePlaceholder')}
            disabled={webdavPushing || webdavPulling}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={webdavPushing || webdavPulling || webdavSaving || !baseDataRoot}
              className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 sm:w-auto"
              onClick={() => void handlePushWebdav()}
            >
              {webdavPushing ? t('settings.webdavPushing') : t('settings.webdavPushNow')}
            </button>
            <button
              type="button"
              disabled={webdavPushing || webdavPulling || webdavSaving || webdavSnapshots.length === 0 || !baseDataRoot}
              className="w-full rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 sm:w-auto"
              onClick={() => void pullSnapshot()}
            >
              {webdavPulling ? t('settings.webdavPulling') : t('settings.webdavPullLatest')}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={webdavBackupBeforePull}
            onChange={(event) => setWebdavBackupBeforePull(event.target.checked)}
            disabled={webdavPulling}
          />
          {t('settings.webdavBackupBeforePull')}
        </label>

        <div className="space-y-2 rounded-md border border-slate-200 p-3">
          <p className="text-sm font-medium text-slate-900">{t('settings.webdavSnapshots')}</p>
          {webdavSnapshots.length === 0 ? (
            <p className="text-sm text-slate-600">{t('settings.webdavNoSnapshots')}</p>
          ) : (
            <>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
                value={selectedSnapshotId}
                onChange={(event) => setSelectedSnapshotId(event.target.value)}
                disabled={webdavPulling || webdavDeleting}
              >
                {webdavSnapshots.map((snapshot) => (
                  <option key={snapshot.id} value={snapshot.id}>
                    {snapshot.id} | {formatSnapshotTime(snapshot.createdAt)} | {formatSnapshotSize(snapshot.sizeBytes)}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!selectedSnapshotId || webdavPulling || webdavSaving || !baseDataRoot}
                  className="w-full rounded-md border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 disabled:opacity-60 sm:w-auto"
                  onClick={() => void pullSnapshot(selectedSnapshotId)}
                >
                  {webdavPulling ? t('settings.webdavPulling') : t('settings.webdavPullSelected')}
                </button>
                <button
                  type="button"
                  disabled={!selectedSnapshotId || webdavDeleting || webdavSaving}
                  className="w-full rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 disabled:opacity-60 sm:w-auto"
                  onClick={() => void handleDeleteSnapshot()}
                >
                  {webdavDeleting ? t('settings.webdavDeleting') : t('settings.webdavDeleteSelected')}
                </button>
              </div>
            </>
          )}
        </div>

        {webdavMessage ? <p className="break-all text-sm text-slate-600">{webdavMessage}</p> : null}
      </section>

      <form onSubmit={handleMigrate} className="w-full max-w-3xl space-y-3 rounded-lg border border-slate-200 p-3 sm:p-4">
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
          className="w-full rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 sm:w-auto"
        >
          {migrateBusy ? t('settings.migrating') : t('settings.migrateAndSwitch')}
        </button>
        {migrateValidationMessage ? <p className="text-sm text-rose-700">{migrateValidationMessage}</p> : null}
        {migrateMessage ? <p className="break-all text-sm text-slate-600">{migrateMessage}</p> : null}
      </form>

      <form onSubmit={handleExport} className="w-full max-w-3xl space-y-3 rounded-lg border border-slate-200 p-3 sm:p-4">
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
          className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 sm:w-auto"
        >
          {exportBusy ? t('settings.exporting') : t('settings.export')}
        </button>
        {exportMessage ? <p className="break-all text-sm text-slate-600">{exportMessage}</p> : null}
      </form>

      <form onSubmit={handleImport} className="w-full max-w-3xl space-y-3 rounded-lg border border-slate-200 p-3 sm:p-4">
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
          className="w-full rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 sm:w-auto"
        >
          {importBusy ? t('settings.importing') : t('settings.import')}
        </button>
        {importMessage ? <p className="break-all text-sm text-slate-600">{importMessage}</p> : null}
      </form>

      <form onSubmit={handleReset} className="w-full max-w-3xl space-y-3 rounded-lg border border-rose-300 bg-rose-50/40 p-3 sm:p-4">
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
          className="w-full rounded-md bg-rose-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 sm:w-auto"
        >
          {resetBusy ? t('settings.resetting') : t('settings.resetAction')}
        </button>
        {resetMessage ? <p className="break-all text-sm text-rose-800">{resetMessage}</p> : null}
      </form>
    </section>
  )
}
