import type { UILanguage } from './messages'

const UI_LANGUAGE_KEY = 'dailytrack.uiLanguage'

export function loadUILanguagePreference(): UILanguage | null {
  const value = window.localStorage.getItem(UI_LANGUAGE_KEY)
  if (value === 'en' || value === 'zh') {
    return value
  }
  return null
}

export function saveUILanguagePreference(language: UILanguage): void {
  window.localStorage.setItem(UI_LANGUAGE_KEY, language)
}
