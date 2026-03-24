import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'

import { preloadRoutePages, router } from './app/router'
import { ToastProvider, ToastViewport } from './features/feedback/ToastContext'
import { I18nProvider } from './features/i18n/I18nContext'
import { PreferencesProvider } from './features/preferences/PreferencesContext'
import { FilesystemWatchBridge } from './features/settings/FilesystemWatchBridge'
import { DataRootProvider } from './features/settings/DataRootContext'
import { UpdaterProvider } from './features/updater/UpdaterContext'
import { WebdavSyncBridge } from './features/webdav/WebdavSyncBridge'

function App() {
  useEffect(() => {
    const preloadTimer = window.setTimeout(() => {
      void preloadRoutePages()
    }, 350)

    return () => {
      window.clearTimeout(preloadTimer)
    }
  }, [])

  return (
    <I18nProvider>
      <UpdaterProvider>
        <DataRootProvider>
          <PreferencesProvider>
            <ToastProvider>
              <FilesystemWatchBridge />
              <WebdavSyncBridge />
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
