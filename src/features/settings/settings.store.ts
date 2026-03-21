const DATA_ROOT_KEY = 'dailytrack.dataRoot'
const ACTIVE_PROFILE_KEY = 'dailytrack.activeProfile'
const PENDING_INITIAL_TEMPLATE_ROOT_KEY = 'dailytrack.pendingInitialTemplateRoot'

export function loadDataRootPreference(): string | null {
  return window.localStorage.getItem(DATA_ROOT_KEY)
}

export function saveDataRootPreference(path: string): void {
  window.localStorage.setItem(DATA_ROOT_KEY, path)
}

export function clearDataRootPreference(): void {
  window.localStorage.removeItem(DATA_ROOT_KEY)
}

export function loadActiveProfilePreference(): string | null {
  return window.localStorage.getItem(ACTIVE_PROFILE_KEY)
}

export function saveActiveProfilePreference(profileName: string): void {
  window.localStorage.setItem(ACTIVE_PROFILE_KEY, profileName)
}

export function loadPendingInitialTemplateRoot(): string | null {
  return window.localStorage.getItem(PENDING_INITIAL_TEMPLATE_ROOT_KEY)
}

export function savePendingInitialTemplateRoot(path: string): void {
  window.localStorage.setItem(PENDING_INITIAL_TEMPLATE_ROOT_KEY, path)
}

export function clearPendingInitialTemplateRoot(): void {
  window.localStorage.removeItem(PENDING_INITIAL_TEMPLATE_ROOT_KEY)
}
