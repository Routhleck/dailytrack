import { useMemo, useState } from 'react'

import { useDataRoot } from '../features/settings/DataRootContext'
import {
  TEMPLATE_PRESETS,
  getTemplatePresetById,
  getTemplateVariant,
  resolvePreferredTemplateLanguage,
  type TemplateLanguage,
} from '../features/settings/templatePresets'

export function InitialTemplateSetupModal() {
  const { dataRoot, completeInitialTemplateSetup } = useDataRoot()
  const [presetId, setPresetId] = useState('balanced')
  const [templateLanguage, setTemplateLanguage] = useState<TemplateLanguage>(
    resolvePreferredTemplateLanguage(),
  )
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const selectedPreset = useMemo(() => getTemplatePresetById(presetId), [presetId])
  const selectedVariant = useMemo(
    () => getTemplateVariant(selectedPreset, templateLanguage),
    [selectedPreset, templateLanguage],
  )

  async function handleApply() {
    setBusy(true)
    setMessage('')
    try {
      await completeInitialTemplateSetup(
        selectedVariant.dailyTemplate,
        selectedVariant.weeklyTemplate,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to apply template setup.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div className="w-full max-w-4xl rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-xl font-semibold text-slate-900">Initial Template Setup</h2>
        <p className="mt-2 text-sm text-slate-600">
          No tracker data was found in this root. Choose a starting template (or Blank) before
          continuing.
        </p>
        <p className="mt-1 break-all text-xs text-slate-500">Root: {dataRoot || '-'}</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="initial-preset">
              Template preset
            </label>
            <select
              id="initial-preset"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={presetId}
              onChange={(event) => setPresetId(event.target.value)}
              disabled={busy}
            >
              {TEMPLATE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.labels[templateLanguage]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="initial-language">
              Template language
            </label>
            <select
              id="initial-language"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={templateLanguage}
              onChange={(event) => setTemplateLanguage(event.target.value as TemplateLanguage)}
              disabled={busy}
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Daily template preview</p>
            <textarea
              className="h-56 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
              value={selectedVariant.dailyTemplate}
              readOnly
              spellCheck={false}
            />
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Weekly template preview</p>
            <textarea
              className="h-56 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
              value={selectedVariant.weeklyTemplate}
              readOnly
              spellCheck={false}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={busy}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? 'Applying...' : 'Apply and Continue'}
          </button>
          {message ? <p className="text-sm text-rose-700">{message}</p> : null}
        </div>
      </div>
    </div>
  )
}
