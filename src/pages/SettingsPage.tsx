import { useEffect, useState, type FormEvent } from 'react'

import { PageHeader } from '../components/PageHeader'
import { useDataRoot } from '../features/settings/DataRootContext'

export function SettingsPage() {
  const { dataRoot, updateDataRoot, loading } = useDataRoot()
  const [draftPath, setDraftPath] = useState(dataRoot ?? '')
  const [message, setMessage] = useState('')

  useEffect(() => {
    setDraftPath(dataRoot ?? '')
  }, [dataRoot])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage('')

    const nextPath = draftPath.trim()
    if (!nextPath) {
      setMessage('Path cannot be empty.')
      return
    }

    try {
      await updateDataRoot(nextPath)
      setMessage('Data root updated.')
    } catch {
      setMessage('Failed to update data root.')
    }
  }

  return (
    <section>
      <PageHeader
        title="Settings"
        description="Configure local data folder path."
      />
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-3">
        <label className="block text-sm font-medium text-slate-700" htmlFor="data-root">
          Data root path
        </label>
        <input
          id="data-root"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
          value={draftPath}
          onChange={(event) => setDraftPath(event.target.value)}
          placeholder="/Users/you/life-tracker-data"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Save
        </button>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </form>
    </section>
  )
}
