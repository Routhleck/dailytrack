import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'
import { listDailyDates } from '../features/daily/daily.service'
import { useDataRoot } from '../features/settings/DataRootContext'
import { onDataChanged } from '../lib/liveSync'

export function DailyListPage() {
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
      setError('Failed to load daily files.')
    }
  }, [dataRoot])

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
    }, 5000)

    return () => {
      unlisten()
      window.clearInterval(interval)
    }
  }, [loadDailyList])

  const filtered = dates.filter((date) => date.includes(query.trim()))

  return (
    <section className="space-y-4">
      <PageHeader title="Daily Notes" description="Browse local daily markdown files." />

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by date, e.g. 2026-03"
        />
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <ul className="space-y-2">
        {filtered.map((date) => (
          <li key={date} className="rounded-md border border-slate-200 px-3 py-2">
            <Link className="text-teal-700 hover:underline" to={`/daily/${date}`}>
              {date}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
