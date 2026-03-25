import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'
import {
  diffIsoDateDays,
  summarizeChecklist,
  type ProgressSummary,
} from '../features/dashboard/dashboard.service'
import { useI18n } from '../features/i18n/I18nContext'
import { getDailyNote, listDailyDates } from '../features/daily/daily.service'
import { useDataRoot } from '../features/settings/DataRootContext'
import { todayDateString } from '../lib/date/date'
import { fallbackPollIntervalMs, onDataChanged } from '../lib/liveSync'

type CompletionFilter = 'all' | 'completed' | 'pending'
type RecencyFilter = 'all' | '7d' | '30d' | '90d'
type DetailFilter = 'all' | 'hasOneLine' | 'hasMoodEnergy'

type DailyListMeta = {
  summary: ProgressSummary
  oneLine: string
  moodTag: string
  energyTag: string
}

function extractDateFromPath(path?: string): string | null {
  if (!path) {
    return null
  }
  const match = path.match(/\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : null
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function monthIdFromIsoDate(isoDate: string): string {
  return isIsoDate(isoDate) ? isoDate.slice(0, 7) : todayDateString().slice(0, 7)
}

function shiftMonth(monthId: string, delta: number): string {
  const matched = monthId.match(/^(\d{4})-(\d{2})$/)
  if (!matched) {
    return monthId
  }
  const year = Number.parseInt(matched[1], 10)
  const month = Number.parseInt(matched[2], 10)
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return monthId
  }
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1))
  const nextYear = shifted.getUTCFullYear()
  const nextMonth = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  return `${nextYear}-${nextMonth}`
}

function buildMonthCells(monthId: string): Array<string | null> {
  const matched = monthId.match(/^(\d{4})-(\d{2})$/)
  if (!matched) {
    return []
  }
  const year = Number.parseInt(matched[1], 10)
  const month = Number.parseInt(matched[2], 10)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return []
  }

  const firstDay = new Date(Date.UTC(year, month - 1, 1))
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const startOffset = firstDay.getUTCDay()
  const cells: Array<string | null> = Array.from({ length: startOffset }, () => null)

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${monthId}-${String(day).padStart(2, '0')}`)
  }

  while (cells.length % 7 !== 0) {
    cells.push(null)
  }
  return cells
}

export function DailyListPage() {
  const { t } = useI18n()
  const { dataRoot } = useDataRoot()
  const navigate = useNavigate()
  const [dates, setDates] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all')
  const [recencyFilter, setRecencyFilter] = useState<RecencyFilter>('all')
  const [detailFilter, setDetailFilter] = useState<DetailFilter>('all')
  const [metadata, setMetadata] = useState<Record<string, DailyListMeta>>({})
  const [calendarMonth, setCalendarMonth] = useState(() => todayDateString().slice(0, 7))
  const [error, setError] = useState('')
  const loadingRef = useRef(false)
  const pendingReloadRef = useRef(false)
  const datesRef = useRef<string[]>([])

  useEffect(() => {
    datesRef.current = dates
  }, [dates])

  useEffect(() => {
    if (dates.length === 0) {
      return
    }
    const latest = [...dates].sort((left, right) => right.localeCompare(left))[0]
    if (!latest) {
      return
    }
    const nextMonth = monthIdFromIsoDate(latest)
    setCalendarMonth((prev) => (prev ? prev : nextMonth))
  }, [dates])

  const refreshDailySummary = useCallback(async (date: string) => {
    if (!dataRoot) {
      return
    }

    try {
      const note = await getDailyNote(dataRoot, date)
      setMetadata((prev) => ({
        ...prev,
        [date]: {
          summary: summarizeChecklist(note.dailyCore),
          oneLine: note.oneLine,
          moodTag: note.moodTag,
          energyTag: note.energyTag,
        },
      }))
    } catch (error) {
      console.warn('[daily-list] failed to refresh summary for date', date, error)
    }
  }, [dataRoot])

  const loadDailyList = useCallback(async () => {
    if (!dataRoot) {
      return
    }

    if (loadingRef.current) {
      pendingReloadRef.current = true
      return
    }

    loadingRef.current = true
    try {
      const next = await listDailyDates(dataRoot)
      setDates(next)
      setMetadata((prev) => {
        const kept: Record<string, DailyListMeta> = {}
        for (const date of next) {
          if (prev[date]) {
            kept[date] = prev[date]
          }
        }
        return kept
      })
      setError('')
    } catch {
      setError(t('dailyList.loadFailed'))
    } finally {
      loadingRef.current = false
      if (pendingReloadRef.current) {
        pendingReloadRef.current = false
        void loadDailyList()
      }
    }
  }, [dataRoot, t])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadDailyList()
    }, 0)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [loadDailyList])

  useEffect(() => {
    const unlisten = onDataChanged((detail) => {
      if (detail.scope === 'daily') {
        const nextDate = extractDateFromPath(detail.path)
        if (!nextDate) {
          void loadDailyList()
          return
        }

        if (!datesRef.current.includes(nextDate)) {
          void loadDailyList()
          return
        }

        void refreshDailySummary(nextDate)
        return
      }

      if (detail.scope === 'profile' || detail.scope === 'all') {
        setMetadata({})
        void loadDailyList()
      }
    })

    const intervalMs = fallbackPollIntervalMs('watch')
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return
      }
      void loadDailyList()
    }, intervalMs)

    return () => {
      unlisten()
      window.clearInterval(interval)
    }
  }, [loadDailyList, refreshDailySummary])

  const missingSummaries = useMemo(
    () => dates.filter((date) => !metadata[date]),
    [dates, metadata],
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
        targets.map(async (date) => {
          const note = await getDailyNote(dataRoot, date)
          return [
            date,
            {
              summary: summarizeChecklist(note.dailyCore),
              oneLine: note.oneLine,
              moodTag: note.moodTag,
              energyTag: note.energyTag,
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
            const [date, value] = item.value
            next[date] = value
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
  const today = todayDateString()
  const recencyLimit = recencyFilter === '7d'
    ? 7
    : recencyFilter === '30d'
      ? 30
      : recencyFilter === '90d'
        ? 90
        : null
  const filtered = dates
    .filter((date) => {
      if (!normalizedQuery) {
        return true
      }
      const meta = metadata[date]
      const searchable = `${date} ${meta?.oneLine ?? ''} ${meta?.moodTag ?? ''} ${meta?.energyTag ?? ''}`.toLowerCase()
      return searchable.includes(normalizedQuery)
    })
    .filter((date) => {
      if (completionFilter === 'all') {
        return true
      }
      const summary = metadata[date]?.summary
      if (!summary) {
        return true
      }
      const completed = summary.total > 0 && summary.checked === summary.total
      return completionFilter === 'completed' ? completed : !completed
    })
    .filter((date) => {
      if (recencyLimit == null) {
        return true
      }
      const gap = diffIsoDateDays(today, date)
      return gap != null && gap >= 0 && gap < recencyLimit
    })
    .filter((date) => {
      if (detailFilter === 'all') {
        return true
      }
      const meta = metadata[date]
      if (!meta) {
        return true
      }
      if (detailFilter === 'hasOneLine') {
        return meta.oneLine.trim().length > 0
      }
      return meta.moodTag.trim().length > 0 || meta.energyTag.trim().length > 0
    })

  const firstMatch = filtered[0]

  function openFirstMatch() {
    if (!firstMatch) {
      return
    }
    navigate(`/daily/${firstMatch}`)
  }

  const monthCells = useMemo(() => buildMonthCells(calendarMonth), [calendarMonth])

  const completionCellClass = (percent: number | null) => {
    if (percent == null) {
      return 'border border-slate-200 bg-white text-slate-400'
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
      <PageHeader title={t('dailyList.title')} description={t('dailyList.description')} />

      <article className="dt-panel space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 sm:text-base">{t('dailyList.calendarTitle')}</h2>
          <div className="flex items-center gap-2">
            <button
              className="dt-btn dt-btn-secondary px-2 py-1 text-xs"
              type="button"
              onClick={() => setCalendarMonth((prev) => shiftMonth(prev, -1))}
            >
              {t('dailyList.calendarPrev')}
            </button>
            <span className="text-xs font-medium text-slate-700">{calendarMonth}</span>
            <button
              className="dt-btn dt-btn-secondary px-2 py-1 text-xs"
              type="button"
              onClick={() => setCalendarMonth((prev) => shiftMonth(prev, 1))}
            >
              {t('dailyList.calendarNext')}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-600">{t('dailyList.calendarHint')}</p>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500">
          <span>{t('dailyList.weekdaySun')}</span>
          <span>{t('dailyList.weekdayMon')}</span>
          <span>{t('dailyList.weekdayTue')}</span>
          <span>{t('dailyList.weekdayWed')}</span>
          <span>{t('dailyList.weekdayThu')}</span>
          <span>{t('dailyList.weekdayFri')}</span>
          <span>{t('dailyList.weekdaySat')}</span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthCells.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="h-10 rounded-md bg-slate-50/70" />
            }
            const percent = metadata[date]?.summary.percent ?? null
            const dayText = date.slice(-2)
            return (
              <Link
                key={date}
                className={`flex h-10 items-center justify-center rounded-md text-xs font-medium transition hover:brightness-95 ${completionCellClass(percent)}`}
                to={`/daily/${date}`}
                title={percent == null
                  ? t('dailyList.calendarNoEntry', { date })
                  : t('dailyList.calendarEntry', { date, percent })}
              >
                {dayText}
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
          placeholder={t('dailyList.filterPlaceholder')}
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="dt-badge gap-2">
            <span>{t('dailyList.statusFilter')}</span>
            <select
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
              value={completionFilter}
              onChange={(event) => setCompletionFilter(event.target.value as CompletionFilter)}
            >
              <option value="all">{t('dailyList.statusAll')}</option>
              <option value="completed">{t('dailyList.statusCompleted')}</option>
              <option value="pending">{t('dailyList.statusPending')}</option>
            </select>
          </label>
          <label className="dt-badge gap-2">
            <span>{t('dailyList.recencyFilter')}</span>
            <select
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
              value={recencyFilter}
              onChange={(event) => setRecencyFilter(event.target.value as RecencyFilter)}
            >
              <option value="all">{t('dailyList.recencyAll')}</option>
              <option value="7d">{t('dailyList.recency7d')}</option>
              <option value="30d">{t('dailyList.recency30d')}</option>
              <option value="90d">{t('dailyList.recency90d')}</option>
            </select>
          </label>
          <label className="dt-badge gap-2">
            <span>{t('dailyList.detailFilter')}</span>
            <select
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
              value={detailFilter}
              onChange={(event) => setDetailFilter(event.target.value as DetailFilter)}
            >
              <option value="all">{t('dailyList.detailAll')}</option>
              <option value="hasOneLine">{t('dailyList.detailHasOneLine')}</option>
              <option value="hasMoodEnergy">{t('dailyList.detailHasMoodEnergy')}</option>
            </select>
          </label>
          <span className="text-xs text-slate-600">
            {t('dailyList.itemsCount', { count: filtered.length, total: dates.length })}
          </span>
          <button
            className="dt-btn dt-btn-secondary ml-auto"
            type="button"
            onClick={openFirstMatch}
            disabled={!firstMatch}
          >
            {t('dailyList.openFirstMatch')}
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-600">
          {t('dailyList.noMatches')}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((date) => {
            const summary = metadata[date]?.summary
            const summaryComplete = summary ? summary.total > 0 && summary.checked === summary.total : false
            return (
              <li key={date} className="dt-panel px-3 py-2">
                <Link className="block space-y-1" to={`/daily/${date}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="dt-link">{date}</span>
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${
                        summaryComplete
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      {summary
                        ? t('dailyList.completionBadge', {
                          checked: summary.checked,
                          total: summary.total,
                          percent: summary.percent,
                        })
                        : t('common.loading')}
                    </span>
                  </div>
                  {metadata[date]?.oneLine ? (
                    <p className="truncate text-xs text-slate-600">
                      {t('dailyList.oneLinePreview')}: {metadata[date]?.oneLine}
                    </p>
                  ) : null}
                  {(metadata[date]?.moodTag || metadata[date]?.energyTag) ? (
                    <p className="text-[11px] text-slate-500">
                      {t('dailyList.tagPreview', {
                        mood: metadata[date]?.moodTag || '-',
                        energy: metadata[date]?.energyTag || '-',
                      })}
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
