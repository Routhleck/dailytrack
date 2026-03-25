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
import { WEEKLY_SECTION_ORDER } from '../features/weekly/weekly.parser'
import { useDataRoot } from '../features/settings/DataRootContext'
import { computeTemplateUpdate, type TemplateUpdatePreview } from '../features/settings/templateUpdate.service'
import {
  getTemplateMeta,
  saveTemplateMeta,
  type TemplateApplyMode,
  type TemplateMeta,
} from '../features/settings/templateMeta.service'
import {
  normalizeTemplateOutput,
  parseDailyTemplateMarkdown,
  parseWeeklyTemplateMarkdown,
  serializeDailyTemplateMarkdown,
  serializeWeeklyTemplateMarkdown,
} from '../features/settings/templateSchema'
import { moveItemBetweenLists } from '../features/settings/templateMove'
import { reorderByOffset } from '../features/settings/templateReorder'
import { todayDateString } from '../lib/date/date'
import { currentWeekId } from '../lib/date/week'
import { readTextFile, writeTextFile } from '../lib/fs/fileApi'
import { joinPath } from '../lib/fs/pathApi'
import { emitDataChanged } from '../lib/liveSync'
import type { DailyNote, WeeklyNote, WeeklySectionKey } from '../types/tracker'

function safeName(name: string): string {
  return name.trim().replace(/\s+/g, '-')
}

type DailyTemplateSection = 'dailyCore' | 'optional'

export function ProfilesPage() {
  const { t, language } = useI18n()
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
    language === 'zh' ? 'zh' : resolvePreferredTemplateLanguage(),
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
  const [createTemplateEditMode, setCreateTemplateEditMode] = useState<'raw' | 'structured'>('structured')
  const [newDailyStructured, setNewDailyStructured] = useState<DailyNote | null>(
    parseDailyTemplateMarkdown(getTemplateVariant(selectedPreset, templateLanguage).dailyTemplate),
  )
  const [newWeeklyStructured, setNewWeeklyStructured] = useState<WeeklyNote | null>(
    parseWeeklyTemplateMarkdown(getTemplateVariant(selectedPreset, templateLanguage).weeklyTemplate),
  )
  const [createTemplateMessage, setCreateTemplateMessage] = useState('')
  const [createMessage, setCreateMessage] = useState('')
  const [createBusy, setCreateBusy] = useState(false)

  const [currentDailyTemplate, setCurrentDailyTemplate] = useState('')
  const [currentWeeklyTemplate, setCurrentWeeklyTemplate] = useState('')
  const [templateEditMode, setTemplateEditMode] = useState<'raw' | 'structured'>('structured')
  const [currentDailyStructured, setCurrentDailyStructured] = useState<DailyNote | null>(null)
  const [currentWeeklyStructured, setCurrentWeeklyStructured] = useState<WeeklyNote | null>(null)
  const [templateMessage, setTemplateMessage] = useState('')
  const [templateBusy, setTemplateBusy] = useState(false)
  const [currentTemplateMeta, setCurrentTemplateMeta] = useState<TemplateMeta | null>(null)
  const [updatePresetId, setUpdatePresetId] = useState('balanced')
  const [updateTemplateLanguage, setUpdateTemplateLanguage] = useState<TemplateLanguage>(
    language === 'zh' ? 'zh' : resolvePreferredTemplateLanguage(),
  )
  const [updateMode, setUpdateMode] = useState<TemplateApplyMode>('merge')
  const [updatePreview, setUpdatePreview] = useState<TemplateUpdatePreview | null>(null)
  const [overwriteAcknowledged, setOverwriteAcknowledged] = useState(false)
  const [updateBusy, setUpdateBusy] = useState(false)
  const updatePreset = useMemo(() => getTemplatePresetById(updatePresetId), [updatePresetId])
  const currentTemplateSourcePreset = useMemo(
    () => (currentTemplateMeta ? getTemplatePresetById(currentTemplateMeta.presetId) : null),
    [currentTemplateMeta],
  )

  useEffect(() => {
    const selectedVariant = getTemplateVariant(selectedPreset, templateLanguage)
    setNewDailyTemplate(selectedVariant.dailyTemplate)
    setNewWeeklyTemplate(selectedVariant.weeklyTemplate)
    setNewDailyStructured(parseDailyTemplateMarkdown(selectedVariant.dailyTemplate))
    setNewWeeklyStructured(parseWeeklyTemplateMarkdown(selectedVariant.weeklyTemplate))
    setCreateTemplateMessage('')
  }, [selectedPreset, templateLanguage])

  useEffect(() => {
    setOverwriteAcknowledged(false)
  }, [updateMode, updatePresetId, updateTemplateLanguage])

  useEffect(() => {
    if (!dataRoot) {
      return
    }

    let cancelled = false

    void Promise.all([
      readTextFile(dataRoot, joinPath(dataRoot, 'templates', 'daily.md')),
      readTextFile(dataRoot, joinPath(dataRoot, 'templates', 'weekly.md')),
      getTemplateMeta(dataRoot),
    ])
      .then(([daily, weekly, meta]) => {
        if (cancelled) {
          return
        }
        setCurrentDailyTemplate(daily)
        setCurrentWeeklyTemplate(weekly)
        setCurrentDailyStructured(parseDailyTemplateMarkdown(daily))
        setCurrentWeeklyStructured(parseWeeklyTemplateMarkdown(weekly))
        setCurrentTemplateMeta(meta)
        setUpdatePreview(null)
        if (meta) {
          setUpdatePresetId(getTemplatePresetById(meta.presetId).id)
          setUpdateTemplateLanguage(meta.templateLanguage)
        }
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
        templatePresetId: selectedPreset.id,
        templateLanguage,
        templateApplyMode: 'overwrite',
      })
      setCreateName('')
      setCreateMessage(t('profiles.profileCreated', { name: profileName }))
    } catch (error) {
      setCreateMessage(error instanceof Error ? error.message : t('profiles.createFailed'))
    } finally {
      setCreateBusy(false)
    }
  }

  function handleCreateTemplateModeChange(mode: 'raw' | 'structured') {
    if (mode === 'structured') {
      try {
        setNewDailyStructured(parseDailyTemplateMarkdown(newDailyTemplate))
        setNewWeeklyStructured(parseWeeklyTemplateMarkdown(newWeeklyTemplate))
        setCreateTemplateMessage('')
      } catch (error) {
        setCreateTemplateMessage(
          error instanceof Error ? error.message : t('profiles.createStructuredTemplateParseFailed'),
        )
        return
      }
    }
    setCreateTemplateEditMode(mode)
  }

  function updateNewDailyItem(section: DailyTemplateSection, index: number, text: string) {
    setNewDailyStructured((prev) => {
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
      setNewDailyTemplate(serializeDailyTemplateMarkdown(next))
      return next
    })
  }

  function removeNewDailyItem(section: DailyTemplateSection, index: number) {
    setNewDailyStructured((prev) => {
      if (!prev) {
        return prev
      }
      const next = {
        ...prev,
        [section]: prev[section].filter((_, itemIndex) => itemIndex !== index),
      }
      setNewDailyTemplate(serializeDailyTemplateMarkdown(next))
      return next
    })
  }

  function moveNewDailyItem(section: DailyTemplateSection, index: number, offset: -1 | 1) {
    setNewDailyStructured((prev) => {
      if (!prev) {
        return prev
      }
      const reordered = reorderByOffset(prev[section], index, offset)
      if (reordered === prev[section]) {
        return prev
      }
      const next = {
        ...prev,
        [section]: reordered,
      }
      setNewDailyTemplate(serializeDailyTemplateMarkdown(next))
      return next
    })
  }

  function moveNewDailyItemToSection(section: DailyTemplateSection, index: number, target: DailyTemplateSection) {
    if (section === target) {
      return
    }
    setNewDailyStructured((prev) => {
      if (!prev) {
        return prev
      }
      const moved = moveItemBetweenLists(prev[section], prev[target], index)
      if (!moved.moved) {
        return prev
      }
      const next = {
        ...prev,
        [section]: moved.source,
        [target]: moved.target,
      }
      setNewDailyTemplate(serializeDailyTemplateMarkdown(next))
      return next
    })
  }

  function addNewDailyItem(section: DailyTemplateSection) {
    setNewDailyStructured((prev) => {
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
      setNewDailyTemplate(serializeDailyTemplateMarkdown(next))
      return next
    })
  }

  function updateNewWeeklyItem(section: WeeklySectionKey, index: number, text: string) {
    setNewWeeklyStructured((prev) => {
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
      setNewWeeklyTemplate(serializeWeeklyTemplateMarkdown(next))
      return next
    })
  }

  function removeNewWeeklyItem(section: WeeklySectionKey, index: number) {
    setNewWeeklyStructured((prev) => {
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
      setNewWeeklyTemplate(serializeWeeklyTemplateMarkdown(next))
      return next
    })
  }

  function moveNewWeeklyItem(section: WeeklySectionKey, index: number, offset: -1 | 1) {
    setNewWeeklyStructured((prev) => {
      if (!prev) {
        return prev
      }
      const reordered = reorderByOffset(prev.sections[section], index, offset)
      if (reordered === prev.sections[section]) {
        return prev
      }
      const next = {
        ...prev,
        sections: {
          ...prev.sections,
          [section]: reordered,
        },
      }
      setNewWeeklyTemplate(serializeWeeklyTemplateMarkdown(next))
      return next
    })
  }

  function moveNewWeeklyItemToSection(section: WeeklySectionKey, index: number, target: WeeklySectionKey) {
    if (section === target) {
      return
    }
    setNewWeeklyStructured((prev) => {
      if (!prev) {
        return prev
      }
      const moved = moveItemBetweenLists(prev.sections[section], prev.sections[target], index)
      if (!moved.moved) {
        return prev
      }
      const next = {
        ...prev,
        sections: {
          ...prev.sections,
          [section]: moved.source,
          [target]: moved.target,
        },
      }
      setNewWeeklyTemplate(serializeWeeklyTemplateMarkdown(next))
      return next
    })
  }

  function addNewWeeklyItem(section: WeeklySectionKey) {
    setNewWeeklyStructured((prev) => {
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
      setNewWeeklyTemplate(serializeWeeklyTemplateMarkdown(next))
      return next
    })
  }

  function updateNewReflectionItem(field: 'goodThings' | 'nextWeekTop3', index: number, text: string) {
    setNewWeeklyStructured((prev) => {
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
      setNewWeeklyTemplate(serializeWeeklyTemplateMarkdown(next))
      return next
    })
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
      setUpdatePreview(null)
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

  function updateDailyItem(section: DailyTemplateSection, index: number, text: string) {
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

  function removeDailyItem(section: DailyTemplateSection, index: number) {
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

  function moveDailyItem(section: DailyTemplateSection, index: number, offset: -1 | 1) {
    setCurrentDailyStructured((prev) => {
      if (!prev) {
        return prev
      }
      const reordered = reorderByOffset(prev[section], index, offset)
      if (reordered === prev[section]) {
        return prev
      }
      const next = {
        ...prev,
        [section]: reordered,
      }
      setCurrentDailyTemplate(serializeDailyTemplateMarkdown(next))
      return next
    })
  }

  function moveDailyItemToSection(section: DailyTemplateSection, index: number, target: DailyTemplateSection) {
    if (section === target) {
      return
    }
    setCurrentDailyStructured((prev) => {
      if (!prev) {
        return prev
      }
      const moved = moveItemBetweenLists(prev[section], prev[target], index)
      if (!moved.moved) {
        return prev
      }
      const next = {
        ...prev,
        [section]: moved.source,
        [target]: moved.target,
      }
      setCurrentDailyTemplate(serializeDailyTemplateMarkdown(next))
      return next
    })
  }

  function addDailyItem(section: DailyTemplateSection) {
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

  function moveWeeklyItem(section: WeeklySectionKey, index: number, offset: -1 | 1) {
    setCurrentWeeklyStructured((prev) => {
      if (!prev) {
        return prev
      }
      const reordered = reorderByOffset(prev.sections[section], index, offset)
      if (reordered === prev.sections[section]) {
        return prev
      }
      const next = {
        ...prev,
        sections: {
          ...prev.sections,
          [section]: reordered,
        },
      }
      setCurrentWeeklyTemplate(serializeWeeklyTemplateMarkdown(next))
      return next
    })
  }

  function moveWeeklyItemToSection(section: WeeklySectionKey, index: number, target: WeeklySectionKey) {
    if (section === target) {
      return
    }
    setCurrentWeeklyStructured((prev) => {
      if (!prev) {
        return prev
      }
      const moved = moveItemBetweenLists(prev.sections[section], prev.sections[target], index)
      if (!moved.moved) {
        return prev
      }
      const next = {
        ...prev,
        sections: {
          ...prev.sections,
          [section]: moved.source,
          [target]: moved.target,
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

  async function handlePreviewTemplateUpdate() {
    setTemplateMessage('')
    try {
      const selectedVariant = getTemplateVariant(updatePreset, updateTemplateLanguage)
      const next = computeTemplateUpdate(
        {
          dailyTemplate: currentDailyTemplate,
          weeklyTemplate: currentWeeklyTemplate,
        },
        {
          dailyTemplate: selectedVariant.dailyTemplate,
          weeklyTemplate: selectedVariant.weeklyTemplate,
        },
        updateMode,
      )
      setUpdatePreview(next.preview)
      setTemplateMessage(
        t('profiles.templateUpdatePreviewReady', {
          dailyAdded: next.preview.daily.added,
          weeklyAdded: next.preview.weekly.added,
        }),
      )
    } catch (error) {
      setUpdatePreview(null)
      setTemplateMessage(error instanceof Error ? error.message : t('profiles.templateUpdatePreviewFailed'))
    }
  }

  async function handleApplyTemplateUpdate() {
    if (!dataRoot) {
      setTemplateMessage(t('profiles.activeProfileNotReady'))
      return
    }
    if (updateMode === 'overwrite' && !overwriteAcknowledged) {
      setTemplateMessage(t('profiles.templateUpdateOverwriteNeedAcknowledge'))
      return
    }
    setTemplateBusy(true)
    setUpdateBusy(true)
    setTemplateMessage('')
    try {
      const selectedVariant = getTemplateVariant(updatePreset, updateTemplateLanguage)
      const next = computeTemplateUpdate(
        {
          dailyTemplate: currentDailyTemplate,
          weeklyTemplate: currentWeeklyTemplate,
        },
        {
          dailyTemplate: selectedVariant.dailyTemplate,
          weeklyTemplate: selectedVariant.weeklyTemplate,
        },
        updateMode,
      )

      if (
        updateMode === 'overwrite' &&
        !window.confirm(
          t('profiles.templateUpdateOverwriteConfirm', {
            dailyRemoved: next.preview.daily.removed,
            weeklyRemoved: next.preview.weekly.removed,
          }),
        )
      ) {
        setTemplateBusy(false)
        setUpdateBusy(false)
        return
      }

      await writeTextFile(dataRoot, joinPath(dataRoot, 'templates', 'daily.md'), next.dailyTemplate)
      await writeTextFile(dataRoot, joinPath(dataRoot, 'templates', 'weekly.md'), next.weeklyTemplate)
      const meta = await saveTemplateMeta(dataRoot, {
        presetId: updatePreset.id,
        templateLanguage: updateTemplateLanguage,
        lastAppliedMode: updateMode,
        lastAppliedAt: new Date().toISOString(),
      })

      setCurrentTemplateMeta(meta)
      setCurrentDailyTemplate(next.dailyTemplate)
      setCurrentWeeklyTemplate(next.weeklyTemplate)
      setCurrentDailyStructured(parseDailyTemplateMarkdown(next.dailyTemplate))
      setCurrentWeeklyStructured(parseWeeklyTemplateMarkdown(next.weeklyTemplate))
      setUpdatePreview(next.preview)
      emitDataChanged({ scope: 'settings' })
      setTemplateMessage(
        t('profiles.templateUpdateApplied', {
          mode: updateMode === 'merge' ? t('profiles.templateUpdateModeMerge') : t('profiles.templateUpdateModeOverwrite'),
        }),
      )
    } catch (error) {
      setTemplateMessage(error instanceof Error ? error.message : t('profiles.templateUpdateApplyFailed'))
    } finally {
      setTemplateBusy(false)
      setUpdateBusy(false)
    }
  }

  return (
    <section className="dt-page">
      <PageHeader
        title={t('profiles.title')}
        description={t('profiles.description')}
      />

      <div className="dt-panel-soft p-4 text-sm text-slate-700">
        <p>
          {t('profiles.baseRoot')}: <span className="font-medium">{baseDataRoot || '-'}</span>
        </p>
        <p>
          {t('profiles.activeProfile')}: <span className="font-medium">{activeProfile || '-'}</span>
        </p>
      </div>

      <article className="dt-panel space-y-3 p-4">
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
                  className="dt-btn dt-btn-secondary px-3 py-1 text-xs"
                  onClick={() => void switchProfile(profile)}
                  disabled={loading || profile === activeProfile}
                >
                  {t('profiles.switch')}
                </button>
                <button
                  type="button"
                  className="dt-btn dt-btn-danger px-3 py-1 text-xs"
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

      <form onSubmit={handleCreateProfile} className="dt-panel space-y-3 p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('profiles.createProfile')}</h2>

        <label className="block text-sm font-medium text-slate-700" htmlFor="profile-name">
          {t('profiles.profileName')}
        </label>
        <input
          id="profile-name"
          className="dt-input"
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
          className="dt-input"
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
          className="dt-input"
          value={templateLanguage}
          onChange={(event) => setTemplateLanguage(event.target.value as TemplateLanguage)}
          disabled={createBusy}
        >
          <option value="en">{t('template.languageEnglish')}</option>
          <option value="zh">{t('template.languageChinese')}</option>
        </select>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`dt-btn ${
              createTemplateEditMode === 'structured' ? 'bg-slate-900 text-white' : 'dt-btn-secondary'
            }`}
            onClick={() => handleCreateTemplateModeChange('structured')}
            disabled={createBusy}
          >
            {t('common.structured')}
          </button>
          <button
            type="button"
            className={`dt-btn ${
              createTemplateEditMode === 'raw' ? 'bg-slate-900 text-white' : 'dt-btn-secondary'
            }`}
            onClick={() => handleCreateTemplateModeChange('raw')}
            disabled={createBusy}
          >
            {t('common.rawMarkdown')}
          </button>
        </div>

        {createTemplateEditMode === 'raw' ? (
          <>
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
          </>
        ) : (
          <div className="space-y-4">
            <article className="rounded-md border border-slate-200 p-3">
              <h3 className="text-sm font-semibold text-slate-900">{t('profiles.dailyTemplateEditable')}</h3>
              <p className="mt-1 text-xs text-slate-500">{t('profiles.dailyTemplateStructuredHint')}</p>
              <p className="mt-1 text-xs text-slate-500">{t('profiles.dailyRequiredHint')}</p>

              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-slate-700">{t('dailyNote.dailyCore')}</p>
                {newDailyStructured?.dailyCore.map((item, index) => (
                  <div key={item.id} className="flex gap-2">
                    <input
                      className="dt-input"
                      value={item.text}
                      onChange={(event) => updateNewDailyItem('dailyCore', index, event.target.value)}
                      disabled={createBusy}
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 px-2 text-xs text-slate-700"
                        onClick={() => moveNewDailyItem('dailyCore', index, -1)}
                        disabled={createBusy || index === 0}
                      >
                        {t('profiles.moveUp')}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 px-2 text-xs text-slate-700"
                        onClick={() => moveNewDailyItem('dailyCore', index, 1)}
                        disabled={createBusy || index >= (newDailyStructured.dailyCore.length - 1)}
                      >
                        {t('profiles.moveDown')}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-indigo-300 bg-indigo-50 px-2 text-xs text-indigo-700"
                        onClick={() => moveNewDailyItemToSection('dailyCore', index, 'optional')}
                        disabled={createBusy}
                      >
                        {t('profiles.moveToOptional')}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-rose-300 bg-rose-50 px-3 text-xs text-rose-700"
                        onClick={() => removeNewDailyItem('dailyCore', index)}
                        disabled={createBusy}
                      >
                        {t('profiles.removeItem')}
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
                  onClick={() => addNewDailyItem('dailyCore')}
                  disabled={createBusy}
                >
                  {t('profiles.addItem')}
                </button>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-slate-700">{t('dailyNote.optional')}</p>
                {newDailyStructured?.optional.map((item, index) => (
                  <div key={item.id} className="flex gap-2">
                    <input
                      className="dt-input"
                      value={item.text}
                      onChange={(event) => updateNewDailyItem('optional', index, event.target.value)}
                      disabled={createBusy}
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 px-2 text-xs text-slate-700"
                        onClick={() => moveNewDailyItem('optional', index, -1)}
                        disabled={createBusy || index === 0}
                      >
                        {t('profiles.moveUp')}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 px-2 text-xs text-slate-700"
                        onClick={() => moveNewDailyItem('optional', index, 1)}
                        disabled={createBusy || index >= (newDailyStructured.optional.length - 1)}
                      >
                        {t('profiles.moveDown')}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-indigo-300 bg-indigo-50 px-2 text-xs text-indigo-700"
                        onClick={() => moveNewDailyItemToSection('optional', index, 'dailyCore')}
                        disabled={createBusy}
                      >
                        {t('profiles.moveToDailyCore')}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-rose-300 bg-rose-50 px-3 text-xs text-rose-700"
                        onClick={() => removeNewDailyItem('optional', index)}
                        disabled={createBusy}
                      >
                        {t('profiles.removeItem')}
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
                  onClick={() => addNewDailyItem('optional')}
                  disabled={createBusy}
                >
                  {t('profiles.addItem')}
                </button>
              </div>
            </article>

            <article className="rounded-md border border-slate-200 p-3">
              <h3 className="text-sm font-semibold text-slate-900">{t('profiles.weeklyTemplateEditable')}</h3>
              <p className="mt-1 text-xs text-slate-500">{t('profiles.weeklyTemplateStructuredHint')}</p>

              {WEEKLY_SECTION_ORDER.map((section) => (
                <div key={section} className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-slate-700">{t(`section.${section}`)}</p>
                  {newWeeklyStructured?.sections[section].map((item, index) => (
                    <div key={item.id} className="flex gap-2">
                      <input
                        className="dt-input"
                        value={item.text}
                        onChange={(event) => updateNewWeeklyItem(section, index, event.target.value)}
                        disabled={createBusy}
                      />
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 px-2 text-xs text-slate-700"
                          onClick={() => moveNewWeeklyItem(section, index, -1)}
                          disabled={createBusy || index === 0}
                        >
                          {t('profiles.moveUp')}
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 px-2 text-xs text-slate-700"
                          onClick={() => moveNewWeeklyItem(section, index, 1)}
                          disabled={createBusy || index >= (newWeeklyStructured.sections[section].length - 1)}
                        >
                          {t('profiles.moveDown')}
                        </button>
                        <label className="text-xs text-slate-600">
                          {t('profiles.category')}
                          <select
                            className="ml-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                            value={section}
                            onChange={(event) =>
                              moveNewWeeklyItemToSection(section, index, event.target.value as WeeklySectionKey)}
                            disabled={createBusy}
                          >
                            {WEEKLY_SECTION_ORDER.map((sectionKey) => (
                              <option key={sectionKey} value={sectionKey}>
                                {t(`section.${sectionKey}`)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="rounded-md border border-rose-300 bg-rose-50 px-3 text-xs text-rose-700"
                          onClick={() => removeNewWeeklyItem(section, index)}
                          disabled={createBusy}
                        >
                          {t('profiles.removeItem')}
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
                    onClick={() => addNewWeeklyItem(section)}
                    disabled={createBusy}
                  >
                    {t('profiles.addItem')}
                  </button>
                </div>
              ))}

              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-slate-700">{t('weeklyNote.goodThings')}</p>
                {[0, 1, 2].map((index) => (
                  <input
                    key={`new-good-${index}`}
                    className="dt-input"
                    value={newWeeklyStructured?.reflection.goodThings[index] ?? ''}
                    onChange={(event) => updateNewReflectionItem('goodThings', index, event.target.value)}
                    disabled={createBusy}
                  />
                ))}
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-slate-700">{t('weeklyNote.nextTop3')}</p>
                {[0, 1, 2].map((index) => (
                  <input
                    key={`new-next-${index}`}
                    className="dt-input"
                    value={newWeeklyStructured?.reflection.nextWeekTop3[index] ?? ''}
                    onChange={(event) => updateNewReflectionItem('nextWeekTop3', index, event.target.value)}
                    disabled={createBusy}
                  />
                ))}
              </div>
            </article>
          </div>
        )}

        {createTemplateMessage ? <p className="text-sm text-slate-600">{createTemplateMessage}</p> : null}

        <button
          type="submit"
          disabled={createBusy}
          className="dt-btn dt-btn-primary"
        >
          {createBusy ? t('profiles.creating') : t('profiles.createProfileButton')}
        </button>
        {createMessage ? <p className="text-sm text-slate-600">{createMessage}</p> : null}
      </form>

      <form onSubmit={handleSaveCurrentTemplates} className="dt-panel space-y-3 p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('profiles.currentTemplates')}</h2>
        <article className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p>
            {t('profiles.templateSource')}:&nbsp;
            <span className="font-medium text-slate-800">
              {currentTemplateMeta && currentTemplateSourcePreset
                ? `${currentTemplateSourcePreset.labels[currentTemplateMeta.templateLanguage]} (${currentTemplateMeta.presetId})`
                : t('profiles.templateSourceUnknown')}
            </span>
          </p>
          <p>
            {t('profiles.templateLastAppliedMode')}:&nbsp;
            <span className="font-medium text-slate-800">
              {currentTemplateMeta
                ? currentTemplateMeta.lastAppliedMode === 'merge'
                  ? t('profiles.templateUpdateModeMerge')
                  : t('profiles.templateUpdateModeOverwrite')
                : '-'}
            </span>
          </p>
          <p>
            {t('profiles.templateLastAppliedAt')}:&nbsp;
            <span className="font-medium text-slate-800">
              {currentTemplateMeta?.lastAppliedAt
                ? new Date(currentTemplateMeta.lastAppliedAt).toLocaleString()
                : '-'}
            </span>
          </p>
        </article>

        <article className="space-y-3 rounded-md border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-slate-900">{t('profiles.templateUpdate')}</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-700" htmlFor="update-profile-preset">
                {t('profiles.templatePreset')}
              </label>
              <select
                id="update-profile-preset"
                className="mt-1 dt-input"
                value={updatePresetId}
                onChange={(event) => setUpdatePresetId(event.target.value)}
                disabled={templateBusy || updateBusy || !dataRoot}
              >
                {TEMPLATE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.labels[updateTemplateLanguage]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700" htmlFor="update-template-language">
                {t('profiles.templateLanguage')}
              </label>
              <select
                id="update-template-language"
                className="mt-1 dt-input"
                value={updateTemplateLanguage}
                onChange={(event) => setUpdateTemplateLanguage(event.target.value as TemplateLanguage)}
                disabled={templateBusy || updateBusy || !dataRoot}
              >
                <option value="en">{t('template.languageEnglish')}</option>
                <option value="zh">{t('template.languageChinese')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700" htmlFor="update-template-mode">
                {t('profiles.templateUpdateMode')}
              </label>
              <select
                id="update-template-mode"
                className="mt-1 dt-input"
                value={updateMode}
                onChange={(event) => {
                  setUpdateMode(event.target.value as TemplateApplyMode)
                }}
                disabled={templateBusy || updateBusy || !dataRoot}
              >
                <option value="merge">{t('profiles.templateUpdateModeMerge')}</option>
                <option value="overwrite">{t('profiles.templateUpdateModeOverwrite')}</option>
              </select>
            </div>
          </div>
          {updatePreset.descriptions?.[updateTemplateLanguage] ? (
            <p className="text-xs text-slate-500">{updatePreset.descriptions[updateTemplateLanguage]}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={templateBusy || updateBusy || !dataRoot}
              className="dt-btn dt-btn-secondary px-3 py-1.5 text-xs"
              onClick={() => void handlePreviewTemplateUpdate()}
            >
              {t('profiles.templateUpdatePreview')}
            </button>
            <button
              type="button"
              disabled={templateBusy || updateBusy || !dataRoot || (updateMode === 'overwrite' && !overwriteAcknowledged)}
              className="dt-btn rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700"
              onClick={() => void handleApplyTemplateUpdate()}
            >
              {updateBusy ? t('profiles.saving') : t('profiles.templateUpdateApply')}
            </button>
          </div>
          {updatePreview ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
              <p className="mb-1 font-medium text-slate-800">
                {t('profiles.templateUpdateImpactTitle')}
              </p>
              <p>
                {t('profiles.templateUpdateImpactFiles', { count: 2 })}
              </p>
              <p>
                {t('profiles.templateUpdateImpactMode', {
                  mode:
                    updatePreview.mode === 'merge'
                      ? t('profiles.templateUpdateModeMerge')
                      : t('profiles.templateUpdateModeOverwrite'),
                })}
              </p>
              <p>
                {t('profiles.templateUpdateSummaryDaily', {
                  before: updatePreview.daily.before,
                  after: updatePreview.daily.after,
                  added: updatePreview.daily.added,
                  removed: updatePreview.daily.removed,
                })}
              </p>
              <p>
                {t('profiles.templateUpdateSummaryWeekly', {
                  before: updatePreview.weekly.before,
                  after: updatePreview.weekly.after,
                  added: updatePreview.weekly.added,
                  removed: updatePreview.weekly.removed,
                })}
              </p>
              <p>
                {t('profiles.templateUpdateSummaryReflection', {
                  before: updatePreview.reflection.beforeFilled,
                  after: updatePreview.reflection.afterFilled,
                  filled: updatePreview.reflection.filledFromPreset,
                })}
              </p>
              {updatePreview.mode === 'overwrite' && (updatePreview.daily.removed > 0 || updatePreview.weekly.removed > 0) ? (
                <p className="mt-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                  {t('profiles.templateUpdateOverwriteRisk', {
                    total: updatePreview.daily.removed + updatePreview.weekly.removed,
                    daily: updatePreview.daily.removed,
                    weekly: updatePreview.weekly.removed,
                  })}
                </p>
              ) : null}
            </div>
          ) : null}
          {updateMode === 'overwrite' ? (
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={overwriteAcknowledged}
                onChange={(event) => setOverwriteAcknowledged(event.target.checked)}
                disabled={templateBusy || updateBusy || !dataRoot}
              />
              {t('profiles.templateUpdateOverwriteAcknowledge')}
            </label>
          ) : null}
        </article>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`dt-btn ${
              templateEditMode === 'structured' ? 'bg-slate-900 text-white' : 'dt-btn-secondary'
            }`}
            onClick={() => handleTemplateModeChange('structured')}
          >
            {t('common.structured')}
          </button>
          <button
            type="button"
            className={`dt-btn ${
              templateEditMode === 'raw' ? 'bg-slate-900 text-white' : 'dt-btn-secondary'
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
              <p className="mt-1 text-xs text-slate-500">{t('profiles.dailyRequiredHint')}</p>

              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-slate-700">{t('dailyNote.dailyCore')}</p>
                {currentDailyStructured?.dailyCore.map((item, index) => (
                  <div key={item.id} className="flex gap-2">
                    <input
                      className="dt-input"
                      value={item.text}
                      onChange={(event) => updateDailyItem('dailyCore', index, event.target.value)}
                      disabled={templateBusy || !dataRoot}
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 px-2 text-xs text-slate-700"
                        onClick={() => moveDailyItem('dailyCore', index, -1)}
                        disabled={templateBusy || !dataRoot || index === 0}
                      >
                        {t('profiles.moveUp')}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 px-2 text-xs text-slate-700"
                        onClick={() => moveDailyItem('dailyCore', index, 1)}
                        disabled={templateBusy || !dataRoot || index >= (currentDailyStructured.dailyCore.length - 1)}
                      >
                        {t('profiles.moveDown')}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-indigo-300 bg-indigo-50 px-2 text-xs text-indigo-700"
                        onClick={() => moveDailyItemToSection('dailyCore', index, 'optional')}
                        disabled={templateBusy || !dataRoot}
                      >
                        {t('profiles.moveToOptional')}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-rose-300 bg-rose-50 px-3 text-xs text-rose-700"
                        onClick={() => removeDailyItem('dailyCore', index)}
                        disabled={templateBusy || !dataRoot}
                      >
                        {t('profiles.removeItem')}
                      </button>
                    </div>
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
                      className="dt-input"
                      value={item.text}
                      onChange={(event) => updateDailyItem('optional', index, event.target.value)}
                      disabled={templateBusy || !dataRoot}
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 px-2 text-xs text-slate-700"
                        onClick={() => moveDailyItem('optional', index, -1)}
                        disabled={templateBusy || !dataRoot || index === 0}
                      >
                        {t('profiles.moveUp')}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 px-2 text-xs text-slate-700"
                        onClick={() => moveDailyItem('optional', index, 1)}
                        disabled={templateBusy || !dataRoot || index >= (currentDailyStructured.optional.length - 1)}
                      >
                        {t('profiles.moveDown')}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-indigo-300 bg-indigo-50 px-2 text-xs text-indigo-700"
                        onClick={() => moveDailyItemToSection('optional', index, 'dailyCore')}
                        disabled={templateBusy || !dataRoot}
                      >
                        {t('profiles.moveToDailyCore')}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-rose-300 bg-rose-50 px-3 text-xs text-rose-700"
                        onClick={() => removeDailyItem('optional', index)}
                        disabled={templateBusy || !dataRoot}
                      >
                        {t('profiles.removeItem')}
                      </button>
                    </div>
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
                        className="dt-input"
                        value={item.text}
                        onChange={(event) => updateWeeklyItem(section, index, event.target.value)}
                        disabled={templateBusy || !dataRoot}
                      />
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 px-2 text-xs text-slate-700"
                          onClick={() => moveWeeklyItem(section, index, -1)}
                          disabled={templateBusy || !dataRoot || index === 0}
                        >
                          {t('profiles.moveUp')}
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 px-2 text-xs text-slate-700"
                          onClick={() => moveWeeklyItem(section, index, 1)}
                          disabled={templateBusy || !dataRoot || index >= (currentWeeklyStructured.sections[section].length - 1)}
                        >
                          {t('profiles.moveDown')}
                        </button>
                        <label className="text-xs text-slate-600">
                          {t('profiles.category')}
                          <select
                            className="ml-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                            value={section}
                            onChange={(event) =>
                              moveWeeklyItemToSection(section, index, event.target.value as WeeklySectionKey)}
                            disabled={templateBusy || !dataRoot}
                          >
                            {WEEKLY_SECTION_ORDER.map((sectionKey) => (
                              <option key={sectionKey} value={sectionKey}>
                                {t(`section.${sectionKey}`)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="rounded-md border border-rose-300 bg-rose-50 px-3 text-xs text-rose-700"
                          onClick={() => removeWeeklyItem(section, index)}
                          disabled={templateBusy || !dataRoot}
                        >
                          {t('profiles.removeItem')}
                        </button>
                      </div>
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
                    className="dt-input"
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
                    className="dt-input"
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
          className="dt-btn dt-btn-primary"
        >
          {templateBusy ? t('profiles.saving') : t('profiles.saveCurrentTemplates')}
        </button>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={templateBusy || !dataRoot}
            className="dt-btn rounded-xl border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700"
            onClick={() => void handleApplyDailyTemplateToToday()}
          >
            {t('profiles.applyDailyTemplateToToday')}
          </button>
          <button
            type="button"
            disabled={templateBusy || !dataRoot}
            className="dt-btn rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700"
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
