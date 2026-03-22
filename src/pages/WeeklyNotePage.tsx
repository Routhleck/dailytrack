import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { MarkdownEditor } from '../components/MarkdownEditor'
import { PageHeader } from '../components/PageHeader'
import { ProgressBar } from '../components/ProgressBar'
import { summarizeChecklist } from '../features/dashboard/dashboard.service'
import { useI18n } from '../features/i18n/I18nContext'
import { usePreferences } from '../features/preferences/PreferencesContext'
import { useDataRoot } from '../features/settings/DataRootContext'
import { diffWeeklyAgainstTemplate } from '../features/weekly/weekly.diff'
import { parseWeeklyMarkdown } from '../features/weekly/weekly.parser'
import { WEEKLY_SECTION_ORDER } from '../features/weekly/weekly.parser'
import { serializeWeeklyMarkdown } from '../features/weekly/weekly.serializer'
import {
  getWeeklyNote,
  saveWeeklyRaw,
  saveWeeklyStructured,
} from '../features/weekly/weekly.service'
import { currentWeekId } from '../lib/date/week'
import { readTextFile } from '../lib/fs/fileApi'
import { joinPath } from '../lib/fs/pathApi'
import { emitDataChanged, fallbackPollIntervalMs } from '../lib/liveSync'
import type { WeeklyNote, WeeklySectionKey } from '../types/tracker'

type Mode = 'structured' | 'raw'

export function WeeklyNotePage() {
  const { t } = useI18n()
  const { weekId } = useParams()
  const activeWeekId = useMemo(() => weekId ?? currentWeekId(), [weekId])
  const { dataRoot, loading: rootLoading } = useDataRoot()
  const { preferences, loading: preferencesLoading, updatePreferences } = usePreferences()

  const [mode, setMode] = useState<Mode>('structured')
  const [note, setNote] = useState<WeeklyNote | null>(null)
  const [templateNote, setTemplateNote] = useState<WeeklyNote | null>(null)
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
  const templateDiff = useMemo(
    () => (note && templateNote ? diffWeeklyAgainstTemplate(note, templateNote) : null),
    [note, templateNote],
  )
  const showOnlyChanges = preferences.ui.showOnlyChanges.weekly
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
          setMessage(t('weeklyNote.loadFailed'))
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
  }, [activeWeekId, dataRoot, markSaved, t])

  useEffect(() => {
    if (!dataRoot) {
      return
    }

    let cancelled = false
    void readTextFile(dataRoot, joinPath(dataRoot, 'templates', 'weekly.md'))
      .then((templateRaw) => {
        if (cancelled) {
          return
        }
        setTemplateNote(parseWeeklyMarkdown(templateRaw.replaceAll('{{week}}', activeWeekId), activeWeekId))
      })
      .catch(() => {
        if (!cancelled) {
          setTemplateNote(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeWeekId, dataRoot])

  const performSave = useCallback(
    async () => {
      if (!dataRoot || !note || saving) {
        return
      }

      setSaving(true)

      try {
        const saved =
          mode === 'raw'
            ? await saveWeeklyRaw(dataRoot, activeWeekId, rawDraft)
            : await saveWeeklyStructured(dataRoot, note)
        setNote(saved)
        setRawDraft(saved.raw)
        markSaved(saved)
        setMessage(t('weeklyNote.autosaved'))
        emitDataChanged({ scope: 'weekly', path: saved.weekId })
      } catch {
        setMessage(t('weeklyNote.autosaveFailed'))
      } finally {
        setSaving(false)
      }
    },
    [activeWeekId, dataRoot, markSaved, mode, note, rawDraft, saving, t],
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

      void getWeeklyNote(dataRoot, activeWeekId)
        .then((remote) => {
          if (remote.raw === savedRawRef.current) {
            return
          }

          setNote(remote)
          setRawDraft(remote.raw)
          markSaved(remote)
          setMessage(t('weeklyNote.updatedFromDisk'))
          emitDataChanged({ scope: 'weekly', path: remote.weekId })
        })
        .catch((error) => {
          console.warn('[weekly] failed to poll note changes from disk', error)
        })
    }, intervalMs)

    return () => {
      window.clearInterval(timer)
    }
  }, [activeWeekId, dataRoot, markSaved, mode, note, preferences.sync.mode, rawDirty, saving, structuredDirty, t])

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
        <PageHeader title={t('weeklyNote.title')} description={t('weeklyNote.loadingDescription')} />
      </section>
    )
  }

  if (!note) {
    return (
      <section>
        <PageHeader title={t('weeklyNote.title')} description={t('weeklyNote.unableDescription')} />
        <p className="text-sm text-rose-700">{message || t('error.unknown')}</p>
      </section>
    )
  }

  const enabledSections = WEEKLY_SECTION_ORDER.filter((section) => preferences.weekly.sections[section])
  const visibleSections = showOnlyChanges && templateDiff
    ? enabledSections.filter(
      (section) =>
        templateDiff.sections[section].changedIds.size > 0
        || templateDiff.sections[section].missingTemplateCount > 0,
    )
    : enabledSections
  const showNoChangesHint = showOnlyChanges && templateDiff != null && !templateDiff.hasAnyChange
  const missingTemplateCount = showOnlyChanges && templateDiff
    ? enabledSections.reduce(
      (count, section) => count + templateDiff.sections[section].missingTemplateCount,
      0,
    )
    : 0

  return (
    <section className="space-y-4">
      <PageHeader
        title={t('weeklyNote.pageTitle', { week: note.weekId })}
        description={t('weeklyNote.pageDescription')}
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
        <label className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={showOnlyChanges}
            onChange={(event) => {
              void updatePreferences({
                ...preferences,
                ui: {
                  ...preferences.ui,
                  showOnlyChanges: {
                    ...preferences.ui.showOnlyChanges,
                    weekly: event.target.checked,
                  },
                },
              })
            }}
          />
          {t('sync.showOnlyChanges')}
        </label>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        <Link className="ml-auto text-sm text-teal-700 hover:underline" to="/weekly">
          {t('weeklyNote.backToList')}
        </Link>
      </div>
      {showOnlyChanges && !templateDiff ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t('common.templateDiffUnavailable')}
        </p>
      ) : null}
      {showNoChangesHint ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {t('common.noTemplateChanges')}
        </p>
      ) : null}
      {missingTemplateCount > 0 ? (
        <p className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
          {t('common.templateItemsMissing', { count: missingTemplateCount })}
        </p>
      ) : null}

      {mode === 'structured' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleSections.map((section) => {
            const items = showOnlyChanges && templateDiff
              ? note.sections[section].filter((item) => templateDiff.sections[section].changedIds.has(item.id))
              : note.sections[section]
            const summary = summarizeChecklist(items)

            return (
              <article key={section} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900">{t(`section.${section}` as 'section.Body')}</h2>
                  <span className="text-xs text-slate-600">
                    {summary.checked}/{summary.total}
                  </span>
                </div>
                <ProgressBar value={summary.percent} />
                <div className="mt-4 space-y-2">
                  {items.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(event) => {
                          const index = note.sections[section].findIndex((candidate) => candidate.id === item.id)
                          updateChecklist(section, index, { checked: event.target.checked })
                        }}
                      />
                      <input
                        className="w-full border-none bg-transparent text-sm text-slate-800 outline-none"
                        value={item.text}
                        onChange={(event) => {
                          const index = note.sections[section].findIndex((candidate) => candidate.id === item.id)
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
            <h2 className="mb-3 text-base font-semibold text-slate-900">{t('weeklyNote.reflection')}</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-md bg-slate-50 p-3">
                <h3 className="text-sm font-medium text-slate-700">{t('weeklyNote.goodThings')}</h3>
                {note.reflection.goodThings.map((value, index) => {
                  if (showOnlyChanges && templateDiff && !templateDiff.reflection.goodThings.has(index)) {
                    return null
                  }
                  return (
                  <input
                    key={`good-${index}`}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={value}
                    onChange={(event) => {
                      updateReflection('goodThings', index, event.target.value)
                    }}
                    placeholder={`${index + 1}.`}
                  />
                  )
                })}
              </div>

              <div className="space-y-2 rounded-md bg-slate-50 p-3">
                <h3 className="text-sm font-medium text-slate-700">
                  {t('weeklyNote.nextTop3')}
                </h3>
                {note.reflection.nextWeekTop3.map((value, index) => {
                  if (showOnlyChanges && templateDiff && !templateDiff.reflection.nextWeekTop3.has(index)) {
                    return null
                  }
                  return (
                  <input
                    key={`next-${index}`}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={value}
                    onChange={(event) => {
                      updateReflection('nextWeekTop3', index, event.target.value)
                    }}
                    placeholder={`${index + 1}.`}
                  />
                  )
                })}
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
