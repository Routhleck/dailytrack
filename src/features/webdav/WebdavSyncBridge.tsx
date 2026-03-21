import { useEffect, useRef, useState } from 'react'

import { getWebdavConfig, webdavRealtimeSyncNow } from '../../lib/fs/fileApi'
import { emitDataChanged, onDataChanged } from '../../lib/liveSync'
import { useDataRoot } from '../settings/DataRootContext'

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
    let intervalId: number | null = null

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
        if (disposed || !config.enabled || config.autoPushIntervalMin <= 0) {
          return
        }

        void sync('both')

        intervalId = window.setInterval(() => {
          void sync('both')
        }, config.autoPushIntervalMin * 60 * 1000)

        const onVisibility = () => {
          if (document.visibilityState === 'visible') {
            void sync('both')
            return
          }

          void sync('push')
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
      if (intervalId != null) {
        window.clearInterval(intervalId)
      }
    }
  }, [baseDataRoot, reloadToken])

  return null
}
