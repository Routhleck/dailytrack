import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'
import { ProgressBar } from '../components/ProgressBar'
import { formatBodyMetricValue, metricLabelWithUnit } from '../features/body/body.format'
import { useI18n } from '../features/i18n/I18nContext'
import { getBodyRecords } from '../features/body/body.service'
import { getTodayNote, listDailyDates } from '../features/daily/daily.service'
import { latestBodyRecord, summarizeChecklist } from '../features/dashboard/dashboard.service'
import { usePreferences } from '../features/preferences/PreferencesContext'
import { useDataRoot } from '../features/settings/DataRootContext'
import { WEEKLY_SECTION_ORDER } from '../features/weekly/weekly.parser'
import { getCurrentWeekNote, listWeeklyIds } from '../features/weekly/weekly.service'
import { onDataChanged } from '../lib/liveSync'
import type { BodyRecord } from '../types/tracker'

const BODY_DASHBOARD_FIELDS: {
  key: keyof Omit<BodyRecord, 'date' | 'note'>
  preferenceKey: 'weight' | 'waist' | 'bodyFat' | 'muscleMass' | 'chest' | 'hip'
  labelKey:
    | 'dashboard.weight'
    | 'dashboard.waist'
    | 'dashboard.bodyFat'
    | 'dashboard.muscleMass'
    | 'dashboard.chest'
    | 'dashboard.hip'
}[] = [
  { key: 'weight', preferenceKey: 'weight', labelKey: 'dashboard.weight' },
  { key: 'waist', preferenceKey: 'waist', labelKey: 'dashboard.waist' },
  { key: 'bodyFat', preferenceKey: 'bodyFat', labelKey: 'dashboard.bodyFat' },
  { key: 'muscleMass', preferenceKey: 'muscleMass', labelKey: 'dashboard.muscleMass' },
  { key: 'chest', preferenceKey: 'chest', labelKey: 'dashboard.chest' },
  { key: 'hip', preferenceKey: 'hip', labelKey: 'dashboard.hip' },
]

type DashboardState = {
  todayCore: { checked: number; total: number; percent: number }
  todayOneLine: string
  weekSummary: { checked: number; total: number; percent: number }
  body: BodyRecord | null
  recentDaily: string[]
  recentWeekly: string[]
}

export function DashboardPage() {
  const { t } = useI18n()
  const { dataRoot } = useDataRoot()
  const { preferences, loading: preferencesLoading } = usePreferences()
  const [state, setState] = useState<DashboardState | null>(null)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    if (!dataRoot) {
      return
    }

    try {
      const [today, week, bodyRecords, dailyDates, weeklyIds] = await Promise.all([
        getTodayNote(dataRoot),
        getCurrentWeekNote(dataRoot),
        getBodyRecords(dataRoot),
        listDailyDates(dataRoot),
        listWeeklyIds(dataRoot),
      ])

      const weeklyItems = WEEKLY_SECTION_ORDER.flatMap((section) =>
        preferences.weekly.sections[section] ? week.sections[section] : [],
      )
      const latestBody = latestBodyRecord(bodyRecords)

      setState({
        todayCore: summarizeChecklist(today.dailyCore),
        todayOneLine: today.oneLine,
        weekSummary: summarizeChecklist(weeklyItems),
        body: latestBody,
        recentDaily: dailyDates.slice(0, 5),
        recentWeekly: weeklyIds.slice(0, 5),
      })
      setError('')
    } catch {
      setError(t('dashboard.loadFailed'))
    }
  }, [dataRoot, preferences, t])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadDashboard()
    }, 0)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [loadDashboard])

  useEffect(() => {
    const unlisten = onDataChanged(() => {
      void loadDashboard()
    })

    const interval = window.setInterval(() => {
      void loadDashboard()
    }, 4000)

    const onFocus = () => {
      void loadDashboard()
    }

    window.addEventListener('focus', onFocus)

    return () => {
      unlisten()
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [loadDashboard])

  if (preferencesLoading || !state) {
    return (
      <section>
        <PageHeader title={t('dashboard.title')} description={t('dashboard.loadingDescription')} />
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </section>
    )
  }

  const body = state.body

  return (
    <section className="space-y-4">
      <PageHeader
        title={t('dashboard.title')}
        description={t('dashboard.description')}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">{t('dashboard.today')}</h2>
            <Link className="text-sm text-teal-700 hover:underline" to="/today">
              {t('common.open')}
            </Link>
          </div>
          <p className="mb-2 text-xs text-slate-600">
            {t('dashboard.dailyCoreProgress')} {state.todayCore.checked}/{state.todayCore.total}
          </p>
          <ProgressBar value={state.todayCore.percent} />
          <p className="mt-3 text-sm text-slate-700">
            {t('dashboard.oneLine')}: {state.todayOneLine || '-'}
          </p>
        </article>

        <article className="rounded-lg border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">{t('dashboard.thisWeek')}</h2>
            <Link className="text-sm text-teal-700 hover:underline" to="/week">
              {t('common.open')}
            </Link>
          </div>
          <p className="mb-2 text-xs text-slate-600">
            {t('dashboard.weeklyChecklist')} {state.weekSummary.checked}/{state.weekSummary.total}
          </p>
          <ProgressBar value={state.weekSummary.percent} />
        </article>

        <article className="rounded-lg border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">{t('dashboard.body')}</h2>
            <Link className="text-sm text-teal-700 hover:underline" to="/body">
              {t('common.open')}
            </Link>
          </div>
          {body ? (
            <div className="space-y-1 text-sm text-slate-700">
              <p>{t('dashboard.date')}: {body.date}</p>
              {BODY_DASHBOARD_FIELDS.map((field) => {
                if (!preferences.body[field.preferenceKey]) {
                  return null
                }

                const value = body[field.key]
                return (
                  <p key={field.key}>
                    {metricLabelWithUnit(t(field.labelKey), preferences.body.display[field.key])}:{' '}
                    {formatBodyMetricValue(value, preferences.body.display[field.key])}
                  </p>
                )
              })}
              {preferences.body.note ? <p>{t('dashboard.note')}: {body.note || '-'}</p> : null}
            </div>
          ) : (
            <p className="text-sm text-slate-600">{t('dashboard.noBodyRecords')}</p>
          )}
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-200 p-4">
          <h2 className="mb-3 text-base font-semibold text-slate-900">{t('dashboard.recentDaily')}</h2>
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
          <h2 className="mb-3 text-base font-semibold text-slate-900">{t('dashboard.recentWeekly')}</h2>
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
