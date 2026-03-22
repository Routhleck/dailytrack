import { useCallback, useEffect, useMemo, useState } from 'react'

import { PageHeader } from '../components/PageHeader'
import { useI18n } from '../features/i18n/I18nContext'
import { useDataRoot } from '../features/settings/DataRootContext'
import {
  type RealtimeConflict,
  type RealtimeSyncStatus,
  type WebdavConfig,
  getWebdavConfig,
  readTextFile,
  writeTextFile,
  webdavRealtimeConflictResolve,
  webdavRealtimeConflictsList,
  webdavRealtimeStatus,
  webdavRealtimeSyncNow,
} from '../lib/fs/fileApi'
import { buildLineDiffRows, type LineDiffRow } from '../lib/diff/lineDiff'
import { joinPath } from '../lib/fs/pathApi'
import { emitDataChanged } from '../lib/liveSync'

type ConflictPreview = {
  loading: boolean
  local?: string
  remote?: string
  rows?: LineDiffRow[]
  localError?: string
  remoteError?: string
}

type SyncHealth = 'healthy' | 'degraded' | 'syncing'
type SyncErrorCategory = 'none' | 'auth' | 'network' | 'config' | 'conflict' | 'local' | 'remote' | 'unknown'
type ResolveStrategy = 'keep_local' | 'apply_remote' | 'mark_resolved'

const PREVIEW_MAX_LINES = 40
const PREVIEW_MAX_CHARS = 3000
const AUTO_REFRESH_MS = 10000

function previewText(raw: string): string {
  const normalized = raw.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  const clippedLines = lines.slice(0, PREVIEW_MAX_LINES).join('\n')
  const clipped = clippedLines.length > PREVIEW_MAX_CHARS
    ? `${clippedLines.slice(0, PREVIEW_MAX_CHARS)}\n...`
    : clippedLines
  if (lines.length > PREVIEW_MAX_LINES && !clipped.endsWith('...')) {
    return `${clipped}\n...`
  }
  return clipped
}

function classifySyncError(lastError?: string | null): SyncErrorCategory {
  if (!lastError || !lastError.trim()) {
    return 'none'
  }

  const normalized = lastError.toLowerCase()
  if (
    normalized.includes('401')
    || normalized.includes('403')
    || normalized.includes('unauthorized')
    || normalized.includes('forbidden')
    || normalized.includes('authentication')
    || normalized.includes('credentials')
  ) {
    return 'auth'
  }
  if (
    normalized.includes('timeout')
    || normalized.includes('timed out')
    || normalized.includes('dns')
    || normalized.includes('connect')
    || normalized.includes('network')
    || normalized.includes('connection')
  ) {
    return 'network'
  }
  if (
    normalized.includes('required')
    || normalized.includes('disabled')
    || normalized.includes('invalid webdav remote url')
    || normalized.includes('invalid sync direction')
    || normalized.includes('must use http or https')
  ) {
    return 'config'
  }
  if (
    normalized.includes('conflict')
    || normalized.includes('etag')
    || normalized.includes('precondition')
  ) {
    return 'conflict'
  }
  if (
    normalized.includes('failed to read local file')
    || normalized.includes('failed to remove local file')
    || normalized.includes('path ')
    || normalized.includes('outside data root')
  ) {
    return 'local'
  }
  if (
    normalized.includes('webdav')
    || normalized.includes('upload')
    || normalized.includes('download')
    || normalized.includes('manifest')
  ) {
    return 'remote'
  }
  return 'unknown'
}

function deriveSyncHealth(status: RealtimeSyncStatus | null, busy: boolean): SyncHealth {
  if (busy) {
    return 'syncing'
  }
  if (status?.lastError) {
    return 'degraded'
  }
  return 'healthy'
}

function buildDiagnosticFileName() {
  return `sync-diagnostic-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
}

export function SyncPage() {
  const { t } = useI18n()
  const { baseDataRoot } = useDataRoot()
  const [status, setStatus] = useState<RealtimeSyncStatus | null>(null)
  const [webdavConfig, setWebdavConfig] = useState<WebdavConfig | null>(null)
  const [conflicts, setConflicts] = useState<RealtimeConflict[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [batchResolving, setBatchResolving] = useState(false)
  const [exportingDiagnostics, setExportingDiagnostics] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [selectedConflictIds, setSelectedConflictIds] = useState<Record<string, boolean>>({})
  const [message, setMessage] = useState('')
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({})
  const [previewMap, setPreviewMap] = useState<Record<string, ConflictPreview>>({})
  const [showOnlyChanges, setShowOnlyChanges] = useState(true)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!baseDataRoot) {
      return
    }

    if (!options?.silent) {
      setLoading(true)
    }

    try {
      const [nextStatus, nextConflicts, nextConfig] = await Promise.all([
        webdavRealtimeStatus(baseDataRoot),
        webdavRealtimeConflictsList(baseDataRoot),
        getWebdavConfig(),
      ])
      const unresolved = nextConflicts.filter((item) => item.status === 'unresolved')
      const unresolvedIds = new Set(unresolved.map((item) => item.id))
      setStatus(nextStatus)
      setWebdavConfig(nextConfig)
      setConflicts(unresolved)
      setExpandedMap((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([id]) => unresolvedIds.has(id))),
      )
      setPreviewMap((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([id]) => unresolvedIds.has(id))),
      )
      setSelectedConflictIds((prev) =>
        Object.fromEntries(
          Object.entries(prev).filter(([id, selected]) => unresolvedIds.has(id) && Boolean(selected)),
        ),
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('sync.loadFailed'))
    } finally {
      if (!options?.silent) {
        setLoading(false)
      }
    }
  }, [baseDataRoot, t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!baseDataRoot) {
      return
    }

    const timerId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load({ silent: true })
      }
    }, AUTO_REFRESH_MS)

    return () => {
      window.clearInterval(timerId)
    }
  }, [baseDataRoot, load])

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await load()
      setMessage(t('sync.refreshed'))
    } finally {
      setRefreshing(false)
    }
  }

  async function handleSync(direction: 'push' | 'pull' | 'both') {
    if (!baseDataRoot) {
      return
    }
    setSyncing(true)
    setMessage('')
    try {
      const result = await webdavRealtimeSyncNow(baseDataRoot, direction)
      setStatus(result.status)
      setMessage(
        t('sync.syncDone', {
          pushed: result.pushed,
          pulled: result.pulled,
          conflicts: result.conflicts,
        }),
      )
      await load()
      emitDataChanged({ scope: 'all' })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('sync.syncFailed'))
    } finally {
      setSyncing(false)
    }
  }

  async function runResolve(conflictId: string, strategy: ResolveStrategy) {
    if (!baseDataRoot) {
      return
    }

    await webdavRealtimeConflictResolve(baseDataRoot, conflictId, strategy)
  }

  async function resolveConflictIds(
    conflictIds: string[],
    strategy: ResolveStrategy,
    mode: 'selection' | 'preset',
  ) {
    if (!baseDataRoot) {
      return
    }

    if (conflictIds.length === 0) {
      return
    }

    if (strategy === 'apply_remote') {
      const confirmKey = mode === 'preset' ? 'sync.confirmApplyRemotePreset' : 'sync.confirmApplyRemoteBatch'
      if (!window.confirm(t(confirmKey))) {
        return
      }
    }
    if (strategy === 'mark_resolved') {
      const confirmKey = mode === 'preset' ? 'sync.confirmMarkResolvedPreset' : 'sync.confirmMarkResolvedBatch'
      if (!window.confirm(t(confirmKey))) {
        return
      }
    }

    setBatchResolving(true)
    setMessage('')
    let success = 0
    let failed = 0

    try {
      for (const conflictId of conflictIds) {
        try {
          await runResolve(conflictId, strategy)
          success += 1
        } catch {
          failed += 1
        }
      }

      await load()
      emitDataChanged({ scope: 'all' })
      if (failed > 0) {
        setMessage(
          t(mode === 'preset' ? 'sync.presetResolvePartial' : 'sync.batchResolvePartial', {
            success,
            failed,
          }),
        )
      } else {
        setMessage(
          t(mode === 'preset' ? 'sync.presetResolveDone' : 'sync.batchResolveDone', {
            success,
          }),
        )
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('sync.resolveFailed'))
    } finally {
      setBatchResolving(false)
    }
  }

  async function handleResolve(
    conflictId: string,
    strategy: ResolveStrategy,
  ) {
    if (!baseDataRoot) {
      return
    }

    if (strategy === 'apply_remote' && !window.confirm(t('sync.confirmApplyRemoteSingle'))) {
      return
    }

    setResolvingId(conflictId)

    try {
      await runResolve(conflictId, strategy)
      await load()
      emitDataChanged({ scope: 'all' })
      setMessage(t('sync.resolveDone'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('sync.resolveFailed'))
    } finally {
      setResolvingId(null)
    }
  }

  async function handleResolveSelected(strategy: ResolveStrategy) {
    const selectedIds = conflicts.filter((item) => selectedConflictIds[item.id]).map((item) => item.id)
    await resolveConflictIds(selectedIds, strategy, 'selection')
  }

  async function handleApplyPresetToAll(strategy: ResolveStrategy) {
    const allIds = conflicts.map((item) => item.id)
    await resolveConflictIds(allIds, strategy, 'preset')
  }

  async function loadConflictPreview(item: RealtimeConflict) {
    if (!baseDataRoot) {
      return
    }

    setPreviewMap((prev) => ({
      ...prev,
      [item.id]: {
        ...(prev[item.id] ?? {}),
        loading: true,
      },
    }))

    let local: string | undefined
    let remote: string | undefined
    let localError: string | undefined
    let remoteError: string | undefined

    try {
      const localRaw = await readTextFile(baseDataRoot, joinPath(baseDataRoot, item.path))
      local = previewText(localRaw)
    } catch (error) {
      localError = error instanceof Error ? error.message : t('sync.previewUnavailable')
    }

    if (item.conflictCopyPath) {
      try {
        const remoteRaw = await readTextFile(baseDataRoot, joinPath(baseDataRoot, item.conflictCopyPath))
        remote = previewText(remoteRaw)
      } catch (error) {
        remoteError = error instanceof Error ? error.message : t('sync.previewUnavailable')
      }
    } else {
      remote = t('sync.remoteDeleted')
    }

    setPreviewMap((prev) => ({
      ...prev,
      [item.id]: {
        loading: false,
        local,
        remote,
        rows: buildLineDiffRows(local ?? '', remote ?? ''),
        localError,
        remoteError,
      },
    }))
  }

  function handleTogglePreview(item: RealtimeConflict) {
    const nextOpen = !expandedMap[item.id]
    setExpandedMap((prev) => ({
      ...prev,
      [item.id]: nextOpen,
    }))

    if (nextOpen && !previewMap[item.id]) {
      void loadConflictPreview(item)
    }
  }

  function formatTime(value?: number | null): string {
    if (!value || !Number.isFinite(value)) {
      return '-'
    }
    return new Date(value).toLocaleString()
  }

  function categoryLabel(category: SyncErrorCategory) {
    switch (category) {
      case 'none':
        return t('sync.errorCategoryNone')
      case 'auth':
        return t('sync.errorCategoryAuth')
      case 'network':
        return t('sync.errorCategoryNetwork')
      case 'config':
        return t('sync.errorCategoryConfig')
      case 'conflict':
        return t('sync.errorCategoryConflict')
      case 'local':
        return t('sync.errorCategoryLocal')
      case 'remote':
        return t('sync.errorCategoryRemote')
      default:
        return t('sync.errorCategoryUnknown')
    }
  }

  function healthLabel(health: SyncHealth) {
    switch (health) {
      case 'healthy':
        return t('sync.healthHealthy')
      case 'degraded':
        return t('sync.healthDegraded')
      default:
        return t('sync.healthSyncing')
    }
  }

  async function handleExportDiagnostics() {
    if (!baseDataRoot) {
      return
    }

    setExportingDiagnostics(true)
    setMessage('')
    try {
      const fileName = buildDiagnosticFileName()
      const path = joinPath(baseDataRoot, 'sync-diagnostics', fileName)
      const safeConfig = webdavConfig
        ? {
            ...webdavConfig,
            password: webdavConfig.password ? '[REDACTED]' : '',
          }
        : null
      const payload = {
        exportedAt: new Date().toISOString(),
        dataRoot: baseDataRoot,
        status,
        health: syncHealth,
        errorCategory,
        autoPull: {
          enabled: Boolean(webdavConfig?.autoPullEnabled),
          intervalSec: webdavConfig?.autoPullIntervalSec ?? null,
          nextAttemptInSec: nextAutoPullInSec,
        },
        conflicts: conflicts.map((item) => ({
          id: item.id,
          path: item.path,
          localSha: item.localSha,
          remoteSha: item.remoteSha,
          conflictCopyPath: item.conflictCopyPath ?? null,
          createdAt: item.createdAt,
          status: item.status,
          remotePresent: item.remotePresent,
        })),
        webdavConfig: safeConfig,
        runtime: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform,
        },
      }

      await writeTextFile(baseDataRoot, path, JSON.stringify(payload, null, 2))
      setMessage(t('sync.diagnosticExported', { path }))
    } catch (error) {
      const details = error instanceof Error ? error.message : t('sync.diagnosticExportFailed')
      setMessage(`${t('sync.diagnosticExportFailed')} ${details}`)
    } finally {
      setExportingDiagnostics(false)
    }
  }

  const selectedCount = useMemo(
    () => conflicts.reduce((count, item) => count + (selectedConflictIds[item.id] ? 1 : 0), 0),
    [conflicts, selectedConflictIds],
  )
  const allSelected = conflicts.length > 0 && selectedCount === conflicts.length
  const hasSelection = selectedCount > 0
  const isResolvingBusy = Boolean(resolvingId) || batchResolving
  const syncHealth = deriveSyncHealth(status, syncing || batchResolving)
  const errorCategory = classifySyncError(status?.lastError)
  const lastSyncAt = Math.max(status?.lastPullAt ?? 0, status?.lastPushAt ?? 0)
  const nextAutoPullInSec = useMemo(() => {
    if (!webdavConfig?.enabled || !webdavConfig.autoPullEnabled) {
      return null
    }
    const intervalSec = Math.max(5, Math.round(webdavConfig.autoPullIntervalSec || 30))
    const lastPoint = Math.max(status?.lastPullAt ?? 0, status?.lastPushAt ?? 0)
    if (!lastPoint) {
      return 0
    }
    return Math.max(0, Math.ceil((lastPoint + intervalSec * 1000 - nowMs) / 1000))
  }, [nowMs, status?.lastPullAt, status?.lastPushAt, webdavConfig])

  return (
    <section className="space-y-4">
      <PageHeader
        title={t('sync.title')}
        description={t('sync.description')}
      />

      <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{t('sync.statusTitle')}</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-60"
              disabled={loading || refreshing || syncing || !baseDataRoot}
              onClick={() => void handleRefresh()}
            >
              {refreshing ? t('sync.refreshing') : t('sync.refresh')}
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-60"
              disabled={loading || exportingDiagnostics || !baseDataRoot}
              onClick={() => void handleExportDiagnostics()}
            >
              {exportingDiagnostics ? t('sync.exportingDiagnostics') : t('sync.exportDiagnostics')}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md bg-teal-700 px-3 py-1.5 text-sm text-white disabled:opacity-60"
            disabled={syncing || !baseDataRoot}
            onClick={() => void handleSync('both')}
          >
            {syncing ? t('sync.syncing') : t('sync.syncBoth')}
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-60"
            disabled={syncing || !baseDataRoot}
            onClick={() => void handleSync('push')}
          >
            {t('sync.syncPush')}
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-60"
            disabled={syncing || !baseDataRoot}
            onClick={() => void handleSync('pull')}
          >
            {t('sync.syncPull')}
          </button>
        </div>

        <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
          <p>{t('sync.health')}: {healthLabel(syncHealth)}</p>
          <p>{t('sync.errorCategory')}: {categoryLabel(errorCategory)}</p>
          <p>{t('sync.pendingChanges')}: {status?.pendingChanges ?? '-'}</p>
          <p>{t('sync.conflicts')}: {status?.conflictsCount ?? '-'}</p>
          <p>{t('sync.lastPush')}: {formatTime(status?.lastPushAt)}</p>
          <p>{t('sync.lastPull')}: {formatTime(status?.lastPullAt)}</p>
          <p>{t('sync.lastAttempt')}: {formatTime(status?.lastAttemptAt)}</p>
          <p>{t('sync.lastSuccess')}: {formatTime(status?.lastSuccessAt)}</p>
          <p>{t('sync.lastFailure')}: {formatTime(status?.lastFailureAt)}</p>
          <p>{t('sync.consecutiveFailures')}: {status?.consecutiveFailures ?? 0}</p>
          <p>{t('sync.totalSuccesses')}: {status?.totalSuccesses ?? 0}</p>
          <p>{t('sync.totalFailures')}: {status?.totalFailures ?? 0}</p>
          <p>{t('sync.lastSync')}: {formatTime(lastSyncAt || null)}</p>
          <p>
            {t('sync.nextAutoPull')}:{' '}
            {!webdavConfig?.enabled || !webdavConfig.autoPullEnabled
              ? t('sync.autoPullDisabled')
              : nextAutoPullInSec == null || nextAutoPullInSec <= 0
                ? t('sync.nextAutoPullNow')
                : t('sync.autoPullEvery', { seconds: nextAutoPullInSec })}
          </p>
        </div>
        {status?.lastError ? <p className="mt-2 text-sm text-rose-700">{status.lastError}</p> : null}
        {message ? <p className="mt-2 text-sm text-slate-700">{message}</p> : null}
      </article>

      <article className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">{t('sync.conflictList')}</h2>
          <p className="text-xs text-slate-600">{t('sync.selectedCount', { count: selectedCount })}</p>
        </div>
        {loading ? <p className="mt-2 text-sm text-slate-600">{t('common.loading')}</p> : null}
        {!loading && conflicts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">{t('sync.noConflicts')}</p>
        ) : null}
        {conflicts.length > 0 ? (
          <div className="mt-3 rounded-md border border-indigo-200 bg-indigo-50/40 p-2">
            <p className="text-xs font-semibold text-indigo-800">{t('sync.presetActions')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border border-indigo-300 px-2 py-1 text-xs text-indigo-700 disabled:opacity-60"
                disabled={batchResolving}
                onClick={() => void handleApplyPresetToAll('keep_local')}
              >
                {batchResolving ? t('sync.batchResolving') : t('sync.presetKeepLocalAll')}
              </button>
              <button
                type="button"
                className="rounded-md border border-indigo-300 bg-indigo-100 px-2 py-1 text-xs text-indigo-800 disabled:opacity-60"
                disabled={batchResolving}
                onClick={() => void handleApplyPresetToAll('apply_remote')}
              >
                {batchResolving ? t('sync.batchResolving') : t('sync.presetApplyRemoteAll')}
              </button>
              <button
                type="button"
                className="rounded-md border border-indigo-300 px-2 py-1 text-xs text-indigo-700 disabled:opacity-60"
                disabled={batchResolving}
                onClick={() => void handleApplyPresetToAll('mark_resolved')}
              >
                {batchResolving ? t('sync.batchResolving') : t('sync.presetMarkResolvedAll')}
              </button>
            </div>
          </div>
        ) : null}
        {conflicts.length > 0 ? (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2">
            <p className="text-xs font-semibold text-slate-700">{t('sync.batchActions')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-60"
                disabled={batchResolving}
                onClick={() =>
                  setSelectedConflictIds(
                    allSelected
                      ? {}
                      : Object.fromEntries(conflicts.map((item) => [item.id, true])),
                  )
                }
              >
                {allSelected ? t('sync.clearSelection') : t('sync.selectAll')}
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-60"
                disabled={!hasSelection || batchResolving}
                onClick={() => void handleResolveSelected('keep_local')}
              >
                {batchResolving ? t('sync.batchResolving') : t('sync.batchKeepLocal')}
              </button>
              <button
                type="button"
                className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs text-indigo-700 disabled:opacity-60"
                disabled={!hasSelection || batchResolving}
                onClick={() => void handleResolveSelected('apply_remote')}
              >
                {batchResolving ? t('sync.batchResolving') : t('sync.batchApplyRemote')}
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-60"
                disabled={!hasSelection || batchResolving}
                onClick={() => void handleResolveSelected('mark_resolved')}
              >
                {batchResolving ? t('sync.batchResolving') : t('sync.batchMarkResolved')}
              </button>
            </div>
          </div>
        ) : null}
        <div className="mt-3 space-y-3">
          {conflicts.map((item) => {
            const preview = previewMap[item.id]
            const expanded = Boolean(expandedMap[item.id])
            const resolving = resolvingId === item.id
            const diffRows = (preview?.rows ?? []).filter((row) => !showOnlyChanges || row.kind !== 'same')
            return (
              <div key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                <label className="mb-1 flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedConflictIds[item.id])}
                    onChange={(event) =>
                      setSelectedConflictIds((prev) => ({
                        ...prev,
                        [item.id]: event.target.checked,
                      }))
                    }
                    disabled={batchResolving}
                  />
                  {t('sync.selectThis')}
                </label>
                <p className="font-medium text-slate-900">{item.path}</p>
                <p className="mt-1 text-xs text-slate-600">{t('sync.createdAt')}: {formatTime(item.createdAt)}</p>
                <p className="mt-1 text-xs break-all text-slate-600">{t('sync.localSha')}: {item.localSha || '-'}</p>
                <p className="text-xs break-all text-slate-600">{t('sync.remoteSha')}: {item.remoteSha || '-'}</p>
                {item.conflictCopyPath ? (
                  <p className="text-xs break-all text-slate-600">{t('sync.conflictCopy')}: {item.conflictCopyPath}</p>
                ) : null}

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                    onClick={() => void handleResolve(item.id, 'keep_local')}
                    disabled={resolving || isResolvingBusy}
                  >
                    {resolving ? t('sync.resolving') : t('sync.keepLocal')}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs text-indigo-700"
                    onClick={() => void handleResolve(item.id, 'apply_remote')}
                    disabled={resolving || isResolvingBusy}
                  >
                    {resolving ? t('sync.resolving') : t('sync.applyRemote')}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                    onClick={() => void handleResolve(item.id, 'mark_resolved')}
                    disabled={resolving || isResolvingBusy}
                  >
                    {resolving ? t('sync.resolving') : t('sync.markResolved')}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                    onClick={() => void handleTogglePreview(item)}
                  >
                    {expanded ? t('sync.hidePreview') : t('sync.showPreview')}
                  </button>
                </div>

                {expanded ? (
                  <div className="mt-3 space-y-3">
                    <div className="rounded-md border border-slate-200 bg-white p-2">
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="font-semibold text-slate-700">{t('sync.diffView')}</span>
                        <label className="ml-auto inline-flex items-center gap-1 text-slate-700">
                          <input
                            type="checkbox"
                            checked={showOnlyChanges}
                            onChange={(event) => setShowOnlyChanges(event.target.checked)}
                          />
                          {t('sync.showOnlyChanges')}
                        </label>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">{t('sync.diffSame')}</span>
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-700">{t('sync.diffRemoved')}</span>
                        <span className="rounded bg-teal-100 px-1.5 py-0.5 text-teal-700">{t('sync.diffAdded')}</span>
                      </div>
                      {preview?.loading ? (
                        <p className="text-xs text-slate-600">{t('common.loading')}</p>
                      ) : diffRows.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-[680px] w-full border-collapse text-[11px]">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-600">
                                <th className="w-10 py-1 text-left">L#</th>
                                <th className="py-1 text-left">{t('sync.localPreview')}</th>
                                <th className="w-10 py-1 text-left">R#</th>
                                <th className="py-1 text-left">{t('sync.remotePreview')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {diffRows.map((row, idx) => {
                                const rowClass =
                                  row.kind === 'same'
                                    ? 'bg-white'
                                    : row.kind === 'remove'
                                      ? 'bg-rose-50'
                                      : 'bg-teal-50'
                                return (
                                  <tr key={`${item.id}-${idx}`} className={`${rowClass} border-b border-slate-100`}>
                                    <td className="px-1 py-1 align-top text-slate-500">{row.leftLineNo ?? ''}</td>
                                    <td className="px-1 py-1 align-top whitespace-pre-wrap break-words text-slate-800">{row.leftText || ' '}</td>
                                    <td className="px-1 py-1 align-top text-slate-500">{row.rightLineNo ?? ''}</td>
                                    <td className="px-1 py-1 align-top whitespace-pre-wrap break-words text-slate-800">{row.rightText || ' '}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-600">
                          {showOnlyChanges ? t('sync.noChangedRows') : t('sync.noDiff')}
                        </p>
                      )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-semibold text-slate-700">{t('sync.localPreview')}</p>
                      {preview?.loading ? (
                        <p className="text-xs text-slate-600">{t('common.loading')}</p>
                      ) : preview?.localError ? (
                        <p className="text-xs break-all text-rose-700">{preview.localError}</p>
                      ) : (
                        <pre className="max-h-56 overflow-auto rounded-md border border-slate-200 bg-white p-2 text-[11px] text-slate-700">{preview?.local || t('sync.previewUnavailable')}</pre>
                      )}
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-slate-700">{t('sync.remotePreview')}</p>
                      {preview?.loading ? (
                        <p className="text-xs text-slate-600">{t('common.loading')}</p>
                      ) : preview?.remoteError ? (
                        <p className="text-xs break-all text-rose-700">{preview.remoteError}</p>
                      ) : (
                        <pre className="max-h-56 overflow-auto rounded-md border border-slate-200 bg-white p-2 text-[11px] text-slate-700">{preview?.remote || t('sync.previewUnavailable')}</pre>
                      )}
                    </div>
                  </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </article>
    </section>
  )
}
