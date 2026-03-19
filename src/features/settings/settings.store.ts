const DATA_ROOT_KEY = 'dailytrack.dataRoot'
const ACTIVE_PROFILE_KEY = 'dailytrack.activeProfile'

export function loadDataRootPreference(): string | null {
  return window.localStorage.getItem(DATA_ROOT_KEY)
}

export function saveDataRootPreference(path: string): void {
  window.localStorage.setItem(DATA_ROOT_KEY, path)
}

export function loadActiveProfilePreference(): string | null {
  return window.localStorage.getItem(ACTIVE_PROFILE_KEY)
}

export function saveActiveProfilePreference(profileName: string): void {
  window.localStorage.setItem(ACTIVE_PROFILE_KEY, profileName)
}
