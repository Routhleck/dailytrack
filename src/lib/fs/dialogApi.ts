import { open } from '@tauri-apps/plugin-dialog'

type DialogResult = string | string[] | null

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
  const result = await open({
    directory: true,
    multiple: false,
    defaultPath: defaultPath && defaultPath.trim() ? defaultPath : undefined,
  })
  return normalizeDialogResult(result)
}

