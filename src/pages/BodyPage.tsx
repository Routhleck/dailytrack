import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { MeasuredChartContainer } from '../components/MeasuredChartContainer'
import { PageHeader } from '../components/PageHeader'
import {
  applyKalmanToBodyRecords,
  filterBodyRecordsByRangeTyped,
  kalmanMetricDelta,
  metricDeltaFromLatest,
  type BodyChartRange,
} from '../features/body/body.analytics'
import { diffBodyRecord } from '../features/body/body.diff'
import {
  decimalInputStep,
  formatBodyMetricNumber,
  formatBodyMetricValue,
  metricLabelWithUnit,
} from '../features/body/body.format'
import { getBodyRecords, saveBodyRecords } from '../features/body/body.service'
import { useToast } from '../features/feedback/ToastContext'
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

const FORM_INTERACTION_GRACE_MS = 1800
const RESUME_POLL_GRACE_MS = 2200
const HIGHLIGHT_DURATION_MS = 2400
const BODY_CHART_RANGE_OPTIONS: {
  key: BodyChartRange
  labelKey: 'body.range7d' | 'body.range30d' | 'body.range90d' | 'body.rangeAll'
}[] = [
  { key: '7d', labelKey: 'body.range7d' },
  { key: '30d', labelKey: 'body.range30d' },
  { key: '90d', labelKey: 'body.range90d' },
  { key: 'all', labelKey: 'body.rangeAll' },
]

function parseNullableNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function nowMillis(): number {
  return Date.now()
}

function bodyRecordSignature(record: BodyRecord): string {
  return [
    record.date,
    record.weight ?? '',
    record.waist ?? '',
    record.bodyFat ?? '',
    record.muscleMass ?? '',
    record.chest ?? '',
    record.hip ?? '',
    record.note,
  ].join('|')
}

function sameBodyRecord(left: BodyRecord, right: BodyRecord): boolean {
  return (
    left.date === right.date
    && left.weight === right.weight
    && left.waist === right.waist
    && left.bodyFat === right.bodyFat
    && left.muscleMass === right.muscleMass
    && left.chest === right.chest
    && left.hip === right.hip
    && left.note === right.note
  )
}

function findSavedRecord(records: BodyRecord[], target: BodyRecord): BodyRecord | null {
  return records.find((item) => sameBodyRecord(item, target)) ?? null
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
  const { pushError, pushInfo, pushSuccess } = useToast()
  const { dataRoot } = useDataRoot()
  const { preferences, loading: preferencesLoading, updatePreferences } = usePreferences()

  const [records, setRecords] = useState<BodyRecord[]>([])
  const [form, setForm] = useState<FormState>(toFormState())
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [chartRange, setChartRange] = useState<BodyChartRange>('30d')
  const [highlightedSignature, setHighlightedSignature] = useState<string | null>(null)

  const recordsRef = useRef<BodyRecord[]>([])
  const editingIndexRef = useRef<number | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const dateInputRef = useRef<HTMLInputElement | null>(null)
  const syncingRef = useRef(false)
  const formFocusedRef = useRef(false)
  const lastFormInteractionAtRef = useRef(0)
  const resumePollAfterRef = useRef(0)
  const pushInfoRef = useRef(pushInfo)
  const tRef = useRef(t)
  useEffect(() => { pushInfoRef.current = pushInfo }, [pushInfo])
  useEffect(() => { tRef.current = t }, [t])

  function markFormInteraction() {
    lastFormInteractionAtRef.current = nowMillis()
  }

  function isFormInteracting(): boolean {
    if (formFocusedRef.current) {
      return true
    }

    const now = nowMillis()
    if (now < resumePollAfterRef.current) {
      return true
    }

    return now - lastFormInteractionAtRef.current < FORM_INTERACTION_GRACE_MS
  }

  useEffect(() => {
    recordsRef.current = records
  }, [records])

  useEffect(() => {
    editingIndexRef.current = editingIndex
  }, [editingIndex])

  useEffect(() => {
    if (!highlightedSignature) {
      return
    }

    const timer = window.setTimeout(() => {
      setHighlightedSignature(null)
    }, HIGHLIGHT_DURATION_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [highlightedSignature])

  useEffect(() => {
    resumePollAfterRef.current = nowMillis() + RESUME_POLL_GRACE_MS

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resumePollAfterRef.current = nowMillis() + RESUME_POLL_GRACE_MS
        return
      }

      formFocusedRef.current = false
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

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

  async function persist(nextRecords: BodyRecord[]): Promise<BodyRecord[] | null> {
    if (!dataRoot) {
      return null
    }

    try {
      const saved = await saveBodyRecords(dataRoot, nextRecords)
      setRecords(saved)
      setMessage('')
      pushSuccess(t('body.saved'))
      emitDataChanged({ scope: 'body' })
      return saved
    } catch {
      setMessage(t('body.saveFailed'))
      pushError(t('body.saveFailed'))
      return null
    }
  }

  useEffect(() => {
    if (!dataRoot) {
      return
    }

    const intervalMs = fallbackPollIntervalMs(preferences.sync.mode)

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return
      }
      if (editingIndexRef.current != null || syncingRef.current || isFormInteracting()) {
        return
      }

      syncingRef.current = true
      void getBodyRecords(dataRoot, { fresh: true })
        .then((latest) => {
          if (!areBodyRecordsEqual(recordsRef.current, latest)) {
            setRecords(latest)
            if (!isFormInteracting()) {
              pushInfoRef.current(tRef.current('body.updatedFromDisk'))
            }
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
  }, [dataRoot, preferences.sync.mode])

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
      pushError(t('body.dateRequired'))
      return
    }

    const nextRecords = [...records]
    if (editingIndex == null) {
      nextRecords.unshift(nextRecord)
    } else {
      nextRecords[editingIndex] = nextRecord
    }

    const savedRecords = await persist(nextRecords)
    if (savedRecords) {
      const savedRecord = findSavedRecord(savedRecords, nextRecord)
      if (savedRecord) {
        const signature = bodyRecordSignature(savedRecord)
        setHighlightedSignature(signature)

        const currentIndex = savedRecords.findIndex((record) => sameBodyRecord(record, savedRecord))
        const previous = currentIndex >= 0 ? savedRecords[currentIndex + 1] : undefined

        if (previous) {
          const summaryParts = enabledNumericMetrics
            .map((metric) => {
              const currentValue = savedRecord[metric.key]
              const previousValue = previous[metric.key]
              if (currentValue == null || previousValue == null) {
                return null
              }
              const delta = currentValue - previousValue
              if (delta === 0) {
                return null
              }
              const sign = delta > 0 ? '+' : ''
              const value = formatBodyMetricValue(delta, preferences.body.display[metric.key])
              return `${t(metric.labelKey)} ${sign}${value}`
            })
            .filter((part): part is string => Boolean(part))

          const summaryText =
            summaryParts.length > 0
              ? t('body.changeSummaryWithDelta', { summary: summaryParts.join(' · ') })
              : t('body.changeSummaryNoDelta')
          setMessage(summaryText)
          pushInfo(summaryText)
        } else {
          const summaryText = t('body.changeSummaryNoPrevious')
          setMessage(summaryText)
          pushInfo(summaryText)
        }
      }
    }
    setForm(toFormState())
    setEditingIndex(null)
  }

  async function handleDelete(index: number) {
    markFormInteraction()
    const nextRecords = records.filter((_, idx) => idx !== index)
    await persist(nextRecords)

    if (editingIndex === index) {
      setForm(toFormState())
      setEditingIndex(null)
      return
    }

    if (editingIndex != null && index < editingIndex) {
      setEditingIndex(editingIndex - 1)
    }
  }

  function beginEdit(index: number, record: BodyRecord) {
    markFormInteraction()
    setEditingIndex(index)
    setForm(toFormState(record))
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      dateInputRef.current?.focus()
    })
  }

  const chartData = useMemo(() => {
    const reversed = [...records].reverse()
    const kalmanData = applyKalmanToBodyRecords(reversed)
    return kalmanData.map((record) => ({
      ...record,
      _signature: bodyRecordSignature(record),
    }))
  }, [records])
  const rangedChartData = useMemo(
    () => filterBodyRecordsByRangeTyped(chartData, chartRange),
    [chartData, chartRange],
  )
  const showOnlyChanges = preferences.ui.showOnlyChanges.body
  const recordDiffs = useMemo(() => records.map((record) => diffBodyRecord(record)), [records])
  const enabledNumericMetrics = BODY_NUMERIC_METRICS.filter((metric) => preferences.body[metric.key])
  const metricDeltas = (() => {
    const next: Partial<Record<BodyNumericMetricKey, number | null>> = {}
    for (const metric of enabledNumericMetrics) {
      // Use Kalman-filtered delta if display mode is filtered
      if (preferences.body.weightDisplayMode === 'filtered') {
        next[metric.key] = kalmanMetricDelta(records, metric.key)
      } else {
        next[metric.key] = metricDeltaFromLatest(records, metric.key)
      }
    }
    return next
  })()
  const metricGoals = (() => {
    const next: Partial<Record<BodyNumericMetricKey, number | null>> = {}
    for (const metric of enabledNumericMetrics) {
      const goal = preferences.body.goals[metric.key]
      next[metric.key] = goal.enabled ? goal.value : null
    }
    return next
  })()
  const metricDomains = useMemo(() => {
    const next: Partial<Record<BodyNumericMetricKey, [number, number]>> = {}
    for (const metric of enabledNumericMetrics) {
      const values: number[] = []
      const kalmanKey = `kalman${metric.key.charAt(0).toUpperCase() + metric.key.slice(1)}`
      const goal = preferences.body.goals[metric.key]
      const goalValue = goal.enabled ? goal.value : null

      for (const record of rangedChartData) {
        // Raw value
        const raw = record[metric.key as keyof typeof record] as number | null
        if (raw != null) values.push(raw)
        // Kalman value (if showing filtered or both)
        if (preferences.body.weightDisplayMode !== 'raw') {
          const kalman = record[kalmanKey as keyof typeof record] as number | null
          if (kalman != null) values.push(kalman)
        }
      }

      // Include goal if set
      if (goalValue != null) {
        values.push(goalValue)
      }

      if (values.length === 0) {
        next[metric.key] = [0, 100] // fallback
      } else {
        const min = Math.min(...values)
        const max = Math.max(...values)
        const padding = (max - min) * 0.1 // 10% padding
        next[metric.key] = [
          Math.max(0, min - padding),
          max + padding,
        ]
      }
    }
    return next
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [enabledNumericMetrics, rangedChartData, preferences.body.goals, preferences.body.weightDisplayMode])
  const visibleNumericMetrics =
    showOnlyChanges
      ? enabledNumericMetrics.filter((metric) =>
        records.some((_, index) => recordDiffs[index].changedMetrics[metric.key]),
      )
      : enabledNumericMetrics
  const showNote = preferences.body.note
  const showNoteColumn = useMemo(
    () => showNote && (!showOnlyChanges || records.some((_, index) => recordDiffs[index].noteChanged)),
    [recordDiffs, records, showNote, showOnlyChanges],
  )
  const visibleRecordEntries = useMemo(
    () =>
      records
        .map((record, index) => ({
          record,
          index,
          diff: recordDiffs[index],
        }))
        .filter((entry) => !showOnlyChanges || entry.diff.hasAnyChange),
    [recordDiffs, records, showOnlyChanges],
  )
  const showNoChangesHint = showOnlyChanges && visibleRecordEntries.length === 0
  const selectedRangeLabelKey =
    BODY_CHART_RANGE_OPTIONS.find((option) => option.key === chartRange)?.labelKey ?? 'body.rangeAll'

  if (preferencesLoading) {
    return (
      <section>
        <PageHeader title={t('body.title')} description={t('body.loadingPreferences')} />
      </section>
    )
  }

  return (
    <section className="dt-page">
      <PageHeader
        title={t('body.title')}
        description={t('body.description')}
      />
      <label className="dt-badge gap-2">
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

      {enabledNumericMetrics.length > 0 ? (
        <article className="dt-panel-soft space-y-2 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-600">{t('body.chartRange')}</span>
            {BODY_CHART_RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`dt-btn px-2.5 py-1 text-xs ${
                  chartRange === option.key ? 'bg-slate-900 text-white' : 'dt-btn-secondary'
                }`}
                onClick={() => setChartRange(option.key)}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
          {enabledNumericMetrics.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-600">{t('body.weightDisplayMode')}</span>
              {(['filtered', 'raw', 'both'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`dt-btn px-2.5 py-1 text-xs ${
                    preferences.body.weightDisplayMode === mode ? 'bg-slate-900 text-white' : 'dt-btn-secondary'
                  }`}
                  onClick={() => {
                    void updatePreferences({
                      ...preferences,
                      body: {
                        ...preferences.body,
                        weightDisplayMode: mode,
                      },
                    })
                  }}
                >
                  {t(`body.weightDisplayMode.${mode}`)}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {enabledNumericMetrics.map((metric) => {
              const delta = metricDeltas[metric.key]
              const deltaText =
                delta == null
                  ? t('body.deltaNotAvailable')
                  : `${delta > 0 ? '+' : ''}${formatBodyMetricValue(
                    delta,
                    preferences.body.display[metric.key],
                  )}`
              return (
                <span key={metric.key} className="dt-badge">
                  {t('body.deltaFromPrevious', {
                    metric: metricLabelWithUnit(t(metric.labelKey), preferences.body.display[metric.key]),
                    delta: deltaText,
                  })}
                </span>
              )
            })}
          </div>
        </article>
      ) : null}

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="dt-panel-soft grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-4"
      >
        <input
          ref={dateInputRef}
          className="dt-input"
          type="date"
          value={form.date}
          onFocus={() => {
            formFocusedRef.current = true
            markFormInteraction()
          }}
          onBlur={() => {
            formFocusedRef.current = false
            markFormInteraction()
          }}
          onChange={(event) => {
            markFormInteraction()
            setForm((prev) => ({ ...prev, date: event.target.value }))
          }}
          required
        />

        {enabledNumericMetrics.map((metric) => (
          <input
            key={metric.key}
            className="dt-input"
            type="number"
            step={decimalInputStep(preferences.body.display[metric.key].decimals)}
            placeholder={metricLabelWithUnit(t(metric.labelKey), preferences.body.display[metric.key])}
            value={form[metric.key]}
            onFocus={() => {
              formFocusedRef.current = true
              markFormInteraction()
            }}
            onBlur={() => {
              formFocusedRef.current = false
              markFormInteraction()
            }}
            onChange={(event) => {
              markFormInteraction()
              const nextValue = event.target.value
              setForm((prev) => ({ ...prev, [metric.key]: nextValue }))
            }}
          />
        ))}

        {showNote ? (
          <input
            className="dt-input sm:col-span-2 lg:col-span-2"
            placeholder={t('body.note')}
            value={form.note}
            onFocus={() => {
              formFocusedRef.current = true
              markFormInteraction()
            }}
            onBlur={() => {
              formFocusedRef.current = false
              markFormInteraction()
            }}
            onChange={(event) => {
              markFormInteraction()
              setForm((prev) => ({ ...prev, note: event.target.value }))
            }}
          />
        ) : null}

        <div className="col-span-full flex flex-wrap items-center gap-2">
          <button className="dt-btn dt-btn-primary w-full sm:w-auto" type="submit">
            {editingIndex == null ? t('body.addRecord') : t('body.updateRecord')}
          </button>
          {editingIndex != null ? (
            <button
              type="button"
              className="dt-btn dt-btn-secondary w-full sm:w-auto"
              onClick={() => {
                markFormInteraction()
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
            <article key={metric.key} className="dt-panel min-w-0 overflow-hidden p-3 sm:p-4">
              <div className="mb-2 flex items-center justify-between sm:mb-3">
                <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
                  {metricLabelWithUnit(t(metric.trendLabelKey), preferences.body.display[metric.key])}
                </h2>
                <span className="dt-badge">{t(selectedRangeLabelKey)}</span>
              </div>
              <MeasuredChartContainer className="h-44 min-w-0 sm:h-52 md:h-56">
                {({ width, height }) => (
                  <LineChart width={width} height={height} data={rangedChartData} margin={{ top: 8, right: 12, left: 6, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} interval="preserveStartEnd" />
                    <YAxis
                      width={48}
                      domain={metricDomains[metric.key]}
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
                    {metricGoals[metric.key] != null ? (
                      <ReferenceLine
                        y={metricGoals[metric.key] as number}
                        stroke="#f59e0b"
                        strokeDasharray="5 4"
                        ifOverflow="extendDomain"
                      />
                    ) : null}
                    <Line
                      type="monotone"
                      dataKey={
                        preferences.body.weightDisplayMode === 'filtered'
                          ? `kalman${metric.key.charAt(0).toUpperCase() + metric.key.slice(1)}`
                          : metric.key
                      }
                      stroke={metric.stroke}
                      strokeWidth={2}
                      dot={({ cx, cy, payload }) => {
                        if (
                          highlightedSignature
                          && payload
                          && typeof payload === 'object'
                          && (payload as { _signature?: string })._signature === highlightedSignature
                          && typeof cx === 'number'
                          && typeof cy === 'number'
                        ) {
                          return <circle cx={cx} cy={cy} r={4.5} fill={metric.stroke} stroke="#ffffff" strokeWidth={2} />
                        }
                        return null
                      }}
                    />
                    {preferences.body.weightDisplayMode === 'both' ? (
                      <Line
                        type="monotone"
                        dataKey={`kalman${metric.key.charAt(0).toUpperCase() + metric.key.slice(1)}`}
                        stroke="#888888"
                        strokeWidth={1.5}
                        strokeDasharray="5 4"
                        dot={false}
                      />
                    ) : null}
                  </LineChart>
                )}
              </MeasuredChartContainer>
            </article>
          ))}
        </div>
      ) : !showNote ? (
        <article className="dt-panel p-4 text-sm text-slate-600">
          {t('body.allDisabled')}
        </article>
      ) : null}

      <article className="dt-panel p-4">
        <h2 className="mb-3 text-base font-semibold text-slate-900">{t('body.history')}</h2>
        {visibleRecordEntries.length === 0 ? (
          <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-sm font-medium text-slate-800">{t('body.noRecords')}</p>
            <p className="mt-1 text-xs text-slate-600">{t('body.noRecordsHint')}</p>
          </div>
        ) : null}

        <div className="space-y-3 md:hidden">
          {visibleRecordEntries.map((entry) => (
            <div
              key={`${entry.record.date}-${entry.index}`}
              className={`dt-panel-soft p-3 text-sm ${
                bodyRecordSignature(entry.record) === highlightedSignature
                  ? 'ring-2 ring-amber-300/70'
                  : ''
              }`}
            >
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
                  className="dt-btn dt-btn-secondary px-2 py-1 text-xs"
                  onClick={() => beginEdit(entry.index, entry.record)}
                  type="button"
                >
                  {t('common.edit')}
                </button>
                <button
                  className="dt-btn dt-btn-danger px-2 py-1 text-xs"
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
                <tr
                  key={`${entry.record.date}-${entry.index}`}
                  className={`border-b border-slate-100 ${
                    bodyRecordSignature(entry.record) === highlightedSignature
                      ? 'bg-amber-50/60'
                      : ''
                  }`}
                >
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
                        className="dt-btn dt-btn-secondary px-2 py-1 text-xs"
                        onClick={() => beginEdit(entry.index, entry.record)}
                        type="button"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        className="dt-btn dt-btn-danger px-2 py-1 text-xs"
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
