/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { createHashRouter } from 'react-router-dom'

import { useI18n } from '../features/i18n/I18nContext'
import { AppShell } from './AppShell'

const loadDashboardPage = () => import('../pages/DashboardPage')
const loadDailyNotePage = () => import('../pages/DailyNotePage')
const loadWeeklyNotePage = () => import('../pages/WeeklyNotePage')
const loadDailyListPage = () => import('../pages/DailyListPage')
const loadWeeklyListPage = () => import('../pages/WeeklyListPage')
const loadBodyPage = () => import('../pages/BodyPage')
const loadMorePage = () => import('../pages/MorePage')
const loadReportsPage = () => import('../pages/ReportsPage')
const loadSettingsPage = () => import('../pages/SettingsPage')
const loadSyncPage = () => import('../pages/SyncPage')
const loadProfilesPage = () => import('../pages/ProfilesPage')
const loadPreferencesPage = () => import('../pages/PreferencesPage')

const DashboardPage = lazy(async () => ({ default: (await loadDashboardPage()).DashboardPage }))
const DailyNotePage = lazy(async () => ({ default: (await loadDailyNotePage()).DailyNotePage }))
const WeeklyNotePage = lazy(async () => ({ default: (await loadWeeklyNotePage()).WeeklyNotePage }))
const DailyListPage = lazy(async () => ({ default: (await loadDailyListPage()).DailyListPage }))
const WeeklyListPage = lazy(async () => ({ default: (await loadWeeklyListPage()).WeeklyListPage }))
const BodyPage = lazy(async () => ({ default: (await loadBodyPage()).BodyPage }))
const MorePage = lazy(async () => ({ default: (await loadMorePage()).MorePage }))
const ReportsPage = lazy(async () => ({ default: (await loadReportsPage()).ReportsPage }))
const SettingsPage = lazy(async () => ({ default: (await loadSettingsPage()).SettingsPage }))
const SyncPage = lazy(async () => ({ default: (await loadSyncPage()).SyncPage }))
const ProfilesPage = lazy(async () => ({ default: (await loadProfilesPage()).ProfilesPage }))
const PreferencesPage = lazy(async () => ({ default: (await loadPreferencesPage()).PreferencesPage }))

const routePageLoaders = [
  loadDashboardPage,
  loadDailyNotePage,
  loadWeeklyNotePage,
  loadDailyListPage,
  loadWeeklyListPage,
  loadBodyPage,
  loadMorePage,
  loadReportsPage,
  loadSettingsPage,
  loadSyncPage,
  loadProfilesPage,
  loadPreferencesPage,
]

let routePreloadPromise: Promise<void> | null = null

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function preloadRoutePagesIncrementally() {
  for (const load of routePageLoaders) {
    await load()
    await sleep(140)
  }
}

export function preloadRoutePages() {
  if (!routePreloadPromise) {
    routePreloadPromise = preloadRoutePagesIncrementally().then(() => undefined, () => undefined)
  }
  return routePreloadPromise
}

function RouteFallback() {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(true)
    }, 140)

    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  if (!visible) {
    return <div className="h-20" aria-hidden />
  }

  return (
    <div className="dt-route-loading" role="status" aria-live="polite">
      <div className="dt-route-loading-line dt-route-loading-line-title" />
      <div className="dt-route-loading-line dt-route-loading-line-content" />
      <p className="dt-route-loading-label">{t('common.loadingPage')}</p>
    </div>
  )
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
      { path: 'more', element: withSuspense(<MorePage />) },
      { path: 'reports', element: withSuspense(<ReportsPage />) },
      { path: 'sync', element: withSuspense(<SyncPage />) },
      { path: 'profiles', element: withSuspense(<ProfilesPage />) },
      { path: 'preferences', element: withSuspense(<PreferencesPage />) },
      { path: 'settings', element: withSuspense(<SettingsPage />) },
    ],
  },
])
