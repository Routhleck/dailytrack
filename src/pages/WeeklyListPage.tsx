import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'
import {
  diffWeekId,
  summarizeChecklist,
  type ProgressSummary,
} from '../features/dashboard/dashboard.service'
import { useI18n } from '../features/i18n/I18nContext'
import { useDataRoot } from '../features/settings/DataRootContext'
import { WEEKLY_SECTION_ORDER } from '../features/weekly/weekly.parser'
import { getWeeklyNote, listWeeklyIds } from '../features/weekly/weekly.service'
import { currentWeekId } from '../lib/date/week'
import { fallbackPollIntervalMs, onDataChanged } from '../lib/liveSync'

type CompletionFilter = 'all' | 'completed' | 'pending'
type RecencyFilter = 'all' | '4w' | '12w' | '24w'
type DetailFilter = 'all' | 'hasReflection'

type WeeklyListMeta = {
  summary: ProgressSummary
  reflectionText: string
}

function extractWeekFromPath(path?: string): string | null {
  if (!path) {
    return null
  }
  const match = path.match(/\d{4}-W\d{2}/i)
  return match ? match[0].toUpperCase() : null
}

function yearFromWeekId(weekId: string): number | null {
  const matched = weekId.match(/^(\d{4})-W\d{2}$/)
  if (!matched) {
    return null
  }
  const year = Number.parseInt(matched[1], 10)
  return Number.isFinite(year) ? year : null
}

function isoWeeksInYear(year: number): number {
  const marker = currentWeekId(new Date(Date.UTC(year, 11, 28)))
  const matched = marker.match(/-W(\d{2})$/)
  if (!matched) {
    return 52
  }
  const count = Number.parseInt(matched[1], 10)
  return Number.isFinite(count) && count >= 52 ? count : 52
}

function weekIdsForYear(year: number): string[] {
  const count = isoWeeksInYear(year)
  return Array.from({ length: count }, (_, index) => `${year}-W${String(index + 1).padStart(2, '0')}`)
}

export function WeeklyListPage() {
  const { t } = useI18n()
  const { dataRoot } = useDataRoot()
  const navigate = useNavigate()
  const [weeks, setWeeks] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all')
  const [recencyFilter, setRecencyFilter] = useState<RecencyFilter>('all')
  const [detailFilter, setDetailFilter] = useState<DetailFilter>('all')
  const [metadata, setMetadata] = useState<Record<string, WeeklyListMeta>>({})
  const [calendarYear, setCalendarYear] = useState(() => new Date().getUTCFullYear())
  const [error, setError] = useState('')
  const loadingRef = useRef(false)
  const pendingReloadRef = useRef(false)
  const weeksRef = useRef<string[]>([])

  useEffect(() => {
    weeksRef.current = weeks
  }, [weeks])

  useEffect(() => {
    if (weeks.length === 0) {
      return
    }
    const latest = [...weeks].sort((left, right) => right.localeCompare(left))[0]
    const latestYear = latest ? yearFromWeekId(latest) : null
    if (latestYear == null) {
      return
    }
    setCalendarYear((prev) => {
      const hasCurrentYearData = weeks.some((week) => week.startsWith(`${prev}-W`))
      return hasCurrentYearData ? prev : latestYear
    })
  }, [weeks])

  const refreshWeeklySummary = useCallback(async (week: string) => {
    if (!dataRoot) {
      return
    }

    try {
      const note = await getWeeklyNote(dataRoot, week)
      const checklist = WEEKLY_SECTION_ORDER.flatMap((section) => note.sections[section])
      const reflectionText = [...note.reflection.goodThings, ...note.reflection.nextWeekTop3]
        .join(' ')
        .trim()
      setMetadata((prev) => ({
        ...prev,
        [week]: {
          summary: summarizeChecklist(checklist),
          reflectionText,
        },
      }))
    } catch (error) {
      console.warn('[weekly-list] failed to refresh summary for week', week, error)
    }
  }, [dataRoot])

  const loadWeeklyList = useCallback(async () => {
    if (!dataRoot) {
      return
    }

    if (loadingRef.current) {
      pendingReloadRef.current = true
      return
    }

    loadingRef.current = true
    try {
      const next = await listWeeklyIds(dataRoot)
      setWeeks(next)
      setMetadata((prev) => {
        const kept: Record<string, WeeklyListMeta> = {}
        for (const week of next) {
          if (prev[week]) {
            kept[week] = prev[week]
          }
        }
        return kept
      })
      setError('')
    } catch {
      setError(t('weeklyList.loadFailed'))
    } finally {
      loadingRef.current = false
      if (pendingReloadRef.current) {
        pendingReloadRef.current = false
        void loadWeeklyList()
      }
    }
  }, [dataRoot, t])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadWeeklyList()
    }, 0)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [loadWeeklyList])

  useEffect(() => {
    const unlisten = onDataChanged((detail) => {
      if (detail.scope === 'weekly') {
        const nextWeek = extractWeekFromPath(detail.path)
        if (!nextWeek) {
          void loadWeeklyList()
          return
        }

        if (!weeksRef.current.includes(nextWeek)) {
          void loadWeeklyList()
          return
        }

        void refreshWeeklySummary(nextWeek)
        return
      }

      if (detail.scope === 'profile' || detail.scope === 'all') {
        setMetadata({})
        void loadWeeklyList()
      }
    })

    const intervalMs = fallbackPollIntervalMs('watch')
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return
      }
      void loadWeeklyList()
    }, intervalMs)

    return () => {
      unlisten()
      window.clearInterval(interval)
    }
  }, [loadWeeklyList, refreshWeeklySummary])

  const missingSummaries = useMemo(
    () => weeks.filter((week) => !metadata[week]),
    [metadata, weeks],
  )

  useEffect(() => {
    let cancelled = false

    async function loadMissingSummaries() {
      if (!dataRoot || missingSummaries.length === 0) {
        return
      }

      if (document.visibilityState !== 'visible') {
        return
      }

      const targets = missingSummaries.slice(0, 12)
      const settled = await Promise.allSettled(
        targets.map(async (week) => {
          const note = await getWeeklyNote(dataRoot, week)
          const checklist = WEEKLY_SECTION_ORDER.flatMap((section) => note.sections[section])
          return [
            week,
            {
              summary: summarizeChecklist(checklist),
              reflectionText: [...note.reflection.goodThings, ...note.reflection.nextWeekTop3]
                .join(' ')
                .trim(),
            },
          ] as const
        }),
      )

      if (cancelled) {
        return
      }

      setMetadata((prev) => {
        const next = { ...prev }
        for (const item of settled) {
          if (item.status === 'fulfilled') {
            const [week, value] = item.value
            next[week] = value
          }
        }
        return next
      })
    }

    void loadMissingSummaries()

    return () => {
      cancelled = true
    }
  }, [dataRoot, missingSummaries])

  const normalizedQuery = query.trim().toLowerCase()
  const currentWeek = currentWeekId()
  const recencyLimit = recencyFilter === '4w'
    ? 4
    : recencyFilter === '12w'
      ? 12
      : recencyFilter === '24w'
        ? 24
        : null
  const filtered = weeks
    .filter((week) => {
      if (!normalizedQuery) {
        return true
      }
      const searchable = `${week} ${metadata[week]?.reflectionText ?? ''}`.toLowerCase()
      return searchable.includes(normalizedQuery)
    })
    .filter((week) => {
      if (completionFilter === 'all') {
        return true
      }
      const summary = metadata[week]?.summary
      if (!summary) {
        return true
      }
      const completed = summary.total > 0 && summary.checked === summary.total
      return completionFilter === 'completed' ? completed : !completed
    })
    .filter((week) => {
      if (recencyLimit == null) {
        return true
      }
      const gap = diffWeekId(currentWeek, week)
      return gap != null && gap >= 0 && gap < recencyLimit
    })
    .filter((week) => {
      if (detailFilter === 'all') {
        return true
      }
      const meta = metadata[week]
      if (!meta) {
        return true
      }
      return meta.reflectionText.trim().length > 0
    })

  const firstMatch = filtered[0]

  function openFirstMatch() {
    if (!firstMatch) {
      return
    }
    navigate(`/weekly/${firstMatch}`)
  }

  const yearWeekCells = useMemo(() => weekIdsForYear(calendarYear), [calendarYear])

  const completionCellClass = (percent: number | null) => {
    if (percent == null) {
      return 'border border-slate-200 bg-white text-slate-500'
    }
    if (percent >= 100) {
      return 'border border-emerald-500 bg-emerald-500 text-white'
    }
    if (percent >= 70) {
      return 'border border-emerald-300 bg-emerald-200 text-emerald-900'
    }
    if (percent >= 40) {
      return 'border border-amber-300 bg-amber-100 text-amber-900'
    }
    return 'border border-rose-200 bg-rose-100 text-rose-800'
  }

  return (
    <section className="dt-page">
      <PageHeader title={t('weeklyList.title')} description={t('weeklyList.description')} />

      <article className="dt-panel space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 sm:text-base">{t('weeklyList.calendarTitle')}</h2>
          <div className="flex items-center gap-2">
            <button
              className="dt-btn dt-btn-secondary px-2 py-1 text-xs"
              type="button"
              onClick={() => setCalendarYear(new Date().getUTCFullYear())}
            >
              {t('weeklyList.calendarJumpCurrentYear')}
            </button>
            <button
              className="dt-btn dt-btn-secondary px-2 py-1 text-xs"
              type="button"
              onClick={() => navigate(`/weekly/${currentWeek}`)}
            >
              {t('weeklyList.calendarOpenCurrentWeek')}
            </button>
            <button
              className="dt-btn dt-btn-secondary px-2 py-1 text-xs"
              type="button"
              onClick={() => setCalendarYear((prev) => prev - 1)}
            >
              {t('weeklyList.calendarPrev')}
            </button>
            <span className="text-xs font-medium text-slate-700">{calendarYear}</span>
            <button
              className="dt-btn dt-btn-secondary px-2 py-1 text-xs"
              type="button"
              onClick={() => setCalendarYear((prev) => prev + 1)}
            >
              {t('weeklyList.calendarNext')}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-600">{t('weeklyList.calendarHint')}</p>
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}>
          {yearWeekCells.map((weekId) => {
            const percent = metadata[weekId]?.summary.percent ?? null
            const shortWeek = weekId.slice(-3)
            const isCurrentWeek = weekId === currentWeek
            return (
              <Link
                key={weekId}
                className={`flex h-8 items-center justify-center rounded-md text-[11px] font-medium transition hover:brightness-95 ${completionCellClass(percent)} ${isCurrentWeek ? 'ring-2 ring-slate-900 ring-offset-1' : ''}`}
                to={`/weekly/${weekId}`}
                title={percent == null
                  ? t('weeklyList.calendarNoEntry', { week: weekId })
                  : t('weeklyList.calendarEntry', { week: weekId, percent })}
              >
                {shortWeek}
              </Link>
            )
          })}
        </div>
      </article>

      <div className="dt-panel-soft space-y-3 p-4">
        <input
          className="dt-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              openFirstMatch()
            }
          }}
          placeholder={t('weeklyList.filterPlaceholder')}
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="dt-badge gap-2">
            <span>{t('weeklyList.statusFilter')}</span>
            <select
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
              value={completionFilter}
              onChange={(event) => setCompletionFilter(event.target.value as CompletionFilter)}
            >
              <option value="all">{t('weeklyList.statusAll')}</option>
              <option value="completed">{t('weeklyList.statusCompleted')}</option>
              <option value="pending">{t('weeklyList.statusPending')}</option>
            </select>
          </label>
          <label className="dt-badge gap-2">
            <span>{t('weeklyList.recencyFilter')}</span>
            <select
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
              value={recencyFilter}
              onChange={(event) => setRecencyFilter(event.target.value as RecencyFilter)}
            >
              <option value="all">{t('weeklyList.recencyAll')}</option>
              <option value="4w">{t('weeklyList.recency4w')}</option>
              <option value="12w">{t('weeklyList.recency12w')}</option>
              <option value="24w">{t('weeklyList.recency24w')}</option>
            </select>
          </label>
          <label className="dt-badge gap-2">
            <span>{t('weeklyList.detailFilter')}</span>
            <select
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
              value={detailFilter}
              onChange={(event) => setDetailFilter(event.target.value as DetailFilter)}
            >
              <option value="all">{t('weeklyList.detailAll')}</option>
              <option value="hasReflection">{t('weeklyList.detailHasReflection')}</option>
            </select>
          </label>
          <span className="text-xs text-slate-600">
            {t('weeklyList.itemsCount', { count: filtered.length, total: weeks.length })}
          </span>
          <button
            className="dt-btn dt-btn-secondary ml-auto"
            type="button"
            onClick={openFirstMatch}
            disabled={!firstMatch}
          >
            {t('weeklyList.openFirstMatch')}
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-600">
          {t('weeklyList.noMatches')}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((week) => {
            const summary = metadata[week]?.summary
            const summaryComplete = summary ? summary.total > 0 && summary.checked === summary.total : false
            return (
              <li key={week} className="dt-panel px-3 py-2">
                <Link className="block space-y-1" to={`/weekly/${week}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="dt-link">{week}</span>
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${
                        summaryComplete
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      {summary
                        ? t('weeklyList.completionBadge', {
                          checked: summary.checked,
                          total: summary.total,
                          percent: summary.percent,
                        })
                        : t('common.loading')}
                    </span>
                  </div>
                  {metadata[week]?.reflectionText ? (
                    <p className="truncate text-xs text-slate-600">
                      {t('weeklyList.reflectionPreview')}: {metadata[week]?.reflectionText}
                    </p>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
