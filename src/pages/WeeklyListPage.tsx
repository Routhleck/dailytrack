import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'
import { summarizeChecklist, type ProgressSummary } from '../features/dashboard/dashboard.service'
import { useI18n } from '../features/i18n/I18nContext'
import { useDataRoot } from '../features/settings/DataRootContext'
import { WEEKLY_SECTION_ORDER } from '../features/weekly/weekly.parser'
import { getWeeklyNote, listWeeklyIds } from '../features/weekly/weekly.service'
import { onDataChanged } from '../lib/liveSync'

type CompletionFilter = 'all' | 'completed' | 'pending'

export function WeeklyListPage() {
  const { t } = useI18n()
  const { dataRoot } = useDataRoot()
  const navigate = useNavigate()
  const [weeks, setWeeks] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all')
  const [summaries, setSummaries] = useState<Record<string, ProgressSummary>>({})
  const [error, setError] = useState('')

  const loadWeeklyList = useCallback(async () => {
    if (!dataRoot) {
      return
    }

    try {
      const next = await listWeeklyIds(dataRoot)
      setWeeks(next)
      setSummaries((prev) => {
        const kept: Record<string, ProgressSummary> = {}
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
      if (detail.scope === 'weekly' || detail.scope === 'profile' || detail.scope === 'all') {
        setSummaries({})
        void loadWeeklyList()
      }
    })

    const interval = window.setInterval(() => {
      void loadWeeklyList()
    }, 10000)

    return () => {
      unlisten()
      window.clearInterval(interval)
    }
  }, [loadWeeklyList])

  const missingSummaries = useMemo(
    () => weeks.filter((week) => !summaries[week]),
    [summaries, weeks],
  )

  useEffect(() => {
    let cancelled = false

    async function loadMissingSummaries() {
      if (!dataRoot || missingSummaries.length === 0) {
        return
      }

      const settled = await Promise.allSettled(
        missingSummaries.map(async (week) => {
          const note = await getWeeklyNote(dataRoot, week)
          const checklist = WEEKLY_SECTION_ORDER.flatMap((section) => note.sections[section])
          return [week, summarizeChecklist(checklist)] as const
        }),
      )

      if (cancelled) {
        return
      }

      setSummaries((prev) => {
        const next = { ...prev }
        for (const item of settled) {
          if (item.status === 'fulfilled') {
            const [week, summary] = item.value
            next[week] = summary
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

  const normalizedQuery = query.trim().toUpperCase()
  const filtered = weeks
    .filter((week) => week.includes(normalizedQuery))
    .filter((week) => {
      if (completionFilter === 'all') {
        return true
      }
      const summary = summaries[week]
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
    navigate(`/weekly/${firstMatch}`)
  }

  return (
    <section className="dt-page">
      <PageHeader title={t('weeklyList.title')} description={t('weeklyList.description')} />

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
            const summary = summaries[week]
            const summaryComplete = summary ? summary.total > 0 && summary.checked === summary.total : false
            return (
              <li key={week} className="dt-panel px-3 py-2">
                <Link className="flex items-center justify-between gap-3" to={`/weekly/${week}`}>
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
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
