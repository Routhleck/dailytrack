import { currentWeekId } from '../../lib/date/week'
import { listFiles, readTextFile, writeTextFile } from '../../lib/fs/fileApi'
import { queueWriteTextFile } from '../../lib/fs/writeBehindQueue'
import { joinPath } from '../../lib/fs/pathApi'
import {
  getCachedWeeklyIds,
  getCachedWeeklyNote,
  setCachedWeeklyIds,
  setCachedWeeklyNote,
  touchCachedWeeklyId,
} from '../../lib/state/trackerMemoryStore'
import type { WeeklyNote } from '../../types/tracker'
import { parseWeeklyMarkdown } from './weekly.parser'
import { serializeWeeklyMarkdown } from './weekly.serializer'

const FALLBACK_WEEKLY_TEMPLATE = `# {{week}}

## Body
- [ ] 4-5 strength sessions
- [ ] 2-3 cardio sessions
- [ ] 3 core sessions
- [ ] Record weight / waist / progress photo
- [ ] Eat well >= 5 days

## Research
- [ ] 3 deep work sessions
- [ ] Push one key project forward
- [ ] Plan next week

## Life
- [ ] 1 outdoor activity
- [ ] 1 small life-enhancing activity
- [ ] 1 environment reset / cleanup

## Output
- [ ] Publish 1 piece of content
- [ ] Save 3 ideas / materials

## Social
- [ ] Join 1 social activity / meetup
- [ ] Reach out to 1 friend

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
`

function buildWeeklyPath(dataRoot: string, weekId: string): string {
  return joinPath(dataRoot, 'weekly', `${weekId}.md`)
}

export type TrackerReadOptions = {
  fresh?: boolean
}

async function readTemplate(dataRoot: string): Promise<string> {
  try {
    return await readTextFile(dataRoot, joinPath(dataRoot, 'templates', 'weekly.md'))
  } catch (error) {
    console.warn('[weekly] failed to read weekly template, falling back to built-in template', error)
    return FALLBACK_WEEKLY_TEMPLATE
  }
}

async function ensureWeeklyFile(dataRoot: string, weekId: string): Promise<string> {
  const path = buildWeeklyPath(dataRoot, weekId)

  try {
    return await readTextFile(dataRoot, path)
  } catch {
    const template = await readTemplate(dataRoot)
    const content = template.replaceAll('{{week}}', weekId).trimEnd() + '\n'
    await writeTextFile(dataRoot, path, content)
    return content
  }
}

export async function getWeeklyNote(
  dataRoot: string,
  weekId: string,
  options?: TrackerReadOptions,
): Promise<WeeklyNote> {
  if (!options?.fresh) {
    const cached = getCachedWeeklyNote(dataRoot, weekId)
    if (cached) {
      return cached
    }
  }

  const markdown = await ensureWeeklyFile(dataRoot, weekId)
  const parsed = parseWeeklyMarkdown(markdown, weekId)
  setCachedWeeklyNote(dataRoot, parsed)
  touchCachedWeeklyId(dataRoot, weekId)
  return parsed
}

export async function getCurrentWeekNote(
  dataRoot: string,
  options?: TrackerReadOptions,
): Promise<WeeklyNote> {
  return getWeeklyNote(dataRoot, currentWeekId(), options)
}

export async function listWeeklyIds(
  dataRoot: string,
  options?: TrackerReadOptions,
): Promise<string[]> {
  if (!options?.fresh) {
    const cached = getCachedWeeklyIds(dataRoot)
    if (cached) {
      return cached
    }
  }

  const files = await listFiles(dataRoot, joinPath(dataRoot, 'weekly'), 'md')
  const weekIds = files
    .map((file) => file.replace(/\.md$/i, ''))
    .filter((name) => /^\d{4}-W\d{2}$/.test(name))
  setCachedWeeklyIds(dataRoot, weekIds)
  return weekIds
}

export async function saveWeeklyStructured(
  dataRoot: string,
  note: WeeklyNote,
): Promise<WeeklyNote> {
  const markdown = serializeWeeklyMarkdown(note)
  const path = buildWeeklyPath(dataRoot, note.weekId)
  const parsed = parseWeeklyMarkdown(markdown, note.weekId)
  setCachedWeeklyNote(dataRoot, parsed)
  touchCachedWeeklyId(dataRoot, note.weekId)
  void queueWriteTextFile(dataRoot, path, markdown).catch((error) => {
    console.warn('[weekly] failed to flush queued write', error)
  })
  return parsed
}

export async function saveWeeklyRaw(
  dataRoot: string,
  weekId: string,
  raw: string,
): Promise<WeeklyNote> {
  const normalized = raw.endsWith('\n') ? raw : `${raw}\n`
  const path = buildWeeklyPath(dataRoot, weekId)
  const parsed = parseWeeklyMarkdown(normalized, weekId)
  setCachedWeeklyNote(dataRoot, parsed)
  touchCachedWeeklyId(dataRoot, weekId)
  void queueWriteTextFile(dataRoot, path, normalized).catch((error) => {
    console.warn('[weekly] failed to flush queued write', error)
  })
  return parsed
}
