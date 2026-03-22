import type { CheckboxItem, DailyNote } from '../../types/tracker'

export type ChecklistTemplateDiff = {
  changedIds: Set<string>
  missingTemplateCount: number
}

export type DailyTemplateDiff = {
  dailyCore: ChecklistTemplateDiff
  optional: ChecklistTemplateDiff
  oneLineChanged: boolean
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

export function diffDailyAgainstTemplate(
  note: DailyNote,
  template: DailyNote,
): DailyTemplateDiff {
  const dailyCore = compareChecklistWithTemplate(note.dailyCore, template.dailyCore)
  const optional = compareChecklistWithTemplate(note.optional, template.optional)
  const oneLineChanged = normalizeText(note.oneLine) !== normalizeText(template.oneLine)
  const hasAnyChange = dailyCore.changedIds.size > 0
    || optional.changedIds.size > 0
    || dailyCore.missingTemplateCount > 0
    || optional.missingTemplateCount > 0
    || oneLineChanged

  return {
    dailyCore,
    optional,
    oneLineChanged,
    hasAnyChange,
  }
}

