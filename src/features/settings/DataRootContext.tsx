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
  type EnsureDataRootInfo,
  listProfiles,
  migrateDataRoot as migrateDataRootApi,
  purgeTrash,
  resetTrackerData as resetTrackerDataApi,
  restoreProfile as restoreProfileApi,
  trashProfile as trashProfileApi,
  writeTextFile,
} from '../../lib/fs/fileApi'
import {
  clearDataRootPreference,
  clearPendingInitialTemplateRoot,
  loadActiveProfilePreference,
  loadDataRootPreference,
  loadPendingInitialTemplateRoot,
  savePendingInitialTemplateRoot,
  saveActiveProfilePreference,
  saveDataRootPreference,
} from './settings.store'
import { emitDataChanged } from '../../lib/liveSync'
import { joinPath } from '../../lib/fs/pathApi'
import { extractErrorMessage } from '../../lib/error'
import { markTutorialPending, resetTutorialState } from '../tutorial/tutorial.store'
import { saveTemplateMeta, type TemplateApplyMode } from './templateMeta.service'
import type { TemplateLanguage } from './templateCatalog'
import { todayDateString } from '../../lib/date/date'
import { currentWeekId } from '../../lib/date/week'

type ProfileCreateOptions = {
  dailyTemplate?: string
  weeklyTemplate?: string
  templatePresetId?: string
  templateLanguage?: TemplateLanguage
  templateApplyMode?: TemplateApplyMode
}

type MigrateDataRootSummary = {
  copiedFiles: number
  skippedFiles: number
  overwrittenFiles: number
  createdDirs: number
}

type TrashUndoInfo = {
  profileName: string
  trashEntry: string
}

type DataRootContextValue = {
  baseDataRoot: string | null
  dataRoot: string | null
  activeProfile: string | null
  profiles: string[]
  needsInitialTemplateSetup: boolean
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  updateDataRoot: (nextPath: string) => Promise<void>
  migrateDataRoot: (destinationPath: string, overwrite?: boolean) => Promise<MigrateDataRootSummary>
  resetTrackerData: () => Promise<void>
  completeInitialTemplateSetup: (
    dailyTemplate: string,
    weeklyTemplate: string,
    templateMeta?: Pick<ProfileCreateOptions, 'templatePresetId' | 'templateLanguage' | 'templateApplyMode'>,
  ) => Promise<void>
  finishInitialTemplateSetup: (options?: { runTutorial?: boolean }) => Promise<void>
  switchProfile: (profileName: string) => Promise<void>
  createProfile: (profileName: string, options?: ProfileCreateOptions) => Promise<void>
  deleteProfile: (profileName: string) => Promise<void>
  trashProfile: (profileName: string) => Promise<TrashUndoInfo>
  restoreProfile: (undo: TrashUndoInfo) => Promise<void>
}

const DataRootContext = createContext<DataRootContextValue | undefined>(undefined)

export function DataRootProvider({ children }: { children: ReactNode }) {
  const [baseDataRoot, setBaseDataRoot] = useState<string | null>(null)
  const [dataRoot, setDataRoot] = useState<string | null>(null)
  const [activeProfile, setActiveProfile] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<string[]>([])
  const [needsInitialTemplateSetup, setNeedsInitialTemplateSetup] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function normalizeTemplateContent(content: string) {
    return content.endsWith('\n') ? content : `${content}\n`
  }

  async function bootstrap(rootOverride?: string, profileOverride?: string) {
    setLoading(true)
    setError(null)

    try {
      let rootInfo: EnsureDataRootInfo
      let retriedWithDefaultRoot = false
      if (rootOverride) {
        try {
          rootInfo = await ensureDataRoot(rootOverride)
        } catch (err) {
          console.warn('Failed to initialize configured data root, fallback to default root', err)
          clearDataRootPreference()
          rootInfo = await ensureDataRoot()
          retriedWithDefaultRoot = true
        }
      } else {
        rootInfo = await ensureDataRoot()
      }
      const root = rootInfo.root
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

      if (rootInfo.isFirstRun) {
        savePendingInitialTemplateRoot(root)
      }
      const pendingRoot = loadPendingInitialTemplateRoot()
      setNeedsInitialTemplateSetup(rootInfo.isFirstRun || pendingRoot === root)

      saveDataRootPreference(root)
      saveActiveProfilePreference(nextProfile)
      if (retriedWithDefaultRoot) {
        console.warn('Configured data root is unavailable, switched to default root', {
          root,
        })
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to initialize data root'))
      setNeedsInitialTemplateSetup(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const preferredRoot = loadDataRootPreference() ?? undefined
    const preferredProfile = loadActiveProfilePreference() ?? undefined
    void bootstrap(preferredRoot, preferredProfile)
  }, [])

  // Purge old trash entries on startup (deferred, non-blocking)
  useEffect(() => {
    if (!baseDataRoot) return
    const timer = window.setTimeout(() => {
      void purgeTrash(baseDataRoot).catch(() => {
        // ignore purge failures silently
      })
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [baseDataRoot])

  const value = useMemo<DataRootContextValue>(
    () => ({
      baseDataRoot,
      dataRoot,
      activeProfile,
      profiles,
      needsInitialTemplateSetup,
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

        const result = await migrateDataRootApi(baseDataRoot, destinationPath, overwrite)
        await bootstrap(result.dataRoot, activeProfile ?? undefined)
        emitDataChanged({ scope: 'settings' })
        return result.summary
      },
      resetTrackerData: async () => {
        if (!baseDataRoot) {
          throw new Error('Data root is not initialized')
        }

        await resetTrackerDataApi(baseDataRoot)
        resetTutorialState()
        savePendingInitialTemplateRoot(baseDataRoot)
        await bootstrap(baseDataRoot)
        emitDataChanged({ scope: 'all' })
      },
      completeInitialTemplateSetup: async (
        dailyTemplate: string,
        weeklyTemplate: string,
        templateMeta,
      ) => {
        if (!dataRoot || !baseDataRoot) {
          throw new Error('Data root is not initialized')
        }

        await writeTextFile(
          dataRoot,
          joinPath(dataRoot, 'templates', 'daily.md'),
          normalizeTemplateContent(dailyTemplate),
        )
        await writeTextFile(
          dataRoot,
          joinPath(dataRoot, 'templates', 'weekly.md'),
          normalizeTemplateContent(weeklyTemplate),
        )

        // Ensure the first opened Today/This Week notes match the selected onboarding template.
        // This prevents default-template auto-created files (from pre-onboarding page loads)
        // from overriding the user's explicit onboarding selection.
        const today = todayDateString()
        const weekId = currentWeekId()
        await writeTextFile(
          dataRoot,
          joinPath(dataRoot, 'daily', `${today}.md`),
          normalizeTemplateContent(dailyTemplate.replaceAll('{{date}}', today)),
        )
        await writeTextFile(
          dataRoot,
          joinPath(dataRoot, 'weekly', `${weekId}.md`),
          normalizeTemplateContent(weeklyTemplate.replaceAll('{{week}}', weekId)),
        )
        if (templateMeta?.templatePresetId && templateMeta?.templateLanguage) {
          await saveTemplateMeta(dataRoot, {
            presetId: templateMeta.templatePresetId,
            templateLanguage: templateMeta.templateLanguage,
            lastAppliedMode: templateMeta.templateApplyMode ?? 'overwrite',
            lastAppliedAt: new Date().toISOString(),
          })
        }

        clearPendingInitialTemplateRoot()
        markTutorialPending()
        setNeedsInitialTemplateSetup(false)
        emitDataChanged({ scope: 'all' })
      },
      finishInitialTemplateSetup: async (options) => {
        clearPendingInitialTemplateRoot()
        if (options?.runTutorial) {
          markTutorialPending()
        }
        setNeedsInitialTemplateSetup(false)
        emitDataChanged({ scope: 'all' })
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

        const profileRoot = await createProfileApi(
          baseDataRoot,
          profileName,
          options?.dailyTemplate,
          options?.weeklyTemplate,
        )
        if (options?.templatePresetId && options?.templateLanguage) {
          await saveTemplateMeta(profileRoot, {
            presetId: options.templatePresetId,
            templateLanguage: options.templateLanguage,
            lastAppliedMode: options.templateApplyMode ?? 'overwrite',
            lastAppliedAt: new Date().toISOString(),
          })
        }
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
      trashProfile: async (profileName: string) => {
        if (!baseDataRoot) {
          throw new Error('Data root is not initialized')
        }

        const result = await trashProfileApi(baseDataRoot, profileName)
        // Extract trash entry dir name from full path
        const trashEntry = result.trashPath.replace(/\\/g, '/').split('/').pop() ?? ''
        await bootstrap(
          baseDataRoot,
          activeProfile === profileName ? result.fallbackProfile : activeProfile ?? undefined,
        )
        emitDataChanged({ scope: 'profile', profile: result.fallbackProfile })
        return { profileName, trashEntry }
      },
      restoreProfile: async (undo: TrashUndoInfo) => {
        if (!baseDataRoot) {
          throw new Error('Data root is not initialized')
        }

        await restoreProfileApi(baseDataRoot, undo.trashEntry, undo.profileName)
        await bootstrap(baseDataRoot, undo.profileName)
        emitDataChanged({ scope: 'profile', profile: undo.profileName })
      },
    }),
    [activeProfile, baseDataRoot, dataRoot, error, loading, needsInitialTemplateSetup, profiles],
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
