import { todayDateString } from '../../lib/date/date'
import { joinPath } from '../../lib/fs/pathApi'
import { listFiles, readTextFile, writeTextFile } from '../../lib/fs/fileApi'
import { queueWriteTextFile } from '../../lib/fs/writeBehindQueue'
import {
  getCachedDailyDates,
  getCachedDailyNote,
  setCachedDailyDates,
  setCachedDailyNote,
  touchCachedDailyDate,
} from '../../lib/state/trackerMemoryStore'
import type { DailyNote } from '../../types/tracker'
import { parseDailyMarkdown } from './daily.parser'
import { serializeDailyMarkdown } from './daily.serializer'

const FALLBACK_DAILY_TEMPLATE = `# {{date}}

## Daily Core
- [ ] Train / move body
- [ ] Eat well / protein target
- [ ] Finish the most important research task
- [ ] Walk outside / get sunlight
- [ ] Record one small win / good moment

## Optional
- [ ] Read / learn something
- [ ] Tidy room / desk
- [ ] Social interaction
- [ ] Capture life note / photo / thought

## Mood & Energy
- Mood: -
- Energy: -

## One Line
-
`

function buildDailyPath(dataRoot: string, date: string): string {
  return joinPath(dataRoot, 'daily', `${date}.md`)
}

export type TrackerReadOptions = {
  fresh?: boolean
}

async function readTemplate(dataRoot: string): Promise<string> {
  try {
    return await readTextFile(dataRoot, joinPath(dataRoot, 'templates', 'daily.md'))
  } catch (error) {
    console.warn('[daily] failed to read daily template, falling back to built-in template', error)
    return FALLBACK_DAILY_TEMPLATE
  }
}

async function ensureDailyFile(dataRoot: string, date: string): Promise<string> {
  const path = buildDailyPath(dataRoot, date)

  try {
    return await readTextFile(dataRoot, path)
  } catch {
    const template = await readTemplate(dataRoot)
    const content = template.replaceAll('{{date}}', date).trimEnd() + '\n'
    await writeTextFile(dataRoot, path, content)
    return content
  }
}

export async function getDailyNote(
  dataRoot: string,
  date: string,
  options?: TrackerReadOptions,
): Promise<DailyNote> {
  if (!options?.fresh) {
    const cached = getCachedDailyNote(dataRoot, date)
    if (cached) {
      return cached
    }
  }

  const markdown = await ensureDailyFile(dataRoot, date)
  const parsed = parseDailyMarkdown(markdown, date)
  setCachedDailyNote(dataRoot, parsed)
  touchCachedDailyDate(dataRoot, date)
  return parsed
}

export async function getTodayNote(dataRoot: string, options?: TrackerReadOptions): Promise<DailyNote> {
  return getDailyNote(dataRoot, todayDateString(), options)
}

export async function listDailyDates(
  dataRoot: string,
  options?: TrackerReadOptions,
): Promise<string[]> {
  if (!options?.fresh) {
    const cached = getCachedDailyDates(dataRoot)
    if (cached) {
      return cached
    }
  }

  const files = await listFiles(dataRoot, joinPath(dataRoot, 'daily'), 'md')
  const dates = files
    .map((file) => file.replace(/\.md$/i, ''))
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
  setCachedDailyDates(dataRoot, dates)
  return dates
}

export async function saveDailyStructured(dataRoot: string, note: DailyNote): Promise<DailyNote> {
  const markdown = serializeDailyMarkdown(note)
  const path = buildDailyPath(dataRoot, note.date)
  const parsed = parseDailyMarkdown(markdown, note.date)
  setCachedDailyNote(dataRoot, parsed)
  touchCachedDailyDate(dataRoot, note.date)
  void queueWriteTextFile(dataRoot, path, markdown).catch((error) => {
    console.warn('[daily] failed to flush queued write', error)
  })
  return parsed
}

export async function saveDailyRaw(dataRoot: string, date: string, raw: string): Promise<DailyNote> {
  const normalized = raw.endsWith('\n') ? raw : `${raw}\n`
  const path = buildDailyPath(dataRoot, date)
  const parsed = parseDailyMarkdown(normalized, date)
  setCachedDailyNote(dataRoot, parsed)
  touchCachedDailyDate(dataRoot, date)
  void queueWriteTextFile(dataRoot, path, normalized).catch((error) => {
    console.warn('[daily] failed to flush queued write', error)
  })
  return parsed
}
