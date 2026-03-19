import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'
import { useDataRoot } from '../features/settings/DataRootContext'
import { listWeeklyIds } from '../features/weekly/weekly.service'

export function WeeklyListPage() {
  const { dataRoot } = useDataRoot()
  const [weeks, setWeeks] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!dataRoot) {
      return
    }

    void listWeeklyIds(dataRoot)
      .then(setWeeks)
      .catch(() => setError('Failed to load weekly files.'))
  }, [dataRoot])

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
