import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'
import { ProgressBar } from '../components/ProgressBar'
import { formatBodyMetricValue, metricLabelWithUnit } from '../features/body/body.format'
import { useI18n } from '../features/i18n/I18nContext'
import { getBodyRecords } from '../features/body/body.service'
import { getDailyNote, getTodayNote, listDailyDates } from '../features/daily/daily.service'
import {
  compareProgress,
  diffIsoDateDays,
  diffWeekId,
  findWeakestSection,
  isChecklistComplete,
  isPreviousIsoDate,
  isPreviousWeekId,
  latestBodyRecord,
  recentIsoDates,
  summarizeChecklist,
  type ProgressComparison,
  type ProgressSummary,
  type SectionProgressSummary,
} from '../features/dashboard/dashboard.service'
import { usePreferences } from '../features/preferences/PreferencesContext'
import { useDataRoot } from '../features/settings/DataRootContext'
import { WEEKLY_SECTION_ORDER } from '../features/weekly/weekly.parser'
import { getCurrentWeekNote, getWeeklyNote, listWeeklyIds } from '../features/weekly/weekly.service'
import { compareIsoDateDesc } from '../lib/date/date'
import { extractErrorMessage } from '../lib/error'
import { fallbackPollIntervalMs, onDataChanged } from '../lib/liveSync'
import { recordRuntimePerfSeries } from '../lib/perf/runtimePerf'
import type { BodyRecord, WeeklySectionKey } from '../types/tracker'

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
  todayComparison: ProgressComparison
  weekComparison: ProgressComparison
  dailyStreak: number
  weeklyStreak: number
  weakestSection: SectionProgressSummary | null
  nextAction:
    | { kind: 'completeToday'; remaining: number }
    | { kind: 'focusWeakestSection'; section: WeeklySectionKey; remaining: number }
    | { kind: 'addBodyRecord' }
    | { kind: 'reviewWeek' }
  body: BodyRecord | null
  reminders: {
    kind: 'daily' | 'weekly' | 'body'
    gap: number | null
    threshold: number
    anchor: string | null
  }[]
  dailyHeatmap: {
    date: string
    percent: number | null
  }[]
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
        getTodayNote(dataRoot, { fresh: true }),
        getCurrentWeekNote(dataRoot, { fresh: true }),
        getBodyRecords(dataRoot, { fresh: true }),
        listDailyDates(dataRoot, { fresh: true }),
        listWeeklyIds(dataRoot, { fresh: true }),
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

      const enabledWeeklySections = WEEKLY_SECTION_ORDER.filter((section) => preferences.weekly.sections[section])
      const summarizeWeeklyNote = (targetWeek: typeof week): ProgressSummary => {
        const enabledItems = enabledWeeklySections.flatMap((section) => targetWeek.sections[section])
        return summarizeChecklist(enabledItems)
      }
      const todayCoreSummary = summarizeChecklist(today.dailyCore)
      const weekSummary = summarizeWeeklyNote(week)
      const sectionGoalStats = enabledWeeklySections.map((section) => ({
        section,
        summary: summarizeChecklist(week.sections[section]),
      }))
      const weakestSection = findWeakestSection(sectionGoalStats)
      const latestBody = latestBodyRecord(bodyRecords)

      const orderedDailyDates = Array.from(new Set([today.date, ...dailyDates])).sort(compareIsoDateDesc)
      const dailySummaryByDate: Record<string, ProgressSummary> = {
        [today.date]: todayCoreSummary,
      }

      // Parallel batch: load daily summaries in groups of 8
      const dailyDatesToLoad = orderedDailyDates.slice(0, 45).filter((d) => d !== today.date)
      for (let i = 0; i < dailyDatesToLoad.length; i += 8) {
        const batch = dailyDatesToLoad.slice(i, i + 8)
        const results = await Promise.all(
          batch.map((date) =>
            getDailyNote(dataRoot, date)
              .then((note) => ({ date, summary: summarizeChecklist(note.dailyCore) }))
              .catch(() => ({ date, summary: null as ProgressSummary | null })),
          ),
        )
        for (const { date, summary } of results) {
          if (summary) {
            dailySummaryByDate[date] = summary
          }
        }
      }

      let previousDailySummary: ProgressSummary | null = null
      let dailyStreak = 0
      let dailyStreakActive = true
      let dailyStreakAnchor = today.date
      let lastCompletedDailyDate: string | null = null

      for (const date of orderedDailyDates.slice(0, 45)) {
        const summary = dailySummaryByDate[date] ?? null
        if (!summary) {
          continue
        }

        if (date !== today.date && previousDailySummary == null) {
          previousDailySummary = summary
        }

        if (lastCompletedDailyDate == null && isChecklistComplete(summary)) {
          lastCompletedDailyDate = date
        }

        if (!dailyStreakActive) {
          if (previousDailySummary) {
            break
          }
          continue
        }

        if (date === today.date) {
          if (isChecklistComplete(summary)) {
            dailyStreak = 1
          } else {
            dailyStreakActive = false
          }
          continue
        }

        if (
          dailyStreak > 0
          && isPreviousIsoDate(dailyStreakAnchor, date)
          && isChecklistComplete(summary)
        ) {
          dailyStreak += 1
          dailyStreakAnchor = date
        } else {
          dailyStreakActive = false
        }

        if (previousDailySummary && !dailyStreakActive) {
          break
        }
      }

      // Parallel batch: load weekly summaries in groups of 8
      const orderedWeeklyIds = Array.from(new Set([week.weekId, ...weeklyIds])).sort((left, right) =>
        right.localeCompare(left),
      )
      const weeklySummaryById: Record<string, ProgressSummary> = {
        [week.weekId]: weekSummary,
      }
      const weeklyIdsToLoad = orderedWeeklyIds.slice(0, 24).filter((id) => id !== week.weekId)
      for (let i = 0; i < weeklyIdsToLoad.length; i += 8) {
        const batch = weeklyIdsToLoad.slice(i, i + 8)
        const results = await Promise.all(
          batch.map((weekId) =>
            getWeeklyNote(dataRoot, weekId)
              .then((note) => ({ weekId, summary: summarizeWeeklyNote(note) }))
              .catch(() => ({ weekId, summary: null as ProgressSummary | null })),
          ),
        )
        for (const { weekId, summary } of results) {
          if (summary) {
            weeklySummaryById[weekId] = summary
          }
        }
      }

      let previousWeekSummary: ProgressSummary | null = null
      let weeklyStreak = 0
      let weeklyStreakActive = true
      let weeklyStreakAnchor = week.weekId
      let lastCompletedWeekId: string | null = null

      for (const weekId of orderedWeeklyIds.slice(0, 24)) {
        const summary = weeklySummaryById[weekId] ?? null
        if (!summary) {
          continue
        }

        if (lastCompletedWeekId == null && isChecklistComplete(summary)) {
          lastCompletedWeekId = weekId
        }

        if (weekId !== week.weekId && previousWeekSummary == null) {
          previousWeekSummary = summary
        }

        if (!weeklyStreakActive) {
          if (previousWeekSummary) {
            break
          }
          continue
        }

        if (weekId === week.weekId) {
          if (isChecklistComplete(summary)) {
            weeklyStreak = 1
          } else {
            weeklyStreakActive = false
          }
          continue
        }

        if (
          weeklyStreak > 0
          && isPreviousWeekId(weeklyStreakAnchor, weekId)
          && isChecklistComplete(summary)
        ) {
          weeklyStreak += 1
          weeklyStreakAnchor = weekId
        } else {
          weeklyStreakActive = false
        }

        if (previousWeekSummary && !weeklyStreakActive) {
          break
        }
      }

      const reminders: DashboardState['reminders'] = []
      if (preferences.reminders.enabled) {
        const dailyGap = lastCompletedDailyDate
          ? diffIsoDateDays(today.date, lastCompletedDailyDate)
          : null
        if (dailyGap == null || dailyGap >= preferences.reminders.dailyGapDays) {
          reminders.push({
            kind: 'daily',
            gap: dailyGap,
            threshold: preferences.reminders.dailyGapDays,
            anchor: lastCompletedDailyDate,
          })
        }

        const weeklyGap = lastCompletedWeekId
          ? diffWeekId(week.weekId, lastCompletedWeekId)
          : null
        if (weeklyGap == null || weeklyGap >= preferences.reminders.weeklyGapWeeks) {
          reminders.push({
            kind: 'weekly',
            gap: weeklyGap,
            threshold: preferences.reminders.weeklyGapWeeks,
            anchor: lastCompletedWeekId,
          })
        }

        const bodyGap = latestBody ? diffIsoDateDays(today.date, latestBody.date) : null
        if (bodyGap == null || bodyGap >= preferences.reminders.bodyGapDays) {
          reminders.push({
            kind: 'body',
            gap: bodyGap,
            threshold: preferences.reminders.bodyGapDays,
            anchor: latestBody?.date ?? null,
          })
        }
      }

      const dailyHeatmap = recentIsoDates(today.date, 28).map((date) => ({
        date,
        percent: dailySummaryByDate[date]?.percent ?? null,
      }))

      const todayRemaining = Math.max(0, todayCoreSummary.total - todayCoreSummary.checked)
      const weakestSectionRemaining = weakestSection
        ? Math.max(0, weakestSection.summary.total - weakestSection.summary.checked)
        : 0
      const nextAction = todayRemaining > 0
        ? { kind: 'completeToday', remaining: todayRemaining } as const
        : weakestSection && weakestSection.summary.percent < 100
          ? {
              kind: 'focusWeakestSection',
              section: weakestSection.section,
              remaining: weakestSectionRemaining,
            } as const
          : !latestBody
            ? { kind: 'addBodyRecord' } as const
            : { kind: 'reviewWeek' } as const

      setState({
        todayCore: todayCoreSummary,
        todayOneLine: today.oneLine,
        weekSummary,
        todayComparison: compareProgress(todayCoreSummary, previousDailySummary),
        weekComparison: compareProgress(weekSummary, previousWeekSummary),
        dailyStreak,
        weeklyStreak,
        weakestSection,
        nextAction,
        body: latestBody,
        reminders,
        dailyHeatmap,
        recentDaily: orderedDailyDates.slice(0, 5),
        recentWeekly: orderedWeeklyIds.slice(0, 5),
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
  const comparisonText = (comparison: ProgressComparison): string => {
    if (
      comparison.previousPercent == null
      || comparison.deltaPercent == null
      || comparison.trend === 'na'
    ) {
      return t('dashboard.comparisonNoPrevious')
    }

    if (comparison.trend === 'flat') {
      return t('dashboard.comparisonFlat', { previous: comparison.previousPercent })
    }

    return comparison.trend === 'up'
      ? t('dashboard.comparisonUp', {
          previous: comparison.previousPercent,
          delta: Math.abs(comparison.deltaPercent),
        })
      : t('dashboard.comparisonDown', {
          previous: comparison.previousPercent,
          delta: Math.abs(comparison.deltaPercent),
        })
  }

  const nextActionText = () => {
    switch (state.nextAction.kind) {
      case 'completeToday':
        return t('dashboard.nextActionCompleteToday', { count: state.nextAction.remaining })
      case 'focusWeakestSection':
        return t('dashboard.nextActionFocusWeakest', {
          section: t(`section.${state.nextAction.section}` as 'section.Body'),
          count: state.nextAction.remaining,
        })
      case 'addBodyRecord':
        return t('dashboard.nextActionAddBody')
      case 'reviewWeek':
        return t('dashboard.nextActionReviewWeek')
      default:
        return t('dashboard.nextActionReviewWeek')
    }
  }

  const nextActionTarget = () => {
    switch (state.nextAction.kind) {
      case 'completeToday':
        return '/today'
      case 'focusWeakestSection':
      case 'reviewWeek':
        return '/week'
      case 'addBodyRecord':
        return '/body'
      default:
        return '/week'
    }
  }

  const reminderText = (item: DashboardState['reminders'][number]) => {
    switch (item.kind) {
      case 'daily':
        if (item.gap == null || item.anchor == null) {
          return t('dashboard.reminderDailyNoData', { threshold: item.threshold })
        }
        return t('dashboard.reminderDailyGap', {
          gap: item.gap,
          threshold: item.threshold,
          date: item.anchor,
        })
      case 'weekly':
        if (item.gap == null || item.anchor == null) {
          return t('dashboard.reminderWeeklyNoData', { threshold: item.threshold })
        }
        return t('dashboard.reminderWeeklyGap', {
          gap: item.gap,
          threshold: item.threshold,
          week: item.anchor,
        })
      case 'body':
        if (item.gap == null || item.anchor == null) {
          return t('dashboard.reminderBodyNoData', { threshold: item.threshold })
        }
        return t('dashboard.reminderBodyGap', {
          gap: item.gap,
          threshold: item.threshold,
          date: item.anchor,
        })
      default:
        return ''
    }
  }

  const heatmapCellClass = (percent: number | null) => {
    if (percent == null) {
      return 'border border-slate-100 bg-slate-50'
    }
    if (percent >= 100) {
      return 'border border-emerald-500 bg-emerald-500'
    }
    if (percent >= 70) {
      return 'border border-emerald-300 bg-emerald-300'
    }
    if (percent >= 40) {
      return 'border border-amber-300 bg-amber-200'
    }
    return 'border border-rose-200 bg-rose-100'
  }

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
          <p className="mt-1 text-xs text-slate-600">{comparisonText(state.todayComparison)}</p>
          <p className="mt-1 text-xs text-slate-600">
            {t('dashboard.dailyStreakDays', { count: state.dailyStreak })}
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
          <p className="mt-1 text-xs text-slate-600">{comparisonText(state.weekComparison)}</p>
          <p className="mt-1 text-xs text-slate-600">
            {t('dashboard.weeklyStreakWeeks', { count: state.weeklyStreak })}
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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 md:gap-4">
        <article className="dt-panel p-3 sm:p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 sm:text-base">{t('dashboard.insights')}</h2>
          {state.weakestSection ? (
            <p className="text-xs text-amber-700">
              {t('dashboard.weakestSectionHint', {
                section: t(`section.${state.weakestSection.section}` as 'section.Body'),
                checked: state.weakestSection.summary.checked,
                total: state.weakestSection.summary.total,
              })}
            </p>
          ) : (
            <p className="text-xs text-slate-600">{t('dashboard.weakestSectionUnavailable')}</p>
          )}
          <div className="mt-3 rounded-md border border-teal-200 bg-teal-50/80 p-3">
            <p className="text-xs font-medium text-teal-800">{t('dashboard.nextBestAction')}</p>
            <p className="mt-1 text-sm text-teal-900">{nextActionText()}</p>
            <Link className="mt-2 inline-block text-sm dt-link" to={nextActionTarget()}>
              {t('dashboard.takeAction')}
            </Link>
          </div>
        </article>

        <article className="dt-panel p-3 sm:p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 sm:text-base">{t('dashboard.reminders')}</h2>
          {!preferences.reminders.enabled ? (
            <p className="text-xs text-slate-600">{t('dashboard.remindersDisabled')}</p>
          ) : state.reminders.length > 0 ? (
            <ul className="space-y-2 text-xs text-amber-800">
              {state.reminders.map((item, index) => (
                <li key={`${item.kind}-${index}`} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5">
                  {reminderText(item)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-emerald-700">{t('dashboard.remindersAllGood')}</p>
          )}
        </article>

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

      <article className="dt-panel p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 sm:text-base">{t('dashboard.dailyHeatmap')}</h2>
          <p className="text-xs text-slate-600">{t('dashboard.dailyHeatmapHint')}</p>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {state.dailyHeatmap.map((cell) => (
            <div
              key={cell.date}
              className={`h-4 rounded-sm ${heatmapCellClass(cell.percent)}`}
              title={cell.percent == null
                ? t('dashboard.heatmapNoEntry', { date: cell.date })
                : t('dashboard.heatmapEntry', { date: cell.date, percent: cell.percent })}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
          <span>{t('dashboard.heatmapLegend')}</span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm border border-slate-100 bg-slate-50" />
            {t('dashboard.heatmapNone')}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm border border-rose-200 bg-rose-100" />
            {t('dashboard.heatmapLow')}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm border border-amber-300 bg-amber-200" />
            {t('dashboard.heatmapMid')}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm border border-emerald-300 bg-emerald-300" />
            {t('dashboard.heatmapHigh')}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm border border-emerald-500 bg-emerald-500" />
            {t('dashboard.heatmapFull')}
          </span>
        </div>
      </article>
    </section>
  )
}
