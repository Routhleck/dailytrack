import type { CheckboxItem, DailyNote, WeeklyNote, WeeklySectionKey } from '../../types/tracker'
import type { TemplateApplyMode } from './templateMeta.service'
import {
  normalizeTemplateOutput,
  parseDailyTemplateMarkdown,
  parseWeeklyTemplateMarkdown,
  serializeDailyTemplateMarkdown,
  serializeWeeklyTemplateMarkdown,
} from './templateSchema'

type TemplatePair = {
  dailyTemplate: string
  weeklyTemplate: string
}

type TemplateSectionPreview = {
  before: number
  after: number
  added: number
  removed: number
}

export type TemplateUpdatePreview = {
  mode: TemplateApplyMode
  daily: TemplateSectionPreview
  weekly: TemplateSectionPreview
  reflection: {
    beforeFilled: number
    afterFilled: number
    filledFromPreset: number
  }
}

export type TemplateUpdateComputation = TemplatePair & {
  preview: TemplateUpdatePreview
}

const WEEKLY_SECTION_KEYS: WeeklySectionKey[] = ['Body', 'Research', 'Life', 'Output', 'Social']

function assertDailyTemplateShape(markdown: string): void {
  if (!/^## Daily Core$/m.test(markdown) || !/^## Optional$/m.test(markdown) || !/^## One Line$/m.test(markdown)) {
    throw new Error('Daily template format is invalid for structured template update.')
  }
}

function assertWeeklyTemplateShape(markdown: string): void {
  const requiredHeadings = [
    /^## Body$/m,
    /^## Research$/m,
    /^## Life$/m,
    /^## Output$/m,
    /^## Social$/m,
    /^## Reflection$/m,
    /^### 3 good things this week$/m,
    /^### 3 most important things next week$/m,
  ]
  if (requiredHeadings.some((rule) => !rule.test(markdown))) {
    throw new Error('Weekly template format is invalid for structured template update.')
  }
}

function normalizeItemKey(text: string): string {
  const trimmed = text.trim().toLowerCase()
  if (!trimmed) {
    return ''
  }
  const compact = trimmed.replace(/[^\p{L}\p{N}]+/gu, '')
  return compact || trimmed
}

function mergeChecklist(base: CheckboxItem[], incoming: CheckboxItem[]): CheckboxItem[] {
  const existingKeys = new Set(base.map((item) => normalizeItemKey(item.text)).filter(Boolean))
  const appended = incoming.filter((item) => {
    const key = normalizeItemKey(item.text)
    if (!key || existingKeys.has(key)) {
      return false
    }
    existingKeys.add(key)
    return true
  })
  return [...base, ...appended.map((item) => ({ ...item, checked: false }))]
}

function countDailyItems(note: DailyNote): number {
  return note.dailyCore.length + note.optional.length
}

function countWeeklyItems(note: WeeklyNote): number {
  return WEEKLY_SECTION_KEYS.reduce((sum, key) => sum + note.sections[key].length, 0)
}

function countFilled(values: string[]): number {
  return values.filter((item) => item.trim().length > 0).length
}

function mergeReflection(base: WeeklyNote, incoming: WeeklyNote): {
  note: WeeklyNote
  filledFromPreset: number
} {
  let filledFromPreset = 0
  const goodThings = Array.from({ length: 3 }, (_, index) => {
    const current = base.reflection.goodThings[index]?.trim() ?? ''
    if (current) {
      return current
    }
    const next = incoming.reflection.goodThings[index]?.trim() ?? ''
    if (next) {
      filledFromPreset += 1
    }
    return next
  })
  const nextWeekTop3 = Array.from({ length: 3 }, (_, index) => {
    const current = base.reflection.nextWeekTop3[index]?.trim() ?? ''
    if (current) {
      return current
    }
    const next = incoming.reflection.nextWeekTop3[index]?.trim() ?? ''
    if (next) {
      filledFromPreset += 1
    }
    return next
  })

  return {
    note: {
      ...base,
      reflection: {
        goodThings,
        nextWeekTop3,
      },
    },
    filledFromPreset,
  }
}

function mergeTemplates(base: TemplatePair, incoming: TemplatePair): TemplateUpdateComputation {
  const baseDaily = parseDailyTemplateMarkdown(base.dailyTemplate)
  const incomingDaily = parseDailyTemplateMarkdown(incoming.dailyTemplate)
  const baseWeekly = parseWeeklyTemplateMarkdown(base.weeklyTemplate)
  const incomingWeekly = parseWeeklyTemplateMarkdown(incoming.weeklyTemplate)

  const mergedDaily: DailyNote = {
    ...baseDaily,
    dailyCore: mergeChecklist(baseDaily.dailyCore, incomingDaily.dailyCore),
    optional: mergeChecklist(baseDaily.optional, incomingDaily.optional),
    oneLine:
      baseDaily.oneLine.trim() && baseDaily.oneLine.trim() !== '-'
        ? baseDaily.oneLine
        : incomingDaily.oneLine,
  }

  const mergedSections = WEEKLY_SECTION_KEYS.reduce<WeeklyNote['sections']>(
    (acc, key) => {
      acc[key] = mergeChecklist(baseWeekly.sections[key], incomingWeekly.sections[key])
      return acc
    },
    {
      Body: [],
      Research: [],
      Life: [],
      Output: [],
      Social: [],
    },
  )

  const reflectionMerged = mergeReflection(
    {
      ...baseWeekly,
      sections: mergedSections,
    },
    incomingWeekly,
  )

  const beforeDaily = countDailyItems(baseDaily)
  const beforeWeekly = countWeeklyItems(baseWeekly)
  const afterDaily = countDailyItems(mergedDaily)
  const afterWeekly = countWeeklyItems(reflectionMerged.note)

  return {
    dailyTemplate: normalizeTemplateOutput(serializeDailyTemplateMarkdown(mergedDaily)),
    weeklyTemplate: normalizeTemplateOutput(serializeWeeklyTemplateMarkdown(reflectionMerged.note)),
    preview: {
      mode: 'merge',
      daily: {
        before: beforeDaily,
        after: afterDaily,
        added: Math.max(0, afterDaily - beforeDaily),
        removed: 0,
      },
      weekly: {
        before: beforeWeekly,
        after: afterWeekly,
        added: Math.max(0, afterWeekly - beforeWeekly),
        removed: 0,
      },
      reflection: {
        beforeFilled:
          countFilled(baseWeekly.reflection.goodThings) + countFilled(baseWeekly.reflection.nextWeekTop3),
        afterFilled:
          countFilled(reflectionMerged.note.reflection.goodThings) +
          countFilled(reflectionMerged.note.reflection.nextWeekTop3),
        filledFromPreset: reflectionMerged.filledFromPreset,
      },
    },
  }
}

function overwriteTemplates(base: TemplatePair, incoming: TemplatePair): TemplateUpdateComputation {
  const baseDaily = parseDailyTemplateMarkdown(base.dailyTemplate)
  const incomingDaily = parseDailyTemplateMarkdown(incoming.dailyTemplate)
  const baseWeekly = parseWeeklyTemplateMarkdown(base.weeklyTemplate)
  const incomingWeekly = parseWeeklyTemplateMarkdown(incoming.weeklyTemplate)

  const beforeDaily = countDailyItems(baseDaily)
  const beforeWeekly = countWeeklyItems(baseWeekly)
  const afterDaily = countDailyItems(incomingDaily)
  const afterWeekly = countWeeklyItems(incomingWeekly)

  return {
    dailyTemplate: normalizeTemplateOutput(incoming.dailyTemplate),
    weeklyTemplate: normalizeTemplateOutput(incoming.weeklyTemplate),
    preview: {
      mode: 'overwrite',
      daily: {
        before: beforeDaily,
        after: afterDaily,
        added: Math.max(0, afterDaily - beforeDaily),
        removed: Math.max(0, beforeDaily - afterDaily),
      },
      weekly: {
        before: beforeWeekly,
        after: afterWeekly,
        added: Math.max(0, afterWeekly - beforeWeekly),
        removed: Math.max(0, beforeWeekly - afterWeekly),
      },
      reflection: {
        beforeFilled:
          countFilled(baseWeekly.reflection.goodThings) + countFilled(baseWeekly.reflection.nextWeekTop3),
        afterFilled:
          countFilled(incomingWeekly.reflection.goodThings) +
          countFilled(incomingWeekly.reflection.nextWeekTop3),
        filledFromPreset: 0,
      },
    },
  }
}

export function computeTemplateUpdate(
  base: TemplatePair,
  incoming: TemplatePair,
  mode: TemplateApplyMode,
): TemplateUpdateComputation {
  assertDailyTemplateShape(base.dailyTemplate)
  assertDailyTemplateShape(incoming.dailyTemplate)
  assertWeeklyTemplateShape(base.weeklyTemplate)
  assertWeeklyTemplateShape(incoming.weeklyTemplate)

  if (mode === 'overwrite') {
    return overwriteTemplates(base, incoming)
  }
  return mergeTemplates(base, incoming)
}
