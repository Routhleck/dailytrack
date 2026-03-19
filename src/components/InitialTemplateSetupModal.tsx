import { useMemo, useState } from 'react'

import { useI18n } from '../features/i18n/I18nContext'
import { useDataRoot } from '../features/settings/DataRootContext'
import {
  TEMPLATE_PRESETS,
  getTemplatePresetById,
  getTemplateVariant,
  resolvePreferredTemplateLanguage,
  type TemplateLanguage,
} from '../features/settings/templatePresets'

export function InitialTemplateSetupModal() {
  const { t } = useI18n()
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
      setMessage(error instanceof Error ? error.message : t('onboarding.applyFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div className="w-full max-w-4xl rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-xl font-semibold text-slate-900">{t('onboarding.title')}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {t('onboarding.description')}
        </p>
        <p className="mt-1 break-all text-xs text-slate-500">
          {t('onboarding.root')}: {dataRoot || '-'}
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="initial-preset">
              {t('onboarding.templatePreset')}
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
              {t('onboarding.templateLanguage')}
            </label>
            <select
              id="initial-language"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={templateLanguage}
              onChange={(event) => setTemplateLanguage(event.target.value as TemplateLanguage)}
              disabled={busy}
            >
              <option value="en">{t('onboarding.languageEnglish')}</option>
              <option value="zh">{t('onboarding.languageChinese')}</option>
            </select>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">{t('onboarding.dailyPreview')}</p>
            <textarea
              className="h-56 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
              value={selectedVariant.dailyTemplate}
              readOnly
              spellCheck={false}
            />
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">{t('onboarding.weeklyPreview')}</p>
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
            {busy ? t('onboarding.applying') : t('onboarding.applyAndContinue')}
          </button>
          {message ? <p className="text-sm text-rose-700">{message}</p> : null}
        </div>
      </div>
    </div>
  )
}
