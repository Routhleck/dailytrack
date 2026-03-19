import { RouterProvider } from 'react-router-dom'

import { router } from './app/router'
import { I18nProvider } from './features/i18n/I18nContext'
import { PreferencesProvider } from './features/preferences/PreferencesContext'
import { DataRootProvider } from './features/settings/DataRootContext'
import { UpdaterProvider } from './features/updater/UpdaterContext'

function App() {
  return (
    <I18nProvider>
      <UpdaterProvider>
        <DataRootProvider>
          <PreferencesProvider>
            <RouterProvider router={router} />
          </PreferencesProvider>
        </DataRootProvider>
      </UpdaterProvider>
    </I18nProvider>
  )
}

export default App
