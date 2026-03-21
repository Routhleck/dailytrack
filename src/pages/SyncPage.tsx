import { useCallback, useEffect, useState } from 'react'

import { PageHeader } from '../components/PageHeader'
import { useI18n } from '../features/i18n/I18nContext'
import { useDataRoot } from '../features/settings/DataRootContext'
import {
  type RealtimeConflict,
  type RealtimeSyncStatus,
  readTextFile,
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

export function SyncPage() {
  const { t } = useI18n()
  const { baseDataRoot } = useDataRoot()
  const [status, setStatus] = useState<RealtimeSyncStatus | null>(null)
  const [conflicts, setConflicts] = useState<RealtimeConflict[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({})
  const [previewMap, setPreviewMap] = useState<Record<string, ConflictPreview>>({})
  const [showOnlyChanges, setShowOnlyChanges] = useState(true)

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!baseDataRoot) {
      return
    }

    if (!options?.silent) {
      setLoading(true)
    }

    try {
      const [nextStatus, nextConflicts] = await Promise.all([
        webdavRealtimeStatus(baseDataRoot),
        webdavRealtimeConflictsList(baseDataRoot),
      ])
      const unresolved = nextConflicts.filter((item) => item.status === 'unresolved')
      const unresolvedIds = new Set(unresolved.map((item) => item.id))
      setStatus(nextStatus)
      setConflicts(unresolved)
      setExpandedMap((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([id]) => unresolvedIds.has(id))),
      )
      setPreviewMap((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([id]) => unresolvedIds.has(id))),
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

  async function handleResolve(
    conflictId: string,
    strategy: 'keep_local' | 'apply_remote' | 'mark_resolved',
  ) {
    if (!baseDataRoot) {
      return
    }
    setResolvingId(conflictId)
    try {
      await webdavRealtimeConflictResolve(baseDataRoot, conflictId, strategy)
      setMessage(t('sync.resolveDone'))
      await load()
      emitDataChanged({ scope: 'all' })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('sync.resolveFailed'))
    } finally {
      setResolvingId(null)
    }
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

  return (
    <section className="space-y-4">
      <PageHeader
        title={t('sync.title')}
        description={t('sync.description')}
      />

      <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{t('sync.statusTitle')}</h2>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-60"
            disabled={loading || refreshing || syncing || !baseDataRoot}
            onClick={() => void handleRefresh()}
          >
            {refreshing ? t('sync.refreshing') : t('sync.refresh')}
          </button>
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
          <p>{t('sync.pendingChanges')}: {status?.pendingChanges ?? '-'}</p>
          <p>{t('sync.conflicts')}: {status?.conflictsCount ?? '-'}</p>
          <p>{t('sync.lastPush')}: {formatTime(status?.lastPushAt)}</p>
          <p>{t('sync.lastPull')}: {formatTime(status?.lastPullAt)}</p>
        </div>
        {status?.lastError ? <p className="mt-2 text-sm text-rose-700">{status.lastError}</p> : null}
        {message ? <p className="mt-2 text-sm text-slate-700">{message}</p> : null}
      </article>

      <article className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('sync.conflictList')}</h2>
        {loading ? <p className="mt-2 text-sm text-slate-600">{t('common.loading')}</p> : null}
        {!loading && conflicts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">{t('sync.noConflicts')}</p>
        ) : null}
        <div className="mt-3 space-y-3">
          {conflicts.map((item) => {
            const preview = previewMap[item.id]
            const expanded = Boolean(expandedMap[item.id])
            const resolving = resolvingId === item.id
            const diffRows = (preview?.rows ?? []).filter((row) => !showOnlyChanges || row.kind !== 'same')
            return (
              <div key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
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
                    disabled={resolving}
                  >
                    {resolving ? t('sync.resolving') : t('sync.keepLocal')}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs text-indigo-700"
                    onClick={() => void handleResolve(item.id, 'apply_remote')}
                    disabled={resolving}
                  >
                    {resolving ? t('sync.resolving') : t('sync.applyRemote')}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                    onClick={() => void handleResolve(item.id, 'mark_resolved')}
                    disabled={resolving}
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
