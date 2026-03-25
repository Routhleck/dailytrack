import { useCallback, useEffect, useRef, useState } from 'react'
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
import { extractErrorMessage } from '../lib/error'
import { fallbackPollIntervalMs, onDataChanged } from '../lib/liveSync'
import { recordRuntimePerfSeries } from '../lib/perf/runtimePerf'
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
  const loadingRef = useRef(false)
  const pendingReloadRef = useRef(false)
  const scheduledReloadRef = useRef<number | null>(null)

  const loadDashboard = useCallback(async () => {
    if (!dataRoot) {
      return
    }

    if (loadingRef.current) {
      pendingReloadRef.current = true
      return
    }

    loadingRef.current = true
    const startMs = performance.now()
    let failed = false
    try {
      const [todayResult, weekResult, bodyResult, dailyResult, weeklyResult] = await Promise.allSettled([
        getTodayNote(dataRoot),
        getCurrentWeekNote(dataRoot),
        getBodyRecords(dataRoot),
        listDailyDates(dataRoot),
        listWeeklyIds(dataRoot),
      ])

      if (todayResult.status !== 'fulfilled') {
        throw todayResult.reason
      }
      if (weekResult.status !== 'fulfilled') {
        throw weekResult.reason
      }

      const today = todayResult.value
      const week = weekResult.value
      const bodyRecords = bodyResult.status === 'fulfilled' ? bodyResult.value : []
      const dailyDates = dailyResult.status === 'fulfilled' ? dailyResult.value : []
      const weeklyIds = weeklyResult.status === 'fulfilled' ? weeklyResult.value : []

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
    } catch (error) {
      failed = true
      console.warn('[dashboard] failed to load dashboard data', error)
      const details = extractErrorMessage(error, '')
      setError(`${t('dashboard.loadFailed')} ${details}`.trim())
    } finally {
      recordRuntimePerfSeries('dashboard_load_ms', performance.now() - startMs, {
        failed,
      })
      loadingRef.current = false
      if (pendingReloadRef.current) {
        pendingReloadRef.current = false
        void loadDashboard()
      }
    }
  }, [dataRoot, preferences, t])

  const scheduleDashboardLoad = useCallback((delayMs = 0) => {
    if (scheduledReloadRef.current != null) {
      window.clearTimeout(scheduledReloadRef.current)
    }

    scheduledReloadRef.current = window.setTimeout(() => {
      scheduledReloadRef.current = null
      if (document.visibilityState !== 'visible') {
        return
      }
      void loadDashboard()
    }, Math.max(0, delayMs))
  }, [loadDashboard])

  useEffect(() => {
    return () => {
      if (scheduledReloadRef.current != null) {
        window.clearTimeout(scheduledReloadRef.current)
        scheduledReloadRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    scheduleDashboardLoad(220)
  }, [scheduleDashboardLoad])

  useEffect(() => {
    const unlisten = onDataChanged(() => {
      scheduleDashboardLoad(280)
    })

    const intervalMs = fallbackPollIntervalMs(preferences.sync.mode)
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return
      }
      scheduleDashboardLoad(0)
    }, intervalMs)

    const onFocus = () => {
      scheduleDashboardLoad(650)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleDashboardLoad(650)
      }
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      unlisten()
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [preferences.sync.mode, scheduleDashboardLoad])

  if (preferencesLoading || !state) {
    return (
      <section>
        <PageHeader title={t('dashboard.title')} description={t('dashboard.loadingDescription')} />
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </section>
    )
  }

  const body = state.body
  const todayRemaining = Math.max(0, state.todayCore.total - state.todayCore.checked)
  const weekRemaining = Math.max(0, state.weekSummary.total - state.weekSummary.checked)

  return (
    <section className="dt-page">
      <PageHeader
        title={t('dashboard.title')}
        description={t('dashboard.description')}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 md:gap-4">
        <article className="dt-panel p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 sm:text-base">{t('dashboard.today')}</h2>
            <Link className="dt-link text-xs sm:text-sm" to="/today">
              {t('common.open')}
            </Link>
          </div>
          <div className="mb-3 flex items-end justify-between">
            <p className="text-xs text-slate-600">
              {t('dashboard.dailyCoreProgress')} {state.todayCore.checked}/{state.todayCore.total}
            </p>
            <p className="text-xl font-semibold text-slate-900">{state.todayCore.percent}%</p>
          </div>
          <ProgressBar value={state.todayCore.percent} />
          <p className="mt-2 text-xs text-slate-600">
            {t('dashboard.remainingItems', { count: todayRemaining })}
          </p>
          <p className="mt-3 break-words text-sm text-slate-700">
            {t('dashboard.oneLine')}: {state.todayOneLine || '-'}
          </p>
        </article>

        <article className="dt-panel p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 sm:text-base">{t('dashboard.thisWeek')}</h2>
            <Link className="dt-link text-xs sm:text-sm" to="/week">
              {t('common.open')}
            </Link>
          </div>
          <div className="mb-3 flex items-end justify-between">
            <p className="text-xs text-slate-600">
              {t('dashboard.weeklyChecklist')} {state.weekSummary.checked}/{state.weekSummary.total}
            </p>
            <p className="text-xl font-semibold text-slate-900">{state.weekSummary.percent}%</p>
          </div>
          <ProgressBar value={state.weekSummary.percent} />
          <p className="mt-2 text-xs text-slate-600">
            {t('dashboard.remainingItems', { count: weekRemaining })}
          </p>
        </article>

        <article className="dt-panel p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 sm:text-base">{t('dashboard.body')}</h2>
            <Link className="dt-link text-xs sm:text-sm" to="/body">
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
            <div className="space-y-2">
              <p className="text-sm text-slate-600">{t('dashboard.noBodyRecords')}</p>
              <Link className="dt-link text-sm" to="/body">
                {t('dashboard.addFirstBodyRecord')}
              </Link>
            </div>
          )}
        </article>
      </div>

      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
        <article className="dt-panel p-3 sm:p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 sm:text-base">{t('dashboard.recentDaily')}</h2>
          {state.recentDaily.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {state.recentDaily.map((date) => (
                <li key={date}>
                  <Link className="dt-link" to={`/daily/${date}`}>
                    {date}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">{t('dashboard.noRecentDaily')}</p>
              <Link className="dt-link text-sm" to="/today">
                {t('dashboard.startToday')}
              </Link>
            </div>
          )}
        </article>

        <article className="dt-panel p-3 sm:p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 sm:text-base">{t('dashboard.recentWeekly')}</h2>
          {state.recentWeekly.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {state.recentWeekly.map((week) => (
                <li key={week}>
                  <Link className="dt-link" to={`/weekly/${week}`}>
                    {week}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">{t('dashboard.noRecentWeekly')}</p>
              <Link className="dt-link text-sm" to="/week">
                {t('dashboard.startThisWeek')}
              </Link>
            </div>
          )}
        </article>
      </div>
    </section>
  )
}
