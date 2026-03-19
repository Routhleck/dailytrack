import { RouterProvider } from 'react-router-dom'

import { router } from './app/router'
import { PreferencesProvider } from './features/preferences/PreferencesContext'
import { DataRootProvider } from './features/settings/DataRootContext'

function App() {
  return (
    <DataRootProvider>
      <PreferencesProvider>
        <RouterProvider router={router} />
      </PreferencesProvider>
    </DataRootProvider>
  )
}

export default App
