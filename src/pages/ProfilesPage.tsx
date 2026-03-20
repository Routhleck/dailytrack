import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { PageHeader } from '../components/PageHeader'
import { useI18n } from '../features/i18n/I18nContext'
import {
  TEMPLATE_PRESETS,
  getTemplatePresetById,
  getTemplateVariant,
  resolvePreferredTemplateLanguage,
  type TemplateLanguage,
} from '../features/settings/templatePresets'
import { parseDailyMarkdown } from '../features/daily/daily.parser'
import { serializeDailyMarkdown } from '../features/daily/daily.serializer'
import { WEEKLY_SECTION_ORDER, parseWeeklyMarkdown } from '../features/weekly/weekly.parser'
import { serializeWeeklyMarkdown } from '../features/weekly/weekly.serializer'
import { useDataRoot } from '../features/settings/DataRootContext'
import { todayDateString } from '../lib/date/date'
import { currentWeekId } from '../lib/date/week'
import { readTextFile, writeTextFile } from '../lib/fs/fileApi'
import { joinPath } from '../lib/fs/pathApi'
import { emitDataChanged } from '../lib/liveSync'
import type { DailyNote, WeeklyNote, WeeklySectionKey } from '../types/tracker'

function safeName(name: string): string {
  return name.trim().replace(/\s+/g, '-')
}

const TEMPLATE_DATE_PLACEHOLDER = '{{date}}'
const TEMPLATE_WEEK_PLACEHOLDER = '{{week}}'
const TEMPLATE_PARSE_DATE = '2000-01-01'
const TEMPLATE_PARSE_WEEK = '2000-W01'

function parseDailyTemplateMarkdown(markdown: string): DailyNote {
  return parseDailyMarkdown(
    markdown.replaceAll(TEMPLATE_DATE_PLACEHOLDER, TEMPLATE_PARSE_DATE),
    TEMPLATE_PARSE_DATE,
  )
}

function parseWeeklyTemplateMarkdown(markdown: string): WeeklyNote {
  return parseWeeklyMarkdown(
    markdown.replaceAll(TEMPLATE_WEEK_PLACEHOLDER, TEMPLATE_PARSE_WEEK),
    TEMPLATE_PARSE_WEEK,
  )
}

function serializeDailyTemplateMarkdown(note: DailyNote): string {
  const next = { ...note, title: TEMPLATE_DATE_PLACEHOLDER }
  return serializeDailyMarkdown(next)
}

function serializeWeeklyTemplateMarkdown(note: WeeklyNote): string {
  const next = { ...note, title: TEMPLATE_WEEK_PLACEHOLDER }
  return serializeWeeklyMarkdown(next)
}

export function ProfilesPage() {
  const { t } = useI18n()
  const {
    baseDataRoot,
    dataRoot,
    activeProfile,
    profiles,
    switchProfile,
    createProfile,
    deleteProfile,
    loading,
  } = useDataRoot()

  const [createName, setCreateName] = useState('')
  const [presetId, setPresetId] = useState('balanced')
  const [templateLanguage, setTemplateLanguage] = useState<TemplateLanguage>(
    resolvePreferredTemplateLanguage(),
  )
  const selectedPreset = useMemo(
    () => getTemplatePresetById(presetId),
    [presetId],
  )

  const [newDailyTemplate, setNewDailyTemplate] = useState(
    getTemplateVariant(selectedPreset, templateLanguage).dailyTemplate,
  )
  const [newWeeklyTemplate, setNewWeeklyTemplate] = useState(
    getTemplateVariant(selectedPreset, templateLanguage).weeklyTemplate,
  )
  const [createMessage, setCreateMessage] = useState('')
  const [createBusy, setCreateBusy] = useState(false)

  const [currentDailyTemplate, setCurrentDailyTemplate] = useState('')
  const [currentWeeklyTemplate, setCurrentWeeklyTemplate] = useState('')
  const [templateEditMode, setTemplateEditMode] = useState<'raw' | 'structured'>('structured')
  const [currentDailyStructured, setCurrentDailyStructured] = useState<DailyNote | null>(null)
  const [currentWeeklyStructured, setCurrentWeeklyStructured] = useState<WeeklyNote | null>(null)
  const [templateMessage, setTemplateMessage] = useState('')
  const [templateBusy, setTemplateBusy] = useState(false)

  useEffect(() => {
    const selectedVariant = getTemplateVariant(selectedPreset, templateLanguage)
    setNewDailyTemplate(selectedVariant.dailyTemplate)
    setNewWeeklyTemplate(selectedVariant.weeklyTemplate)
  }, [selectedPreset, templateLanguage])

  useEffect(() => {
    if (!dataRoot) {
      return
    }

    let cancelled = false

    void Promise.all([
      readTextFile(dataRoot, joinPath(dataRoot, 'templates', 'daily.md')),
      readTextFile(dataRoot, joinPath(dataRoot, 'templates', 'weekly.md')),
    ])
      .then(([daily, weekly]) => {
        if (cancelled) {
          return
        }
        setCurrentDailyTemplate(daily)
        setCurrentWeeklyTemplate(weekly)
        setCurrentDailyStructured(parseDailyTemplateMarkdown(daily))
        setCurrentWeeklyStructured(parseWeeklyTemplateMarkdown(weekly))
      })
      .catch(() => {
        if (cancelled) {
          return
        }
        setTemplateMessage(t('profiles.currentTemplateLoadFailed'))
      })

    return () => {
      cancelled = true
    }
  }, [dataRoot, t])

  async function handleCreateProfile(event: FormEvent) {
    event.preventDefault()

    const profileName = safeName(createName)
    if (!profileName) {
      setCreateMessage(t('profiles.profileNameRequired'))
      return
    }

    setCreateBusy(true)
    setCreateMessage('')

    try {
      await createProfile(profileName, {
        dailyTemplate: newDailyTemplate,
        weeklyTemplate: newWeeklyTemplate,
      })
      setCreateName('')
      setCreateMessage(t('profiles.profileCreated', { name: profileName }))
    } catch (error) {
      setCreateMessage(error instanceof Error ? error.message : t('profiles.createFailed'))
    } finally {
      setCreateBusy(false)
    }
  }

  async function handleSaveCurrentTemplates(event: FormEvent) {
    event.preventDefault()

    if (!dataRoot) {
      setTemplateMessage(t('profiles.activeProfileNotReady'))
      return
    }

    setTemplateBusy(true)
    setTemplateMessage('')

    try {
      await writeTextFile(dataRoot, joinPath(dataRoot, 'templates', 'daily.md'), currentDailyTemplate)
      await writeTextFile(dataRoot, joinPath(dataRoot, 'templates', 'weekly.md'), currentWeeklyTemplate)
      setTemplateMessage(t('profiles.currentTemplatesSaved'))
    } catch (error) {
      setTemplateMessage(error instanceof Error ? error.message : t('profiles.currentTemplateSaveFailed'))
    } finally {
      setTemplateBusy(false)
    }
  }

  function handleTemplateModeChange(mode: 'raw' | 'structured') {
    if (mode === 'structured') {
      try {
        setCurrentDailyStructured(parseDailyTemplateMarkdown(currentDailyTemplate))
        setCurrentWeeklyStructured(parseWeeklyTemplateMarkdown(currentWeeklyTemplate))
      } catch (error) {
        setTemplateMessage(error instanceof Error ? error.message : t('profiles.structuredTemplateParseFailed'))
        return
      }
    }
    setTemplateEditMode(mode)
  }

  function updateDailyItem(
    section: 'dailyCore' | 'optional',
    index: number,
    text: string,
  ) {
    setCurrentDailyStructured((prev) => {
      if (!prev) {
        return prev
      }
      const target = prev[section][index]
      if (!target) {
        return prev
      }
      const next = {
        ...prev,
        [section]: prev[section].map((item, itemIndex) =>
          itemIndex === index ? { ...item, text } : item,
        ),
      }
      setCurrentDailyTemplate(serializeDailyTemplateMarkdown(next))
      return next
    })
  }

  function removeDailyItem(section: 'dailyCore' | 'optional', index: number) {
    setCurrentDailyStructured((prev) => {
      if (!prev) {
        return prev
      }
      const next = {
        ...prev,
        [section]: prev[section].filter((_, itemIndex) => itemIndex !== index),
      }
      setCurrentDailyTemplate(serializeDailyTemplateMarkdown(next))
      return next
    })
  }

  function addDailyItem(section: 'dailyCore' | 'optional') {
    setCurrentDailyStructured((prev) => {
      if (!prev) {
        return prev
      }
      const next = {
        ...prev,
        [section]: [
          ...prev[section],
          {
            id: `${section}-${Date.now()}`,
            text: '',
            checked: false,
          },
        ],
      }
      setCurrentDailyTemplate(serializeDailyTemplateMarkdown(next))
      return next
    })
  }

  function updateWeeklyItem(section: WeeklySectionKey, index: number, text: string) {
    setCurrentWeeklyStructured((prev) => {
      if (!prev) {
        return prev
      }
      const target = prev.sections[section][index]
      if (!target) {
        return prev
      }
      const next = {
        ...prev,
        sections: {
          ...prev.sections,
          [section]: prev.sections[section].map((item, itemIndex) =>
            itemIndex === index ? { ...item, text } : item,
          ),
        },
      }
      setCurrentWeeklyTemplate(serializeWeeklyTemplateMarkdown(next))
      return next
    })
  }

  function removeWeeklyItem(section: WeeklySectionKey, index: number) {
    setCurrentWeeklyStructured((prev) => {
      if (!prev) {
        return prev
      }
      const next = {
        ...prev,
        sections: {
          ...prev.sections,
          [section]: prev.sections[section].filter((_, itemIndex) => itemIndex !== index),
        },
      }
      setCurrentWeeklyTemplate(serializeWeeklyTemplateMarkdown(next))
      return next
    })
  }

  function addWeeklyItem(section: WeeklySectionKey) {
    setCurrentWeeklyStructured((prev) => {
      if (!prev) {
        return prev
      }
      const next = {
        ...prev,
        sections: {
          ...prev.sections,
          [section]: [
            ...prev.sections[section],
            {
              id: `${section}-${Date.now()}`,
              text: '',
              checked: false,
            },
          ],
        },
      }
      setCurrentWeeklyTemplate(serializeWeeklyTemplateMarkdown(next))
      return next
    })
  }

  function updateReflectionItem(field: 'goodThings' | 'nextWeekTop3', index: number, text: string) {
    setCurrentWeeklyStructured((prev) => {
      if (!prev) {
        return prev
      }
      const nextValues = [...prev.reflection[field]]
      while (nextValues.length < 3) {
        nextValues.push('')
      }
      nextValues[index] = text
      const next = {
        ...prev,
        reflection: {
          ...prev.reflection,
          [field]: nextValues,
        },
      }
      setCurrentWeeklyTemplate(serializeWeeklyTemplateMarkdown(next))
      return next
    })
  }

  function normalizeTemplateOutput(content: string): string {
    return content.trimEnd() + '\n'
  }

  async function handleApplyDailyTemplateToToday() {
    if (!dataRoot) {
      setTemplateMessage(t('profiles.activeProfileNotReady'))
      return
    }
    if (!window.confirm(t('profiles.applyDailyTemplateToTodayConfirm'))) {
      return
    }

    setTemplateBusy(true)
    setTemplateMessage('')
    try {
      const date = todayDateString()
      const output = normalizeTemplateOutput(currentDailyTemplate.replaceAll('{{date}}', date))
      await writeTextFile(dataRoot, joinPath(dataRoot, 'daily', `${date}.md`), output)
      emitDataChanged({ scope: 'daily' })
      setTemplateMessage(t('profiles.applyDailyTemplateToTodayDone', { date }))
    } catch (error) {
      setTemplateMessage(error instanceof Error ? error.message : t('profiles.applyTemplateFailed'))
    } finally {
      setTemplateBusy(false)
    }
  }

  async function handleApplyWeeklyTemplateToCurrentWeek() {
    if (!dataRoot) {
      setTemplateMessage(t('profiles.activeProfileNotReady'))
      return
    }
    if (!window.confirm(t('profiles.applyWeeklyTemplateToCurrentWeekConfirm'))) {
      return
    }

    setTemplateBusy(true)
    setTemplateMessage('')
    try {
      const weekId = currentWeekId()
      const output = normalizeTemplateOutput(currentWeeklyTemplate.replaceAll('{{week}}', weekId))
      await writeTextFile(dataRoot, joinPath(dataRoot, 'weekly', `${weekId}.md`), output)
      emitDataChanged({ scope: 'weekly' })
      setTemplateMessage(t('profiles.applyWeeklyTemplateToCurrentWeekDone', { weekId }))
    } catch (error) {
      setTemplateMessage(error instanceof Error ? error.message : t('profiles.applyTemplateFailed'))
    } finally {
      setTemplateBusy(false)
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={t('profiles.title')}
        description={t('profiles.description')}
      />

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p>
          {t('profiles.baseRoot')}: <span className="font-medium">{baseDataRoot || '-'}</span>
        </p>
        <p>
          {t('profiles.activeProfile')}: <span className="font-medium">{activeProfile || '-'}</span>
        </p>
      </div>

      <article className="space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('profiles.profileList')}</h2>

        <ul className="space-y-2">
          {profiles.map((profile) => (
            <li
              key={profile}
              className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2"
            >
              <span className="text-sm text-slate-800">
                {profile} {profile === activeProfile ? t('profiles.activeTag') : ''}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded bg-slate-200 px-3 py-1 text-xs text-slate-800"
                  onClick={() => void switchProfile(profile)}
                  disabled={loading || profile === activeProfile}
                >
                  {t('profiles.switch')}
                </button>
                <button
                  type="button"
                  className="rounded bg-rose-100 px-3 py-1 text-xs text-rose-700 disabled:opacity-60"
                  onClick={() => void deleteProfile(profile)}
                  disabled={loading || profiles.length <= 1 || profile === activeProfile}
                >
                  {t('profiles.delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">
          {t('profiles.deleteHint')}
        </p>
      </article>

      <form onSubmit={handleCreateProfile} className="space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('profiles.createProfile')}</h2>

        <label className="block text-sm font-medium text-slate-700" htmlFor="profile-name">
          {t('profiles.profileName')}
        </label>
        <input
          id="profile-name"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder={t('profiles.profileNamePlaceholder')}
          value={createName}
          onChange={(event) => setCreateName(event.target.value)}
          disabled={createBusy}
        />

        <label className="block text-sm font-medium text-slate-700" htmlFor="profile-preset">
          {t('profiles.templatePreset')}
        </label>
        <select
          id="profile-preset"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={presetId}
          onChange={(event) => setPresetId(event.target.value)}
          disabled={createBusy}
        >
          {TEMPLATE_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.labels[templateLanguage]}
            </option>
          ))}
        </select>
        {selectedPreset.descriptions?.[templateLanguage] ? (
          <p className="text-xs text-slate-500">{selectedPreset.descriptions[templateLanguage]}</p>
        ) : null}

        <label className="block text-sm font-medium text-slate-700" htmlFor="template-language">
          {t('profiles.templateLanguage')}
        </label>
        <select
          id="template-language"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={templateLanguage}
          onChange={(event) => setTemplateLanguage(event.target.value as TemplateLanguage)}
          disabled={createBusy}
        >
          <option value="en">{t('template.languageEnglish')}</option>
          <option value="zh">{t('template.languageChinese')}</option>
        </select>

        <label className="block text-sm font-medium text-slate-700">{t('profiles.dailyTemplateEditable')}</label>
        <textarea
          className="h-48 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
          value={newDailyTemplate}
          onChange={(event) => setNewDailyTemplate(event.target.value)}
          disabled={createBusy}
          spellCheck={false}
        />

        <label className="block text-sm font-medium text-slate-700">{t('profiles.weeklyTemplateEditable')}</label>
        <textarea
          className="h-56 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
          value={newWeeklyTemplate}
          onChange={(event) => setNewWeeklyTemplate(event.target.value)}
          disabled={createBusy}
          spellCheck={false}
        />

        <button
          type="submit"
          disabled={createBusy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {createBusy ? t('profiles.creating') : t('profiles.createProfileButton')}
        </button>
        {createMessage ? <p className="text-sm text-slate-600">{createMessage}</p> : null}
      </form>

      <form onSubmit={handleSaveCurrentTemplates} className="space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('profiles.currentTemplates')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm ${
              templateEditMode === 'structured' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
            }`}
            onClick={() => handleTemplateModeChange('structured')}
          >
            {t('common.structured')}
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm ${
              templateEditMode === 'raw' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
            }`}
            onClick={() => handleTemplateModeChange('raw')}
          >
            {t('common.rawMarkdown')}
          </button>
        </div>

        {templateEditMode === 'raw' ? (
          <>
            <label className="block text-sm font-medium text-slate-700">{t('profiles.dailyTemplate')}</label>
            <textarea
              className="h-48 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
              value={currentDailyTemplate}
              onChange={(event) => setCurrentDailyTemplate(event.target.value)}
              disabled={templateBusy || !dataRoot}
              spellCheck={false}
            />

            <label className="block text-sm font-medium text-slate-700">{t('profiles.weeklyTemplate')}</label>
            <textarea
              className="h-56 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
              value={currentWeeklyTemplate}
              onChange={(event) => setCurrentWeeklyTemplate(event.target.value)}
              disabled={templateBusy || !dataRoot}
              spellCheck={false}
            />
          </>
        ) : (
          <div className="space-y-4">
            <article className="rounded-md border border-slate-200 p-3">
              <h3 className="text-sm font-semibold text-slate-900">{t('profiles.dailyTemplate')}</h3>
              <p className="mt-1 text-xs text-slate-500">{t('profiles.dailyTemplateStructuredHint')}</p>

              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-slate-700">{t('dailyNote.dailyCore')}</p>
                {currentDailyStructured?.dailyCore.map((item, index) => (
                  <div key={item.id} className="flex gap-2">
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={item.text}
                      onChange={(event) => updateDailyItem('dailyCore', index, event.target.value)}
                      disabled={templateBusy || !dataRoot}
                    />
                    <button
                      type="button"
                      className="rounded-md border border-rose-300 bg-rose-50 px-3 text-xs text-rose-700"
                      onClick={() => removeDailyItem('dailyCore', index)}
                      disabled={templateBusy || !dataRoot}
                    >
                      {t('profiles.removeItem')}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
                  onClick={() => addDailyItem('dailyCore')}
                  disabled={templateBusy || !dataRoot}
                >
                  {t('profiles.addItem')}
                </button>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-slate-700">{t('dailyNote.optional')}</p>
                {currentDailyStructured?.optional.map((item, index) => (
                  <div key={item.id} className="flex gap-2">
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={item.text}
                      onChange={(event) => updateDailyItem('optional', index, event.target.value)}
                      disabled={templateBusy || !dataRoot}
                    />
                    <button
                      type="button"
                      className="rounded-md border border-rose-300 bg-rose-50 px-3 text-xs text-rose-700"
                      onClick={() => removeDailyItem('optional', index)}
                      disabled={templateBusy || !dataRoot}
                    >
                      {t('profiles.removeItem')}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
                  onClick={() => addDailyItem('optional')}
                  disabled={templateBusy || !dataRoot}
                >
                  {t('profiles.addItem')}
                </button>
              </div>
            </article>

            <article className="rounded-md border border-slate-200 p-3">
              <h3 className="text-sm font-semibold text-slate-900">{t('profiles.weeklyTemplate')}</h3>
              <p className="mt-1 text-xs text-slate-500">{t('profiles.weeklyTemplateStructuredHint')}</p>

              {WEEKLY_SECTION_ORDER.map((section) => (
                <div key={section} className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-slate-700">{t(`section.${section}`)}</p>
                  {currentWeeklyStructured?.sections[section].map((item, index) => (
                    <div key={item.id} className="flex gap-2">
                      <input
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={item.text}
                        onChange={(event) => updateWeeklyItem(section, index, event.target.value)}
                        disabled={templateBusy || !dataRoot}
                      />
                      <button
                        type="button"
                        className="rounded-md border border-rose-300 bg-rose-50 px-3 text-xs text-rose-700"
                        onClick={() => removeWeeklyItem(section, index)}
                        disabled={templateBusy || !dataRoot}
                      >
                        {t('profiles.removeItem')}
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
                    onClick={() => addWeeklyItem(section)}
                    disabled={templateBusy || !dataRoot}
                  >
                    {t('profiles.addItem')}
                  </button>
                </div>
              ))}

              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-slate-700">{t('weeklyNote.goodThings')}</p>
                {[0, 1, 2].map((index) => (
                  <input
                    key={`good-${index}`}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={currentWeeklyStructured?.reflection.goodThings[index] ?? ''}
                    onChange={(event) => updateReflectionItem('goodThings', index, event.target.value)}
                    disabled={templateBusy || !dataRoot}
                  />
                ))}
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-slate-700">{t('weeklyNote.nextTop3')}</p>
                {[0, 1, 2].map((index) => (
                  <input
                    key={`next-${index}`}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={currentWeeklyStructured?.reflection.nextWeekTop3[index] ?? ''}
                    onChange={(event) => updateReflectionItem('nextWeekTop3', index, event.target.value)}
                    disabled={templateBusy || !dataRoot}
                  />
                ))}
              </div>
            </article>
          </div>
        )}

        <button
          type="submit"
          disabled={templateBusy || !dataRoot}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {templateBusy ? t('profiles.saving') : t('profiles.saveCurrentTemplates')}
        </button>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={templateBusy || !dataRoot}
            className="rounded-md border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700 disabled:opacity-60"
            onClick={() => void handleApplyDailyTemplateToToday()}
          >
            {t('profiles.applyDailyTemplateToToday')}
          </button>
          <button
            type="button"
            disabled={templateBusy || !dataRoot}
            className="rounded-md border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 disabled:opacity-60"
            onClick={() => void handleApplyWeeklyTemplateToCurrentWeek()}
          >
            {t('profiles.applyWeeklyTemplateToCurrentWeek')}
          </button>
        </div>
        {templateMessage ? <p className="text-sm text-slate-600">{templateMessage}</p> : null}
      </form>
    </section>
  )
}
