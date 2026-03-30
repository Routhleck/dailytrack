import type { BodyNumericMetricKey, BodyRecord } from '../../types/tracker'
import { applyKalmanFilterToSeries } from '../../utils/kalmanFilter'

export type BodyChartRange = '7d' | '30d' | '90d' | 'all'

const DAY_MS = 24 * 60 * 60 * 1000

const RANGE_DAYS: Record<Exclude<BodyChartRange, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

function parseDate(date: string): number | null {
  const timestamp = Date.parse(date)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function filterBodyRecordsByRange(
  records: BodyRecord[],
  range: BodyChartRange,
): BodyRecord[] {
  if (range === 'all' || records.length === 0) {
    return records
  }

  const timestamps = records.map((record) => parseDate(record.date))
  const latestTimestamp = timestamps.reduce<number | null>((latest, current) => {
    if (current == null) {
      return latest
    }
    if (latest == null) {
      return current
    }
    return current > latest ? current : latest
  }, null)

  if (latestTimestamp == null) {
    return records
  }

  const rangeDays = RANGE_DAYS[range]
  const cutoff = latestTimestamp - (rangeDays - 1) * DAY_MS

  return records.filter((_, index) => {
    const timestamp = timestamps[index]
    if (timestamp == null) {
      return false
    }
    return timestamp >= cutoff
  })
}

export function filterBodyRecordsByRangeTyped<T extends BodyRecord>(
  records: T[],
  range: BodyChartRange,
): T[] {
  return filterBodyRecordsByRange(records, range) as T[]
}

export function metricDeltaFromLatest(
  recordsDesc: BodyRecord[],
  metric: BodyNumericMetricKey,
): number | null {
  if (recordsDesc.length < 2) {
    return null
  }

  const latest = recordsDesc[0][metric]
  const previous = recordsDesc[1][metric]

  if (latest == null || previous == null) {
    return null
  }

  return latest - previous
}

export type BodyRecordWithKalman = BodyRecord & {
  kalmanWeight: number | null
  kalmanWaist: number | null
  kalmanBodyFat: number | null
  kalmanMuscleMass: number | null
  kalmanChest: number | null
  kalmanHip: number | null
}

const KALMAN_Q = 0.1 // Process noise - true value changes slowly
const KALMAN_R = 1.0 // Measurement noise - scale/body meter accuracy

const KALMAN_METRIC_KEYS: BodyNumericMetricKey[] = [
  'weight',
  'waist',
  'bodyFat',
  'muscleMass',
  'chest',
  'hip',
]

/**
 * Apply Kalman filter to all body metrics.
 * Records should be sorted by date descending (most recent first).
 * Returns records with kalman* fields containing the filtered estimates.
 */
export function applyKalmanToBodyRecords(
  records: BodyRecord[],
): BodyRecordWithKalman[] {
  if (records.length === 0) {
    return []
  }

  // Records are sorted desc by date, but Kalman filter needs oldest first
  const recordsAsc = [...records].reverse()

  // Apply Kalman filter per metric and collect results
  const kalmanResults: Record<BodyNumericMetricKey, (number | null)[]> = {
    weight: [],
    waist: [],
    bodyFat: [],
    muscleMass: [],
    chest: [],
    hip: [],
  }

  for (const metricKey of KALMAN_METRIC_KEYS) {
    const values = recordsAsc.map((r) => r[metricKey])
    kalmanResults[metricKey] = applyKalmanFilterToSeries(values, { q: KALMAN_Q, r: KALMAN_R })
  }

  // Build result records
  return recordsAsc
    .map((record, i) => ({
      ...record,
      kalmanWeight: kalmanResults.weight[i],
      kalmanWaist: kalmanResults.waist[i],
      kalmanBodyFat: kalmanResults.bodyFat[i],
      kalmanMuscleMass: kalmanResults.muscleMass[i],
      kalmanChest: kalmanResults.chest[i],
      kalmanHip: kalmanResults.hip[i],
    }))
    .reverse() as BodyRecordWithKalman[] // Back to desc order
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Get the Kalman-filtered delta for a specific metric between latest two records.
 */
export function kalmanMetricDelta(
  recordsDesc: BodyRecord[],
  metric: BodyNumericMetricKey,
): number | null {
  if (recordsDesc.length < 2) {
    return null
  }

  const withKalman = applyKalmanToBodyRecords(recordsDesc)
  const latest = withKalman[0][`kalman${capitalize(metric)}` as keyof BodyRecordWithKalman] as number | null
  const previous = withKalman[1][`kalman${capitalize(metric)}` as keyof BodyRecordWithKalman] as number | null

  if (latest == null || previous == null) {
    return null
  }

  return latest - previous
}
