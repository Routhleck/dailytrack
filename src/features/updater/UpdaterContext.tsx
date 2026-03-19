import { getVersion } from '@tauri-apps/api/app'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { isUpdaterConfigured } from '../../lib/fs/fileApi'
import { useI18n } from '../i18n/I18nContext'
import {
  checkForAvailableUpdate,
  installCachedUpdate,
  type AvailableUpdate,
} from './updater.service'
import { loadAutoUpdatePreference, saveAutoUpdatePreference } from './updater.store'

type UpdaterContextValue = {
  configured: boolean
  resolved: boolean
  currentVersion: string
  autoCheckEnabled: boolean
  checking: boolean
  installing: boolean
  update: AvailableUpdate | null
  status: string
  error: string
  downloadPercent: number | null
  setAutoCheckEnabled: (enabled: boolean) => void
  checkForUpdates: (manual?: boolean) => Promise<void>
  installUpdate: () => Promise<void>
  dismissUpdate: () => void
  isBannerVisible: boolean
}

const UpdaterContext = createContext<UpdaterContextValue | undefined>(undefined)

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallback
}

export function UpdaterProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()

  const [resolved, setResolved] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [currentVersion, setCurrentVersion] = useState('-')
  const [autoCheckEnabled, setAutoCheckEnabledState] = useState(loadAutoUpdatePreference())

  const [checking, setChecking] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [update, setUpdate] = useState<AvailableUpdate | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null)
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void getVersion()
      .then((version) => {
        if (!cancelled) {
          setCurrentVersion(version)
        }
      })
      .catch(() => {
        // ignore version resolution failures on unsupported runtimes
      })

    void isUpdaterConfigured()
      .then((enabled) => {
        if (!cancelled) {
          setConfigured(enabled)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConfigured(false)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setResolved(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const checkForUpdates = useCallback(
    async (manual = true) => {
      if (!configured) {
        if (manual) {
          setError(t('updater.notConfigured'))
        }
        return
      }

      setChecking(true)
      setError('')
      setDownloadPercent(null)
      if (manual) {
        setStatus(t('updater.checking'))
      }

      try {
        const next = await checkForAvailableUpdate()
        setUpdate(next)

        if (next) {
          setDismissedVersion((previous) => (previous === next.version ? previous : null))
          setStatus(t('updater.available', { version: next.version }))
        } else if (manual) {
          setStatus(t('updater.upToDate'))
        } else {
          setStatus('')
        }
      } catch (reason) {
        if (manual) {
          setStatus('')
          setError(toErrorMessage(reason, t('updater.checkFailed')))
        }
      } finally {
        setChecking(false)
      }
    },
    [configured, t],
  )

  const installUpdate = useCallback(async () => {
    if (!update) {
      return
    }

    setInstalling(true)
    setError('')
    setStatus(t('updater.installing'))

    try {
      await installCachedUpdate((progress) => {
        if (!progress.total || progress.total <= 0) {
          setDownloadPercent(null)
          return
        }

        const percent = Math.min(100, Math.round((progress.downloaded / progress.total) * 100))
        setDownloadPercent(percent)
      })
    } catch (reason) {
      setStatus('')
      setError(toErrorMessage(reason, t('updater.installFailed')))
    } finally {
      setInstalling(false)
    }
  }, [t, update])

  useEffect(() => {
    if (!resolved || !configured || !autoCheckEnabled) {
      return
    }

    void checkForUpdates(false)
  }, [autoCheckEnabled, checkForUpdates, configured, resolved])

  const setAutoCheckEnabled = useCallback((enabled: boolean) => {
    setAutoCheckEnabledState(enabled)
    saveAutoUpdatePreference(enabled)
  }, [])

  const dismissUpdate = useCallback(() => {
    if (!update) {
      return
    }
    setDismissedVersion(update.version)
  }, [update])

  const isBannerVisible = Boolean(update && dismissedVersion !== update.version)

  const value = useMemo<UpdaterContextValue>(
    () => ({
      configured,
      resolved,
      currentVersion,
      autoCheckEnabled,
      checking,
      installing,
      update,
      status,
      error,
      downloadPercent,
      setAutoCheckEnabled,
      checkForUpdates,
      installUpdate,
      dismissUpdate,
      isBannerVisible,
    }),
    [
      configured,
      resolved,
      currentVersion,
      autoCheckEnabled,
      checking,
      installing,
      update,
      status,
      error,
      downloadPercent,
      setAutoCheckEnabled,
      checkForUpdates,
      installUpdate,
      dismissUpdate,
      isBannerVisible,
    ],
  )

  return <UpdaterContext.Provider value={value}>{children}</UpdaterContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUpdater() {
  const context = useContext(UpdaterContext)
  if (!context) {
    throw new Error('useUpdater must be used inside UpdaterProvider')
  }

  return context
}
