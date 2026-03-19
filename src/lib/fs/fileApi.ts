import { invoke } from '@tauri-apps/api/core'

export async function ensureDataRoot(dataRoot?: string): Promise<string> {
  return invoke<string>('ensure_data_root', { dataRoot })
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

export async function readTextFile(path: string): Promise<string> {
  return invoke<string>('read_text_file', { path })
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  return invoke<void>('write_text_file', { path, content })
}

export async function listFiles(
  dirPath: string,
  extension?: string,
): Promise<string[]> {
  return invoke<string[]>('list_files', { dirPath, extension })
}

export async function exportDataBundle(
  dataRoot: string,
  destinationDir: string,
): Promise<string> {
  return invoke<string>('export_data_bundle', { dataRoot, destinationDir })
}

export async function importDataBundle(
  sourceDir: string,
  dataRoot: string,
  overwrite = true,
): Promise<string> {
  return invoke<string>('import_data_bundle', { sourceDir, dataRoot, overwrite })
}
