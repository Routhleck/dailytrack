import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'
import { ProgressBar } from '../components/ProgressBar'
import { getBodyRecords } from '../features/body/body.service'
import { getTodayNote, listDailyDates } from '../features/daily/daily.service'
import { latestBodyRecord, summarizeChecklist } from '../features/dashboard/dashboard.service'
import { usePreferences } from '../features/preferences/PreferencesContext'
import { useDataRoot } from '../features/settings/DataRootContext'
import { WEEKLY_SECTION_ORDER } from '../features/weekly/weekly.parser'
import { getCurrentWeekNote, listWeeklyIds } from '../features/weekly/weekly.service'

type DashboardState = {
  todayCore: { checked: number; total: number; percent: number }
  todayOneLine: string
  weekSummary: { checked: number; total: number; percent: number }
  body: {
    date: string
    weight: string
    waist: string
    note: string
  } | null
  recentDaily: string[]
  recentWeekly: string[]
}

export function DashboardPage() {
  const { dataRoot } = useDataRoot()
  const { preferences, loading: preferencesLoading } = usePreferences()
  const [state, setState] = useState<DashboardState | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!dataRoot) {
      return
    }

    let cancelled = false

    void Promise.all([
      getTodayNote(dataRoot),
      getCurrentWeekNote(dataRoot),
      getBodyRecords(dataRoot),
      listDailyDates(dataRoot),
      listWeeklyIds(dataRoot),
    ])
      .then(([today, week, bodyRecords, dailyDates, weeklyIds]) => {
        if (cancelled) {
          return
        }

        const weeklyItems = WEEKLY_SECTION_ORDER.flatMap((section) =>
          preferences.weekly.sections[section] ? week.sections[section] : [],
        )
        const latestBody = latestBodyRecord(bodyRecords)

        setState({
          todayCore: summarizeChecklist(today.dailyCore),
          todayOneLine: today.oneLine,
          weekSummary: summarizeChecklist(weeklyItems),
          body: latestBody
            ? {
                date: latestBody.date,
                weight: latestBody.weight == null ? '-' : String(latestBody.weight),
                waist: latestBody.waist == null ? '-' : String(latestBody.waist),
                note: latestBody.note || '-',
              }
            : null,
          recentDaily: dailyDates.slice(0, 5),
          recentWeekly: weeklyIds.slice(0, 5),
        })
        setError('')
      })
      .catch(() => {
        if (cancelled) {
          return
        }
        setError('Failed to load dashboard data.')
      })

    return () => {
      cancelled = true
    }
  }, [dataRoot, preferences])

  if (preferencesLoading || !state) {
    return (
      <section>
        <PageHeader title="Dashboard" description="Loading local tracker summary..." />
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Dashboard"
        description="Quick overview for today, this week, body progress, and recent notes."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Today</h2>
            <Link className="text-sm text-teal-700 hover:underline" to="/today">
              Open
            </Link>
          </div>
          <p className="mb-2 text-xs text-slate-600">
            Daily Core {state.todayCore.checked}/{state.todayCore.total}
          </p>
          <ProgressBar value={state.todayCore.percent} />
          <p className="mt-3 text-sm text-slate-700">One Line: {state.todayOneLine || '-'}</p>
        </article>

        <article className="rounded-lg border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">This Week</h2>
            <Link className="text-sm text-teal-700 hover:underline" to="/week">
              Open
            </Link>
          </div>
          <p className="mb-2 text-xs text-slate-600">
            Weekly Checklist {state.weekSummary.checked}/{state.weekSummary.total}
          </p>
          <ProgressBar value={state.weekSummary.percent} />
        </article>

        <article className="rounded-lg border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Body</h2>
            <Link className="text-sm text-teal-700 hover:underline" to="/body">
              Open
            </Link>
          </div>
          {state.body ? (
            <div className="space-y-1 text-sm text-slate-700">
              <p>Date: {state.body.date}</p>
              {preferences.body.weight ? <p>Weight: {state.body.weight}</p> : null}
              {preferences.body.waist ? <p>Waist: {state.body.waist}</p> : null}
              {preferences.body.note ? <p>Note: {state.body.note}</p> : null}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No body records yet.</p>
          )}
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-200 p-4">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Recent Daily Notes</h2>
          <ul className="space-y-1 text-sm">
            {state.recentDaily.map((date) => (
              <li key={date}>
                <Link className="text-teal-700 hover:underline" to={`/daily/${date}`}>
                  {date}
                </Link>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-lg border border-slate-200 p-4">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Recent Weekly Notes</h2>
          <ul className="space-y-1 text-sm">
            {state.recentWeekly.map((week) => (
              <li key={week}>
                <Link className="text-teal-700 hover:underline" to={`/weekly/${week}`}>
                  {week}
                </Link>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  )
}
