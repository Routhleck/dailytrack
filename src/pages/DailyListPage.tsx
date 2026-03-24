import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'
import { summarizeChecklist, type ProgressSummary } from '../features/dashboard/dashboard.service'
import { useI18n } from '../features/i18n/I18nContext'
import { getDailyNote, listDailyDates } from '../features/daily/daily.service'
import { useDataRoot } from '../features/settings/DataRootContext'
import { onDataChanged } from '../lib/liveSync'

type CompletionFilter = 'all' | 'completed' | 'pending'

export function DailyListPage() {
  const { t } = useI18n()
  const { dataRoot } = useDataRoot()
  const navigate = useNavigate()
  const [dates, setDates] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all')
  const [summaries, setSummaries] = useState<Record<string, ProgressSummary>>({})
  const [error, setError] = useState('')

  const loadDailyList = useCallback(async () => {
    if (!dataRoot) {
      return
    }

    try {
      const next = await listDailyDates(dataRoot)
      setDates(next)
      setSummaries((prev) => {
        const kept: Record<string, ProgressSummary> = {}
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
      if (detail.scope === 'daily' || detail.scope === 'profile' || detail.scope === 'all') {
        setSummaries({})
        void loadDailyList()
      }
    })

    const interval = window.setInterval(() => {
      void loadDailyList()
    }, 10000)

    return () => {
      unlisten()
      window.clearInterval(interval)
    }
  }, [loadDailyList])

  const missingSummaries = useMemo(
    () => dates.filter((date) => !summaries[date]),
    [dates, summaries],
  )

  useEffect(() => {
    let cancelled = false

    async function loadMissingSummaries() {
      if (!dataRoot || missingSummaries.length === 0) {
        return
      }

      const settled = await Promise.allSettled(
        missingSummaries.map(async (date) => {
          const note = await getDailyNote(dataRoot, date)
          return [date, summarizeChecklist(note.dailyCore)] as const
        }),
      )

      if (cancelled) {
        return
      }

      setSummaries((prev) => {
        const next = { ...prev }
        for (const item of settled) {
          if (item.status === 'fulfilled') {
            const [date, summary] = item.value
            next[date] = summary
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

  const normalizedQuery = query.trim()
  const filtered = dates
    .filter((date) => date.includes(normalizedQuery))
    .filter((date) => {
      if (completionFilter === 'all') {
        return true
      }
      const summary = summaries[date]
      if (!summary) {
        return true
      }
      const completed = summary.total > 0 && summary.checked === summary.total
      return completionFilter === 'completed' ? completed : !completed
    })

  const firstMatch = filtered[0]

  function openFirstMatch() {
    if (!firstMatch) {
      return
    }
    navigate(`/daily/${firstMatch}`)
  }

  return (
    <section className="dt-page">
      <PageHeader title={t('dailyList.title')} description={t('dailyList.description')} />

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
            const summary = summaries[date]
            const summaryComplete = summary ? summary.total > 0 && summary.checked === summary.total : false
            return (
              <li key={date} className="dt-panel px-3 py-2">
                <Link className="flex items-center justify-between gap-3" to={`/daily/${date}`}>
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
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
