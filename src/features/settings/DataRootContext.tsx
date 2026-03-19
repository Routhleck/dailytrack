import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { ensureDataRoot } from '../../lib/fs/fileApi'
import { loadDataRootPreference, saveDataRootPreference } from './settings.store'

type DataRootContextValue = {
  dataRoot: string | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  updateDataRoot: (nextPath: string) => Promise<void>
}

const DataRootContext = createContext<DataRootContextValue | undefined>(undefined)

export function DataRootProvider({ children }: { children: ReactNode }) {
  const [dataRoot, setDataRoot] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function bootstrap(rootOverride?: string) {
    setLoading(true)
    setError(null)

    try {
      const root = await ensureDataRoot(rootOverride)
      setDataRoot(root)
      saveDataRootPreference(root)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize data root')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const preferred = loadDataRootPreference() ?? undefined
    void bootstrap(preferred)
  }, [])

  const value = useMemo<DataRootContextValue>(
    () => ({
      dataRoot,
      loading,
      error,
      refresh: async () => {
        await bootstrap(dataRoot ?? loadDataRootPreference() ?? undefined)
      },
      updateDataRoot: async (nextPath: string) => {
        await bootstrap(nextPath)
      },
    }),
    [dataRoot, error, loading],
  )

  return <DataRootContext.Provider value={value}>{children}</DataRootContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDataRoot() {
  const ctx = useContext(DataRootContext)
  if (!ctx) {
    throw new Error('useDataRoot must be used inside DataRootProvider')
  }

  return ctx
}
