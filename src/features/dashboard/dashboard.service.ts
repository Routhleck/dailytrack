import type { BodyRecord, CheckboxItem } from '../../types/tracker'

export type ProgressSummary = {
  checked: number
  total: number
  percent: number
}

export function summarizeChecklist(items: CheckboxItem[]): ProgressSummary {
  const total = items.length
  const checked = items.filter((item) => item.checked).length
  const percent = total === 0 ? 0 : Math.round((checked / total) * 100)

  return { checked, total, percent }
}

export function latestBodyRecord(records: BodyRecord[]): BodyRecord | null {
  return records.length > 0 ? records[0] : null
}
