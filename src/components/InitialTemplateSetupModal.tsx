import { useEffect, useMemo, useState } from 'react'

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
import {
  getWebdavConfig,
  importDataBundle,
  pullWebdavSnapshot,
  saveWebdavConfig,
  testWebdavConnection,
  type WebdavConfig,
} from '../lib/fs/fileApi'
import { pickDirectory } from '../lib/fs/dialogApi'

type OnboardingStep = 'language' | 'userType' | 'template' | 'existing'
type ExistingMode = 'import' | 'webdav'

type WebdavDraft = {
  remoteBaseUrl: string
  username: string
  password: string
  autoPullEnabled: boolean
  autoPullIntervalSec: number
}

const DEFAULT_WEBDAV_CONFIG: WebdavConfig = {
  enabled: false,
  autoPullEnabled: false,
  autoPullIntervalSec: 30,
  remoteBaseUrl: '',
  username: '',
  password: '',
  autoPushIntervalMin: 0,
  requestTimeoutSec: 90,
  maxSnapshots: 30,
  verifyTls: true,
  deviceId: '',
}

export function InitialTemplateSetupModal() {
  const { t, language, setLanguage } = useI18n()
  const {
    dataRoot,
    completeInitialTemplateSetup,
    finishInitialTemplateSetup,
  } = useDataRoot()

  const [step, setStep] = useState<OnboardingStep>('language')
  const [userType, setUserType] = useState<'new' | 'existing'>('new')
  const [presetId, setPresetId] = useState('balanced')
  const [templateLanguage, setTemplateLanguage] = useState<TemplateLanguage>(() => {
    if (language === 'en' || language === 'zh') {
      return language
    }
    return resolvePreferredTemplateLanguage()
  })
  const [existingMode, setExistingMode] = useState<ExistingMode>('import')

  const [importSource, setImportSource] = useState('')
  const [importOverwrite, setImportOverwrite] = useState(true)

  const [loadedWebdavConfig, setLoadedWebdavConfig] = useState<WebdavConfig | null>(null)
  const [webdavDraft, setWebdavDraft] = useState<WebdavDraft>({
    remoteBaseUrl: '',
    username: '',
    password: '',
    autoPullEnabled: true,
    autoPullIntervalSec: 30,
  })

  const [busy, setBusy] = useState(false)
  const [testingWebdav, setTestingWebdav] = useState(false)
  const [message, setMessage] = useState('')

  const selectedPreset = useMemo(() => getTemplatePresetById(presetId), [presetId])
  const selectedVariant = useMemo(
    () => getTemplateVariant(selectedPreset, templateLanguage),
    [selectedPreset, templateLanguage],
  )

  useEffect(() => {
    if (step !== 'existing' || loadedWebdavConfig) {
      return
    }

    let cancelled = false
    void getWebdavConfig()
      .then((config) => {
        if (cancelled) {
          return
        }
        setLoadedWebdavConfig(config)
        setWebdavDraft({
          remoteBaseUrl: config.remoteBaseUrl,
          username: config.username,
          password: config.password,
          autoPullEnabled: config.autoPullEnabled,
          autoPullIntervalSec: config.autoPullIntervalSec,
        })
      })
      .catch(() => {
        if (cancelled) {
          return
        }
        setLoadedWebdavConfig(DEFAULT_WEBDAV_CONFIG)
      })

    return () => {
      cancelled = true
    }
  }, [loadedWebdavConfig, step])

  function buildWebdavConfig(): WebdavConfig {
    const base = loadedWebdavConfig ?? DEFAULT_WEBDAV_CONFIG
    return {
      ...base,
      enabled: true,
      autoPullEnabled: webdavDraft.autoPullEnabled,
      autoPullIntervalSec: Math.max(5, Math.round(webdavDraft.autoPullIntervalSec || 30)),
      remoteBaseUrl: webdavDraft.remoteBaseUrl.trim(),
      username: webdavDraft.username.trim(),
      password: webdavDraft.password.trim() || base.password,
    }
  }

  async function handleApplyTemplate() {
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

  async function handleImportAndContinue() {
    if (!dataRoot) {
      setMessage(t('onboarding.applyFailed'))
      return
    }
    if (!importSource.trim()) {
      setMessage(t('onboarding.importSourceRequired'))
      return
    }

    setBusy(true)
    setMessage('')
    try {
      await importDataBundle(importSource.trim(), dataRoot, importOverwrite)
      await finishInitialTemplateSetup({ runTutorial: false })
    } catch (error) {
      setMessage(extractErrorMessage(error, t('onboarding.importFailed')))
    } finally {
      setBusy(false)
    }
  }

  async function handlePickImportSource() {
    try {
      const picked = await pickDirectory(importSource || undefined)
      if (picked) {
        setImportSource(picked)
      }
    } catch (error) {
      setMessage(extractErrorMessage(error, t('onboarding.pathPickFailed')))
    }
  }

  async function handleTestWebdav() {
    setTestingWebdav(true)
    setMessage('')

    try {
      const config = buildWebdavConfig()
      const saved = await saveWebdavConfig(config)
      setLoadedWebdavConfig(saved)
      await testWebdavConnection()
      setMessage(t('onboarding.webdavTestPassed'))
    } catch (error) {
      setMessage(extractErrorMessage(error, t('onboarding.webdavTestFailed')))
    } finally {
      setTestingWebdav(false)
    }
  }

  async function handleWebdavPullAndContinue() {
    if (!dataRoot) {
      setMessage(t('onboarding.webdavPullFailed'))
      return
    }

    setBusy(true)
    setMessage('')
    try {
      const config = buildWebdavConfig()
      const saved = await saveWebdavConfig(config)
      setLoadedWebdavConfig(saved)
      await pullWebdavSnapshot(dataRoot, undefined, true, true)
      await finishInitialTemplateSetup({ runTutorial: false })
    } catch (error) {
      setMessage(extractErrorMessage(error, t('onboarding.webdavPullFailed')))
    } finally {
      setBusy(false)
    }
  }

  async function handleSkipExisting() {
    setBusy(true)
    setMessage('')
    try {
      await finishInitialTemplateSetup({ runTutorial: false })
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
                onClick={() => setStep('userType')}
                className="dt-btn dt-btn-primary"
              >
                {t('onboarding.continue')}
              </button>
            </div>
          </>
        ) : null}

        {step === 'userType' ? (
          <>
            <h2 className="text-xl font-semibold text-slate-900">{t('onboarding.userTypeTitle')}</h2>
            <p className="mt-2 text-sm text-slate-600">{t('onboarding.userTypeDescription')}</p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  userType === 'new'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                }`}
                onClick={() => setUserType('new')}
              >
                <p className="text-sm font-semibold">{t('onboarding.userTypeNew')}</p>
                <p className={`mt-1 text-xs ${userType === 'new' ? 'text-slate-200' : 'text-slate-500'}`}>
                  {t('onboarding.userTypeNewHint')}
                </p>
              </button>
              <button
                type="button"
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  userType === 'existing'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                }`}
                onClick={() => setUserType('existing')}
              >
                <p className="text-sm font-semibold">{t('onboarding.userTypeExisting')}</p>
                <p className={`mt-1 text-xs ${userType === 'existing' ? 'text-slate-200' : 'text-slate-500'}`}>
                  {t('onboarding.userTypeExistingHint')}
                </p>
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep('language')}
                className="dt-btn dt-btn-secondary"
              >
                {t('onboarding.back')}
              </button>
              <button
                type="button"
                onClick={() => setStep(userType === 'new' ? 'template' : 'existing')}
                className="dt-btn dt-btn-primary"
              >
                {t('onboarding.continue')}
              </button>
            </div>
          </>
        ) : null}

        {step === 'template' ? (
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
                onClick={() => setStep('userType')}
                className="dt-btn dt-btn-secondary"
                disabled={busy}
              >
                {t('onboarding.back')}
              </button>
              <button
                type="button"
                onClick={() => void handleApplyTemplate()}
                disabled={busy}
                className="dt-btn dt-btn-primary"
              >
                {busy ? t('onboarding.applying') : t('onboarding.applyAndContinue')}
              </button>
              {message ? <p className="text-sm text-rose-700">{message}</p> : null}
            </div>
          </>
        ) : null}

        {step === 'existing' ? (
          <>
            <h2 className="text-xl font-semibold text-slate-900">{t('onboarding.existingTitle')}</h2>
            <p className="mt-2 text-sm text-slate-600">{t('onboarding.existingDescription')}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`dt-btn ${existingMode === 'import' ? 'bg-slate-900 text-white' : 'dt-btn-secondary'}`}
                onClick={() => setExistingMode('import')}
                disabled={busy || testingWebdav}
              >
                {t('onboarding.importTitle')}
              </button>
              <button
                type="button"
                className={`dt-btn ${existingMode === 'webdav' ? 'bg-slate-900 text-white' : 'dt-btn-secondary'}`}
                onClick={() => setExistingMode('webdav')}
                disabled={busy || testingWebdav}
              >
                {t('onboarding.webdavTitle')}
              </button>
            </div>

            {existingMode === 'import' ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-600">{t('onboarding.importDescription')}</p>
                <label className="block text-sm font-medium text-slate-700" htmlFor="onboarding-import-source">
                  {t('onboarding.importSource')}
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="onboarding-import-source"
                    className="dt-input min-w-56 flex-1"
                    value={importSource}
                    onChange={(event) => setImportSource(event.target.value)}
                    placeholder={t('onboarding.importSourcePlaceholder')}
                    disabled={busy || testingWebdav}
                  />
                  <button
                    type="button"
                    className="dt-btn dt-btn-secondary"
                    onClick={() => void handlePickImportSource()}
                    disabled={busy || testingWebdav}
                  >
                    {t('common.browse')}
                  </button>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={importOverwrite}
                    onChange={(event) => setImportOverwrite(event.target.checked)}
                    disabled={busy || testingWebdav}
                  />
                  {t('onboarding.importOverwrite')}
                </label>
                <button
                  type="button"
                  className="dt-btn dt-btn-primary"
                  onClick={() => void handleImportAndContinue()}
                  disabled={busy || testingWebdav}
                >
                  {busy ? t('onboarding.importing') : t('onboarding.importAndContinue')}
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-600">{t('onboarding.webdavDescription')}</p>

                <label className="block text-sm font-medium text-slate-700" htmlFor="onboarding-webdav-url">
                  {t('onboarding.webdavBaseUrl')}
                </label>
                <input
                  id="onboarding-webdav-url"
                  className="dt-input"
                  value={webdavDraft.remoteBaseUrl}
                  onChange={(event) => setWebdavDraft((prev) => ({ ...prev, remoteBaseUrl: event.target.value }))}
                  disabled={busy || testingWebdav}
                />

                <label className="block text-sm font-medium text-slate-700" htmlFor="onboarding-webdav-username">
                  {t('onboarding.webdavUsername')}
                </label>
                <input
                  id="onboarding-webdav-username"
                  className="dt-input"
                  value={webdavDraft.username}
                  onChange={(event) => setWebdavDraft((prev) => ({ ...prev, username: event.target.value }))}
                  disabled={busy || testingWebdav}
                />

                <label className="block text-sm font-medium text-slate-700" htmlFor="onboarding-webdav-password">
                  {t('onboarding.webdavPassword')}
                </label>
                <input
                  id="onboarding-webdav-password"
                  type="password"
                  className="dt-input"
                  value={webdavDraft.password}
                  onChange={(event) => setWebdavDraft((prev) => ({ ...prev, password: event.target.value }))}
                  disabled={busy || testingWebdav}
                />

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={webdavDraft.autoPullEnabled}
                    onChange={(event) => setWebdavDraft((prev) => ({ ...prev, autoPullEnabled: event.target.checked }))}
                    disabled={busy || testingWebdav}
                  />
                  {t('onboarding.webdavAutoPull')}
                </label>

                <label className="block text-sm font-medium text-slate-700" htmlFor="onboarding-webdav-interval">
                  {t('onboarding.webdavAutoPullInterval')}
                </label>
                <input
                  id="onboarding-webdav-interval"
                  type="number"
                  min={5}
                  className="dt-input"
                  value={webdavDraft.autoPullIntervalSec}
                  onChange={(event) => {
                    const next = Number.parseInt(event.target.value, 10)
                    setWebdavDraft((prev) => ({
                      ...prev,
                      autoPullIntervalSec: Number.isFinite(next) ? Math.max(5, next) : 30,
                    }))
                  }}
                  disabled={busy || testingWebdav}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="dt-btn dt-btn-secondary"
                    onClick={() => void handleTestWebdav()}
                    disabled={busy || testingWebdav}
                  >
                    {testingWebdav ? t('onboarding.webdavTesting') : t('onboarding.webdavTest')}
                  </button>
                  <button
                    type="button"
                    className="dt-btn dt-btn-primary"
                    onClick={() => void handleWebdavPullAndContinue()}
                    disabled={busy || testingWebdav}
                  >
                    {busy ? t('onboarding.webdavPulling') : t('onboarding.webdavPullAndContinue')}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                className="dt-btn dt-btn-secondary"
                onClick={() => setStep('userType')}
                disabled={busy || testingWebdav}
              >
                {t('onboarding.back')}
              </button>
              <button
                type="button"
                className="dt-btn dt-btn-secondary"
                onClick={() => void handleSkipExisting()}
                disabled={busy || testingWebdav}
              >
                {t('onboarding.skipForNow')}
              </button>
              {message ? <p className="text-sm text-rose-700">{message}</p> : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
