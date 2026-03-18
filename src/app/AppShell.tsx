import { Outlet } from 'react-router-dom'

import { Sidebar } from '../components/Sidebar'
import { useDataRoot } from '../features/settings/DataRootContext'

export function AppShell() {
  const { dataRoot, loading, error } = useDataRoot()

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1400px] border-x border-slate-200 bg-white shadow-sm">
        <Sidebar />
        <main className="flex-1 px-8 py-6">
          <div className="mb-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            {loading && 'Initializing local data folder...'}
            {!loading && !error && `Data root: ${dataRoot}`}
            {!loading && error && `Initialization error: ${error}`}
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
