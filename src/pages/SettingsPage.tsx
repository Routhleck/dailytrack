import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { PageHeader } from '../components/PageHeader'
import { useToast } from '../features/feedback/ToastContext'
import { useI18n } from '../features/i18n/I18nContext'
import { useDataRoot } from '../features/settings/DataRootContext'
import { emitTutorialOpen } from '../features/tutorial/tutorial.events'
import { useUpdater } from '../features/updater/UpdaterContext'
import {
  checkLatestAndroidRelease,
  type AndroidReleaseUpdate,
} from '../features/updater/androidRelease.service'
import {
  deleteWebdavSnapshot,
  exportDataBundle,
  getWebdavConfig,
  importDataBundleSmart,
  listWebdavSnapshots,
  pullWebdavSnapshot,
  pushWebdavSnapshot,
  readBinaryFile,
  saveWebdavConfig,
  testWebdavConnection,
  type CopySummary,
  type WebdavConfig,
  type WebdavSnapshot,
  writeTextFile,
  writeBinaryFile,
} from '../lib/fs/fileApi'
import {
  isMobileDirectoryPickerError,
  pickDirectory,
  pickDirectoryOrParentFromFile,
  pickFile,
  pickSaveFile,
} from '../lib/fs/dialogApi'
import { emitDataChanged } from '../lib/liveSync'
import {
  defaultWebdavConfig,
  formatSnapshotSize,
  formatSnapshotTime,
  normalizeWebdavConfig,
} from '../features/webdav/webdav.service'
import { joinPath } from '../lib/fs/pathApi'
import { captureRuntimePerfSnapshot } from '../lib/perf/runtimePerf'
import { open } from '@tauri-apps/plugin-shell'

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

function baseName(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const index = normalized.lastIndexOf('/')
  if (index < 0) {
    return normalized
  }
  return normalized.slice(index + 1)
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

function perfDiagnosticFileName() {
  return `perf-diagnostic-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
}

const LATEST_RELEASE_URL = 'https://github.com/Routhleck/dailytrack/releases/latest'

type WebdavNumericField =
  | 'autoPushIntervalMin'
  | 'autoPullIntervalSec'
  | 'requestTimeoutSec'
  | 'maxSnapshots'
type WebdavTextField = 'remoteBaseUrl' | 'username' | 'password'

function webdavConfigSignature(config: WebdavConfig): string {
  return JSON.stringify(normalizeWebdavConfig(config))
}

export function SettingsPage() {
  const { t } = useI18n()
  const { pushError, pushSuccess } = useToast()
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
    error: dataRootError,
  } = useDataRoot()
  const isAndroidRuntime = useMemo(
    () => typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent),
    [],
  )

  const defaultExportDir = useMemo(() => {
    if (baseDataRoot) {
      return baseDataRoot
    }
    if (!dataRoot) {
      return ''
    }
    return parentPath(dataRoot)
  }, [baseDataRoot, dataRoot])
  const fixedMobileExportDir = useMemo(() => {
    if (!isAndroidRuntime || !baseDataRoot) {
      return ''
    }
    return joinPath(baseDataRoot, 'exports')
  }, [baseDataRoot, isAndroidRuntime])

  const [exportDir, setExportDir] = useState(defaultExportDir)
  const [exportMessage, setExportMessage] = useState('')
  const [exportBusy, setExportBusy] = useState(false)
  const [lastExportZipPath, setLastExportZipPath] = useState('')
  const [mobileExportActionBusy, setMobileExportActionBusy] = useState(false)

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
  const [perfExportBusy, setPerfExportBusy] = useState(false)
  const [perfExportMessage, setPerfExportMessage] = useState('')
  const [androidReleaseChecking, setAndroidReleaseChecking] = useState(false)
  const [androidReleaseStatus, setAndroidReleaseStatus] = useState('')
  const [androidReleaseError, setAndroidReleaseError] = useState('')
  const [androidReleaseUpdate, setAndroidReleaseUpdate] = useState<AndroidReleaseUpdate | null>(null)

  const [webdavConfig, setWebdavConfig] = useState<WebdavConfig>(defaultWebdavConfig())
  const [webdavSnapshots, setWebdavSnapshots] = useState<WebdavSnapshot[]>([])
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('')
  const [webdavMessage, setWebdavMessage] = useState('')
  const [webdavConfigMessage, setWebdavConfigMessage] = useState('')
  const [webdavLoading, setWebdavLoading] = useState(false)
  const [webdavExpanded, setWebdavExpanded] = useState(false)
  const [webdavBootstrapped, setWebdavBootstrapped] = useState(false)
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
    if (isAndroidRuntime) {
      if (fixedMobileExportDir && exportDir !== fixedMobileExportDir) {
        setExportDir(fixedMobileExportDir)
      }
      return
    }
    if (!exportDir) {
      setExportDir(defaultExportDir)
    }
  }, [defaultExportDir, exportDir, fixedMobileExportDir, isAndroidRuntime])

  useEffect(() => {
    if (isAndroidRuntime || !baseDataRoot || migrateTarget) {
      return
    }

    const suggested = baseDataRoot.replace(/life-tracker-data$/, 'dailytrack-data')
    setMigrateTarget(suggested === baseDataRoot ? `${baseDataRoot}-migrated` : suggested)
  }, [baseDataRoot, isAndroidRuntime, migrateTarget])

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
    if (!webdavExpanded || webdavBootstrapped) {
      return
    }

    let disposed = false
    setWebdavLoading(true)

    const timer = window.setTimeout(() => {
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
            if (!webdavLastSavedSignatureRef.current) {
              webdavLastSavedSignatureRef.current = webdavConfigSignature(normalizeWebdavConfig(webdavConfig))
            }
            setWebdavBootstrapped(true)
            setWebdavLoading(false)
          }
        }
      })()
    }, 120)

    return () => {
      disposed = true
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, webdavBootstrapped, webdavExpanded])

  useEffect(() => {
    if (!webdavBootstrapped || webdavLoading) {
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
      const text = result.message || t('settings.webdavTestPassed')
      setWebdavMessage(text)
      pushSuccess(text)
      await refreshWebdavSnapshots(true)
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.webdavTestFailed')
      setWebdavMessage(text)
      pushError(text)
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
      const text =
        `${t('settings.webdavPushSucceeded', { id: result.snapshot.id })}` +
          (result.prunedSnapshotIds.length > 0
            ? ` ${t('settings.webdavPruned', { count: result.prunedSnapshotIds.length })}`
            : '')
      setWebdavMessage(text)
      pushSuccess(text)
      await refreshWebdavSnapshots(true)
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.webdavPushFailed')
      setWebdavMessage(text)
      pushError(text)
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
      const text =
        `${t('settings.webdavPullSucceeded', { id: result.snapshot.id })} ${formatCopySummary(result.summary, t)}` +
          (result.backupPath ? ` ${t('settings.webdavBackupPath', { path: result.backupPath })}` : '')
      setWebdavMessage(text)
      pushSuccess(text)
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.webdavPullFailed')
      setWebdavMessage(text)
      pushError(text)
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
        const text = t('settings.webdavDeleteSucceeded')
        setWebdavMessage(text)
        pushSuccess(text)
      } else {
        const text = t('settings.webdavDeleteNoop')
        setWebdavMessage(text)
        pushSuccess(text)
      }
      await refreshWebdavSnapshots(true)
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.webdavDeleteFailed')
      setWebdavMessage(text)
      pushError(text)
    } finally {
      setWebdavDeleting(false)
    }
  }

  async function handleExport(event: FormEvent) {
    event.preventDefault()

    if (!dataRoot) {
      const text = t('settings.dataRootNotReady')
      setExportMessage(text)
      pushError(text)
      return
    }

    const destination = isAndroidRuntime ? fixedMobileExportDir : exportDir.trim()
    if (!destination) {
      const text = t('settings.exportDestinationRequired')
      setExportMessage(text)
      pushError(text)
      return
    }

    setExportBusy(true)
    setExportMessage('')
    setLastExportZipPath('')

    try {
      const result = await exportDataBundle(dataRoot, destination)
      const text = `${t('settings.exportCompleted', { path: result.bundlePath })} ${formatCopySummary(result.summary, t)}`
      setExportMessage(text)
      setLastExportZipPath(result.bundlePath)
      pushSuccess(text)
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.exportFailed')
      setExportMessage(text)
      pushError(text)
    } finally {
      setExportBusy(false)
    }
  }

  async function handlePickMigrateTarget() {
    if (isAndroidRuntime) {
      return
    }
    try {
      const picked = await pickDirectoryOrParentFromFile(migrateTarget || baseDataRoot || undefined)
      if (picked) {
        setMigrateTarget(picked)
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.pathPickFailed')
      setMigrateMessage(text)
      pushError(text)
    }
  }

  async function handlePickExportDir() {
    if (isAndroidRuntime) {
      return
    }
    try {
      const picked = await pickDirectoryOrParentFromFile(exportDir || defaultExportDir || undefined)
      if (picked) {
        setExportDir(picked)
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.pathPickFailed')
      setExportMessage(text)
      pushError(text)
    }
  }

  async function handlePickImportSource() {
    if (isAndroidRuntime) {
      try {
        const pickedFile = await pickFile(importSource || undefined)
        if (pickedFile) {
          setImportSource(pickedFile)
        }
      } catch (error) {
        const text = error instanceof Error ? error.message : t('settings.pathPickFailed')
        setImportMessage(text)
        pushError(text)
      }
      return
    }

    try {
      const picked = await pickDirectory(importSource || exportDir || defaultExportDir || undefined)
      if (picked) {
        setImportSource(picked)
      }
    } catch (error) {
      if (isMobileDirectoryPickerError(error)) {
        try {
          const pickedFile = await pickFile(importSource || exportDir || defaultExportDir || undefined)
          if (pickedFile) {
            setImportSource(pickedFile)
          }
          return
        } catch (fileError) {
          const text = fileError instanceof Error ? fileError.message : t('settings.pathPickFailed')
          setImportMessage(text)
          pushError(text)
          return
        }
      }
      const text = error instanceof Error ? error.message : t('settings.pathPickFailed')
      setImportMessage(text)
      pushError(text)
    }
  }

  async function handleShareExportZip() {
    if (!lastExportZipPath) {
      return
    }
    if (!navigator.share) {
      const text = t('settings.mobileShareUnsupported')
      setExportMessage(text)
      pushError(text)
      return
    }

    setMobileExportActionBusy(true)
    try {
      const bytes = await readBinaryFile(lastExportZipPath)
      const fileName = baseName(lastExportZipPath) || 'dailytrack-export.zip'
      const shareBuffer = new ArrayBuffer(bytes.byteLength)
      new Uint8Array(shareBuffer).set(bytes)
      const file = new File([shareBuffer], fileName, { type: 'application/zip' })
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        const text = t('settings.mobileShareUnsupported')
        setExportMessage(text)
        pushError(text)
        return
      }
      await navigator.share({
        title: 'dailytrack export',
        text: fileName,
        files: [file],
      })
      pushSuccess(t('settings.mobileShareDone'))
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.mobileShareFailed')
      setExportMessage(text)
      pushError(text)
    } finally {
      setMobileExportActionBusy(false)
    }
  }

  async function handleSaveExportZipAs() {
    if (!lastExportZipPath) {
      return
    }

    setMobileExportActionBusy(true)
    try {
      const defaultName = baseName(lastExportZipPath) || 'dailytrack-export.zip'
      const destination = await pickSaveFile(defaultName)
      if (!destination) {
        return
      }
      const bytes = await readBinaryFile(lastExportZipPath)
      await writeBinaryFile(destination, bytes)
      const text = t('settings.mobileSaveAsDone', { path: destination })
      setExportMessage(text)
      pushSuccess(text)
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.mobileSaveAsFailed')
      setExportMessage(text)
      pushError(text)
    } finally {
      setMobileExportActionBusy(false)
    }
  }

  async function handleMigrate(event: FormEvent) {
    event.preventDefault()

    if (isAndroidRuntime) {
      const text = t('settings.mobileMigrateDisabled')
      setMigrateMessage(text)
      pushError(text)
      return
    }

    if (!baseDataRoot) {
      const text = t('settings.dataRootNotReady')
      setMigrateMessage(text)
      pushError(text)
      return
    }

    const destination = migrateTarget.trim()
    if (!destination) {
      const text = t('settings.migrateDestinationRequired')
      setMigrateMessage(text)
      pushError(text)
      return
    }
    if (migrateValidationMessage) {
      setMigrateMessage(migrateValidationMessage)
      pushError(migrateValidationMessage)
      return
    }

    setMigrateBusy(true)
    setMigrateMessage('')

    try {
      const summary = await migrateDataRoot(destination, overwriteMigrate)
      const text = `${t('settings.migrateCompleted')} ${formatCopySummary(summary, t)}`
      setMigrateMessage(text)
      pushSuccess(text)
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.migrateFailed')
      setMigrateMessage(text)
      pushError(text)
    } finally {
      setMigrateBusy(false)
    }
  }

  async function handleImport(event: FormEvent) {
    event.preventDefault()

    if (!dataRoot) {
      const text = t('settings.dataRootNotReady')
      setImportMessage(text)
      pushError(text)
      return
    }

    const source = importSource.trim()
    if (!source) {
      const text = t('settings.importSourceRequired')
      setImportMessage(text)
      pushError(text)
      return
    }

    setImportBusy(true)
    setImportMessage('')

    try {
      const result = await importDataBundleSmart(source, dataRoot, overwriteImport)
      await refresh()
      emitDataChanged({ scope: 'all' })
      const text = `${t('settings.importCompleted')} ${formatCopySummary(result.summary, t)}`
      setImportMessage(text)
      pushSuccess(text)
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.importFailed')
      setImportMessage(text)
      pushError(text)
    } finally {
      setImportBusy(false)
    }
  }

  async function handleReset(event: FormEvent) {
    event.preventDefault()

    if (!baseDataRoot) {
      const text = t('settings.dataRootNotReady')
      setResetMessage(text)
      pushError(text)
      return
    }
    if (resetConfirmText.trim() !== 'RESET') {
      const text = t('settings.resetConfirmMismatch')
      setResetMessage(text)
      pushError(text)
      return
    }

    setResetBusy(true)
    setResetMessage('')

    try {
      await resetTrackerData()
      setResetConfirmText('')
      const text = t('settings.resetCompleted')
      setResetMessage(text)
      pushSuccess(text)
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.resetFailed')
      setResetMessage(text)
      pushError(text)
    } finally {
      setResetBusy(false)
    }
  }

  async function handleExportPerfDiagnostics() {
    if (!dataRoot) {
      const text = t('settings.dataRootNotReady')
      setPerfExportMessage(text)
      pushError(text)
      return
    }

    setPerfExportBusy(true)
    setPerfExportMessage('')
    try {
      const path = joinPath(dataRoot, 'perf-diagnostics', perfDiagnosticFileName())
      const snapshot = captureRuntimePerfSnapshot()
      const payload = {
        exportedAt: new Date().toISOString(),
        app: {
          version: currentVersion,
          profile: activeProfile,
          baseDataRoot,
          profileRoot: dataRoot,
        },
        runtime: {
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
          visibilityState: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
        },
        perf: snapshot,
      }

      await writeTextFile(dataRoot, path, `${JSON.stringify(payload, null, 2)}\n`)
      const text = t('settings.perfDiagnosticExported', { path })
      setPerfExportMessage(text)
      pushSuccess(text)
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.perfDiagnosticExportFailed')
      setPerfExportMessage(text)
      pushError(text)
    } finally {
      setPerfExportBusy(false)
    }
  }

  async function openExternalLink(url: string) {
    try {
      await open(url)
    } catch {
      window.location.href = url
    }
  }

  function handleOpenLatestRelease() {
    const url = androidReleaseUpdate?.releaseUrl || LATEST_RELEASE_URL
    openExternalLink(url)
  }

  function handleDownloadAndroidApk() {
    if (!androidReleaseUpdate) {
      return
    }
    openExternalLink(androidReleaseUpdate.apkUrl)
  }

  async function handleCheckAndroidRelease() {
    setAndroidReleaseChecking(true)
    setAndroidReleaseError('')
    setAndroidReleaseStatus('')

    try {
      const result = await checkLatestAndroidRelease(currentVersion)
      setAndroidReleaseUpdate(result)
      if (result.isUpdateAvailable) {
        setAndroidReleaseStatus(t('settings.androidUpdaterAvailable', { version: result.latestVersion }))
      } else {
        setAndroidReleaseStatus(t('settings.androidUpdaterUpToDate', { version: result.latestVersion }))
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : t('settings.androidUpdaterCheckFailed')
      setAndroidReleaseError(text)
    } finally {
      setAndroidReleaseChecking(false)
    }
  }

  return (
    <section className="dt-page">
      <PageHeader
        title={t('settings.title')}
        description={t('settings.description')}
      />

      <div className="dt-panel-soft w-full max-w-3xl p-3 text-sm text-slate-700 sm:p-4">
        <p className="text-sm font-semibold text-slate-900">{t('settings.diagnosticsTitle')}</p>
        <p className="mt-1 text-xs text-slate-500">{t('settings.diagnosticsDescription')}</p>
        <p className="mt-3">
          {t('settings.initState')}: <span className="font-medium">{loading ? t('common.loading') : (dataRootError ? t('shell.initError') : t('common.yes'))}</span>
        </p>
        {dataRootError ? <p className="mt-1 break-all text-rose-700">{dataRootError}</p> : null}
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
          <p className="text-sm font-medium text-slate-900">{t('settings.performanceDiagnostics')}</p>
          <p className="mt-1 text-sm text-slate-600">{t('settings.performanceDiagnosticsDescription')}</p>
          <button
            type="button"
            className="dt-btn dt-btn-secondary mt-3"
            onClick={() => void handleExportPerfDiagnostics()}
            disabled={perfExportBusy || loading || !dataRoot}
          >
            {perfExportBusy ? t('settings.exportingPerfDiagnostics') : t('settings.exportPerfDiagnostics')}
          </button>
          {perfExportMessage ? (
            <p className="mt-2 break-all text-sm text-slate-600">{perfExportMessage}</p>
          ) : null}
        </div>
        <div className="mt-4 border-t border-slate-200 pt-3">
          <p className="text-sm font-medium text-slate-900">{t('settings.tutorial')}</p>
          <p className="mt-1 text-sm text-slate-600">{t('settings.tutorialDescription')}</p>
          <button
            type="button"
            className="dt-btn dt-btn-secondary mt-3"
            onClick={() => emitTutorialOpen('settings')}
          >
            {t('settings.startTutorial')}
          </button>
        </div>
      </div>

      <section className="dt-panel w-full max-w-3xl space-y-3 p-3 sm:p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('settings.updater')}</h2>
        {isAndroidRuntime ? (
          <>
            <p className="text-sm text-slate-600">{t('settings.androidUpdaterDescription')}</p>
            <p className="text-sm text-slate-700">
              {t('settings.currentVersion')}: <span className="font-medium">{currentVersion}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="w-full rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 sm:w-auto"
                disabled={androidReleaseChecking}
                onClick={() => void handleCheckAndroidRelease()}
              >
                {androidReleaseChecking ? t('settings.androidUpdaterChecking') : t('settings.checkAndroidUpdates')}
              </button>
              <button
                type="button"
                className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60 sm:w-auto"
                onClick={handleOpenLatestRelease}
              >
                {t('settings.openLatestRelease')}
              </button>
              {androidReleaseUpdate?.isUpdateAvailable ? (
                <button
                  type="button"
                  className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 sm:w-auto"
                  onClick={handleDownloadAndroidApk}
                >
                  {t('settings.downloadAndroidApk')}
                </button>
              ) : null}
            </div>
            {androidReleaseUpdate ? (
              <>
                <p className="text-sm text-slate-700">
                  {t('settings.latestVersion')}: <span className="font-medium">{androidReleaseUpdate.latestVersion}</span>
                </p>
                <p className="text-sm text-slate-700">
                  {t('settings.androidUpdaterLatestApk')}: <span className="font-medium break-all">{androidReleaseUpdate.apkName}</span>
                </p>
              </>
            ) : null}
            {androidReleaseStatus ? <p className="text-sm text-slate-700">{androidReleaseStatus}</p> : null}
            {androidReleaseError ? <p className="text-sm text-rose-700">{androidReleaseError}</p> : null}
          </>
        ) : (
          <>
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
          </>
        )}
      </section>

      <section className="dt-panel w-full max-w-3xl space-y-3 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{t('settings.webdavTitle')}</h2>
            <p className="text-sm text-slate-600">{t('settings.webdavDescription')}</p>
          </div>
          <button
            type="button"
            className="dt-btn dt-btn-secondary shrink-0"
            onClick={() => setWebdavExpanded((current) => !current)}
            aria-expanded={webdavExpanded}
          >
            {webdavExpanded ? t('settings.collapseSection') : t('settings.expandSection')}
          </button>
        </div>

        {!webdavExpanded ? (
          <p className="text-xs text-slate-500">{t('settings.webdavCollapsedHint')}</p>
        ) : null}

        {webdavExpanded ? (
          <>
            {!webdavBootstrapped || webdavLoading ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                {t('settings.webdavLoadingPanel')}
              </div>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={webdavConfig.enabled}
                    onChange={(event) => setWebdavConfig((current) => ({ ...current, enabled: event.target.checked }))}
                    disabled={webdavSaving}
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
                    disabled={webdavSaving}
                  />
                  {t('settings.webdavAutoPullEnabled')}
                </label>
                <div className="max-w-xs">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="webdav-auto-pull-interval">
                    {t('settings.webdavAutoPullInterval')}
                  </label>
                  <input
                    id="webdav-auto-pull-interval"
                    type="number"
                    min={5}
                    max={3600}
                    className="mt-1 dt-input"
                    value={webdavConfig.autoPullIntervalSec}
                    onChange={(event) => setWebdavNumericField('autoPullIntervalSec', event.target.value)}
                    disabled={webdavSaving || !webdavConfig.autoPullEnabled}
                  />
                </div>

                <label className="block text-sm font-medium text-slate-700" htmlFor="webdav-url">
                  {t('settings.webdavBaseUrl')}
                </label>
                <input
                  id="webdav-url"
                  className="dt-input"
                  value={webdavConfig.remoteBaseUrl}
                  onChange={(event) => setWebdavTextField('remoteBaseUrl', event.target.value)}
                  placeholder="https://cloud.example.com/remote.php/dav/files/<user>/dailytrack"
                  disabled={webdavSaving}
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700" htmlFor="webdav-username">
                      {t('settings.webdavUsername')}
                    </label>
                    <input
                      id="webdav-username"
                      className="dt-input"
                      value={webdavConfig.username}
                      onChange={(event) => setWebdavTextField('username', event.target.value)}
                      disabled={webdavSaving}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700" htmlFor="webdav-password">
                      {t('settings.webdavPassword')}
                    </label>
                    <input
                      id="webdav-password"
                      type="password"
                      className="dt-input"
                      value={webdavConfig.password}
                      onChange={(event) => setWebdavTextField('password', event.target.value)}
                      disabled={webdavSaving}
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
                      className="dt-input"
                      value={webdavConfig.autoPushIntervalMin}
                      onChange={(event) => setWebdavNumericField('autoPushIntervalMin', event.target.value)}
                      disabled={webdavSaving}
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
                      className="dt-input"
                      value={webdavConfig.requestTimeoutSec}
                      onChange={(event) => setWebdavNumericField('requestTimeoutSec', event.target.value)}
                      disabled={webdavSaving}
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
                      className="dt-input"
                      value={webdavConfig.maxSnapshots}
                      onChange={(event) => setWebdavNumericField('maxSnapshots', event.target.value)}
                      disabled={webdavSaving}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={webdavConfig.verifyTls}
                    onChange={(event) => setWebdavConfig((current) => ({ ...current, verifyTls: event.target.checked }))}
                    disabled={webdavSaving}
                  />
                  {t('settings.webdavVerifyTls')}
                </label>

                <p className="text-xs text-slate-500">{t('settings.webdavCredentialsHint')}</p>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={webdavTesting || webdavSaving}
                    className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60 sm:w-auto"
                    onClick={() => void handleTestWebdav()}
                  >
                    {webdavTesting ? t('settings.webdavTesting') : t('settings.webdavTest')}
                  </button>
                  <button
                    type="button"
                    disabled={webdavRefreshing || webdavSaving}
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
                    className="dt-input"
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
                        className="dt-input"
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
              </>
            )}
          </>
        ) : null}
      </section>

      {!isAndroidRuntime ? (
      <form onSubmit={handleMigrate} className="dt-panel w-full max-w-3xl space-y-3 p-3 sm:p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('settings.migrateDataRoot')}</h2>
        <p className="text-sm text-slate-600">
          {t('settings.migrateDescription')}
        </p>
        <label className="block text-sm font-medium text-slate-700" htmlFor="migrate-target">
          {t('settings.migrateDestination')}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="migrate-target"
            className="dt-input min-w-56 flex-1"
            value={migrateTarget}
            onChange={(event) => setMigrateTarget(event.target.value)}
            placeholder="/Users/you/dailytrack-data"
            disabled={loading || migrateBusy}
          />
          <button
            type="button"
            className="dt-btn dt-btn-secondary"
            disabled={loading || migrateBusy}
            onClick={() => void handlePickMigrateTarget()}
          >
            {t('common.browse')}
          </button>
        </div>
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
      ) : (
      <section className="dt-panel w-full max-w-3xl space-y-3 p-3 sm:p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('settings.migrateDataRoot')}</h2>
        <p className="text-sm text-slate-600">{t('settings.mobileMigrateDisabled')}</p>
      </section>
      )}

      <form onSubmit={handleExport} className="dt-panel w-full max-w-3xl space-y-3 p-3 sm:p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('settings.exportData')}</h2>
        <p className="text-sm text-slate-600">
          {t('settings.exportDescription')}
        </p>
        {isAndroidRuntime ? (
          <p className="text-sm text-slate-700">
            {t('settings.mobileFixedExportPath', { path: fixedMobileExportDir || '-' })}
          </p>
        ) : (
          <>
            <label className="block text-sm font-medium text-slate-700" htmlFor="export-dir">
              {t('settings.exportDestination')}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="export-dir"
                className="dt-input min-w-56 flex-1"
                value={exportDir}
                onChange={(event) => setExportDir(event.target.value)}
                placeholder="/Users/you/Desktop"
                disabled={loading || exportBusy}
              />
              <button
                type="button"
                className="dt-btn dt-btn-secondary"
                disabled={loading || exportBusy}
                onClick={() => void handlePickExportDir()}
              >
                {t('common.browse')}
              </button>
            </div>
          </>
        )}
        <button
          type="submit"
          disabled={loading || exportBusy}
          className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 sm:w-auto"
        >
          {exportBusy ? t('settings.exporting') : t('settings.export')}
        </button>
        {isAndroidRuntime && lastExportZipPath ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="dt-btn dt-btn-secondary"
              disabled={mobileExportActionBusy}
              onClick={() => void handleShareExportZip()}
            >
              {mobileExportActionBusy ? t('common.loading') : t('settings.mobileShareZip')}
            </button>
            <button
              type="button"
              className="dt-btn dt-btn-secondary"
              disabled={mobileExportActionBusy}
              onClick={() => void handleSaveExportZipAs()}
            >
              {mobileExportActionBusy ? t('common.loading') : t('settings.mobileSaveZipAs')}
            </button>
          </div>
        ) : null}
        {exportMessage ? <p className="break-all text-sm text-slate-600">{exportMessage}</p> : null}
      </form>

      <form onSubmit={handleImport} className="dt-panel w-full max-w-3xl space-y-3 p-3 sm:p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('settings.importData')}</h2>
        <p className="text-sm text-slate-600">
          {t('settings.importDescription')}
        </p>
        {isAndroidRuntime ? (
          <p className="text-xs text-slate-500">{t('settings.mobileImportZipOnlyHint')}</p>
        ) : null}
        <label className="block text-sm font-medium text-slate-700" htmlFor="import-source">
          {t('settings.importSource')}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="import-source"
            className="dt-input min-w-56 flex-1"
            value={importSource}
            onChange={(event) => setImportSource(event.target.value)}
            placeholder={
              isAndroidRuntime
                ? '/storage/emulated/0/Download/dailytrack-export.zip'
                : '/Users/you/Desktop/dailytrack-export-123456789 or /Users/you/Desktop/export.zip'
            }
            disabled={loading || importBusy || isAndroidRuntime}
            readOnly={isAndroidRuntime}
          />
          <button
            type="button"
            className="dt-btn dt-btn-secondary"
            disabled={loading || importBusy}
            onClick={() => void handlePickImportSource()}
          >
            {t('common.browse')}
          </button>
        </div>

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
