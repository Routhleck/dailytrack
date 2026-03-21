import { useCallback, useEffect, useState } from 'react'

import { PageHeader } from '../components/PageHeader'
import { useI18n } from '../features/i18n/I18nContext'
import { useDataRoot } from '../features/settings/DataRootContext'
import {
  type RealtimeConflict,
  type RealtimeSyncStatus,
  webdavRealtimeConflictResolve,
  webdavRealtimeConflictsList,
  webdavRealtimeStatus,
  webdavRealtimeSyncNow,
} from '../lib/fs/fileApi'
import { emitDataChanged } from '../lib/liveSync'

export function SyncPage() {
  const { t } = useI18n()
  const { baseDataRoot } = useDataRoot()
  const [status, setStatus] = useState<RealtimeSyncStatus | null>(null)
  const [conflicts, setConflicts] = useState<RealtimeConflict[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    if (!baseDataRoot) {
      return
    }
    setLoading(true)
    try {
      const [nextStatus, nextConflicts] = await Promise.all([
        webdavRealtimeStatus(baseDataRoot),
        webdavRealtimeConflictsList(baseDataRoot),
      ])
      setStatus(nextStatus)
      setConflicts(nextConflicts.filter((item) => item.status === 'unresolved'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('sync.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [baseDataRoot, t])

  useEffect(() => {
    void load()
  }, [load])

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
    try {
      await webdavRealtimeConflictResolve(baseDataRoot, conflictId, strategy)
      setMessage(t('sync.resolveDone'))
      await load()
      emitDataChanged({ scope: 'all' })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('sync.resolveFailed'))
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
          {conflicts.map((item) => (
            <div key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-900">{item.path}</p>
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
                >
                  {t('sync.keepLocal')}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs text-indigo-700"
                  onClick={() => void handleResolve(item.id, 'apply_remote')}
                >
                  {t('sync.applyRemote')}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                  onClick={() => void handleResolve(item.id, 'mark_resolved')}
                >
                  {t('sync.markResolved')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  )
}
