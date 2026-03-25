import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router-dom'

import { preloadRoutePages, router } from './app/router'
import { ToastProvider, ToastViewport } from './features/feedback/ToastContext'
import { I18nProvider } from './features/i18n/I18nContext'
import { PreferencesProvider } from './features/preferences/PreferencesContext'
import { FilesystemWatchBridge } from './features/settings/FilesystemWatchBridge'
import { DataRootProvider } from './features/settings/DataRootContext'
import { UpdaterProvider } from './features/updater/UpdaterContext'
import { WebdavSyncBridge } from './features/webdav/WebdavSyncBridge'
import {
  initRuntimePerf,
  markRuntimePerf,
  recordRuntimePerfSeries,
} from './lib/perf/runtimePerf'

function App() {
  const [bridgesReady, setBridgesReady] = useState(false)

  useEffect(() => {
    initRuntimePerf()
    markRuntimePerf('app_mounted')
    const frameStart = performance.now()
    const frameId = window.requestAnimationFrame(() => {
      recordRuntimePerfSeries('app_mount_to_first_frame_ms', performance.now() - frameStart)
      markRuntimePerf('app_first_frame')
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [])

  useEffect(() => {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    const isMobileRuntime = /android|iphone|ipad|ipod/i.test(userAgent)
    if (isMobileRuntime) {
      return
    }

    const fallbackTimer = window.setTimeout(() => {
      markRuntimePerf('preload_routes_fallback')
      void preloadRoutePages()
    }, 1800)

    let idleId: number | null = null
    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(() => {
        markRuntimePerf('preload_routes_idle')
        void preloadRoutePages()
      }, { timeout: 3000 })
    }

    return () => {
      window.clearTimeout(fallbackTimer)
      if (idleId != null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId)
      }
    }
  }, [])

  useEffect(() => {
    const startMs = performance.now()
    const timer = window.setTimeout(() => {
      setBridgesReady(true)
      recordRuntimePerfSeries('startup_to_background_bridges_ms', performance.now() - startMs)
      markRuntimePerf('background_bridges_ready')
    }, 1700)

    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  return (
    <I18nProvider>
      <UpdaterProvider>
        <DataRootProvider>
          <PreferencesProvider>
            <ToastProvider>
              {bridgesReady ? <FilesystemWatchBridge /> : null}
              {bridgesReady ? <WebdavSyncBridge /> : null}
              <RouterProvider router={router} />
              <ToastViewport />
            </ToastProvider>
          </PreferencesProvider>
        </DataRootProvider>
      </UpdaterProvider>
    </I18nProvider>
  )
}

export default App
