import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'
import { useDataRoot } from '../features/settings/DataRootContext'
import { listWeeklyIds } from '../features/weekly/weekly.service'
import { onDataChanged } from '../lib/liveSync'

export function WeeklyListPage() {
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
      setError('Failed to load weekly files.')
    }
  }, [dataRoot])

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
    }, 5000)

    return () => {
      unlisten()
      window.clearInterval(interval)
    }
  }, [loadWeeklyList])

  const filtered = weeks.filter((week) => week.includes(query.trim().toUpperCase()))

  return (
    <section className="space-y-4">
      <PageHeader title="Weekly Notes" description="Browse local weekly markdown files." />

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by week, e.g. 2026-W12"
        />
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <ul className="space-y-2">
        {filtered.map((week) => (
          <li key={week} className="rounded-md border border-slate-200 px-3 py-2">
            <Link className="text-teal-700 hover:underline" to={`/weekly/${week}`}>
              {week}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
