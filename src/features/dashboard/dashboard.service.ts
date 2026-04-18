import type { BodyRecord, CheckboxItem, WeeklySectionKey } from '../../types/tracker'

export type ProgressSummary = {
  checked: number
  total: number
  percent: number
}

export type QuantifiedSummary = ProgressSummary & {
  totalCount: number
  checkedCount: number
}

export type ProgressTrend = 'up' | 'down' | 'flat' | 'na'

export type ProgressComparison = {
  previousPercent: number | null
  deltaPercent: number | null
  trend: ProgressTrend
}

export type SectionProgressSummary = {
  section: WeeklySectionKey
  summary: ProgressSummary
}

export function summarizeChecklist(items: CheckboxItem[]): ProgressSummary {
  const total = items.length
  const checked = items.filter((item) => item.checked).length
  const percent = total === 0 ? 0 : Math.round((checked / total) * 100)

  return { checked, total, percent }
}

export function getQuantifiedStats(items: CheckboxItem[]): QuantifiedSummary {
  const summary = summarizeChecklist(items)
  const quantifiedItems = items.filter((item) => item.count !== undefined)
  const totalCount = quantifiedItems.reduce((sum, item) => sum + (item.count ?? 0), 0)
  const checkedCount = quantifiedItems
    .filter((item) => item.checked)
    .reduce((sum, item) => sum + (item.count ?? 0), 0)

  return {
    ...summary,
    totalCount,
    checkedCount,
  }
}

export function isChecklistComplete(summary: ProgressSummary): boolean {
  return summary.total > 0 && summary.checked === summary.total
}

export function compareProgress(current: ProgressSummary, previous: ProgressSummary | null): ProgressComparison {
  if (!previous) {
    return {
      previousPercent: null,
      deltaPercent: null,
      trend: 'na',
    }
  }

  const delta = current.percent - previous.percent
  if (delta > 0) {
    return {
      previousPercent: previous.percent,
      deltaPercent: delta,
      trend: 'up',
    }
  }
  if (delta < 0) {
    return {
      previousPercent: previous.percent,
      deltaPercent: delta,
      trend: 'down',
    }
  }

  return {
    previousPercent: previous.percent,
    deltaPercent: delta,
    trend: 'flat',
  }
}

export function findWeakestSection(sectionSummaries: SectionProgressSummary[]): SectionProgressSummary | null {
  return sectionSummaries
    .filter((item) => item.summary.total > 0)
    .sort((left, right) => left.summary.percent - right.summary.percent)[0] ?? null
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const ONE_WEEK_MS = 7 * ONE_DAY_MS

function parseIsoDateUtcMs(isoDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return null
  }
  const timestamp = Date.parse(`${isoDate}T00:00:00Z`)
  return Number.isFinite(timestamp) ? timestamp : null
}

function weekIdToMondayUtcMs(weekId: string): number | null {
  const matched = weekId.match(/^(\d{4})-W(\d{2})$/)
  if (!matched) {
    return null
  }

  const year = Number.parseInt(matched[1], 10)
  const week = Number.parseInt(matched[2], 10)
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) {
    return null
  }

  const jan4 = new Date(Date.UTC(year, 0, 4))
  const day = jan4.getUTCDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - day + 1)

  const targetMonday = new Date(week1Monday)
  targetMonday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7)

  return targetMonday.getTime()
}

export function isPreviousIsoDate(referenceIsoDate: string, candidateIsoDate: string): boolean {
  const reference = parseIsoDateUtcMs(referenceIsoDate)
  const candidate = parseIsoDateUtcMs(candidateIsoDate)
  if (reference == null || candidate == null) {
    return false
  }
  return reference - candidate === ONE_DAY_MS
}

export function diffIsoDateDays(referenceIsoDate: string, candidateIsoDate: string): number | null {
  const reference = parseIsoDateUtcMs(referenceIsoDate)
  const candidate = parseIsoDateUtcMs(candidateIsoDate)
  if (reference == null || candidate == null) {
    return null
  }
  return Math.floor((reference - candidate) / ONE_DAY_MS)
}

export function isPreviousWeekId(referenceWeekId: string, candidateWeekId: string): boolean {
  const reference = weekIdToMondayUtcMs(referenceWeekId)
  const candidate = weekIdToMondayUtcMs(candidateWeekId)
  if (reference == null || candidate == null) {
    return false
  }
  return reference - candidate === ONE_WEEK_MS
}

export function diffWeekId(referenceWeekId: string, candidateWeekId: string): number | null {
  const reference = weekIdToMondayUtcMs(referenceWeekId)
  const candidate = weekIdToMondayUtcMs(candidateWeekId)
  if (reference == null || candidate == null) {
    return null
  }
  return Math.floor((reference - candidate) / ONE_WEEK_MS)
}

export function recentIsoDates(referenceIsoDate: string, days: number): string[] {
  const normalizedDays = Math.max(0, Math.trunc(days))
  const referenceTs = parseIsoDateUtcMs(referenceIsoDate)
  if (referenceTs == null || normalizedDays === 0) {
    return []
  }

  const values: string[] = []
  for (let offset = normalizedDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(referenceTs - offset * ONE_DAY_MS)
    values.push(date.toISOString().slice(0, 10))
  }
  return values
}

export function latestBodyRecord(records: BodyRecord[]): BodyRecord | null {
  return records.length > 0 ? records[0] : null
}
