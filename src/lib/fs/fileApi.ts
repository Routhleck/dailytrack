import { invoke } from '@tauri-apps/api/core'

export type EnsureDataRootInfo = {
  root: string
  isFirstRun: boolean
}

export type CopySummary = {
  copiedFiles: number
  skippedFiles: number
  overwrittenFiles: number
  createdDirs: number
}

export type ExportDataBundleResult = {
  bundlePath: string
  summary: CopySummary
}

export type ImportDataBundleResult = {
  dataRoot: string
  summary: CopySummary
}

export type MigrateDataRootResult = {
  dataRoot: string
  summary: CopySummary
}

export type GenerateLlmReportResult = {
  content: string
}

export type WebdavConfig = {
  enabled: boolean
  remoteBaseUrl: string
  username: string
  password: string
  autoPushIntervalMin: number
  requestTimeoutSec: number
  maxSnapshots: number
  verifyTls: boolean
  deviceId: string
}

export type WebdavSnapshot = {
  id: string
  createdAt: number
  deviceId: string
  appVersion: string
  fileName: string
  sizeBytes: number
  sha256: string
  note?: string | null
}

export type WebdavTestResult = {
  ok: boolean
  message: string
}

export type WebdavPushResult = {
  snapshot: WebdavSnapshot
  prunedSnapshotIds: string[]
}

export type WebdavPullResult = {
  snapshot: WebdavSnapshot
  summary: CopySummary
  backupPath?: string | null
}

export type WebdavDeleteSnapshotResult = {
  deleted: boolean
}

export type FsChangedEventPayload = {
  scope: 'daily' | 'weekly' | 'body' | 'preferences' | 'settings' | 'all'
  path: string
  at: number
}

export async function isUpdaterConfigured(): Promise<boolean> {
  return invoke<boolean>('updater_is_configured')
}

export async function ensureDataRoot(dataRoot?: string): Promise<EnsureDataRootInfo> {
  return invoke<EnsureDataRootInfo>('ensure_data_root', { dataRoot })
}

export async function listProfiles(dataRoot: string): Promise<string[]> {
  return invoke<string[]>('list_profiles', { dataRoot })
}

export async function ensureProfile(dataRoot: string, profileName: string): Promise<string> {
  return invoke<string>('ensure_profile', { dataRoot, profileName })
}

export async function createProfile(
  dataRoot: string,
  profileName: string,
  dailyTemplate?: string,
  weeklyTemplate?: string,
): Promise<string> {
  return invoke<string>('create_profile', {
    dataRoot,
    profileName,
    dailyTemplate,
    weeklyTemplate,
  })
}

export async function deleteProfile(dataRoot: string, profileName: string): Promise<string> {
  return invoke<string>('delete_profile', { dataRoot, profileName })
}

export async function readTextFile(dataRoot: string, path: string): Promise<string> {
  return invoke<string>('read_text_file', { path, dataRoot })
}

export async function writeTextFile(dataRoot: string, path: string, content: string): Promise<void> {
  return invoke<void>('write_text_file', { path, content, dataRoot })
}

export async function listFiles(
  dataRoot: string,
  dirPath: string,
  extension?: string,
): Promise<string[]> {
  return invoke<string[]>('list_files', { dirPath, extension, dataRoot })
}

export async function startDataRootWatch(dataRoot: string): Promise<void> {
  return invoke<void>('start_data_root_watch', { dataRoot })
}

export async function stopDataRootWatch(dataRoot: string): Promise<void> {
  return invoke<void>('stop_data_root_watch', { dataRoot })
}

export async function generateLlmReport(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature?: number,
): Promise<GenerateLlmReportResult> {
  return invoke<GenerateLlmReportResult>('generate_llm_report', {
    baseUrl,
    apiKey,
    model,
    systemPrompt,
    userPrompt,
    temperature,
  })
}

export async function exportDataBundle(
  dataRoot: string,
  destinationDir: string,
): Promise<ExportDataBundleResult> {
  return invoke<ExportDataBundleResult>('export_data_bundle', { dataRoot, destinationDir })
}

export async function importDataBundle(
  sourceDir: string,
  dataRoot: string,
  overwrite = true,
): Promise<ImportDataBundleResult> {
  return invoke<ImportDataBundleResult>('import_data_bundle', { sourceDir, dataRoot, overwrite })
}

export async function migrateDataRoot(
  sourceRoot: string,
  destinationRoot: string,
  overwrite = false,
): Promise<MigrateDataRootResult> {
  return invoke<MigrateDataRootResult>('migrate_data_root', {
    sourceRoot,
    destinationRoot,
    overwrite,
  })
}

export async function resetTrackerData(dataRoot: string): Promise<string> {
  return invoke<string>('reset_tracker_data', { dataRoot })
}

export async function getWebdavConfig(): Promise<WebdavConfig> {
  return invoke<WebdavConfig>('get_webdav_config')
}

export async function saveWebdavConfig(config: WebdavConfig): Promise<WebdavConfig> {
  return invoke<WebdavConfig>('save_webdav_config', { config })
}

export async function testWebdavConnection(): Promise<WebdavTestResult> {
  return invoke<WebdavTestResult>('test_webdav_connection')
}

export async function listWebdavSnapshots(): Promise<WebdavSnapshot[]> {
  return invoke<WebdavSnapshot[]>('webdav_list_snapshots')
}

export async function pushWebdavSnapshot(
  dataRoot: string,
  note?: string,
): Promise<WebdavPushResult> {
  return invoke<WebdavPushResult>('webdav_push_snapshot', { dataRoot, note })
}

export async function pullWebdavSnapshot(
  dataRoot: string,
  snapshotId?: string,
  overwrite = true,
  backupBeforePull = true,
): Promise<WebdavPullResult> {
  return invoke<WebdavPullResult>('webdav_pull_snapshot', {
    dataRoot,
    snapshotId,
    overwrite,
    backupBeforePull,
  })
}

export async function deleteWebdavSnapshot(
  snapshotId: string,
): Promise<WebdavDeleteSnapshotResult> {
  return invoke<WebdavDeleteSnapshotResult>('webdav_delete_snapshot', { snapshotId })
}
