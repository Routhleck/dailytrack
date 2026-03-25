import type { CheckboxItem, DailyNote } from '../../types/tracker'
import { checkboxId, parseCheckbox } from '../../lib/parser/checkbox'

export function parseDailyMarkdown(markdown: string, date: string): DailyNote {
  const lines = markdown.split(/\r?\n/)
  const dailyCore: CheckboxItem[] = []
  const optional: CheckboxItem[] = []

  let title = date
  let moodTag = ''
  let energyTag = ''
  let oneLine = ''
  let currentSection: 'dailyCore' | 'optional' | 'moodEnergy' | 'oneLine' | null = null

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

    if (line === '## Mood & Energy') {
      currentSection = 'moodEnergy'
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

    if (currentSection === 'moodEnergy') {
      if (!line || line === '-') {
        continue
      }

      const normalized = line.replace(/^-+\s*/, '')
      const paired = normalized.match(/^(Mood|Energy)\s*:\s*(.*)$/i)
      if (paired) {
        const key = paired[1].toLowerCase()
        const value = paired[2].trim() === '-' ? '' : paired[2].trim()
        if (key === 'mood') {
          moodTag = value
        }
        if (key === 'energy') {
          energyTag = value
        }
        continue
      }

      if (!moodTag) {
        moodTag = normalized
      } else if (!energyTag) {
        energyTag = normalized
      }
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
    moodTag,
    energyTag,
    oneLine,
    raw: markdown,
  }
}
