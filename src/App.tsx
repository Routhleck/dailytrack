import { RouterProvider } from 'react-router-dom'

import { router } from './app/router'
import { DataRootProvider } from './features/settings/DataRootContext'

function App() {
  return (
    <DataRootProvider>
      <RouterProvider router={router} />
    </DataRootProvider>
  )
}

export default App
