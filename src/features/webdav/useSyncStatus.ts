import { useCallback, useEffect, useMemo, useState } from 'react'

import { getWebdavConfig, type RealtimeSyncStatus, type WebdavConfig, webdavRealtimeStatus } from '../../lib/fs/fileApi'
import { useDataRoot } from '../settings/DataRootContext'

const REFRESH_INTERVAL_MS = 10_000
const COUNTDOWN_TICK_MS = 5_000
const VISIBILITY_REFRESH_DELAY_MS = 1_400

export type SyncStatusSnapshot = {
  loading: boolean
  error: string | null
  online: boolean
  webdavEnabled: boolean
  autoPullEnabled: boolean
  autoPullIntervalSec: number
  status: RealtimeSyncStatus | null
  nextAutoPullInSec: number | null
  refresh: () => Promise<void>
}

function deriveNextAutoPullInSec(
  status: RealtimeSyncStatus | null,
  config: WebdavConfig | null,
  nowMs: number,
  anchorMs: number | null,
): number | null {
  if (!config?.enabled || !config.autoPullEnabled) {
    return null
  }
  const intervalSec = Math.max(5, Math.round(config.autoPullIntervalSec || 30))
  const lastPoint = Math.max(
    status?.lastPullAt ?? 0,
    status?.lastPushAt ?? 0,
    status?.lastAttemptAt ?? 0,
    anchorMs ?? 0,
  )
  if (!lastPoint) {
    return intervalSec
  }
  return Math.max(0, Math.ceil((lastPoint + intervalSec * 1000 - nowMs) / 1000))
}

const EMPTY_SNAPSHOT: SyncStatusSnapshot = {
  loading: false,
  error: null,
  online: true,
  webdavEnabled: false,
  autoPullEnabled: false,
  autoPullIntervalSec: 30,
  status: null,
  nextAutoPullInSec: null,
  refresh: async () => {},
}

export function useSyncStatus(options?: { enabled?: boolean }): SyncStatusSnapshot {
  const active = options?.enabled ?? true
  const { baseDataRoot } = useDataRoot()
  const [status, setStatus] = useState<RealtimeSyncStatus | null>(null)
  const [config, setConfig] = useState<WebdavConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [autoPullAnchorMs, setAutoPullAnchorMs] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    if (!baseDataRoot) {
      setStatus(null)
      setConfig(null)
      return
    }

    setLoading(true)
    try {
      const [nextConfig, nextStatus] = await Promise.all([
        getWebdavConfig(),
        webdavRealtimeStatus(baseDataRoot),
      ])
      setConfig(nextConfig)
      setStatus(nextStatus)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load sync status')
    } finally {
      setLoading(false)
    }
  }, [baseDataRoot])

  useEffect(() => {
    if (!active) {
      return
    }
    const timerId = window.setTimeout(() => {
      void refresh()
    }, 280)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [active, refresh])

  useEffect(() => {
    if (!active) {
      return
    }
    const timerId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh()
      }
    }, REFRESH_INTERVAL_MS)

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        return
      }
      window.setTimeout(() => {
        void refresh()
      }, VISIBILITY_REFRESH_DELAY_MS)
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.clearInterval(timerId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [active, refresh])

  useEffect(() => {
    if (!active || !config?.enabled || !config.autoPullEnabled) {
      return
    }

    const timerId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return
      }
      setNowMs(Date.now())
    }, COUNTDOWN_TICK_MS)

    return () => {
      window.clearInterval(timerId)
    }
  }, [active, config?.autoPullEnabled, config?.enabled])

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    if (!config?.enabled || !config.autoPullEnabled) {
      setAutoPullAnchorMs(null)
      return
    }

    const statusAnchor = Math.max(
      status?.lastPullAt ?? 0,
      status?.lastPushAt ?? 0,
      status?.lastAttemptAt ?? 0,
    )

    if (statusAnchor > 0) {
      setAutoPullAnchorMs(statusAnchor)
      return
    }

    setAutoPullAnchorMs((current) => current ?? Date.now())
  }, [
    config?.enabled,
    config?.autoPullEnabled,
    status?.lastPullAt,
    status?.lastPushAt,
    status?.lastAttemptAt,
  ])

  const nextAutoPullInSec = useMemo(
    () => deriveNextAutoPullInSec(status, config, nowMs, autoPullAnchorMs),
    [autoPullAnchorMs, config, nowMs, status],
  )

  if (!active) {
    return EMPTY_SNAPSHOT
  }

  return {
    loading,
    error,
    online,
    webdavEnabled: Boolean(config?.enabled),
    autoPullEnabled: Boolean(config?.enabled && config.autoPullEnabled),
    autoPullIntervalSec: Math.max(5, Math.round(config?.autoPullIntervalSec || 30)),
    status,
    nextAutoPullInSec,
    refresh,
  }
}
