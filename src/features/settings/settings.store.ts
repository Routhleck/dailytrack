const DATA_ROOT_KEY = 'dailytrack.dataRoot'

export function loadDataRootPreference(): string | null {
  return window.localStorage.getItem(DATA_ROOT_KEY)
}

export function saveDataRootPreference(path: string): void {
  window.localStorage.setItem(DATA_ROOT_KEY, path)
}
