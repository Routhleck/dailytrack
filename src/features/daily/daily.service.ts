import { todayDateString } from '../../lib/date/date'
import { joinPath } from '../../lib/fs/pathApi'
import { listFiles, readTextFile, writeTextFile } from '../../lib/fs/fileApi'
import type { DailyNote } from '../../types/tracker'
import { parseDailyMarkdown } from './daily.parser'
import { serializeDailyMarkdown } from './daily.serializer'

function buildDailyPath(dataRoot: string, date: string): string {
  return joinPath(dataRoot, 'daily', `${date}.md`)
}

async function readTemplate(dataRoot: string): Promise<string> {
  return readTextFile(joinPath(dataRoot, 'templates', 'daily.md'))
}

async function ensureDailyFile(dataRoot: string, date: string): Promise<string> {
  const path = buildDailyPath(dataRoot, date)

  try {
    return await readTextFile(path)
  } catch {
    const template = await readTemplate(dataRoot)
    const content = template.replaceAll('{{date}}', date).trimEnd() + '\n'
    await writeTextFile(path, content)
    return content
  }
}

export async function getDailyNote(dataRoot: string, date: string): Promise<DailyNote> {
  const markdown = await ensureDailyFile(dataRoot, date)
  return parseDailyMarkdown(markdown, date)
}

export async function getTodayNote(dataRoot: string): Promise<DailyNote> {
  return getDailyNote(dataRoot, todayDateString())
}

export async function listDailyDates(dataRoot: string): Promise<string[]> {
  const files = await listFiles(joinPath(dataRoot, 'daily'), 'md')
  return files
    .map((file) => file.replace(/\.md$/i, ''))
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
}

export async function saveDailyStructured(dataRoot: string, note: DailyNote): Promise<DailyNote> {
  const markdown = serializeDailyMarkdown(note)
  const path = buildDailyPath(dataRoot, note.date)
  await writeTextFile(path, markdown)
  return parseDailyMarkdown(markdown, note.date)
}

export async function saveDailyRaw(dataRoot: string, date: string, raw: string): Promise<DailyNote> {
  const normalized = raw.endsWith('\n') ? raw : `${raw}\n`
  const path = buildDailyPath(dataRoot, date)
  await writeTextFile(path, normalized)
  return parseDailyMarkdown(normalized, date)
}
