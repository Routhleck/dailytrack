import type { CheckboxItem, WeeklyNote, WeeklySectionKey } from '../../types/tracker'
import { WEEKLY_SECTION_ORDER } from './weekly.parser'

type ReflectionKey = keyof WeeklyNote['reflection']

export type ChecklistTemplateDiff = {
  changedIds: Set<string>
  missingTemplateCount: number
}

export type WeeklyTemplateDiff = {
  sections: Record<WeeklySectionKey, ChecklistTemplateDiff>
  reflection: Record<ReflectionKey, Set<number>>
  hasAnyChange: boolean
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function compareChecklistWithTemplate(
  items: CheckboxItem[],
  templateItems: CheckboxItem[],
): ChecklistTemplateDiff {
  const remaining = templateItems.map((item) => ({
    text: normalizeText(item.text),
    checked: item.checked,
  }))

  const changedIds = new Set<string>()
  for (const item of items) {
    const normalizedText = normalizeText(item.text)
    const exactIndex = remaining.findIndex(
      (candidate) => candidate.text === normalizedText && candidate.checked === item.checked,
    )
    if (exactIndex >= 0) {
      remaining.splice(exactIndex, 1)
      continue
    }

    const textIndex = remaining.findIndex((candidate) => candidate.text === normalizedText)
    if (textIndex >= 0) {
      remaining.splice(textIndex, 1)
      changedIds.add(item.id)
      continue
    }

    changedIds.add(item.id)
  }

  return {
    changedIds,
    missingTemplateCount: remaining.length,
  }
}

function diffReflectionList(
  values: string[],
  templateValues: string[],
): Set<number> {
  const changedIndexes = new Set<number>()
  const maxLength = Math.max(values.length, templateValues.length)
  for (let index = 0; index < maxLength; index += 1) {
    const current = normalizeText(values[index] ?? '')
    const baseline = normalizeText(templateValues[index] ?? '')
    if (current !== baseline) {
      changedIndexes.add(index)
    }
  }
  return changedIndexes
}

export function diffWeeklyAgainstTemplate(
  note: WeeklyNote,
  template: WeeklyNote,
): WeeklyTemplateDiff {
  const sections = WEEKLY_SECTION_ORDER.reduce<Record<WeeklySectionKey, ChecklistTemplateDiff>>(
    (acc, section) => {
      acc[section] = compareChecklistWithTemplate(note.sections[section], template.sections[section])
      return acc
    },
    {} as Record<WeeklySectionKey, ChecklistTemplateDiff>,
  )

  const reflection = {
    goodThings: diffReflectionList(note.reflection.goodThings, template.reflection.goodThings),
    nextWeekTop3: diffReflectionList(note.reflection.nextWeekTop3, template.reflection.nextWeekTop3),
  }

  const hasSectionChanges = WEEKLY_SECTION_ORDER.some(
    (section) => sections[section].changedIds.size > 0 || sections[section].missingTemplateCount > 0,
  )
  const hasReflectionChanges = reflection.goodThings.size > 0 || reflection.nextWeekTop3.size > 0

  return {
    sections,
    reflection,
    hasAnyChange: hasSectionChanges || hasReflectionChanges,
  }
}

