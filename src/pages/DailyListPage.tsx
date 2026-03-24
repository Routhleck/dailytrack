import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'
import { useI18n } from '../features/i18n/I18nContext'
import { listDailyDates } from '../features/daily/daily.service'
import { useDataRoot } from '../features/settings/DataRootContext'
import { onDataChanged } from '../lib/liveSync'

export function DailyListPage() {
  const { t } = useI18n()
  const { dataRoot } = useDataRoot()
  const [dates, setDates] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  const loadDailyList = useCallback(async () => {
    if (!dataRoot) {
      return
    }

    try {
      const next = await listDailyDates(dataRoot)
      setDates(next)
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

  const filtered = dates.filter((date) => date.includes(query.trim()))

  return (
    <section className="dt-page">
      <PageHeader title={t('dailyList.title')} description={t('dailyList.description')} />

      <div className="dt-panel-soft p-4">
        <input
          className="dt-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('dailyList.filterPlaceholder')}
        />
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <ul className="space-y-2">
        {filtered.map((date) => (
          <li key={date} className="dt-panel px-3 py-2">
            <Link className="dt-link" to={`/daily/${date}`}>
              {date}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
