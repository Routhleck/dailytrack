import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

export type AvailableUpdate = {
  currentVersion: string
  version: string
  date?: string
  body?: string
}

export type DownloadProgress = {
  downloaded: number
  total: number | null
}

let cachedUpdate: Update | null = null

async function clearCachedUpdate(): Promise<void> {
  if (!cachedUpdate) {
    return
  }

  try {
    await cachedUpdate.close()
  } catch {
    // ignore stale resource cleanup failures
  } finally {
    cachedUpdate = null
  }
}

export async function checkForAvailableUpdate(): Promise<AvailableUpdate | null> {
  await clearCachedUpdate()

  const update = await check()
  if (!update) {
    return null
  }

  cachedUpdate = update
  return {
    currentVersion: update.currentVersion,
    version: update.version,
    date: update.date,
    body: update.body,
  }
}

export async function installCachedUpdate(
  onProgress?: (progress: DownloadProgress) => void,
): Promise<void> {
  if (!cachedUpdate) {
    throw new Error('No update is ready to install. Please check for updates first.')
  }

  let downloaded = 0
  let total: number | null = null
  const handleEvent = (event: DownloadEvent) => {
    if (event.event === 'Started') {
      total = event.data.contentLength ?? null
      downloaded = 0
      onProgress?.({ downloaded, total })
      return
    }

    if (event.event === 'Progress') {
      downloaded += event.data.chunkLength
      onProgress?.({ downloaded, total })
    }
  }

  await cachedUpdate.downloadAndInstall(handleEvent)
  await clearCachedUpdate()
  await relaunch()
}
