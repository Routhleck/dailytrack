import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { MarkdownEditor } from '../components/MarkdownEditor'
import { PageHeader } from '../components/PageHeader'
import { ProgressBar } from '../components/ProgressBar'
import { getDailyNote, saveDailyRaw, saveDailyStructured } from '../features/daily/daily.service'
import { summarizeChecklist } from '../features/dashboard/dashboard.service'
import { usePreferences } from '../features/preferences/PreferencesContext'
import { useDataRoot } from '../features/settings/DataRootContext'
import { todayDateString } from '../lib/date/date'
import type { DailyNote } from '../types/tracker'

type Mode = 'structured' | 'raw'

export function DailyNotePage() {
  const { date } = useParams()
  const activeDate = useMemo(() => date ?? todayDateString(), [date])
  const { dataRoot, loading: rootLoading } = useDataRoot()
  const { preferences, loading: preferencesLoading } = usePreferences()

  const [mode, setMode] = useState<Mode>('structured')
  const [note, setNote] = useState<DailyNote | null>(null)
  const [rawDraft, setRawDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!dataRoot) {
      return
    }

    let cancelled = false
    setLoading(true)
    setMessage('')

    void getDailyNote(dataRoot, activeDate)
      .then((next) => {
        if (cancelled) {
          return
        }
        setNote(next)
        setRawDraft(next.raw)
      })
      .catch(() => {
        if (!cancelled) {
          setMessage('Failed to load note.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeDate, dataRoot])

  async function handleSave() {
    if (!dataRoot || !note) {
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const saved =
        mode === 'raw'
          ? await saveDailyRaw(dataRoot, activeDate, rawDraft)
          : await saveDailyStructured(dataRoot, note)
      setNote(saved)
      setRawDraft(saved.raw)
      setMessage('Saved.')
    } catch {
      setMessage('Save failed.')
    } finally {
      setSaving(false)
    }
  }

  function updateChecklist(
    section: 'dailyCore' | 'optional',
    itemIndex: number,
    patch: Partial<{ checked: boolean; text: string }>,
  ) {
    setNote((prev) => {
      if (!prev) {
        return prev
      }

      const next = { ...prev, [section]: [...prev[section]] }
      const target = next[section][itemIndex]
      if (!target) {
        return prev
      }

      next[section][itemIndex] = { ...target, ...patch }
      return next
    })
  }

  if (rootLoading || preferencesLoading || loading) {
    return (
      <section>
        <PageHeader title="Daily" description="Loading local markdown note..." />
      </section>
    )
  }

  if (!note) {
    return (
      <section>
        <PageHeader title="Daily" description="Unable to load note." />
        <p className="text-sm text-rose-700">{message || 'Unknown error.'}</p>
      </section>
    )
  }

  const coreSummary = summarizeChecklist(note.dailyCore)

  return (
    <section className="space-y-4">
      <PageHeader
        title={`Daily: ${note.date}`}
        description="Toggle checklist items in structured mode, or switch to raw markdown mode."
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          className={`rounded-md px-3 py-1.5 text-sm ${
            mode === 'structured' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
          }`}
          onClick={() => setMode('structured')}
        >
          Structured
        </button>
        <button
          className={`rounded-md px-3 py-1.5 text-sm ${
            mode === 'raw' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
          }`}
          onClick={() => setMode('raw')}
        >
          Raw Markdown
        </button>
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-md bg-teal-700 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-70"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        <Link className="ml-auto text-sm text-teal-700 hover:underline" to="/daily">
          Back to Daily List
        </Link>
      </div>

      {mode === 'structured' ? (
        <div className="space-y-6">
          <article className="rounded-lg border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Daily Core</h2>
              <span className="text-xs text-slate-600">
                {coreSummary.checked}/{coreSummary.total}
              </span>
            </div>
            <ProgressBar value={coreSummary.percent} />
            <div className="mt-4 space-y-2">
              {note.dailyCore.map((item, index) => (
                <label key={item.id} className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(event) => {
                      updateChecklist('dailyCore', index, { checked: event.target.checked })
                    }}
                  />
                  <input
                    className="w-full border-none bg-transparent text-sm text-slate-800 outline-none"
                    value={item.text}
                    onChange={(event) => {
                      updateChecklist('dailyCore', index, { text: event.target.value })
                    }}
                  />
                </label>
              ))}
            </div>
          </article>

          {preferences.daily.showOptional ? (
            <article className="rounded-lg border border-slate-200 p-4">
              <h2 className="mb-3 text-base font-semibold text-slate-900">Optional</h2>
              <div className="space-y-2">
                {note.optional.map((item, index) => (
                  <label key={item.id} className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(event) => {
                        updateChecklist('optional', index, { checked: event.target.checked })
                      }}
                    />
                    <input
                      className="w-full border-none bg-transparent text-sm text-slate-800 outline-none"
                      value={item.text}
                      onChange={(event) => {
                        updateChecklist('optional', index, { text: event.target.value })
                      }}
                    />
                  </label>
                ))}
              </div>
            </article>
          ) : null}

          <article className="rounded-lg border border-slate-200 p-4">
            <h2 className="mb-3 text-base font-semibold text-slate-900">One Line</h2>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={note.oneLine}
              onChange={(event) => {
                setNote((prev) => (prev ? { ...prev, oneLine: event.target.value } : prev))
              }}
              placeholder="Capture one line for today"
            />
          </article>
        </div>
      ) : (
        <MarkdownEditor value={rawDraft} onChange={setRawDraft} />
      )}
    </section>
  )
}
