import { currentMonthId, todayDateString } from '../../lib/date/date'
import { weekIdFromIsoDate, currentWeekId } from '../../lib/date/week'
import { joinPath } from '../../lib/fs/pathApi'
import { writeTextFile, generateLlmReport } from '../../lib/fs/fileApi'
import { getBodyRecords } from '../body/body.service'
import { summarizeChecklist } from '../dashboard/dashboard.service'
import { getDailyNote, listDailyDates } from '../daily/daily.service'
import { getWeeklyNote, listWeeklyIds } from '../weekly/weekly.service'
import type { BodyRecord, DailyNote, WeeklyNote } from '../../types/tracker'
import type { BuildReportInput, BuildReportResult, ReportProviderConfig, ReportPeriod } from './reports.types'

function reportPath(dataRoot: string, period: ReportPeriod, targetId: string): string {
  return joinPath(dataRoot, 'reports', period, `${targetId}.md`)
}

function normalizeGeneratedContent(content: string): string {
  const trimmed = content.trim()
  return trimmed.endsWith('\n') ? trimmed : `${trimmed}\n`
}

function formatDailySummary(note: DailyNote): string {
  const core = summarizeChecklist(note.dailyCore)
  const optional = summarizeChecklist(note.optional)
  const doneCore = note.dailyCore.filter((item) => item.checked).map((item) => item.text)
  const doneOptional = note.optional.filter((item) => item.checked).map((item) => item.text)

  return [
    `### ${note.date}`,
    `- Daily Core: ${core.checked}/${core.total} (${core.percent}%)`,
    `- Optional: ${optional.checked}/${optional.total} (${optional.percent}%)`,
    `- One Line: ${note.oneLine || '-'}`,
    `- Done Core: ${doneCore.length > 0 ? doneCore.join(' | ') : '-'}`,
    `- Done Optional: ${doneOptional.length > 0 ? doneOptional.join(' | ') : '-'}`,
  ].join('\n')
}

function formatWeeklySummary(note: WeeklyNote): string {
  const sectionLines = Object.entries(note.sections).map(([section, items]) => {
    const summary = summarizeChecklist(items)
    return `- ${section}: ${summary.checked}/${summary.total} (${summary.percent}%)`
  })
  return [
    `### ${note.weekId}`,
    ...sectionLines,
    `- Good things: ${note.reflection.goodThings.filter(Boolean).join(' | ') || '-'}`,
    `- Next top 3: ${note.reflection.nextWeekTop3.filter(Boolean).join(' | ') || '-'}`,
  ].join('\n')
}

function formatBodySummary(records: BodyRecord[]): string {
  if (records.length === 0) {
    return '- No body records in selected period.'
  }

  const latest = records[0]
  const first = records[records.length - 1]
  const delta = (left: number | null, right: number | null): string => {
    if (left == null || right == null) {
      return 'n/a'
    }
    return (left - right).toFixed(2)
  }

  return [
    `- Records: ${records.length}`,
    `- Latest: ${latest.date} (weight=${latest.weight ?? '-'}, waist=${latest.waist ?? '-'})`,
    `- Change vs first in period: weight=${delta(latest.weight, first.weight)}, waist=${delta(latest.waist, first.waist)}`,
    `- Notes: ${records.filter((item) => item.note.trim()).map((item) => `${item.date}:${item.note.trim()}`).slice(0, 8).join(' | ') || '-'}`,
  ].join('\n')
}

function buildContextMarkdown(
  period: ReportPeriod,
  targetId: string,
  dailyNotes: DailyNote[],
  weeklyNotes: WeeklyNote[],
  bodyRecords: BodyRecord[],
): string {
  const lines: string[] = [
    `# Context (${period} ${targetId})`,
    '',
    '## Daily Notes',
  ]
  if (dailyNotes.length === 0) {
    lines.push('- No daily notes found.')
  } else {
    for (const note of dailyNotes) {
      lines.push(formatDailySummary(note), '')
    }
  }

  lines.push('## Weekly Notes')
  if (weeklyNotes.length === 0) {
    lines.push('- No weekly notes found.')
  } else {
    for (const note of weeklyNotes) {
      lines.push(formatWeeklySummary(note), '')
    }
  }

  lines.push('## Body Progress')
  lines.push(formatBodySummary(bodyRecords))
  return lines.join('\n').trim()
}

function systemPromptFor(period: ReportPeriod): string {
  const periodLabel = period === 'weekly' ? 'weekly' : 'monthly'
  return [
    'You are an analytical life-tracker coach.',
    `Generate a ${periodLabel} report in Markdown.`,
    'Focus on concrete outcomes, patterns, risks, and next actions.',
    'Keep it practical and concise.',
    'Output structure:',
    '1) Key Wins',
    '2) Progress Snapshot',
    '3) What Slipped',
    '4) Health/Body Signals',
    '5) Action Plan (next period, 5 bullets max)',
  ].join('\n')
}

function buildFinalReportMarkdown(
  period: ReportPeriod,
  targetId: string,
  provider: ReportProviderConfig,
  generatedContent: string,
): string {
  return [
    `# ${period === 'weekly' ? 'Weekly' : 'Monthly'} Report - ${targetId}`,
    '',
    `- Generated at: ${todayDateString()}`,
    `- Provider: ${provider.providerName}`,
    `- Model: ${provider.model}`,
    '',
    normalizeGeneratedContent(generatedContent),
  ].join('\n')
}

async function loadWeeklyNotesByIds(dataRoot: string, weekIds: string[]): Promise<WeeklyNote[]> {
  const notes: WeeklyNote[] = []
  for (const weekId of weekIds) {
    try {
      notes.push(await getWeeklyNote(dataRoot, weekId))
    } catch {
      // ignore missing/corrupted single week file
    }
  }
  return notes
}

export function defaultReportTarget(period: ReportPeriod): string {
  return period === 'weekly' ? currentWeekId() : currentMonthId()
}

export async function buildAndSaveAiReport(
  dataRoot: string,
  provider: ReportProviderConfig,
  input: BuildReportInput,
): Promise<BuildReportResult> {
  const allDates = await listDailyDates(dataRoot)
  const allWeeks = await listWeeklyIds(dataRoot)
  const allBody = await getBodyRecords(dataRoot)

  let selectedDates: string[] = []
  let selectedWeekIds: string[] = []
  let selectedBody: BodyRecord[] = []

  if (input.period === 'weekly') {
    selectedDates = allDates.filter((date) => weekIdFromIsoDate(date) === input.targetId)
    selectedWeekIds = allWeeks.includes(input.targetId) ? [input.targetId] : []
    selectedBody = allBody.filter((record) => weekIdFromIsoDate(record.date) === input.targetId)
  } else {
    selectedDates = allDates.filter((date) => date.startsWith(input.targetId))
    const derivedWeekIds = new Set(
      selectedDates
        .map((date) => weekIdFromIsoDate(date))
        .filter((weekId): weekId is string => Boolean(weekId)),
    )
    selectedWeekIds = allWeeks.filter((weekId) => derivedWeekIds.has(weekId))
    selectedBody = allBody.filter((record) => record.date.startsWith(input.targetId))
  }

  const dailyNotes: DailyNote[] = []
  for (const date of selectedDates) {
    try {
      dailyNotes.push(await getDailyNote(dataRoot, date))
    } catch {
      // ignore single-file parse/read failure
    }
  }
  const weeklyNotes = await loadWeeklyNotesByIds(dataRoot, selectedWeekIds)
  const context = buildContextMarkdown(input.period, input.targetId, dailyNotes, weeklyNotes, selectedBody)
  const result = await generateLlmReport(
    provider.baseUrl,
    provider.apiKey,
    provider.model,
    systemPromptFor(input.period),
    context,
    provider.temperature,
  )

  const finalMarkdown = buildFinalReportMarkdown(input.period, input.targetId, provider, result.content)
  const path = reportPath(dataRoot, input.period, input.targetId)
  await writeTextFile(dataRoot, path, finalMarkdown)

  return {
    reportPath: path,
    reportMarkdown: finalMarkdown,
  }
}
