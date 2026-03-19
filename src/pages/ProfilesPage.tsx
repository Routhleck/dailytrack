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
import { useDataRoot } from '../features/settings/DataRootContext'
import { readTextFile, writeTextFile } from '../lib/fs/fileApi'
import { joinPath } from '../lib/fs/pathApi'

function safeName(name: string): string {
  return name.trim().replace(/\s+/g, '-')
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
      readTextFile(joinPath(dataRoot, 'templates', 'daily.md')),
      readTextFile(joinPath(dataRoot, 'templates', 'weekly.md')),
    ])
      .then(([daily, weekly]) => {
        if (cancelled) {
          return
        }
        setCurrentDailyTemplate(daily)
        setCurrentWeeklyTemplate(weekly)
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
      await writeTextFile(joinPath(dataRoot, 'templates', 'daily.md'), currentDailyTemplate)
      await writeTextFile(joinPath(dataRoot, 'templates', 'weekly.md'), currentWeeklyTemplate)
      setTemplateMessage(t('profiles.currentTemplatesSaved'))
    } catch (error) {
      setTemplateMessage(error instanceof Error ? error.message : t('profiles.currentTemplateSaveFailed'))
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

        <button
          type="submit"
          disabled={templateBusy || !dataRoot}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {templateBusy ? t('profiles.saving') : t('profiles.saveCurrentTemplates')}
        </button>
        {templateMessage ? <p className="text-sm text-slate-600">{templateMessage}</p> : null}
      </form>
    </section>
  )
}
