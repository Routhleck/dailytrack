import type { BodyRecord, DailyNote, WeeklyNote } from '../../types/tracker'

type CacheScope = 'daily' | 'weekly' | 'body' | 'preferences' | 'settings' | 'all'

type TrackerRootCache = {
  dailyNotes: Map<string, DailyNote>
  weeklyNotes: Map<string, WeeklyNote>
  bodyRecords: BodyRecord[] | null
  dailyDates: string[] | null
  weeklyIds: string[] | null
}

const rootCaches = new Map<string, TrackerRootCache>()

function cloneValue<T>(value: T): T {
  return structuredClone(value)
}

function getRootCache(dataRoot: string): TrackerRootCache {
  const cached = rootCaches.get(dataRoot)
  if (cached) {
    return cached
  }

  const created: TrackerRootCache = {
    dailyNotes: new Map(),
    weeklyNotes: new Map(),
    bodyRecords: null,
    dailyDates: null,
    weeklyIds: null,
  }
  rootCaches.set(dataRoot, created)
  return created
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => right.localeCompare(left))
}

function extractDailyDate(path: string): string | null {
  const matched = path.match(/\d{4}-\d{2}-\d{2}/)
  return matched ? matched[0] : null
}

function extractWeeklyId(path: string): string | null {
  const matched = path.match(/\d{4}-W\d{2}/i)
  return matched ? matched[0].toUpperCase() : null
}

export function getCachedDailyNote(dataRoot: string, date: string): DailyNote | null {
  const entry = rootCaches.get(dataRoot)?.dailyNotes.get(date)
  return entry ? cloneValue(entry) : null
}

export function setCachedDailyNote(dataRoot: string, note: DailyNote): void {
  const cache = getRootCache(dataRoot)
  cache.dailyNotes.set(note.date, cloneValue(note))
}

export function getCachedWeeklyNote(dataRoot: string, weekId: string): WeeklyNote | null {
  const entry = rootCaches.get(dataRoot)?.weeklyNotes.get(weekId)
  return entry ? cloneValue(entry) : null
}

export function setCachedWeeklyNote(dataRoot: string, note: WeeklyNote): void {
  const cache = getRootCache(dataRoot)
  cache.weeklyNotes.set(note.weekId, cloneValue(note))
}

export function getCachedBodyRecords(dataRoot: string): BodyRecord[] | null {
  const records = rootCaches.get(dataRoot)?.bodyRecords
  return records ? cloneValue(records) : null
}

export function setCachedBodyRecords(dataRoot: string, records: BodyRecord[]): void {
  const cache = getRootCache(dataRoot)
  cache.bodyRecords = cloneValue(records)
}

export function getCachedDailyDates(dataRoot: string): string[] | null {
  const dates = rootCaches.get(dataRoot)?.dailyDates
  return dates ? [...dates] : null
}

export function setCachedDailyDates(dataRoot: string, dates: string[]): void {
  const cache = getRootCache(dataRoot)
  cache.dailyDates = uniqueSorted(dates)
}

export function touchCachedDailyDate(dataRoot: string, date: string): void {
  const cache = getRootCache(dataRoot)
  if (!cache.dailyDates) {
    return
  }
  cache.dailyDates = uniqueSorted([date, ...cache.dailyDates])
}

export function getCachedWeeklyIds(dataRoot: string): string[] | null {
  const ids = rootCaches.get(dataRoot)?.weeklyIds
  return ids ? [...ids] : null
}

export function setCachedWeeklyIds(dataRoot: string, weekIds: string[]): void {
  const cache = getRootCache(dataRoot)
  cache.weeklyIds = uniqueSorted(weekIds.map((item) => item.toUpperCase()))
}

export function touchCachedWeeklyId(dataRoot: string, weekId: string): void {
  const cache = getRootCache(dataRoot)
  if (!cache.weeklyIds) {
    return
  }
  cache.weeklyIds = uniqueSorted([weekId.toUpperCase(), ...cache.weeklyIds])
}

export function clearTrackerMemoryCache(dataRoot: string): void {
  rootCaches.delete(dataRoot)
}

export function invalidateTrackerMemoryByFsEvent(
  dataRoot: string,
  scope: CacheScope,
  path?: string,
): void {
  const cache = rootCaches.get(dataRoot)
  if (!cache) {
    return
  }

  if (scope === 'all' || scope === 'settings' || scope === 'preferences') {
    clearTrackerMemoryCache(dataRoot)
    return
  }

  if (scope === 'daily') {
    const date = path ? extractDailyDate(path) : null
    if (date) {
      cache.dailyNotes.delete(date)
    } else {
      cache.dailyNotes.clear()
    }
    cache.dailyDates = null
    return
  }

  if (scope === 'weekly') {
    const weekId = path ? extractWeeklyId(path) : null
    if (weekId) {
      cache.weeklyNotes.delete(weekId)
    } else {
      cache.weeklyNotes.clear()
    }
    cache.weeklyIds = null
    return
  }

  if (scope === 'body') {
    cache.bodyRecords = null
  }
}
