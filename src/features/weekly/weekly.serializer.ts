import type { WeeklyNote } from '../../types/tracker'
import { serializeChecklist } from '../../lib/parser/checkbox'
import { WEEKLY_SECTION_ORDER } from './weekly.parser'

function serializeTop3(values: string[]): string[] {
  const normalized = values.slice(0, 3)
  while (normalized.length < 3) {
    normalized.push('')
  }

  return normalized.map((value, index) => `${index + 1}. ${value}`.trimEnd())
}

export function serializeWeeklyMarkdown(note: WeeklyNote): string {
  const lines: string[] = []

  lines.push(`# ${note.title || note.weekId}`)
  lines.push('')

  for (const sectionKey of WEEKLY_SECTION_ORDER) {
    lines.push(`## ${sectionKey}`)
    lines.push(...serializeChecklist(note.sections[sectionKey]))
    lines.push('')
  }

  lines.push('## Reflection')
  lines.push('### 3 good things this week')
  lines.push(...serializeTop3(note.reflection.goodThings))
  lines.push('')
  lines.push('### 3 most important things next week')
  lines.push(...serializeTop3(note.reflection.nextWeekTop3))

  return `${lines.join('\n')}\n`
}
