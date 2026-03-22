import { useEffect, useRef, useState } from 'react'

import { getWebdavConfig, webdavRealtimeSyncNow } from '../../lib/fs/fileApi'
import { emitDataChanged, onDataChanged } from '../../lib/liveSync'
import { useDataRoot } from '../settings/DataRootContext'

const DEFAULT_AUTO_PULL_INTERVAL_MS = 30_000

export function WebdavSyncBridge() {
  const { baseDataRoot } = useDataRoot()
  const [reloadToken, setReloadToken] = useState(0)
  const busyRef = useRef(false)

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

    async function sync(direction: 'push' | 'pull' | 'both') {
      if (busyRef.current) {
        return
      }

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

    async function setup() {
      try {
        const config = await getWebdavConfig()
        if (disposed || !config.enabled) {
          return
        }

        if (config.autoPushIntervalMin > 0) {
          void sync('both')

          autoSyncIntervalId = window.setInterval(() => {
            void sync('both')
          }, config.autoPushIntervalMin * 60 * 1000)
        }

        if (config.autoPullEnabled) {
          const pullIntervalMs = Math.max(
            5_000,
            Number.isFinite(config.autoPullIntervalSec)
              ? Math.round(config.autoPullIntervalSec * 1000)
              : DEFAULT_AUTO_PULL_INTERVAL_MS,
          )
          const autoPullDirection: 'pull' | 'both' = config.autoPushIntervalMin > 0 ? 'pull' : 'both'

          void sync(autoPullDirection)
          autoPullIntervalId = window.setInterval(() => {
            void sync(autoPullDirection)
          }, pullIntervalMs)
        }

        const onVisibility = () => {
          if (document.visibilityState === 'visible') {
            if (config.autoPullEnabled) {
              void sync(config.autoPushIntervalMin > 0 ? 'pull' : 'both')
            }
            if (config.autoPushIntervalMin > 0) {
              void sync('both')
            }
            return
          }

          if (config.autoPushIntervalMin > 0) {
            void sync('push')
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
    }
  }, [baseDataRoot, reloadToken])

  return null
}
