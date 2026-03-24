import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'

import { PageHeader } from '../components/PageHeader'
import { useI18n } from '../features/i18n/I18nContext'
import {
  defaultReportProviderConfig,
  getReportProviderConfig,
  saveReportProviderConfig,
} from '../features/reports/reports.provider.service'
import { buildAndSaveAiReport, defaultReportTarget } from '../features/reports/reports.service'
import type { ReportPeriod, ReportProviderConfig } from '../features/reports/reports.types'
import { useDataRoot } from '../features/settings/DataRootContext'
import { listFiles, readTextFile } from '../lib/fs/fileApi'
import { joinPath } from '../lib/fs/pathApi'

export function ReportsPage() {
  const { t } = useI18n()
  const { dataRoot } = useDataRoot()
  const [config, setConfig] = useState<ReportProviderConfig>(defaultReportProviderConfig())
  const [savingConfig, setSavingConfig] = useState(false)
  const [period, setPeriod] = useState<ReportPeriod>('weekly')
  const [targetId, setTargetId] = useState(defaultReportTarget('weekly'))
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState('')
  const [weeklyReports, setWeeklyReports] = useState<string[]>([])
  const [monthlyReports, setMonthlyReports] = useState<string[]>([])

  const reportsDir = useMemo(() => {
    if (!dataRoot) {
      return null
    }
    return {
      weekly: joinPath(dataRoot, 'reports', 'weekly'),
      monthly: joinPath(dataRoot, 'reports', 'monthly'),
    }
  }, [dataRoot])

  const loadReportFiles = useCallback(async () => {
    if (!dataRoot || !reportsDir) {
      return
    }

    try {
      const [weekly, monthly] = await Promise.all([
        listFiles(dataRoot, reportsDir.weekly, 'md'),
        listFiles(dataRoot, reportsDir.monthly, 'md'),
      ])
      setWeeklyReports(weekly)
      setMonthlyReports(monthly)
    } catch {
      // keep empty list on read error
    }
  }, [dataRoot, reportsDir])

  useEffect(() => {
    if (!dataRoot) {
      return
    }

    setMessage('')
    void getReportProviderConfig(dataRoot)
      .then((next) => setConfig(next))
      .catch(() => setConfig(defaultReportProviderConfig()))
    void loadReportFiles()
  }, [dataRoot, loadReportFiles])

  useEffect(() => {
    setTargetId(defaultReportTarget(period))
  }, [period])

  async function handleSaveConfig(event: FormEvent) {
    event.preventDefault()
    if (!dataRoot) {
      setMessage(t('reports.dataRootNotReady'))
      return
    }

    setSavingConfig(true)
    setMessage('')
    try {
      const saved = await saveReportProviderConfig(dataRoot, config)
      setConfig(saved)
      setMessage(t('reports.providerSaved'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('reports.providerSaveFailed'))
    } finally {
      setSavingConfig(false)
    }
  }

  async function handleGenerate(event: FormEvent) {
    event.preventDefault()
    if (!dataRoot) {
      setMessage(t('reports.dataRootNotReady'))
      return
    }
    if (!config.baseUrl.trim() || !config.apiKey.trim() || !config.model.trim()) {
      setMessage(t('reports.providerIncomplete'))
      return
    }
    if (!targetId.trim()) {
      setMessage(t('reports.targetRequired'))
      return
    }

    setGenerating(true)
    setMessage('')
    try {
      const result = await buildAndSaveAiReport(dataRoot, config, {
        period,
        targetId: targetId.trim(),
      })
      setPreview(result.reportMarkdown)
      setMessage(t('reports.generatedAtPath', { path: result.reportPath }))
      await loadReportFiles()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('reports.generateFailed'))
    } finally {
      setGenerating(false)
    }
  }

  async function openExistingReport(reportPeriod: ReportPeriod, fileName: string) {
    if (!dataRoot || !reportsDir) {
      return
    }
    const dir = reportPeriod === 'weekly' ? reportsDir.weekly : reportsDir.monthly
    try {
      const raw = await readTextFile(dataRoot, joinPath(dir, fileName))
      setPreview(raw)
      setMessage(t('reports.loadedExisting', { name: fileName }))
    } catch {
      setMessage(t('reports.loadExistingFailed'))
    }
  }

  return (
    <section className="dt-page">
      <PageHeader title={t('reports.title')} description={t('reports.description')} />

      <form onSubmit={handleSaveConfig} className="dt-panel max-w-4xl space-y-3 p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('reports.providerConfig')}</h2>
        <p className="text-xs text-slate-500">{t('reports.providerHint')}</p>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('reports.providerName')}</span>
            <input
              className="dt-input"
              value={config.providerName}
              onChange={(event) => setConfig((prev) => ({ ...prev, providerName: event.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('reports.baseUrl')}</span>
            <input
              className="dt-input"
              value={config.baseUrl}
              onChange={(event) => setConfig((prev) => ({ ...prev, baseUrl: event.target.value }))}
              placeholder="https://api.openai.com/v1"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('reports.apiKey')}</span>
            <input
              type="password"
              className="dt-input"
              value={config.apiKey}
              onChange={(event) => setConfig((prev) => ({ ...prev, apiKey: event.target.value }))}
              placeholder="sk-..."
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('reports.model')}</span>
            <input
              className="dt-input"
              value={config.model}
              onChange={(event) => setConfig((prev) => ({ ...prev, model: event.target.value }))}
              placeholder="gpt-4o-mini"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('reports.temperature')}</span>
            <input
              type="number"
              min={0}
              max={2}
              step={0.1}
              className="dt-input"
              value={String(config.temperature)}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  temperature: Number.parseFloat(event.target.value) || 0,
                }))
              }
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={savingConfig}
          className="dt-btn dt-btn-secondary"
        >
          {savingConfig ? t('reports.savingProvider') : t('reports.saveProvider')}
        </button>
      </form>

      <form onSubmit={handleGenerate} className="dt-panel max-w-4xl space-y-3 p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('reports.generate')}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('reports.period')}</span>
            <select
              className="dt-input"
              value={period}
              onChange={(event) => setPeriod(event.target.value as ReportPeriod)}
              disabled={generating}
            >
              <option value="weekly">{t('reports.weekly')}</option>
              <option value="monthly">{t('reports.monthly')}</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{period === 'weekly' ? t('reports.targetWeek') : t('reports.targetMonth')}</span>
            <input
              className="dt-input"
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              placeholder={period === 'weekly' ? '2026-W12' : '2026-03'}
              disabled={generating}
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={generating}
          className="dt-btn dt-btn-primary"
        >
          {generating ? t('reports.generating') : t('reports.generateAndSave')}
        </button>
      </form>

      <article className="dt-panel max-w-4xl p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('reports.existingReports')}</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-700">{t('reports.weekly')}</h3>
            <ul className="space-y-1 text-sm">
              {weeklyReports.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    className="dt-link text-left"
                    onClick={() => void openExistingReport('weekly', name)}
                  >
                    {name}
                  </button>
                </li>
              ))}
              {weeklyReports.length === 0 ? <li className="text-slate-500">-</li> : null}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-700">{t('reports.monthly')}</h3>
            <ul className="space-y-1 text-sm">
              {monthlyReports.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    className="dt-link text-left"
                    onClick={() => void openExistingReport('monthly', name)}
                  >
                    {name}
                  </button>
                </li>
              ))}
              {monthlyReports.length === 0 ? <li className="text-slate-500">-</li> : null}
            </ul>
          </div>
        </div>
      </article>

      <article className="dt-panel max-w-4xl p-4">
        <h2 className="mb-3 text-base font-semibold text-slate-900">{t('reports.preview')}</h2>
        <textarea
          className="dt-input h-80 font-mono text-xs"
          value={preview}
          onChange={(event) => setPreview(event.target.value)}
        />
      </article>

      {message ? <p className="max-w-4xl break-all text-sm text-slate-700">{message}</p> : null}
    </section>
  )
}
