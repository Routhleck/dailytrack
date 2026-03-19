import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { MarkdownEditor } from '../components/MarkdownEditor'
import { PageHeader } from '../components/PageHeader'
import { ProgressBar } from '../components/ProgressBar'
import { summarizeChecklist } from '../features/dashboard/dashboard.service'
import { useDataRoot } from '../features/settings/DataRootContext'
import { WEEKLY_SECTION_ORDER } from '../features/weekly/weekly.parser'
import {
  getWeeklyNote,
  saveWeeklyRaw,
  saveWeeklyStructured,
} from '../features/weekly/weekly.service'
import { currentWeekId } from '../lib/date/week'
import type { WeeklyNote, WeeklySectionKey } from '../types/tracker'

type Mode = 'structured' | 'raw'

export function WeeklyNotePage() {
  const { weekId } = useParams()
  const activeWeekId = useMemo(() => weekId ?? currentWeekId(), [weekId])
  const { dataRoot, loading: rootLoading } = useDataRoot()

  const [mode, setMode] = useState<Mode>('structured')
  const [note, setNote] = useState<WeeklyNote | null>(null)
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

    void getWeeklyNote(dataRoot, activeWeekId)
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
  }, [activeWeekId, dataRoot])

  async function handleSave() {
    if (!dataRoot || !note) {
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const saved =
        mode === 'raw'
          ? await saveWeeklyRaw(dataRoot, activeWeekId, rawDraft)
          : await saveWeeklyStructured(dataRoot, note)
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
    section: WeeklySectionKey,
    itemIndex: number,
    patch: Partial<{ checked: boolean; text: string }>,
  ) {
    setNote((prev) => {
      if (!prev) {
        return prev
      }

      const updatedSection = [...prev.sections[section]]
      const target = updatedSection[itemIndex]
      if (!target) {
        return prev
      }

      updatedSection[itemIndex] = { ...target, ...patch }
      return {
        ...prev,
        sections: {
          ...prev.sections,
          [section]: updatedSection,
        },
      }
    })
  }

  function updateReflection(key: 'goodThings' | 'nextWeekTop3', index: number, value: string) {
    setNote((prev) => {
      if (!prev) {
        return prev
      }

      const nextValues = [...prev.reflection[key]]
      nextValues[index] = value
      return {
        ...prev,
        reflection: {
          ...prev.reflection,
          [key]: nextValues,
        },
      }
    })
  }

  if (rootLoading || loading) {
    return (
      <section>
        <PageHeader title="Weekly" description="Loading local markdown note..." />
      </section>
    )
  }

  if (!note) {
    return (
      <section>
        <PageHeader title="Weekly" description="Unable to load note." />
        <p className="text-sm text-rose-700">{message || 'Unknown error.'}</p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title={`Weekly: ${note.weekId}`}
        description="Track section checklists and weekly reflection, with raw markdown fallback."
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
        <Link className="ml-auto text-sm text-teal-700 hover:underline" to="/weekly">
          Back to Weekly List
        </Link>
      </div>

      {mode === 'structured' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {WEEKLY_SECTION_ORDER.map((section) => {
            const items = note.sections[section]
            const summary = summarizeChecklist(items)

            return (
              <article key={section} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900">{section}</h2>
                  <span className="text-xs text-slate-600">
                    {summary.checked}/{summary.total}
                  </span>
                </div>
                <ProgressBar value={summary.percent} />
                <div className="mt-4 space-y-2">
                  {items.map((item, index) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(event) => {
                          updateChecklist(section, index, { checked: event.target.checked })
                        }}
                      />
                      <input
                        className="w-full border-none bg-transparent text-sm text-slate-800 outline-none"
                        value={item.text}
                        onChange={(event) => {
                          updateChecklist(section, index, { text: event.target.value })
                        }}
                      />
                    </label>
                  ))}
                </div>
              </article>
            )
          })}

          <article className="rounded-lg border border-slate-200 p-4 lg:col-span-2">
            <h2 className="mb-3 text-base font-semibold text-slate-900">Reflection</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-md bg-slate-50 p-3">
                <h3 className="text-sm font-medium text-slate-700">3 good things this week</h3>
                {note.reflection.goodThings.map((value, index) => (
                  <input
                    key={`good-${index}`}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={value}
                    onChange={(event) => {
                      updateReflection('goodThings', index, event.target.value)
                    }}
                    placeholder={`${index + 1}.`}
                  />
                ))}
              </div>

              <div className="space-y-2 rounded-md bg-slate-50 p-3">
                <h3 className="text-sm font-medium text-slate-700">
                  3 most important things next week
                </h3>
                {note.reflection.nextWeekTop3.map((value, index) => (
                  <input
                    key={`next-${index}`}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={value}
                    onChange={(event) => {
                      updateReflection('nextWeekTop3', index, event.target.value)
                    }}
                    placeholder={`${index + 1}.`}
                  />
                ))}
              </div>
            </div>
          </article>
        </div>
      ) : (
        <MarkdownEditor value={rawDraft} onChange={setRawDraft} />
      )}
    </section>
  )
}
