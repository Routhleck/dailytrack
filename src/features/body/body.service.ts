import { readTextFile, writeTextFile } from '../../lib/fs/fileApi'
import { compareIsoDateDesc } from '../../lib/date/date'
import { joinPath } from '../../lib/fs/pathApi'
import type { BodyRecord } from '../../types/tracker'
import { parseBodyCsv, serializeBodyCsv } from './body.csv'

function bodyPath(dataRoot: string): string {
  return joinPath(dataRoot, 'body.csv')
}

export async function getBodyRecords(dataRoot: string): Promise<BodyRecord[]> {
  const path = bodyPath(dataRoot)
  try {
    const raw = await readTextFile(dataRoot, path)
    return parseBodyCsv(raw)
  } catch (error) {
    console.warn('[body] failed to read body.csv, returning empty records', error)
    return []
  }
}

export async function saveBodyRecords(dataRoot: string, records: BodyRecord[]): Promise<BodyRecord[]> {
  const normalized = [...records].sort((a, b) => compareIsoDateDesc(a.date, b.date))
  await writeTextFile(dataRoot, bodyPath(dataRoot), serializeBodyCsv(normalized))
  return normalized
}
