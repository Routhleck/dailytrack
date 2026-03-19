const AUTO_UPDATE_KEY = 'dailytrack.updater.autoCheck'

export function loadAutoUpdatePreference(): boolean {
  const raw = localStorage.getItem(AUTO_UPDATE_KEY)
  if (raw == null) {
    return true
  }
  return raw === '1'
}

export function saveAutoUpdatePreference(enabled: boolean): void {
  localStorage.setItem(AUTO_UPDATE_KEY, enabled ? '1' : '0')
}
