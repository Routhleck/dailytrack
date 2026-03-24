import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'
import { useI18n } from '../features/i18n/I18nContext'
import { useDataRoot } from '../features/settings/DataRootContext'
import { listWeeklyIds } from '../features/weekly/weekly.service'
import { onDataChanged } from '../lib/liveSync'

export function WeeklyListPage() {
  const { t } = useI18n()
  const { dataRoot } = useDataRoot()
  const [weeks, setWeeks] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  const loadWeeklyList = useCallback(async () => {
    if (!dataRoot) {
      return
    }

    try {
      const next = await listWeeklyIds(dataRoot)
      setWeeks(next)
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

  const filtered = weeks.filter((week) => week.includes(query.trim().toUpperCase()))

  return (
    <section className="dt-page">
      <PageHeader title={t('weeklyList.title')} description={t('weeklyList.description')} />

      <div className="dt-panel-soft p-4">
        <input
          className="dt-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('weeklyList.filterPlaceholder')}
        />
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <ul className="space-y-2">
        {filtered.map((week) => (
          <li key={week} className="dt-panel px-3 py-2">
            <Link className="dt-link" to={`/weekly/${week}`}>
              {week}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
