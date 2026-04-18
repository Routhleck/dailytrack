import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ExpandableInput } from '../components/ExpandableInput'
import { MarkdownEditor } from '../components/MarkdownEditor'
import { PageHeader } from '../components/PageHeader'
import { ProgressBar } from '../components/ProgressBar'
import { TaskCheckbox } from '../components/TaskCheckbox'
import { summarizeChecklist } from '../features/dashboard/dashboard.service'
import { useI18n } from '../features/i18n/I18nContext'
import { usePreferences } from '../features/preferences/PreferencesContext'
import { useDataRoot } from '../features/settings/DataRootContext'
import { diffWeeklyAgainstTemplate } from '../features/weekly/weekly.diff'
import { parseWeeklyMarkdown } from '../features/weekly/weekly.parser'
import { WEEKLY_SECTION_ORDER } from '../features/weekly/weekly.parser'
import {
  getWeeklyNote,
  saveWeeklyRaw,
  saveWeeklyStructured,
} from '../features/weekly/weekly.service'
import { currentWeekId } from '../lib/date/week'
import { readTextFile } from '../lib/fs/fileApi'
import { joinPath } from '../lib/fs/pathApi'
import { emitDataChanged, fallbackPollIntervalMs } from '../lib/liveSync'
import { recordRuntimePerfSeries } from '../lib/perf/runtimePerf'
import type { WeeklyNote, WeeklySectionKey } from '../types/tracker'

type Mode = 'structured' | 'raw'
const RESUME_POLL_GRACE_MS = 1800

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

  const savedRawRef = useRef('')
  const pollBusyRef = useRef(false)
  const resumePollAfterRef = useRef(0)
  const noteRef = useRef<WeeklyNote | null>(null)
  const rawDraftRef = useRef('')
  const savingRef = useRef(false)
  const dirtyRef = useRef(false)
  const saveTimerRef = useRef<number | null>(null)
  const debounceDelayRef = useRef(1200)
  useEffect(() => { noteRef.current = note }, [note])
  useEffect(() => { rawDraftRef.current = rawDraft }, [rawDraft])
  useEffect(() => { savingRef.current = saving }, [saving])
  useEffect(() => { debounceDelayRef.current = mode === 'structured' ? 1200 : 1500 }, [mode])

  const templateDiff = useMemo(
    () => (note && templateNote ? diffWeeklyAgainstTemplate(note, templateNote) : null),
    [note, templateNote],
  )
  const showOnlyChanges = preferences.ui.showOnlyChanges.weekly
  const noteLoaded = note !== null

  const markSaved = useCallback((savedNote: WeeklyNote) => {
    savedRawRef.current = savedNote.raw
  }, [])

  useEffect(() => {
    if (!dataRoot) {
      return
    }

    let cancelled = false
    setLoading(true)
    setMessage('')
    const loadStartMs = performance.now()
    let failed = false

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
        failed = true
        if (!cancelled) {
          setMessage(t('weeklyNote.loadFailed'))
        }
      })
      .finally(() => {
        recordRuntimePerfSeries('weekly_note_load_ms', performance.now() - loadStartMs, {
          failed,
          weekId: activeWeekId,
        })
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
      const currentNote = noteRef.current
      if (!dataRoot || !currentNote || savingRef.current) {
        return
      }

      setSaving(true)

      try {
        const saved =
          mode === 'raw'
            ? await saveWeeklyRaw(dataRoot, activeWeekId, rawDraftRef.current)
            : await saveWeeklyStructured(dataRoot, currentNote)
        setNote(saved)
        setRawDraft(saved.raw)
        markSaved(saved)
        dirtyRef.current = false
        setMessage(t('weeklyNote.autosaved'))
        emitDataChanged({ scope: 'weekly', path: saved.weekId })
      } catch {
        setMessage(t('weeklyNote.autosaveFailed'))
      } finally {
        setSaving(false)
      }
    },
    [activeWeekId, dataRoot, markSaved, mode, t],
  )

  const performSaveRef = useRef(performSave)
  useEffect(() => { performSaveRef.current = performSave }, [performSave])

  const scheduleAutosave = useCallback(() => {
    dirtyRef.current = true
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      void performSaveRef.current()
    }, debounceDelayRef.current)
  }, [])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    dirtyRef.current = false
  }, [mode])

  useEffect(() => {
    resumePollAfterRef.current = Date.now() + RESUME_POLL_GRACE_MS

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resumePollAfterRef.current = Date.now() + RESUME_POLL_GRACE_MS
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  useEffect(() => {
    if (!dataRoot || !noteLoaded) {
      return
    }

    const intervalMs = fallbackPollIntervalMs(preferences.sync.mode)

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return
      }
      if (Date.now() < resumePollAfterRef.current) {
        return
      }
      if (pollBusyRef.current) {
        return
      }
      if (savingRef.current || dirtyRef.current) {
        return
      }

      pollBusyRef.current = true
      void getWeeklyNote(dataRoot, activeWeekId, { fresh: true })
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
        .finally(() => {
          pollBusyRef.current = false
        })
    }, intervalMs)

    return () => {
      window.clearInterval(timer)
    }
  }, [activeWeekId, dataRoot, markSaved, noteLoaded, preferences.sync.mode, t])

  function updateChecklist(
    section: WeeklySectionKey,
    itemIndex: number,
    patch: Partial<{ checked: boolean; text: string; count: number }>,
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
    scheduleAutosave()
  }

  function toggleChecklistItem(section: WeeklySectionKey, itemId: string, checked: boolean) {
    const index = note?.sections[section].findIndex((candidate) => candidate.id === itemId) ?? -1
    if (index < 0) {
      return
    }
    const patch: Partial<{ checked: boolean; text: string; count: number }> = { checked }
    if (!checked) {
      patch.count = 0
    }
    updateChecklist(section, index, patch)
  }

  function incrementCount(section: WeeklySectionKey, itemId: string) {
    const index = note?.sections[section].findIndex((candidate) => candidate.id === itemId) ?? -1
    if (index < 0) {
      return
    }
    const item = note?.sections[section][index]
    if (!item) {
      return
    }
    updateChecklist(section, index, { count: (item.count ?? 0) + 1 })
  }

  function decrementCount(section: WeeklySectionKey, itemId: string) {
    const index = note?.sections[section].findIndex((candidate) => candidate.id === itemId) ?? -1
    if (index < 0) {
      return
    }
    const item = note?.sections[section][index]
    if (!item) {
      return
    }
    const currentCount = item.count ?? 0
    if (currentCount <= 0) {
      return
    }
    updateChecklist(section, index, { count: currentCount - 1 })
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
    scheduleAutosave()
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
  const sectionGoalStats = enabledSections.map((section) => {
    const summary = summarizeChecklist(note.sections[section])
    return {
      section,
      summary,
      met: summary.total > 0 && summary.checked === summary.total,
    }
  })
  const sectionsWithItemsCount = sectionGoalStats.filter((item) => item.summary.total > 0).length
  const metSectionsCount = sectionGoalStats.filter((item) => item.met).length
  const weakestGoalSection = sectionGoalStats
    .filter((item) => item.summary.total > 0)
    .sort((left, right) => left.summary.percent - right.summary.percent)[0] ?? null

  return (
    <section className="dt-page">
      <PageHeader
        title={t('weeklyNote.pageTitle', { week: note.weekId })}
        description={t('weeklyNote.pageDescription')}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          className={`dt-btn ${
            mode === 'structured' ? 'bg-slate-900 text-white' : 'dt-btn-secondary'
          }`}
          onClick={() => setMode('structured')}
        >
          {t('common.structured')}
        </button>
        <button
          className={`dt-btn ${
            mode === 'raw' ? 'bg-slate-900 text-white' : 'dt-btn-secondary'
          }`}
          onClick={() => setMode('raw')}
        >
          {t('common.rawMarkdown')}
        </button>
        <span className="dt-badge">
          {saving ? t('common.saving') : t('common.autoSaveOn')}
        </span>
        <label className="dt-badge gap-2">
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
        <p className="basis-full text-xs text-slate-600 lg:basis-auto">
          {mode === 'structured' ? t('common.structuredHint') : t('common.rawMarkdownHint')}
        </p>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        <Link className="ml-auto text-sm dt-link" to="/weekly">
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
        <div className="space-y-4">
          <article className="dt-panel p-4">
            <h2 className="text-base font-semibold text-slate-900">{t('weeklyNote.goalProgressTitle')}</h2>
            <p className="mt-1 text-sm text-slate-700">
              {t('weeklyNote.goalProgressSummary', { met: metSectionsCount, total: sectionsWithItemsCount })}
            </p>
            {sectionsWithItemsCount === 0 ? (
              <p className="mt-1 text-xs text-slate-600">{t('weeklyNote.goalNoItems')}</p>
            ) : weakestGoalSection && metSectionsCount < sectionsWithItemsCount ? (
              <p className="mt-1 text-xs text-amber-700">
                {t('weeklyNote.goalProgressWeakest', {
                  section: t(`section.${weakestGoalSection.section}` as 'section.Body'),
                  checked: weakestGoalSection.summary.checked,
                  total: weakestGoalSection.summary.total,
                })}
              </p>
            ) : (
              <p className="mt-1 text-xs text-emerald-700">{t('weeklyNote.goalProgressAllMet')}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {sectionGoalStats.map((item) => (
                <span
                  key={item.section}
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${
                    item.met
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  {t('weeklyNote.goalSectionBadge', {
                    section: t(`section.${item.section}` as 'section.Body'),
                    checked: item.summary.checked,
                    total: item.summary.total,
                  })}
                </span>
              ))}
            </div>
          </article>

          <div className="grid gap-4 lg:grid-cols-2">
            {visibleSections.map((section) => {
              const items = showOnlyChanges && templateDiff
                ? note.sections[section].filter((item) => templateDiff.sections[section].changedIds.has(item.id))
                : note.sections[section]
              const summary = summarizeChecklist(items)

              return (
                <article key={section} className="dt-panel p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-900">{t(`section.${section}` as 'section.Body')}</h2>
                    <span className="text-xs text-slate-600">
                      {summary.checked}/{summary.total}
                    </span>
                  </div>
                  <ProgressBar value={summary.percent} />
                  <div className="mt-4 space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 transition ${
                          item.checked ? 'border border-teal-200 bg-teal-50/80' : 'bg-slate-50'
                        }`}
                      >
                        <TaskCheckbox
                          checked={item.checked}
                          ariaLabel={item.text || `${section}-item`}
                          onToggle={(next) => toggleChecklistItem(section, item.id, next)}
                        />
                        <input
                          className={`w-full border-none bg-transparent text-sm outline-none ${
                            item.checked ? 'text-slate-500 line-through' : 'text-slate-800'
                          }`}
                          value={item.text}
                          onChange={(event) => {
                            const index = note.sections[section].findIndex((candidate) => candidate.id === item.id)
                            updateChecklist(section, index, { text: event.target.value })
                          }}
                        />
                        {item.count !== undefined && item.count > 0 && (
                          <span className="ml-auto rounded bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
                            {item.count}
                          </span>
                        )}
                        {item.count !== undefined && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="h-6 w-6 rounded bg-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-300"
                              onClick={() => decrementCount(section, item.id)}
                            >
                              -
                            </button>
                            <button
                              type="button"
                              className="h-6 w-6 rounded bg-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-300"
                              onClick={() => incrementCount(section, item.id)}
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </article>
              )
            })}

            <article className="dt-panel p-4 lg:col-span-2">
              <h2 className="mb-3 text-base font-semibold text-slate-900">{t('weeklyNote.reflection')}</h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 rounded-md bg-slate-50 p-3">
                  <h3 className="text-sm font-medium text-slate-700">{t('weeklyNote.goodThings')}</h3>
                  {note.reflection.goodThings.map((value, index) => {
                    if (showOnlyChanges && templateDiff && !templateDiff.reflection.goodThings.has(index)) {
                      return null
                    }
                    return (
                      <ExpandableInput
                      key={`good-${index}`}
                      className="dt-input"
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
                      <ExpandableInput
                      key={`next-${index}`}
                      className="dt-input"
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
        </div>
      ) : (
        <MarkdownEditor value={rawDraft} onChange={(next) => {
          setRawDraft(next)
          scheduleAutosave()
        }} />
      )}
    </section>
  )
}
