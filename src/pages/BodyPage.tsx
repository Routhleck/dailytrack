import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { MeasuredChartContainer } from '../components/MeasuredChartContainer'
import { PageHeader } from '../components/PageHeader'
import { diffBodyRecord } from '../features/body/body.diff'
import {
  decimalInputStep,
  formatBodyMetricNumber,
  formatBodyMetricValue,
  metricLabelWithUnit,
} from '../features/body/body.format'
import { getBodyRecords, saveBodyRecords } from '../features/body/body.service'
import { useI18n } from '../features/i18n/I18nContext'
import { usePreferences } from '../features/preferences/PreferencesContext'
import { useDataRoot } from '../features/settings/DataRootContext'
import { todayDateString } from '../lib/date/date'
import { emitDataChanged, fallbackPollIntervalMs } from '../lib/liveSync'
import type { BodyNumericMetricKey, BodyRecord } from '../types/tracker'

const BODY_NUMERIC_METRICS: {
  key: BodyNumericMetricKey
  labelKey:
    | 'body.weight'
    | 'body.waist'
    | 'body.bodyFat'
    | 'body.muscleMass'
    | 'body.chest'
    | 'body.hip'
  trendLabelKey:
    | 'body.weightTrend'
    | 'body.waistTrend'
    | 'body.bodyFatTrend'
    | 'body.muscleMassTrend'
    | 'body.chestTrend'
    | 'body.hipTrend'
  stroke: string
}[] = [
  { key: 'weight', labelKey: 'body.weight', trendLabelKey: 'body.weightTrend', stroke: '#0f766e' },
  { key: 'waist', labelKey: 'body.waist', trendLabelKey: 'body.waistTrend', stroke: '#334155' },
  { key: 'bodyFat', labelKey: 'body.bodyFat', trendLabelKey: 'body.bodyFatTrend', stroke: '#dc2626' },
  {
    key: 'muscleMass',
    labelKey: 'body.muscleMass',
    trendLabelKey: 'body.muscleMassTrend',
    stroke: '#7c3aed',
  },
  { key: 'chest', labelKey: 'body.chest', trendLabelKey: 'body.chestTrend', stroke: '#2563eb' },
  { key: 'hip', labelKey: 'body.hip', trendLabelKey: 'body.hipTrend', stroke: '#ca8a04' },
]

type FormState = {
  date: string
  weight: string
  waist: string
  bodyFat: string
  muscleMass: string
  chest: string
  hip: string
  note: string
}

function parseNullableNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function toFormState(record?: BodyRecord): FormState {
  if (!record) {
    return {
      date: todayDateString(),
      weight: '',
      waist: '',
      bodyFat: '',
      muscleMass: '',
      chest: '',
      hip: '',
      note: '',
    }
  }

  return {
    date: record.date,
    weight: record.weight == null ? '' : String(record.weight),
    waist: record.waist == null ? '' : String(record.waist),
    bodyFat: record.bodyFat == null ? '' : String(record.bodyFat),
    muscleMass: record.muscleMass == null ? '' : String(record.muscleMass),
    chest: record.chest == null ? '' : String(record.chest),
    hip: record.hip == null ? '' : String(record.hip),
    note: record.note,
  }
}

function areBodyRecordsEqual(left: BodyRecord[], right: BodyRecord[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    const current = left[index]
    const next = right[index]
    if (
      current.date !== next.date ||
      current.weight !== next.weight ||
      current.waist !== next.waist ||
      current.bodyFat !== next.bodyFat ||
      current.muscleMass !== next.muscleMass ||
      current.chest !== next.chest ||
      current.hip !== next.hip ||
      current.note !== next.note
    ) {
      return false
    }
  }

  return true
}

export function BodyPage() {
  const { t } = useI18n()
  const { dataRoot } = useDataRoot()
  const { preferences, loading: preferencesLoading, updatePreferences } = usePreferences()

  const [records, setRecords] = useState<BodyRecord[]>([])
  const [form, setForm] = useState<FormState>(toFormState())
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  const recordsRef = useRef<BodyRecord[]>([])
  const editingIndexRef = useRef<number | null>(null)
  const syncingRef = useRef(false)

  useEffect(() => {
    recordsRef.current = records
  }, [records])

  useEffect(() => {
    editingIndexRef.current = editingIndex
  }, [editingIndex])

  useEffect(() => {
    if (!dataRoot) {
      return
    }

    void getBodyRecords(dataRoot)
      .then((items) => {
        setRecords(items)
      })
      .catch(() => setMessage(t('body.loadFailed')))
  }, [dataRoot, t])

  async function persist(nextRecords: BodyRecord[]) {
    if (!dataRoot) {
      return
    }

    try {
      const saved = await saveBodyRecords(dataRoot, nextRecords)
      setRecords(saved)
      setMessage(t('body.saved'))
      emitDataChanged({ scope: 'body' })
    } catch {
      setMessage(t('body.saveFailed'))
    }
  }

  useEffect(() => {
    if (!dataRoot) {
      return
    }

    const intervalMs = fallbackPollIntervalMs(preferences.sync.mode)

    const timer = window.setInterval(() => {
      if (editingIndexRef.current != null || syncingRef.current) {
        return
      }

      syncingRef.current = true
      void getBodyRecords(dataRoot)
        .then((latest) => {
          if (!areBodyRecordsEqual(recordsRef.current, latest)) {
            setRecords(latest)
            setMessage(t('body.updatedFromDisk'))
          }
        })
        .catch((error) => {
          console.warn('[body] failed to poll records from disk', error)
        })
        .finally(() => {
          syncingRef.current = false
        })
    }, intervalMs)

    return () => {
      window.clearInterval(timer)
    }
  }, [dataRoot, preferences.sync.mode, t])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const editingRecord = editingIndex == null ? undefined : records[editingIndex]

    const nextRecord: BodyRecord = {
      date: form.date,
      weight: preferences.body.weight
        ? parseNullableNumber(form.weight)
        : (editingRecord?.weight ?? null),
      waist: preferences.body.waist
        ? parseNullableNumber(form.waist)
        : (editingRecord?.waist ?? null),
      bodyFat: preferences.body.bodyFat
        ? parseNullableNumber(form.bodyFat)
        : (editingRecord?.bodyFat ?? null),
      muscleMass: preferences.body.muscleMass
        ? parseNullableNumber(form.muscleMass)
        : (editingRecord?.muscleMass ?? null),
      chest: preferences.body.chest
        ? parseNullableNumber(form.chest)
        : (editingRecord?.chest ?? null),
      hip: preferences.body.hip
        ? parseNullableNumber(form.hip)
        : (editingRecord?.hip ?? null),
      note: preferences.body.note ? form.note.trim() : (editingRecord?.note ?? ''),
    }

    if (!nextRecord.date) {
      setMessage(t('body.dateRequired'))
      return
    }

    const nextRecords = [...records]
    if (editingIndex == null) {
      nextRecords.unshift(nextRecord)
    } else {
      nextRecords[editingIndex] = nextRecord
    }

    await persist(nextRecords)
    setForm(toFormState())
    setEditingIndex(null)
  }

  async function handleDelete(index: number) {
    const nextRecords = records.filter((_, idx) => idx !== index)
    await persist(nextRecords)

    if (editingIndex === index) {
      setForm(toFormState())
      setEditingIndex(null)
    }
  }

  const chartData = useMemo(() => [...records].reverse(), [records])
  const showOnlyChanges = preferences.ui.showOnlyChanges.body
  const recordDiffs = useMemo(() => records.map((record) => diffBodyRecord(record)), [records])

  if (preferencesLoading) {
    return (
      <section>
        <PageHeader title={t('body.title')} description={t('body.loadingPreferences')} />
      </section>
    )
  }

  const enabledNumericMetrics = BODY_NUMERIC_METRICS.filter((metric) => preferences.body[metric.key])
  const visibleNumericMetrics = showOnlyChanges
    ? enabledNumericMetrics.filter((metric) =>
      records.some((_, index) => recordDiffs[index].changedMetrics[metric.key]),
    )
    : enabledNumericMetrics
  const showNote = preferences.body.note
  const showNoteColumn = showNote && (!showOnlyChanges || records.some((_, index) => recordDiffs[index].noteChanged))
  const visibleRecordEntries = records
    .map((record, index) => ({
      record,
      index,
      diff: recordDiffs[index],
    }))
    .filter((entry) => !showOnlyChanges || entry.diff.hasAnyChange)
  const showNoChangesHint = showOnlyChanges && visibleRecordEntries.length === 0

  return (
    <section className="min-w-0 space-y-4 md:space-y-6">
      <PageHeader
        title={t('body.title')}
        description={t('body.description')}
      />
      <label className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700">
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
                  body: event.target.checked,
                },
              },
            })
          }}
        />
        {t('sync.showOnlyChanges')}
      </label>
      {showNoChangesHint ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {t('common.noTemplateChanges')}
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-4"
      >
        <input
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          type="date"
          value={form.date}
          onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
          required
        />

        {enabledNumericMetrics.map((metric) => (
          <input
            key={metric.key}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            type="number"
            step={decimalInputStep(preferences.body.display[metric.key].decimals)}
            placeholder={metricLabelWithUnit(t(metric.labelKey), preferences.body.display[metric.key])}
            value={form[metric.key]}
            onChange={(event) => {
              const nextValue = event.target.value
              setForm((prev) => ({ ...prev, [metric.key]: nextValue }))
            }}
          />
        ))}

        {showNote ? (
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2 lg:col-span-2"
            placeholder={t('body.note')}
            value={form.note}
            onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
          />
        ) : null}

        <div className="col-span-full flex flex-wrap items-center gap-2">
          <button className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white sm:w-auto" type="submit">
            {editingIndex == null ? t('body.addRecord') : t('body.updateRecord')}
          </button>
          {editingIndex != null ? (
            <button
              type="button"
              className="w-full rounded-md bg-slate-300 px-4 py-2 text-sm text-slate-800 sm:w-auto"
              onClick={() => {
                setEditingIndex(null)
                setForm(toFormState())
              }}
            >
              {t('common.cancelEdit')}
            </button>
          ) : null}
          {message ? <span className="w-full text-sm text-slate-600 sm:w-auto">{message}</span> : null}
        </div>
      </form>

      {visibleNumericMetrics.length > 0 ? (
        <div className={`grid min-w-0 gap-3 md:gap-4 ${visibleNumericMetrics.length > 1 ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
          {visibleNumericMetrics.map((metric) => (
            <article key={metric.key} className="min-w-0 overflow-hidden rounded-lg border border-slate-200 p-3 sm:p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-900 sm:mb-3 sm:text-base">
                {metricLabelWithUnit(t(metric.trendLabelKey), preferences.body.display[metric.key])}
              </h2>
              <MeasuredChartContainer className="h-44 min-w-0 sm:h-52 md:h-56">
                {({ width, height }) => (
                  <LineChart width={width} height={height} data={chartData} margin={{ top: 8, right: 12, left: 6, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} interval="preserveStartEnd" />
                    <YAxis
                      width={48}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => {
                        const numeric = Number(value)
                        if (!Number.isFinite(numeric)) {
                          return '-'
                        }
                        return formatBodyMetricNumber(numeric, preferences.body.display[metric.key])
                      }}
                    />
                    <Tooltip
                      formatter={(value) => {
                        const parsed =
                          typeof value === 'number'
                            ? value
                            : Number.parseFloat(String(value))
                        if (!Number.isFinite(parsed)) {
                          return '-'
                        }
                        return formatBodyMetricValue(parsed, preferences.body.display[metric.key])
                      }}
                    />
                    <Line type="monotone" dataKey={metric.key} stroke={metric.stroke} strokeWidth={2} dot={false} />
                  </LineChart>
                )}
              </MeasuredChartContainer>
            </article>
          ))}
        </div>
      ) : !showNote ? (
        <article className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
          {t('body.allDisabled')}
        </article>
      ) : null}

      <article className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-base font-semibold text-slate-900">{t('body.history')}</h2>

        <div className="space-y-3 md:hidden">
          {visibleRecordEntries.map((entry) => (
            <div key={`${entry.record.date}-${entry.index}`} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-900">{entry.record.date}</p>
              <div className="mt-1 space-y-1 text-slate-700">
                {visibleNumericMetrics
                  .filter((metric) => !showOnlyChanges || entry.diff.changedMetrics[metric.key])
                  .map((metric) => (
                    <p key={metric.key}>
                      {metricLabelWithUnit(t(metric.labelKey), preferences.body.display[metric.key])}:{' '}
                      {formatBodyMetricValue(entry.record[metric.key], preferences.body.display[metric.key])}
                    </p>
                  ))}
                {showNoteColumn && (!showOnlyChanges || entry.diff.noteChanged) ? <p>{t('body.note')}: {entry.record.note || '-'}</p> : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-700"
                  onClick={() => {
                    setEditingIndex(entry.index)
                    setForm(toFormState(entry.record))
                  }}
                  type="button"
                >
                  {t('common.edit')}
                </button>
                <button
                  className="rounded bg-rose-100 px-2 py-1 text-xs text-rose-700"
                  onClick={() => void handleDelete(entry.index)}
                  type="button"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-auto md:block">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2">{t('body.date')}</th>
                {visibleNumericMetrics.map((metric) => (
                  <th key={metric.key} className="py-2">
                    {metricLabelWithUnit(t(metric.labelKey), preferences.body.display[metric.key])}
                  </th>
                ))}
                {showNoteColumn ? <th className="py-2">{t('body.note')}</th> : null}
                <th className="py-2">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecordEntries.map((entry) => (
                <tr key={`${entry.record.date}-${entry.index}`} className="border-b border-slate-100">
                  <td className="py-2">{entry.record.date}</td>
                  {visibleNumericMetrics.map((metric) => (
                    <td key={metric.key} className="py-2">
                      {!showOnlyChanges || entry.diff.changedMetrics[metric.key]
                        ? formatBodyMetricValue(entry.record[metric.key], preferences.body.display[metric.key])
                        : '-'}
                    </td>
                  ))}
                  {showNoteColumn ? <td className="py-2">{!showOnlyChanges || entry.diff.noteChanged ? (entry.record.note || '-') : '-'}</td> : null}
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button
                        className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-700"
                        onClick={() => {
                          setEditingIndex(entry.index)
                          setForm(toFormState(entry.record))
                        }}
                        type="button"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        className="rounded bg-rose-100 px-2 py-1 text-xs text-rose-700"
                        onClick={() => void handleDelete(entry.index)}
                        type="button"
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

    </section>
  )
}

