import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type { TrackerPreferences } from '../../types/preferences'
import { useDataRoot } from '../settings/DataRootContext'
import {
  defaultPreferences,
  getPreferences,
  savePreferences,
} from './preferences.service'

type PreferencesContextValue = {
  preferences: TrackerPreferences
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  updatePreferences: (next: TrackerPreferences) => Promise<void>
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { dataRoot } = useDataRoot()
  const [preferences, setPreferences] = useState<TrackerPreferences>(defaultPreferences())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadFromRoot(root: string | null) {
    if (!root) {
      setPreferences(defaultPreferences())
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const next = await getPreferences(root)
      setPreferences(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadFromRoot(dataRoot)
  }, [dataRoot])

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      loading,
      error,
      refresh: async () => {
        await loadFromRoot(dataRoot)
      },
      updatePreferences: async (next) => {
        if (!dataRoot) {
          throw new Error('Data root is not ready')
        }

        const saved = await savePreferences(dataRoot, next)
        setPreferences(saved)
      },
    }),
    [dataRoot, error, loading, preferences],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePreferences() {
  const ctx = useContext(PreferencesContext)
  if (!ctx) {
    throw new Error('usePreferences must be used inside PreferencesProvider')
  }

  return ctx
}
