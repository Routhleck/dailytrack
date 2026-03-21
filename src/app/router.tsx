/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, type ReactNode } from 'react'
import { createHashRouter } from 'react-router-dom'

import { useI18n } from '../features/i18n/I18nContext'
import { AppShell } from './AppShell'

const DashboardPage = lazy(async () => ({
  default: (await import('../pages/DashboardPage')).DashboardPage,
}))
const DailyNotePage = lazy(async () => ({
  default: (await import('../pages/DailyNotePage')).DailyNotePage,
}))
const WeeklyNotePage = lazy(async () => ({
  default: (await import('../pages/WeeklyNotePage')).WeeklyNotePage,
}))
const DailyListPage = lazy(async () => ({
  default: (await import('../pages/DailyListPage')).DailyListPage,
}))
const WeeklyListPage = lazy(async () => ({
  default: (await import('../pages/WeeklyListPage')).WeeklyListPage,
}))
const BodyPage = lazy(async () => ({
  default: (await import('../pages/BodyPage')).BodyPage,
}))
const ReportsPage = lazy(async () => ({
  default: (await import('../pages/ReportsPage')).ReportsPage,
}))
const SettingsPage = lazy(async () => ({
  default: (await import('../pages/SettingsPage')).SettingsPage,
}))
const SyncPage = lazy(async () => ({
  default: (await import('../pages/SyncPage')).SyncPage,
}))
const ProfilesPage = lazy(async () => ({
  default: (await import('../pages/ProfilesPage')).ProfilesPage,
}))
const PreferencesPage = lazy(async () => ({
  default: (await import('../pages/PreferencesPage')).PreferencesPage,
}))

function RouteFallback() {
  const { t } = useI18n()
  return <div className="text-sm text-slate-500">{t('common.loadingPage')}</div>
}

function withSuspense(node: ReactNode) {
  return (
    <Suspense fallback={<RouteFallback />}>
      {node}
    </Suspense>
  )
}

export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: withSuspense(<DashboardPage />) },
      { path: 'today', element: withSuspense(<DailyNotePage />) },
      { path: 'week', element: withSuspense(<WeeklyNotePage />) },
      { path: 'daily', element: withSuspense(<DailyListPage />) },
      { path: 'daily/:date', element: withSuspense(<DailyNotePage />) },
      { path: 'weekly', element: withSuspense(<WeeklyListPage />) },
      { path: 'weekly/:weekId', element: withSuspense(<WeeklyNotePage />) },
      { path: 'body', element: withSuspense(<BodyPage />) },
      { path: 'reports', element: withSuspense(<ReportsPage />) },
      { path: 'sync', element: withSuspense(<SyncPage />) },
      { path: 'profiles', element: withSuspense(<ProfilesPage />) },
      { path: 'preferences', element: withSuspense(<PreferencesPage />) },
      { path: 'settings', element: withSuspense(<SettingsPage />) },
    ],
  },
])
