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
