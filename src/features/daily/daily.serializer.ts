import type { DailyNote } from '../../types/tracker'

function serializeChecklist(items: DailyNote['dailyCore']): string[] {
  return items.map((item) => `- [${item.checked ? 'x' : ' '}] ${item.text}`)
}

export function serializeDailyMarkdown(note: DailyNote): string {
  const lines: string[] = []

  lines.push(`# ${note.title || note.date}`)
  lines.push('')
  lines.push('## Daily Core')
  lines.push(...serializeChecklist(note.dailyCore))
  lines.push('')
  lines.push('## Optional')
  lines.push(...serializeChecklist(note.optional))
  lines.push('')
  lines.push('## One Line')
  lines.push(note.oneLine.trim() || '-')

  return `${lines.join('\n')}\n`
}
