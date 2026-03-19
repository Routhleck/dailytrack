import type { BodyMetricDisplay } from '../../types/preferences'
import type { BodyNumericMetricKey } from '../../types/tracker'

export const BODY_NUMERIC_METRIC_KEYS: BodyNumericMetricKey[] = [
  'weight',
  'waist',
  'bodyFat',
  'muscleMass',
  'chest',
  'hip',
]

const MIN_DECIMALS = 0
const MAX_DECIMALS = 3
const MAX_UNIT_LENGTH = 12

export const DEFAULT_BODY_METRIC_DISPLAY: Record<BodyNumericMetricKey, BodyMetricDisplay> = {
  weight: { unit: 'kg', decimals: 1 },
  waist: { unit: 'cm', decimals: 1 },
  bodyFat: { unit: '%', decimals: 1 },
  muscleMass: { unit: 'kg', decimals: 1 },
  chest: { unit: 'cm', decimals: 1 },
  hip: { unit: 'cm', decimals: 1 },
}

export function cloneDefaultBodyMetricDisplay(): Record<BodyNumericMetricKey, BodyMetricDisplay> {
  return BODY_NUMERIC_METRIC_KEYS.reduce<Record<BodyNumericMetricKey, BodyMetricDisplay>>((acc, key) => {
    acc[key] = { ...DEFAULT_BODY_METRIC_DISPLAY[key] }
    return acc
  }, {} as Record<BodyNumericMetricKey, BodyMetricDisplay>)
}

function normalizeUnit(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  return trimmed.slice(0, MAX_UNIT_LENGTH)
}

function normalizeDecimals(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  const rounded = Math.round(value)
  return Math.min(MAX_DECIMALS, Math.max(MIN_DECIMALS, rounded))
}

export function normalizeBodyMetricDisplay(
  raw: unknown,
  fallback: BodyMetricDisplay,
): BodyMetricDisplay {
  const object = typeof raw === 'object' && raw ? (raw as Record<string, unknown>) : {}
  return {
    unit: normalizeUnit(object.unit, fallback.unit),
    decimals: normalizeDecimals(object.decimals, fallback.decimals),
  }
}

export function formatBodyMetricNumber(value: number, display: BodyMetricDisplay): string {
  return value.toFixed(display.decimals)
}

export function formatBodyMetricValue(
  value: number | null,
  display: BodyMetricDisplay,
): string {
  if (value == null) {
    return '-'
  }

  const formatted = formatBodyMetricNumber(value, display)
  return display.unit ? `${formatted} ${display.unit}` : formatted
}

export function metricLabelWithUnit(label: string, display: BodyMetricDisplay): string {
  if (!display.unit) {
    return label
  }
  return `${label} (${display.unit})`
}

export function decimalInputStep(decimals: number): string {
  if (decimals <= 0) {
    return '1'
  }

  return `0.${'0'.repeat(Math.max(0, decimals - 1))}1`
}
