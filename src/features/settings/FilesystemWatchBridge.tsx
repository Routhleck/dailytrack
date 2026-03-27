import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { useEffect } from 'react'

import {
  startDataRootWatch,
  stopDataRootWatch,
  type FsChangedEventPayload,
} from '../../lib/fs/fileApi'
import { emitDataChanged, FS_CHANGED_EVENT_NAME } from '../../lib/liveSync'
import { invalidateTrackerMemoryByFsEvent } from '../../lib/state/trackerMemoryStore'
import { usePreferences } from '../preferences/PreferencesContext'
import { useDataRoot } from './DataRootContext'

export function FilesystemWatchBridge() {
  const { dataRoot } = useDataRoot()
  const { preferences, loading } = usePreferences()

  useEffect(() => {
    if (!dataRoot || loading || preferences.sync.mode !== 'watch') {
      return
    }

    let unlisten: UnlistenFn | null = null

    void (async () => {
      try {
        await startDataRootWatch(dataRoot)
        unlisten = await listen<FsChangedEventPayload>(FS_CHANGED_EVENT_NAME, (event) => {
          const payload = event.payload
          invalidateTrackerMemoryByFsEvent(dataRoot, payload.scope, payload.path)
          emitDataChanged({
            scope: payload.scope,
            path: payload.path,
          })
        })
      } catch (error) {
        console.warn('[sync] failed to start filesystem watch; polling fallback remains active', error)
      }
    })()

    return () => {
      if (unlisten) {
        unlisten()
      }
      void stopDataRootWatch(dataRoot).catch((error) => {
        console.warn('[sync] failed to stop filesystem watch', error)
      })
    }
  }, [dataRoot, loading, preferences.sync.mode])

  return null
}
