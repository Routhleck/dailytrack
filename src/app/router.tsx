/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, type ReactNode } from 'react'
import { createHashRouter } from 'react-router-dom'

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
const SettingsPage = lazy(async () => ({
  default: (await import('../pages/SettingsPage')).SettingsPage,
}))
const ProfilesPage = lazy(async () => ({
  default: (await import('../pages/ProfilesPage')).ProfilesPage,
}))
const PreferencesPage = lazy(async () => ({
  default: (await import('../pages/PreferencesPage')).PreferencesPage,
}))

function withSuspense(node: ReactNode) {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Loading page...</div>}>
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
      { path: 'profiles', element: withSuspense(<ProfilesPage />) },
      { path: 'preferences', element: withSuspense(<PreferencesPage />) },
      { path: 'settings', element: withSuspense(<SettingsPage />) },
    ],
  },
])
