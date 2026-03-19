import type { CheckboxItem, DailyNote } from '../../types/tracker'
import { checkboxId, parseCheckbox } from '../../lib/parser/checkbox'

export function parseDailyMarkdown(markdown: string, date: string): DailyNote {
  const lines = markdown.split(/\r?\n/)
  const dailyCore: CheckboxItem[] = []
  const optional: CheckboxItem[] = []

  let title = date
  let oneLine = ''
  let currentSection: 'dailyCore' | 'optional' | 'oneLine' | null = null

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    if (line.startsWith('# ')) {
      title = line.slice(2).trim() || date
      currentSection = null
      continue
    }

    if (line === '## Daily Core') {
      currentSection = 'dailyCore'
      continue
    }

    if (line === '## Optional') {
      currentSection = 'optional'
      continue
    }

    if (line === '## One Line') {
      currentSection = 'oneLine'
      continue
    }

    if (line.startsWith('## ')) {
      currentSection = null
      continue
    }

    if (currentSection === 'dailyCore' || currentSection === 'optional') {
      const parsed = parseCheckbox(line)
      if (!parsed) {
        continue
      }

      const target = currentSection === 'dailyCore' ? dailyCore : optional
      target.push({
        id: checkboxId(currentSection, parsed.text, target.length),
        text: parsed.text,
        checked: parsed.checked,
      })
      continue
    }

    if (currentSection === 'oneLine') {
      if (!line || line === '-') {
        continue
      }
      if (!oneLine) {
        oneLine = line
      }
    }
  }

  return {
    kind: 'daily',
    date,
    title,
    dailyCore,
    optional,
    oneLine,
    raw: markdown,
  }
}
