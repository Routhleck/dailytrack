import { RouterProvider } from 'react-router-dom'

import { router } from './app/router'
import { I18nProvider } from './features/i18n/I18nContext'
import { PreferencesProvider } from './features/preferences/PreferencesContext'
import { DataRootProvider } from './features/settings/DataRootContext'

function App() {
  return (
    <I18nProvider>
      <DataRootProvider>
        <PreferencesProvider>
          <RouterProvider router={router} />
        </PreferencesProvider>
      </DataRootProvider>
    </I18nProvider>
  )
}

export default App
