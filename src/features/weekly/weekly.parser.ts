import type {
  CheckboxItem,
  WeeklyNote,
  WeeklyReflection,
  WeeklySectionKey,
} from '../../types/tracker'
import { checkboxId, parseCheckbox } from '../../lib/parser/checkbox'

const SECTION_KEYS: WeeklySectionKey[] = ['Body', 'Research', 'Life', 'Output', 'Social']

function emptySections(): Record<WeeklySectionKey, CheckboxItem[]> {
  return {
    Body: [],
    Research: [],
    Life: [],
    Output: [],
    Social: [],
  }
}

function normalizeTop3(items: string[]): string[] {
  const result = items.slice(0, 3)
  while (result.length < 3) {
    result.push('')
  }
  return result
}

export function parseWeeklyMarkdown(markdown: string, weekId: string): WeeklyNote {
  const lines = markdown.split(/\r?\n/)
  const sections = emptySections()
  const reflection: WeeklyReflection = { goodThings: [], nextWeekTop3: [] }

  let title = weekId
  let currentSection: WeeklySectionKey | null = null
  let reflectionMode: keyof WeeklyReflection | null = null

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    if (line.startsWith('# ')) {
      title = line.slice(2).trim() || weekId
      continue
    }

    if (line.startsWith('## ')) {
      const heading = line.slice(3).trim()
      if (heading === 'Reflection') {
        currentSection = null
        reflectionMode = null
        continue
      }

      if ((SECTION_KEYS as string[]).includes(heading)) {
        currentSection = heading as WeeklySectionKey
        reflectionMode = null
      } else {
        currentSection = null
        reflectionMode = null
      }
      continue
    }

    if (line.startsWith('### ')) {
      const heading = line.slice(4).trim().toLowerCase()
      if (heading === '3 good things this week') {
        reflectionMode = 'goodThings'
      } else if (heading === '3 most important things next week') {
        reflectionMode = 'nextWeekTop3'
      } else {
        reflectionMode = null
      }
      currentSection = null
      continue
    }

    if (currentSection) {
      const parsed = parseCheckbox(line)
      if (!parsed) {
        continue
      }

      const target = sections[currentSection]
      target.push({
        id: checkboxId(currentSection, parsed.text, target.length),
        text: parsed.text,
        checked: parsed.checked,
        count: parsed.count,
      })
      continue
    }

    if (reflectionMode) {
      const numbered = line.match(/^[1-3]\.\s?(.*)$/)
      if (!numbered) {
        continue
      }

      reflection[reflectionMode].push(numbered[1].trim())
    }
  }

  return {
    kind: 'weekly',
    weekId,
    title,
    sections,
    reflection: {
      goodThings: normalizeTop3(reflection.goodThings),
      nextWeekTop3: normalizeTop3(reflection.nextWeekTop3),
    },
    raw: markdown,
  }
}

export const WEEKLY_SECTION_ORDER = SECTION_KEYS
