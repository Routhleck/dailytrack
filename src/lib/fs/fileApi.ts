import { invoke } from '@tauri-apps/api/core'

export async function ensureDataRoot(dataRoot?: string): Promise<string> {
  return invoke<string>('ensure_data_root', { dataRoot })
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
