import { useEffect, useRef, useState } from 'react'

import { getWebdavConfig, pushWebdavSnapshot } from '../../lib/fs/fileApi'
import { onDataChanged } from '../../lib/liveSync'
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

    async function setup() {
      try {
        const config = await getWebdavConfig()
        if (disposed || !config.enabled || config.autoPushIntervalMin <= 0) {
          return
        }

        intervalId = window.setInterval(() => {
          if (busyRef.current) {
            return
          }

          busyRef.current = true
          void pushWebdavSnapshot(root, 'Auto push')
            .catch((error) => {
              console.warn('[webdav] auto push failed', error)
            })
            .finally(() => {
              busyRef.current = false
            })
        }, config.autoPushIntervalMin * 60 * 1000)
      } catch (error) {
        console.warn('[webdav] failed to start auto push bridge', error)
      }
    }

    void setup()

    return () => {
      disposed = true
      if (intervalId != null) {
        window.clearInterval(intervalId)
      }
    }
  }, [baseDataRoot, reloadToken])

  return null
}
