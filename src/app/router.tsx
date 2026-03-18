import { createHashRouter } from 'react-router-dom'

import { AppShell } from './AppShell'
import { BodyPage } from '../pages/BodyPage'
import { DailyListPage } from '../pages/DailyListPage'
import { DailyNotePage } from '../pages/DailyNotePage'
import { DashboardPage } from '../pages/DashboardPage'
import { SettingsPage } from '../pages/SettingsPage'
import { WeeklyListPage } from '../pages/WeeklyListPage'
import { WeeklyNotePage } from '../pages/WeeklyNotePage'

export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'today', element: <DailyNotePage /> },
      { path: 'week', element: <WeeklyNotePage /> },
      { path: 'daily', element: <DailyListPage /> },
      { path: 'daily/:date', element: <DailyNotePage /> },
      { path: 'weekly', element: <WeeklyListPage /> },
      { path: 'weekly/:weekId', element: <WeeklyNotePage /> },
      { path: 'body', element: <BodyPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
