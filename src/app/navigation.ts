import type { MessageKey } from '../features/i18n/messages'
import type { NavGlyphName } from '../components/NavGlyph'

export type AppNavItem = {
  to: string
  labelKey: MessageKey
  icon: NavGlyphName
  group: 'primary' | 'secondary'
  end?: boolean
  tourTarget?: string
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: 'dashboard', group: 'primary', end: true, tourTarget: 'nav-dashboard' },
  { to: '/today', labelKey: 'nav.today', icon: 'today', group: 'primary', end: true, tourTarget: 'nav-today' },
  { to: '/week', labelKey: 'nav.thisWeek', icon: 'week', group: 'primary', end: true, tourTarget: 'nav-week' },
  { to: '/body', labelKey: 'nav.bodyProgress', icon: 'body', group: 'primary', end: true, tourTarget: 'nav-body' },
  { to: '/reports', labelKey: 'nav.reports', icon: 'reports', group: 'primary', end: true, tourTarget: 'nav-reports' },

  { to: '/daily', labelKey: 'nav.dailyNotes', icon: 'daily', group: 'secondary', tourTarget: 'nav-daily-list' },
  { to: '/weekly', labelKey: 'nav.weeklyNotes', icon: 'weekly', group: 'secondary', tourTarget: 'nav-weekly-list' },
  { to: '/sync', labelKey: 'nav.sync', icon: 'sync', group: 'secondary', end: true, tourTarget: 'nav-sync' },
  { to: '/profiles', labelKey: 'nav.profiles', icon: 'profiles', group: 'secondary', end: true, tourTarget: 'nav-profiles' },
  { to: '/preferences', labelKey: 'nav.preferences', icon: 'preferences', group: 'secondary', end: true, tourTarget: 'nav-preferences' },
  { to: '/settings', labelKey: 'nav.settings', icon: 'settings', group: 'secondary', end: true, tourTarget: 'nav-settings' },
]

export const PRIMARY_NAV_ITEMS = APP_NAV_ITEMS.filter((item) => item.group === 'primary')
export const SECONDARY_NAV_ITEMS = APP_NAV_ITEMS.filter((item) => item.group === 'secondary')

export const MOBILE_TAB_ITEMS = PRIMARY_NAV_ITEMS
export const MOBILE_MORE_ITEMS = SECONDARY_NAV_ITEMS
