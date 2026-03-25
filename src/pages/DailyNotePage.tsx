import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { MarkdownEditor } from '../components/MarkdownEditor'
import { PageHeader } from '../components/PageHeader'
import { ProgressBar } from '../components/ProgressBar'
import { TaskCheckbox } from '../components/TaskCheckbox'
import { diffDailyAgainstTemplate } from '../features/daily/daily.diff'
import { parseDailyMarkdown } from '../features/daily/daily.parser'
import { getDailyNote, saveDailyRaw, saveDailyStructured } from '../features/daily/daily.service'
import { summarizeChecklist } from '../features/dashboard/dashboard.service'
import { useI18n } from '../features/i18n/I18nContext'
import { usePreferences } from '../features/preferences/PreferencesContext'
import { useDataRoot } from '../features/settings/DataRootContext'
import { todayDateString } from '../lib/date/date'
import { extractErrorMessage } from '../lib/error'
import { readTextFile } from '../lib/fs/fileApi'
import { joinPath } from '../lib/fs/pathApi'
import { emitDataChanged, fallbackPollIntervalMs } from '../lib/liveSync'
import { recordRuntimePerfSeries } from '../lib/perf/runtimePerf'
import type { DailyNote } from '../types/tracker'

type Mode = 'structured' | 'raw'
type DailySection = 'dailyCore' | 'optional'
const RESUME_POLL_GRACE_MS = 1800

export function DailyNotePage() {
  const { t } = useI18n()
  const { date } = useParams()
  const activeDate = useMemo(() => date ?? todayDateString(), [date])
  const { dataRoot, loading: rootLoading } = useDataRoot()
  const { preferences, loading: preferencesLoading, updatePreferences } = usePreferences()

  const [mode, setMode] = useState<Mode>('structured')
  const [note, setNote] = useState<DailyNote | null>(null)
  const [templateNote, setTemplateNote] = useState<DailyNote | null>(null)
  const [rawDraft, setRawDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const savedRawRef = useRef('')
  const pollBusyRef = useRef(false)
  const resumePollAfterRef = useRef(0)
  const noteRef = useRef<DailyNote | null>(null)
  noteRef.current = note
  const rawDraftRef = useRef('')
  rawDraftRef.current = rawDraft
  const savingRef = useRef(false)
  savingRef.current = saving
  const dirtyRef = useRef(false)
  const saveTimerRef = useRef<number | null>(null)
  const debounceDelayRef = useRef(1200)
  debounceDelayRef.current = mode === 'structured' ? 1200 : 1500

  const templateDiff = useMemo(
    () => (note && templateNote ? diffDailyAgainstTemplate(note, templateNote) : null),
    [note, templateNote],
  )
  const showOnlyChanges = preferences.ui.showOnlyChanges.daily
  const noteLoaded = note !== null

  const markSaved = useCallback((savedNote: DailyNote) => {
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

    void getDailyNote(dataRoot, activeDate)
      .then((next) => {
        if (cancelled) {
          return
        }
        setNote(next)
        setRawDraft(next.raw)
        markSaved(next)
      })
      .catch((error) => {
        failed = true
        if (cancelled) {
          return
        }
        setMessage(`${t('dailyNote.loadFailed')} ${extractErrorMessage(error, '')}`.trim())
      })
      .finally(() => {
        recordRuntimePerfSeries('daily_note_load_ms', performance.now() - loadStartMs, {
          failed,
          date: activeDate,
        })
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeDate, dataRoot, markSaved, t])

  useEffect(() => {
    if (!dataRoot) {
      return
    }

    let cancelled = false
    void readTextFile(dataRoot, joinPath(dataRoot, 'templates', 'daily.md'))
      .then((templateRaw) => {
        if (cancelled) {
          return
        }
        setTemplateNote(parseDailyMarkdown(templateRaw.replaceAll('{{date}}', activeDate), activeDate))
      })
      .catch(() => {
        if (!cancelled) {
          setTemplateNote(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeDate, dataRoot])

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
            ? await saveDailyRaw(dataRoot, activeDate, rawDraftRef.current)
            : await saveDailyStructured(dataRoot, currentNote)
        setNote(saved)
        setRawDraft(saved.raw)
        markSaved(saved)
        dirtyRef.current = false
        setMessage(t('dailyNote.autosaved'))
        emitDataChanged({ scope: 'daily', path: saved.date })
    } catch {
      setMessage(t('dailyNote.autosaveFailed'))
    } finally {
      setSaving(false)
    }
    },
    [activeDate, dataRoot, markSaved, mode, t],
  )

  const performSaveRef = useRef(performSave)
  performSaveRef.current = performSave

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
        .finally(() => {
          pollBusyRef.current = false
        })
    }, intervalMs)

    return () => {
      window.clearInterval(timer)
    }
  }, [activeDate, dataRoot, markSaved, noteLoaded, preferences.sync.mode, t])

  function updateChecklist(
    section: DailySection,
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

  function toggleChecklistItem(section: DailySection, itemId: string, checked: boolean) {
    const index = note?.[section].findIndex((candidate) => candidate.id === itemId) ?? -1
    if (index < 0) {
      return
    }
    updateChecklist(section, index, { checked })
    scheduleAutosave()
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
  const coreRemainingCount = Math.max(0, coreSummary.total - coreSummary.checked)
  const visibleDailyCore = showOnlyChanges && templateDiff
    ? note.dailyCore.filter((item) => templateDiff.dailyCore.changedIds.has(item.id))
    : note.dailyCore
  const visibleOptional = showOnlyChanges && templateDiff
    ? note.optional.filter((item) => templateDiff.optional.changedIds.has(item.id))
    : note.optional
  const showMoodEnergyCard = !showOnlyChanges
    || !templateDiff
    || templateDiff.moodTagChanged
    || templateDiff.energyTagChanged
  const showOneLineCard = !showOnlyChanges || !templateDiff || templateDiff.oneLineChanged
  const showNoChangesHint = showOnlyChanges && templateDiff != null && !templateDiff.hasAnyChange

  return (
    <section className="dt-page">
      <PageHeader
        title={t('dailyNote.pageTitle', { date: note.date })}
        description={t('dailyNote.pageDescription')}
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
                    daily: event.target.checked,
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
        <Link className="ml-auto text-sm dt-link" to="/daily">
          {t('dailyNote.backToList')}
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
      {showOnlyChanges && templateDiff && (templateDiff.dailyCore.missingTemplateCount > 0 || templateDiff.optional.missingTemplateCount > 0) ? (
        <p className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
          {t('common.templateItemsMissing', {
            count: templateDiff.dailyCore.missingTemplateCount + templateDiff.optional.missingTemplateCount,
          })}
        </p>
      ) : null}

      {mode === 'structured' ? (
        <div className="space-y-6">
          <article className="dt-panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">{t('dailyNote.dailyCore')}</h2>
              <span className="text-xs text-slate-600">
                {coreSummary.checked}/{coreSummary.total}
              </span>
            </div>
            <ProgressBar value={coreSummary.percent} />
            <p className="mt-2 text-xs text-slate-600">{t('dailyNote.remainingCore', { count: coreRemainingCount })}</p>
            <div className="mt-4 space-y-2">
              {visibleDailyCore.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 transition ${
                    item.checked ? 'border border-teal-200 bg-teal-50/80' : 'bg-slate-50'
                  }`}
                  onClick={(event) => {
                    const target = event.target as HTMLElement
                    if (target.closest('button,input,textarea,a,label')) {
                      return
                    }
                    toggleChecklistItem('dailyCore', item.id, !item.checked)
                  }}
                >
                  <TaskCheckbox
                    checked={item.checked}
                    ariaLabel={item.text || 'daily-core-item'}
                    onToggle={(next) => toggleChecklistItem('dailyCore', item.id, next)}
                  />
                  <input
                    className={`w-full border-none bg-transparent text-sm outline-none ${
                      item.checked ? 'text-slate-500 line-through' : 'text-slate-800'
                    }`}
                    value={item.text}
                    onChange={(event) => {
                      const index = note.dailyCore.findIndex((candidate) => candidate.id === item.id)
                      updateChecklist('dailyCore', index, { text: event.target.value })
                      scheduleAutosave()
                    }}
                  />
                </div>
              ))}
            </div>
          </article>

          {preferences.daily.showOptional ? (
            <article className="dt-panel p-4">
              <h2 className="mb-3 text-base font-semibold text-slate-900">{t('dailyNote.optional')}</h2>
              <div className="space-y-2">
                {visibleOptional.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 transition ${
                    item.checked ? 'border border-teal-200 bg-teal-50/80' : 'bg-slate-50'
                  }`}
                  onClick={(event) => {
                    const target = event.target as HTMLElement
                    if (target.closest('button,input,textarea,a,label')) {
                      return
                    }
                    toggleChecklistItem('optional', item.id, !item.checked)
                  }}
                >
                  <TaskCheckbox
                    checked={item.checked}
                    ariaLabel={item.text || 'optional-item'}
                    onToggle={(next) => toggleChecklistItem('optional', item.id, next)}
                  />
                    <input
                      className={`w-full border-none bg-transparent text-sm outline-none ${
                        item.checked ? 'text-slate-500 line-through' : 'text-slate-800'
                      }`}
                      value={item.text}
                      onChange={(event) => {
                        const index = note.optional.findIndex((candidate) => candidate.id === item.id)
                        updateChecklist('optional', index, { text: event.target.value })
                        scheduleAutosave()
                      }}
                    />
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          {showMoodEnergyCard ? (
            <article className="dt-panel p-4">
              <h2 className="mb-3 text-base font-semibold text-slate-900">{t('dailyNote.moodEnergy')}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs text-slate-600">{t('dailyNote.moodTag')}</span>
                  <input
                    className="dt-input"
                    value={note.moodTag}
                    onChange={(event) => {
                      setNote((prev) => (prev ? { ...prev, moodTag: event.target.value } : prev))
                      scheduleAutosave()
                    }}
                    placeholder={t('dailyNote.moodPlaceholder')}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-600">{t('dailyNote.energyTag')}</span>
                  <input
                    className="dt-input"
                    value={note.energyTag}
                    onChange={(event) => {
                      setNote((prev) => (prev ? { ...prev, energyTag: event.target.value } : prev))
                      scheduleAutosave()
                    }}
                    placeholder={t('dailyNote.energyPlaceholder')}
                  />
                </label>
              </div>
            </article>
          ) : null}

          {showOneLineCard ? (
            <article className="dt-panel p-4">
              <h2 className="mb-3 text-base font-semibold text-slate-900">{t('dailyNote.oneLine')}</h2>
              <input
                className="dt-input"
                value={note.oneLine}
                onChange={(event) => {
                  setNote((prev) => (prev ? { ...prev, oneLine: event.target.value } : prev))
                  scheduleAutosave()
                }}
                placeholder={t('dailyNote.oneLinePlaceholder')}
              />
            </article>
          ) : null}
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
