import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { MarkdownEditor } from '../components/MarkdownEditor'
import { PageHeader } from '../components/PageHeader'
import { ProgressBar } from '../components/ProgressBar'
import { summarizeChecklist } from '../features/dashboard/dashboard.service'
import { usePreferences } from '../features/preferences/PreferencesContext'
import { useDataRoot } from '../features/settings/DataRootContext'
import { WEEKLY_SECTION_ORDER } from '../features/weekly/weekly.parser'
import { serializeWeeklyMarkdown } from '../features/weekly/weekly.serializer'
import {
  getWeeklyNote,
  saveWeeklyRaw,
  saveWeeklyStructured,
} from '../features/weekly/weekly.service'
import { currentWeekId } from '../lib/date/week'
import { emitDataChanged } from '../lib/liveSync'
import type { WeeklyNote, WeeklySectionKey } from '../types/tracker'

type Mode = 'structured' | 'raw'

export function WeeklyNotePage() {
  const { weekId } = useParams()
  const activeWeekId = useMemo(() => weekId ?? currentWeekId(), [weekId])
  const { dataRoot, loading: rootLoading } = useDataRoot()
  const { preferences, loading: preferencesLoading } = usePreferences()

  const [mode, setMode] = useState<Mode>('structured')
  const [note, setNote] = useState<WeeklyNote | null>(null)
  const [rawDraft, setRawDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const savedStructuredRef = useRef('')
  const savedRawRef = useRef('')

  const structuredDraft = useMemo(
    () => (note ? serializeWeeklyMarkdown(note) : ''),
    [note],
  )
  const structuredDirty = Boolean(note && structuredDraft !== savedStructuredRef.current)
  const rawDirty = rawDraft !== savedRawRef.current

  const markSaved = useCallback((savedNote: WeeklyNote) => {
    savedStructuredRef.current = serializeWeeklyMarkdown(savedNote)
    savedRawRef.current = savedNote.raw
  }, [])

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
        markSaved(next)
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
  }, [activeWeekId, dataRoot, markSaved])

  const performSave = useCallback(
    async (source: 'manual' | 'auto') => {
      if (!dataRoot || !note || saving) {
        return
      }

      setSaving(true)
      if (source === 'manual') {
        setMessage('')
      }

      try {
        const saved =
          mode === 'raw'
            ? await saveWeeklyRaw(dataRoot, activeWeekId, rawDraft)
            : await saveWeeklyStructured(dataRoot, note)
        setNote(saved)
        setRawDraft(saved.raw)
        markSaved(saved)
        setMessage(source === 'manual' ? 'Saved.' : 'Autosaved.')
        emitDataChanged({ scope: 'weekly', path: saved.weekId })
      } catch {
        setMessage(source === 'manual' ? 'Save failed.' : 'Autosave failed.')
      } finally {
        setSaving(false)
      }
    },
    [activeWeekId, dataRoot, markSaved, mode, note, rawDraft, saving],
  )

  useEffect(() => {
    if (!dataRoot || !note || loading || saving) {
      return
    }

    const dirty = mode === 'structured' ? structuredDirty : rawDirty
    if (!dirty) {
      return
    }

    const timer = window.setTimeout(() => {
      void performSave('auto')
    }, mode === 'structured' ? 800 : 1200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [dataRoot, loading, mode, note, performSave, rawDirty, saving, structuredDirty])

  useEffect(() => {
    if (!dataRoot || !note) {
      return
    }

    const timer = window.setInterval(() => {
      if (saving) {
        return
      }

      const dirty = mode === 'structured' ? structuredDirty : rawDirty
      if (dirty) {
        return
      }

      void getWeeklyNote(dataRoot, activeWeekId)
        .then((remote) => {
          if (remote.raw === savedRawRef.current) {
            return
          }

          setNote(remote)
          setRawDraft(remote.raw)
          markSaved(remote)
          setMessage('Updated from disk.')
          emitDataChanged({ scope: 'weekly', path: remote.weekId })
        })
        .catch(() => {
          // ignore polling failures to avoid noisy UI updates
        })
    }, 2500)

    return () => {
      window.clearInterval(timer)
    }
  }, [activeWeekId, dataRoot, markSaved, mode, note, rawDirty, saving, structuredDirty])

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

  if (rootLoading || preferencesLoading || loading) {
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

  const enabledSections = WEEKLY_SECTION_ORDER.filter((section) => preferences.weekly.sections[section])

  return (
    <section className="space-y-4">
      <PageHeader
        title={`Weekly: ${note.weekId}`}
        description="Structured edits and raw markdown are autosaved; external file changes are pulled in when no local unsaved edits exist."
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
          onClick={() => void performSave('manual')}
          disabled={saving}
          className="rounded-md bg-teal-700 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-70"
        >
          {saving ? 'Saving...' : 'Save now'}
        </button>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        <Link className="ml-auto text-sm text-teal-700 hover:underline" to="/weekly">
          Back to Weekly List
        </Link>
      </div>

      {mode === 'structured' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {enabledSections.map((section) => {
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
