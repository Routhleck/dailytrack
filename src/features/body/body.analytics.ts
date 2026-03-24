import type { BodyNumericMetricKey, BodyRecord } from '../../types/tracker'

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
