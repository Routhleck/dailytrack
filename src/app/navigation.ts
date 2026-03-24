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

export type MobileGroupItem = {
  to: string
  labelKey: MessageKey
  icon: NavGlyphName
  end?: boolean
  tourTarget?: string
}

export const MOBILE_RECORD_ITEMS: MobileGroupItem[] = [
  { to: '/today', labelKey: 'nav.today', icon: 'today', end: true, tourTarget: 'nav-today' },
  { to: '/week', labelKey: 'nav.thisWeek', icon: 'week', end: true, tourTarget: 'nav-week' },
  { to: '/body', labelKey: 'nav.bodyProgress', icon: 'body', end: true, tourTarget: 'nav-body' },
]

export const MOBILE_HISTORY_ITEMS: MobileGroupItem[] = [
  { to: '/daily', labelKey: 'nav.dailyNotes', icon: 'daily', tourTarget: 'nav-daily-list' },
  { to: '/weekly', labelKey: 'nav.weeklyNotes', icon: 'weekly', tourTarget: 'nav-weekly-list' },
]

export const MORE_PAGE_ITEMS: MobileGroupItem[] = [
  { to: '/sync', labelKey: 'nav.sync', icon: 'sync', end: true, tourTarget: 'nav-sync' },
  { to: '/profiles', labelKey: 'nav.profiles', icon: 'profiles', end: true, tourTarget: 'nav-profiles' },
  { to: '/preferences', labelKey: 'nav.preferences', icon: 'preferences', end: true, tourTarget: 'nav-preferences' },
  { to: '/settings', labelKey: 'nav.settings', icon: 'settings', end: true, tourTarget: 'nav-settings' },
  { to: '/reports', labelKey: 'nav.reports', icon: 'reports', end: true, tourTarget: 'nav-reports' },
]

export const MOBILE_MORE_ITEMS = MORE_PAGE_ITEMS

export type MobileTabKey = 'dashboard' | 'record' | 'history' | 'more'
export type MobileSheetKey = 'record' | 'history'

type MobileRouteTab = {
  key: MobileTabKey
  kind: 'route'
  to: string
  labelKey: MessageKey
  icon: NavGlyphName
  end?: boolean
  tourTarget?: string
}

type MobileSheetTab = {
  key: MobileTabKey
  kind: 'sheet'
  sheet: MobileSheetKey
  labelKey: MessageKey
  icon: NavGlyphName
}

export type MobileTabItem = MobileRouteTab | MobileSheetTab

export const MOBILE_TABS: MobileTabItem[] = [
  { key: 'dashboard', kind: 'route', to: '/', labelKey: 'nav.dashboard', icon: 'dashboard', end: true, tourTarget: 'nav-dashboard' },
  { key: 'record', kind: 'sheet', sheet: 'record', labelKey: 'nav.record', icon: 'today' },
  { key: 'history', kind: 'sheet', sheet: 'history', labelKey: 'nav.history', icon: 'daily' },
  { key: 'more', kind: 'route', to: '/more', labelKey: 'nav.more', icon: 'more', end: true },
]

function pathStartsWith(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function getActiveMobileTab(pathname: string): MobileTabKey {
  if (pathname === '/') {
    return 'dashboard'
  }

  if (
    pathname === '/today'
    || pathname === '/week'
    || pathname === '/body'
  ) {
    return 'record'
  }

  if (pathStartsWith(pathname, '/daily') || pathStartsWith(pathname, '/weekly')) {
    return 'history'
  }

  return 'more'
}
