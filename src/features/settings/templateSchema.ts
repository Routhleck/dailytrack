import { parseDailyMarkdown } from '../daily/daily.parser'
import { serializeDailyMarkdown } from '../daily/daily.serializer'
import { parseWeeklyMarkdown } from '../weekly/weekly.parser'
import { serializeWeeklyMarkdown } from '../weekly/weekly.serializer'
import type { DailyNote, WeeklyNote } from '../../types/tracker'

export const TEMPLATE_DATE_PLACEHOLDER = '{{date}}'
export const TEMPLATE_WEEK_PLACEHOLDER = '{{week}}'
const TEMPLATE_PARSE_DATE = '2000-01-01'
const TEMPLATE_PARSE_WEEK = '2000-W01'

export function parseDailyTemplateMarkdown(markdown: string): DailyNote {
  return parseDailyMarkdown(
    markdown.replaceAll(TEMPLATE_DATE_PLACEHOLDER, TEMPLATE_PARSE_DATE),
    TEMPLATE_PARSE_DATE,
  )
}

export function parseWeeklyTemplateMarkdown(markdown: string): WeeklyNote {
  return parseWeeklyMarkdown(
    markdown.replaceAll(TEMPLATE_WEEK_PLACEHOLDER, TEMPLATE_PARSE_WEEK),
    TEMPLATE_PARSE_WEEK,
  )
}

export function serializeDailyTemplateMarkdown(note: DailyNote): string {
  const next = { ...note, title: TEMPLATE_DATE_PLACEHOLDER }
  return serializeDailyMarkdown(next)
}

export function serializeWeeklyTemplateMarkdown(note: WeeklyNote): string {
  const next = { ...note, title: TEMPLATE_WEEK_PLACEHOLDER }
  return serializeWeeklyMarkdown(next)
}

export function normalizeTemplateOutput(content: string): string {
  return content.trimEnd() + '\n'
}
