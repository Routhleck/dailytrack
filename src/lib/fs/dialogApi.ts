import { open, save } from '@tauri-apps/plugin-dialog'

type DialogResult = string | string[] | null

function isDirectoryPickerUnsupportedOnMobile(message: string): boolean {
  const text = message.toLowerCase()
  return text.includes('folder picker is not implemented on mobile')
    || text.includes('directory picker is not implemented on mobile')
}

export function parentPath(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const index = normalized.lastIndexOf('/')
  if (index <= 0) {
    return path
  }
  const parent = normalized.slice(0, index)
  return path.includes('\\') ? parent.replaceAll('/', '\\') : parent
}

function normalizeDialogResult(result: DialogResult): string | null {
  if (Array.isArray(result)) {
    return result[0] ?? null
  }
  if (typeof result === 'string') {
    return result
  }
  return null
}

export async function pickDirectory(defaultPath?: string): Promise<string | null> {
  const resolvedDefaultPath = defaultPath && defaultPath.trim() ? defaultPath : undefined
  const result = await open({
    directory: true,
    multiple: false,
    defaultPath: resolvedDefaultPath,
  })
  return normalizeDialogResult(result)
}

export async function pickDirectoryOrParentFromFile(
  defaultPath?: string,
): Promise<string | null> {
  try {
    return await pickDirectory(defaultPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!isDirectoryPickerUnsupportedOnMobile(message)) {
      throw error
    }
    const pickedFile = await pickFile(defaultPath)
    return pickedFile ? parentPath(pickedFile) : null
  }
}

export async function pickFile(defaultPath?: string): Promise<string | null> {
  const resolvedDefaultPath = defaultPath && defaultPath.trim() ? defaultPath : undefined
  const result = await open({
    directory: false,
    multiple: false,
    defaultPath: resolvedDefaultPath,
    pickerMode: 'document',
  })
  return normalizeDialogResult(result)
}

export async function pickSaveFile(defaultPath?: string): Promise<string | null> {
  const resolvedDefaultPath = defaultPath && defaultPath.trim() ? defaultPath : undefined
  return save({
    defaultPath: resolvedDefaultPath,
  })
}

export function isMobileDirectoryPickerError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return isDirectoryPickerUnsupportedOnMobile(message)
}
