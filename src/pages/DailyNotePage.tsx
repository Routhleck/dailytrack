import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { MarkdownEditor } from '../components/MarkdownEditor'
import { PageHeader } from '../components/PageHeader'
import { ProgressBar } from '../components/ProgressBar'
import { getDailyNote, saveDailyRaw, saveDailyStructured } from '../features/daily/daily.service'
import { serializeDailyMarkdown } from '../features/daily/daily.serializer'
import { summarizeChecklist } from '../features/dashboard/dashboard.service'
import { useI18n } from '../features/i18n/I18nContext'
import { usePreferences } from '../features/preferences/PreferencesContext'
import { useDataRoot } from '../features/settings/DataRootContext'
import { todayDateString } from '../lib/date/date'
import { emitDataChanged, fallbackPollIntervalMs } from '../lib/liveSync'
import type { DailyNote } from '../types/tracker'

type Mode = 'structured' | 'raw'

export function DailyNotePage() {
  const { t } = useI18n()
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

  const savedStructuredRef = useRef('')
  const savedRawRef = useRef('')

  const structuredDraft = useMemo(
    () => (note ? serializeDailyMarkdown(note) : ''),
    [note],
  )
  const structuredDirty = Boolean(note && structuredDraft !== savedStructuredRef.current)
  const rawDirty = rawDraft !== savedRawRef.current

  const markSaved = useCallback((savedNote: DailyNote) => {
    savedStructuredRef.current = serializeDailyMarkdown(savedNote)
    savedRawRef.current = savedNote.raw
  }, [])

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
        markSaved(next)
      })
      .catch(() => {
        if (!cancelled) {
          setMessage(t('dailyNote.loadFailed'))
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
  }, [activeDate, dataRoot, markSaved, t])

  const performSave = useCallback(
    async () => {
      if (!dataRoot || !note || saving) {
        return
      }

      setSaving(true)

      try {
        const saved =
          mode === 'raw'
            ? await saveDailyRaw(dataRoot, activeDate, rawDraft)
            : await saveDailyStructured(dataRoot, note)
        setNote(saved)
        setRawDraft(saved.raw)
        markSaved(saved)
        setMessage(t('dailyNote.autosaved'))
        emitDataChanged({ scope: 'daily', path: saved.date })
      } catch {
        setMessage(t('dailyNote.autosaveFailed'))
      } finally {
        setSaving(false)
      }
    },
    [activeDate, dataRoot, markSaved, mode, note, rawDraft, saving, t],
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
      void performSave()
    }, mode === 'structured' ? 1200 : 1500)

    return () => {
      window.clearTimeout(timer)
    }
  }, [dataRoot, loading, mode, note, performSave, rawDirty, saving, structuredDirty])

  useEffect(() => {
    if (!dataRoot || !note) {
      return
    }

    const intervalMs = fallbackPollIntervalMs(preferences.sync.mode)

    const timer = window.setInterval(() => {
      if (saving) {
        return
      }

      const dirty = mode === 'structured' ? structuredDirty : rawDirty
      if (dirty) {
        return
      }

      void getDailyNote(dataRoot, activeDate)
        .then((remote) => {
          if (remote.raw === savedRawRef.current) {
            return
          }

          setNote(remote)
          setRawDraft(remote.raw)
          markSaved(remote)
          setMessage(t('dailyNote.updatedFromDisk'))
          emitDataChanged({ scope: 'daily', path: remote.date })
        })
        .catch((error) => {
          console.warn('[daily] failed to poll note changes from disk', error)
        })
    }, intervalMs)

    return () => {
      window.clearInterval(timer)
    }
  }, [activeDate, dataRoot, markSaved, mode, note, preferences.sync.mode, rawDirty, saving, structuredDirty, t])

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
        <PageHeader title={t('dailyNote.title')} description={t('dailyNote.loadingDescription')} />
      </section>
    )
  }

  if (!note) {
    return (
      <section>
        <PageHeader title={t('dailyNote.title')} description={t('dailyNote.unableDescription')} />
        <p className="text-sm text-rose-700">{message || t('error.unknown')}</p>
      </section>
    )
  }

  const coreSummary = summarizeChecklist(note.dailyCore)

  return (
    <section className="space-y-4">
      <PageHeader
        title={t('dailyNote.pageTitle', { date: note.date })}
        description={t('dailyNote.pageDescription')}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          className={`rounded-md px-3 py-1.5 text-sm ${
            mode === 'structured' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
          }`}
          onClick={() => setMode('structured')}
        >
          {t('common.structured')}
        </button>
        <button
          className={`rounded-md px-3 py-1.5 text-sm ${
            mode === 'raw' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
          }`}
          onClick={() => setMode('raw')}
        >
          {t('common.rawMarkdown')}
        </button>
        <span className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600">
          {saving ? t('common.saving') : t('common.autoSaveOn')}
        </span>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        <Link className="ml-auto text-sm text-teal-700 hover:underline" to="/daily">
          {t('dailyNote.backToList')}
        </Link>
      </div>

      {mode === 'structured' ? (
        <div className="space-y-6">
          <article className="rounded-lg border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">{t('dailyNote.dailyCore')}</h2>
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
              <h2 className="mb-3 text-base font-semibold text-slate-900">{t('dailyNote.optional')}</h2>
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
            <h2 className="mb-3 text-base font-semibold text-slate-900">{t('dailyNote.oneLine')}</h2>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={note.oneLine}
              onChange={(event) => {
                setNote((prev) => (prev ? { ...prev, oneLine: event.target.value } : prev))
              }}
              placeholder={t('dailyNote.oneLinePlaceholder')}
            />
          </article>
        </div>
      ) : (
        <MarkdownEditor value={rawDraft} onChange={setRawDraft} />
      )}
    </section>
  )
}
