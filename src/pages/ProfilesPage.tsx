import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { PageHeader } from '../components/PageHeader'
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
        setTemplateMessage('Failed to load current profile templates.')
      })

    return () => {
      cancelled = true
    }
  }, [dataRoot])

  async function handleCreateProfile(event: FormEvent) {
    event.preventDefault()

    const profileName = safeName(createName)
    if (!profileName) {
      setCreateMessage('Profile name is required.')
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
      setCreateMessage(`Profile ${profileName} created and activated.`)
    } catch (error) {
      setCreateMessage(error instanceof Error ? error.message : 'Failed to create profile.')
    } finally {
      setCreateBusy(false)
    }
  }

  async function handleSaveCurrentTemplates(event: FormEvent) {
    event.preventDefault()

    if (!dataRoot) {
      setTemplateMessage('Active profile is not ready.')
      return
    }

    setTemplateBusy(true)
    setTemplateMessage('')

    try {
      await writeTextFile(joinPath(dataRoot, 'templates', 'daily.md'), currentDailyTemplate)
      await writeTextFile(joinPath(dataRoot, 'templates', 'weekly.md'), currentWeeklyTemplate)
      setTemplateMessage('Current profile templates saved.')
    } catch (error) {
      setTemplateMessage(error instanceof Error ? error.message : 'Failed to save templates.')
    } finally {
      setTemplateBusy(false)
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Profiles"
        description="Create, switch, delete profiles, and customize profile templates."
      />

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p>
          Base root: <span className="font-medium">{baseDataRoot || '-'}</span>
        </p>
        <p>
          Active profile: <span className="font-medium">{activeProfile || '-'}</span>
        </p>
      </div>

      <article className="space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-900">Profile List</h2>

        <ul className="space-y-2">
          {profiles.map((profile) => (
            <li
              key={profile}
              className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2"
            >
              <span className="text-sm text-slate-800">
                {profile} {profile === activeProfile ? '(active)' : ''}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded bg-slate-200 px-3 py-1 text-xs text-slate-800"
                  onClick={() => void switchProfile(profile)}
                  disabled={loading || profile === activeProfile}
                >
                  Switch
                </button>
                <button
                  type="button"
                  className="rounded bg-rose-100 px-3 py-1 text-xs text-rose-700 disabled:opacity-60"
                  onClick={() => void deleteProfile(profile)}
                  disabled={loading || profiles.length <= 1 || profile === activeProfile}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">
          To delete an active profile, switch to another profile first.
        </p>
      </article>

      <form onSubmit={handleCreateProfile} className="space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-900">Create Profile</h2>

        <label className="block text-sm font-medium text-slate-700" htmlFor="profile-name">
          Profile name
        </label>
        <input
          id="profile-name"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="e.g. personal, fitness, work"
          value={createName}
          onChange={(event) => setCreateName(event.target.value)}
          disabled={createBusy}
        />

        <label className="block text-sm font-medium text-slate-700" htmlFor="profile-preset">
          Template preset
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
          Template language
        </label>
        <select
          id="template-language"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={templateLanguage}
          onChange={(event) => setTemplateLanguage(event.target.value as TemplateLanguage)}
          disabled={createBusy}
        >
          <option value="en">English</option>
          <option value="zh">中文</option>
        </select>

        <label className="block text-sm font-medium text-slate-700">Daily template (editable)</label>
        <textarea
          className="h-48 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
          value={newDailyTemplate}
          onChange={(event) => setNewDailyTemplate(event.target.value)}
          disabled={createBusy}
          spellCheck={false}
        />

        <label className="block text-sm font-medium text-slate-700">Weekly template (editable)</label>
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
          {createBusy ? 'Creating...' : 'Create Profile'}
        </button>
        {createMessage ? <p className="text-sm text-slate-600">{createMessage}</p> : null}
      </form>

      <form onSubmit={handleSaveCurrentTemplates} className="space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-900">Current Profile Templates</h2>

        <label className="block text-sm font-medium text-slate-700">Daily template</label>
        <textarea
          className="h-48 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
          value={currentDailyTemplate}
          onChange={(event) => setCurrentDailyTemplate(event.target.value)}
          disabled={templateBusy || !dataRoot}
          spellCheck={false}
        />

        <label className="block text-sm font-medium text-slate-700">Weekly template</label>
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
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {templateBusy ? 'Saving...' : 'Save Current Templates'}
        </button>
        {templateMessage ? <p className="text-sm text-slate-600">{templateMessage}</p> : null}
      </form>
    </section>
  )
}
