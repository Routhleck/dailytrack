import { currentWeekId } from '../../lib/date/week'
import { listFiles, readTextFile, writeTextFile } from '../../lib/fs/fileApi'
import { joinPath } from '../../lib/fs/pathApi'
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

export async function getWeeklyNote(dataRoot: string, weekId: string): Promise<WeeklyNote> {
  const markdown = await ensureWeeklyFile(dataRoot, weekId)
  return parseWeeklyMarkdown(markdown, weekId)
}

export async function getCurrentWeekNote(dataRoot: string): Promise<WeeklyNote> {
  return getWeeklyNote(dataRoot, currentWeekId())
}

export async function listWeeklyIds(dataRoot: string): Promise<string[]> {
  const files = await listFiles(dataRoot, joinPath(dataRoot, 'weekly'), 'md')
  return files
    .map((file) => file.replace(/\.md$/i, ''))
    .filter((name) => /^\d{4}-W\d{2}$/.test(name))
}

export async function saveWeeklyStructured(
  dataRoot: string,
  note: WeeklyNote,
): Promise<WeeklyNote> {
  const markdown = serializeWeeklyMarkdown(note)
  const path = buildWeeklyPath(dataRoot, note.weekId)
  await writeTextFile(dataRoot, path, markdown)
  return parseWeeklyMarkdown(markdown, note.weekId)
}

export async function saveWeeklyRaw(
  dataRoot: string,
  weekId: string,
  raw: string,
): Promise<WeeklyNote> {
  const normalized = raw.endsWith('\n') ? raw : `${raw}\n`
  const path = buildWeeklyPath(dataRoot, weekId)
  await writeTextFile(dataRoot, path, normalized)
  return parseWeeklyMarkdown(normalized, weekId)
}
