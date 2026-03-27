import { readTextFile } from '../../lib/fs/fileApi'
import { compareIsoDateDesc } from '../../lib/date/date'
import { joinPath } from '../../lib/fs/pathApi'
import { queueWriteTextFile } from '../../lib/fs/writeBehindQueue'
import { getCachedBodyRecords, setCachedBodyRecords } from '../../lib/state/trackerMemoryStore'
import type { BodyRecord } from '../../types/tracker'
import { parseBodyCsv, serializeBodyCsv } from './body.csv'

function bodyPath(dataRoot: string): string {
  return joinPath(dataRoot, 'body.csv')
}

export type TrackerReadOptions = {
  fresh?: boolean
}

export async function getBodyRecords(
  dataRoot: string,
  options?: TrackerReadOptions,
): Promise<BodyRecord[]> {
  if (!options?.fresh) {
    const cached = getCachedBodyRecords(dataRoot)
    if (cached) {
      return cached
    }
  }

  const path = bodyPath(dataRoot)
  try {
    const raw = await readTextFile(dataRoot, path)
    const parsed = parseBodyCsv(raw)
    setCachedBodyRecords(dataRoot, parsed)
    return parsed
  } catch (error) {
    console.warn('[body] failed to read body.csv, returning empty records', error)
    setCachedBodyRecords(dataRoot, [])
    return []
  }
}

export async function saveBodyRecords(dataRoot: string, records: BodyRecord[]): Promise<BodyRecord[]> {
  const normalized = [...records].sort((a, b) => compareIsoDateDesc(a.date, b.date))
  setCachedBodyRecords(dataRoot, normalized)
  void queueWriteTextFile(dataRoot, bodyPath(dataRoot), serializeBodyCsv(normalized)).catch((error) => {
    console.warn('[body] failed to flush queued write', error)
  })
  return normalized
}
