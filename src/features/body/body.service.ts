import { readTextFile, writeTextFile } from '../../lib/fs/fileApi'
import { joinPath } from '../../lib/fs/pathApi'
import type { BodyRecord } from '../../types/tracker'
import { parseBodyCsv, serializeBodyCsv } from './body.csv'

function bodyPath(dataRoot: string): string {
  return joinPath(dataRoot, 'body.csv')
}

export async function getBodyRecords(dataRoot: string): Promise<BodyRecord[]> {
  const raw = await readTextFile(dataRoot, bodyPath(dataRoot))
  return parseBodyCsv(raw)
}

export async function saveBodyRecords(dataRoot: string, records: BodyRecord[]): Promise<BodyRecord[]> {
  const normalized = [...records].sort((a, b) => b.date.localeCompare(a.date))
  await writeTextFile(dataRoot, bodyPath(dataRoot), serializeBodyCsv(normalized))
  return normalized
}
