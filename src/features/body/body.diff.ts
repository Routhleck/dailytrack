import type { BodyNumericMetricKey, BodyRecord } from '../../types/tracker'

export const BODY_NUMERIC_METRIC_KEYS: BodyNumericMetricKey[] = [
  'weight',
  'waist',
  'bodyFat',
  'muscleMass',
  'chest',
  'hip',
]

export type BodyRecordDiff = {
  changedMetrics: Record<BodyNumericMetricKey, boolean>
  noteChanged: boolean
  hasAnyChange: boolean
}

export function diffBodyRecord(record: BodyRecord): BodyRecordDiff {
  const changedMetrics = BODY_NUMERIC_METRIC_KEYS.reduce<Record<BodyNumericMetricKey, boolean>>(
    (acc, key) => {
      acc[key] = record[key] != null
      return acc
    },
    {} as Record<BodyNumericMetricKey, boolean>,
  )

  const noteChanged = record.note.trim().length > 0
  const hasAnyMetricChange = BODY_NUMERIC_METRIC_KEYS.some((key) => changedMetrics[key])

  return {
    changedMetrics,
    noteChanged,
    hasAnyChange: hasAnyMetricChange || noteChanged,
  }
}

export function hasAnyBodyRecordChanges(records: BodyRecord[]): boolean {
  return records.some((record) => diffBodyRecord(record).hasAnyChange)
}

