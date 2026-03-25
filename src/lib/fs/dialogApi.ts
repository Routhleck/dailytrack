import { open } from '@tauri-apps/plugin-dialog'

type DialogResult = string | string[] | null

function isDirectoryPickerUnsupportedOnMobile(message: string): boolean {
  const text = message.toLowerCase()
  return text.includes('folder picker is not implemented on mobile')
    || text.includes('directory picker is not implemented on mobile')
}

function parentPath(path: string): string {
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
  try {
    const result = await open({
      directory: true,
      multiple: false,
      defaultPath: resolvedDefaultPath,
    })
    return normalizeDialogResult(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!isDirectoryPickerUnsupportedOnMobile(message)) {
      throw error
    }

    const fileResult = await open({
      directory: false,
      multiple: false,
      defaultPath: resolvedDefaultPath,
    })
    const pickedFile = normalizeDialogResult(fileResult)
    return pickedFile ? parentPath(pickedFile) : null
  }
}
