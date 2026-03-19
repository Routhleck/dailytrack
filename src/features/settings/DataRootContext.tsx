import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  createProfile as createProfileApi,
  deleteProfile as deleteProfileApi,
  ensureDataRoot,
  ensureProfile,
  listProfiles,
  migrateDataRoot as migrateDataRootApi,
} from '../../lib/fs/fileApi'
import {
  loadActiveProfilePreference,
  loadDataRootPreference,
  saveActiveProfilePreference,
  saveDataRootPreference,
} from './settings.store'
import { emitDataChanged } from '../../lib/liveSync'

type ProfileCreateOptions = {
  dailyTemplate?: string
  weeklyTemplate?: string
}

type DataRootContextValue = {
  baseDataRoot: string | null
  dataRoot: string | null
  activeProfile: string | null
  profiles: string[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  updateDataRoot: (nextPath: string) => Promise<void>
  migrateDataRoot: (destinationPath: string, overwrite?: boolean) => Promise<void>
  switchProfile: (profileName: string) => Promise<void>
  createProfile: (profileName: string, options?: ProfileCreateOptions) => Promise<void>
  deleteProfile: (profileName: string) => Promise<void>
}

const DataRootContext = createContext<DataRootContextValue | undefined>(undefined)

export function DataRootProvider({ children }: { children: ReactNode }) {
  const [baseDataRoot, setBaseDataRoot] = useState<string | null>(null)
  const [dataRoot, setDataRoot] = useState<string | null>(null)
  const [activeProfile, setActiveProfile] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<string[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function bootstrap(rootOverride?: string, profileOverride?: string) {
    setLoading(true)
    setError(null)

    try {
      const root = await ensureDataRoot(rootOverride)
      const availableProfiles = await listProfiles(root)

      const preferredProfile =
        profileOverride ?? loadActiveProfilePreference() ?? availableProfiles[0] ?? null
      const nextProfile =
        preferredProfile && availableProfiles.includes(preferredProfile)
          ? preferredProfile
          : availableProfiles[0]

      if (!nextProfile) {
        throw new Error('No profile available')
      }

      const profileRoot = await ensureProfile(root, nextProfile)

      setBaseDataRoot(root)
      setProfiles(availableProfiles)
      setActiveProfile(nextProfile)
      setDataRoot(profileRoot)

      saveDataRootPreference(root)
      saveActiveProfilePreference(nextProfile)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize data root')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const preferredRoot = loadDataRootPreference() ?? undefined
    const preferredProfile = loadActiveProfilePreference() ?? undefined
    void bootstrap(preferredRoot, preferredProfile)
  }, [])

  const value = useMemo<DataRootContextValue>(
    () => ({
      baseDataRoot,
      dataRoot,
      activeProfile,
      profiles,
      loading,
      error,
      refresh: async () => {
        await bootstrap(baseDataRoot ?? loadDataRootPreference() ?? undefined, activeProfile ?? undefined)
      },
      updateDataRoot: async (nextPath: string) => {
        await bootstrap(nextPath)
        emitDataChanged({ scope: 'settings' })
      },
      migrateDataRoot: async (destinationPath: string, overwrite = false) => {
        if (!baseDataRoot) {
          throw new Error('Data root is not initialized')
        }

        const nextRoot = await migrateDataRootApi(baseDataRoot, destinationPath, overwrite)
        await bootstrap(nextRoot, activeProfile ?? undefined)
        emitDataChanged({ scope: 'settings' })
      },
      switchProfile: async (profileName: string) => {
        if (!baseDataRoot) {
          throw new Error('Data root is not initialized')
        }
        await bootstrap(baseDataRoot, profileName)
        emitDataChanged({ scope: 'profile', profile: profileName })
      },
      createProfile: async (profileName: string, options?: ProfileCreateOptions) => {
        if (!baseDataRoot) {
          throw new Error('Data root is not initialized')
        }

        await createProfileApi(
          baseDataRoot,
          profileName,
          options?.dailyTemplate,
          options?.weeklyTemplate,
        )
        await bootstrap(baseDataRoot, profileName)
        emitDataChanged({ scope: 'profile', profile: profileName })
      },
      deleteProfile: async (profileName: string) => {
        if (!baseDataRoot) {
          throw new Error('Data root is not initialized')
        }

        const fallbackProfile = await deleteProfileApi(baseDataRoot, profileName)
        await bootstrap(baseDataRoot, activeProfile === profileName ? fallbackProfile : activeProfile ?? undefined)
        emitDataChanged({ scope: 'profile', profile: fallbackProfile })
      },
    }),
    [activeProfile, baseDataRoot, dataRoot, error, loading, profiles],
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
