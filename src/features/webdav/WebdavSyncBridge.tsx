import { useEffect, useRef, useState } from 'react'

import { getWebdavConfig, webdavRealtimeSyncNow } from '../../lib/fs/fileApi'
import { emitDataChanged, onDataChanged } from '../../lib/liveSync'
import { useDataRoot } from '../settings/DataRootContext'

const DEFAULT_AUTO_PULL_INTERVAL_MS = 30_000
const INITIAL_SYNC_DELAY_MS = 3_500
const VISIBILITY_SYNC_DELAY_MS = 2_600
const MIN_SYNC_GAP_MS = 3_500

export function WebdavSyncBridge() {
  const { baseDataRoot } = useDataRoot()
  const [reloadToken, setReloadToken] = useState(0)
  const busyRef = useRef(false)
  const lastSyncRequestedAtRef = useRef(0)

  useEffect(() => {
    const unsubscribe = onDataChanged((detail) => {
      if (detail.scope === 'settings') {
        setReloadToken((value) => value + 1)
      }
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (!baseDataRoot) {
      return
    }
    const root = baseDataRoot

    let disposed = false
    let autoSyncIntervalId: number | null = null
    let autoPullIntervalId: number | null = null
    const timerIds = new Set<number>()

    async function sync(direction: 'push' | 'pull' | 'both') {
      const now = Date.now()
      if (now - lastSyncRequestedAtRef.current < MIN_SYNC_GAP_MS) {
        return
      }
      if (busyRef.current) {
        return
      }

      lastSyncRequestedAtRef.current = now
      busyRef.current = true
      try {
        const result = await webdavRealtimeSyncNow(root, direction)
        if (disposed) {
          return
        }

        if (result.pushed > 0 || result.pulled > 0 || result.conflicts > 0) {
          emitDataChanged({ scope: 'all' })
        }
      } catch (error) {
        console.warn('[webdav] realtime sync failed', error)
      } finally {
        busyRef.current = false
      }
    }

    function scheduleSync(direction: 'push' | 'pull' | 'both', delayMs = 0) {
      const timeoutId = window.setTimeout(() => {
        timerIds.delete(timeoutId)
        if (disposed) {
          return
        }
        if (document.visibilityState !== 'visible' && direction !== 'push') {
          return
        }
        void sync(direction)
      }, Math.max(0, delayMs))
      timerIds.add(timeoutId)
    }

    async function setup() {
      try {
        const config = await getWebdavConfig()
        if (disposed || !config.enabled) {
          return
        }
        const hasAutoPush = config.autoPushIntervalMin > 0
        const hasAutoPull = config.autoPullEnabled
        const autoPullDirection: 'pull' | 'both' = hasAutoPush ? 'pull' : 'both'

        if (hasAutoPush || hasAutoPull) {
          scheduleSync(hasAutoPush ? 'both' : autoPullDirection, INITIAL_SYNC_DELAY_MS)
        }

        if (hasAutoPush) {
          autoSyncIntervalId = window.setInterval(() => {
            if (document.visibilityState !== 'visible') {
              return
            }
            scheduleSync('both')
          }, config.autoPushIntervalMin * 60 * 1000)
        }

        if (hasAutoPull) {
          const pullIntervalMs = Math.max(
            5_000,
            Number.isFinite(config.autoPullIntervalSec)
              ? Math.round(config.autoPullIntervalSec * 1000)
              : DEFAULT_AUTO_PULL_INTERVAL_MS,
          )
          autoPullIntervalId = window.setInterval(() => {
            if (document.visibilityState !== 'visible') {
              return
            }
            scheduleSync(autoPullDirection)
          }, pullIntervalMs)
        }

        const onVisibility = () => {
          if (document.visibilityState === 'visible') {
            if (hasAutoPush || hasAutoPull) {
              scheduleSync(hasAutoPush ? 'both' : autoPullDirection, VISIBILITY_SYNC_DELAY_MS)
            }
            return
          }

          if (hasAutoPush) {
            scheduleSync('push')
          }
        }

        document.addEventListener('visibilitychange', onVisibility)

        return () => {
          document.removeEventListener('visibilitychange', onVisibility)
        }
      } catch (error) {
        console.warn('[webdav] failed to start realtime sync bridge', error)
      }
    }

    let cleanupVisibility: (() => void) | null = null
    void setup().then((cleanup) => {
      cleanupVisibility = cleanup ?? null
    })

    return () => {
      disposed = true
      if (cleanupVisibility) {
        cleanupVisibility()
      }
      if (autoSyncIntervalId != null) {
        window.clearInterval(autoSyncIntervalId)
      }
      if (autoPullIntervalId != null) {
        window.clearInterval(autoPullIntervalId)
      }
      for (const timerId of timerIds) {
        window.clearTimeout(timerId)
      }
      timerIds.clear()
    }
  }, [baseDataRoot, reloadToken])

  return null
}
