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
import { extractErrorMessage } from '../lib/error'

export function InitialTemplateSetupModal() {
  const { t, language, setLanguage } = useI18n()
  const { dataRoot, completeInitialTemplateSetup } = useDataRoot()
  const [step, setStep] = useState<'language' | 'template'>('language')
  const [presetId, setPresetId] = useState('balanced')
  const [templateLanguage, setTemplateLanguage] = useState<TemplateLanguage>(() => {
    if (language === 'en' || language === 'zh') {
      return language
    }
    return resolvePreferredTemplateLanguage()
  })
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
        {
          templatePresetId: selectedPreset.id,
          templateLanguage,
          templateApplyMode: 'overwrite',
        },
      )
    } catch (error) {
      setMessage(extractErrorMessage(error, t('onboarding.applyFailed')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="dt-panel w-full max-w-4xl p-5">
        {step === 'language' ? (
          <>
            <h2 className="text-xl font-semibold text-slate-900">{t('onboarding.languageTitle')}</h2>
            <p className="mt-2 text-sm text-slate-600">{t('onboarding.languageDescription')}</p>
            <p className="mt-1 break-all text-xs text-slate-500">
              {t('onboarding.root')}: {dataRoot || '-'}
            </p>

            <div className="mt-4 max-w-sm">
              <label className="block text-sm font-medium text-slate-700" htmlFor="initial-ui-language">
                {t('onboarding.uiLanguage')}
              </label>
              <select
                id="initial-ui-language"
                className="mt-1 dt-input"
                value={language}
                onChange={(event) => {
                  const nextLanguage = event.target.value as 'en' | 'zh'
                  setLanguage(nextLanguage)
                  setTemplateLanguage(nextLanguage)
                }}
              >
                <option value="en">{t('onboarding.languageEnglish')}</option>
                <option value="zh">{t('onboarding.languageChinese')}</option>
              </select>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep('template')}
                className="dt-btn dt-btn-primary"
              >
                {t('onboarding.continue')}
              </button>
            </div>
          </>
        ) : (
          <>
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
                  className="mt-1 dt-input"
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
                  className="mt-1 dt-input"
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
                  className="dt-input h-56 font-mono text-xs"
                  value={selectedVariant.dailyTemplate}
                  readOnly
                  spellCheck={false}
                />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-slate-700">{t('onboarding.weeklyPreview')}</p>
                <textarea
                  className="dt-input h-56 font-mono text-xs"
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
                className="dt-btn dt-btn-primary"
              >
                {busy ? t('onboarding.applying') : t('onboarding.applyAndContinue')}
              </button>
              {message ? <p className="text-sm text-rose-700">{message}</p> : null}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
