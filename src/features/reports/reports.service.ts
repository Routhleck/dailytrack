import { compareIsoDateDesc, currentMonthId, todayDateString } from '../../lib/date/date'
import { weekIdFromIsoDate, currentWeekId } from '../../lib/date/week'
import { joinPath } from '../../lib/fs/pathApi'
import { writeTextFile, generateLlmReport } from '../../lib/fs/fileApi'
import { flushQueuedTextWrites } from '../../lib/fs/writeBehindQueue'
import { getBodyRecords } from '../body/body.service'
import { summarizeChecklist, getQuantifiedStats } from '../dashboard/dashboard.service'
import { getDailyNote, listDailyDates } from '../daily/daily.service'
import { getWeeklyNote, listWeeklyIds } from '../weekly/weekly.service'
import type { BodyRecord, DailyNote, WeeklyNote } from '../../types/tracker'
import type {
  BuildReportInput,
  BuildReportResult,
  ReportLanguage,
  ReportProviderConfig,
  ReportPeriod,
} from './reports.types'

type StructuredSnapshotStats = {
  dailyNotesCount: number
  dailyCoreAveragePercent: number | null
  weeklyNotesCount: number
  weeklyChecklistAveragePercent: number | null
  weakestWeeklySection:
    | {
        section: string
        checked: number
        total: number
        percent: number
      }
    | null
  bodyRecordsCount: number
  latestBodyDate: string | null
  bodyWeightDelta: number | null
}

type PeriodComparisonStats = {
  previousTargetId: string | null
  dailyCoreAverageDelta: number | null
  weeklyChecklistAverageDelta: number | null
  bodyRecordsDelta: number | null
}

type ReportPeriodData = {
  dailyNotes: DailyNote[]
  weeklyNotes: WeeklyNote[]
  bodyRecords: BodyRecord[]
}

type ReportExportPayload = {
  schemaVersion: 1
  generatedAt: string
  period: ReportPeriod
  targetId: string
  language: ReportLanguage
  provider: {
    providerName: string
    model: string
  }
  snapshot: StructuredSnapshotStats
  comparison: PeriodComparisonStats
  recommendations: string[]
}

function reportPath(dataRoot: string, period: ReportPeriod, targetId: string): string {
  return joinPath(dataRoot, 'reports', period, `${targetId}.md`)
}

function reportJsonPath(dataRoot: string, period: ReportPeriod, targetId: string): string {
  return joinPath(dataRoot, 'reports', period, `${targetId}.json`)
}

function normalizeGeneratedContent(content: string): string {
  const trimmed = content.trim()
  return trimmed.endsWith('\n') ? trimmed : `${trimmed}\n`
}

function normalizeReportLanguage(language?: ReportLanguage): ReportLanguage {
  return language === 'zh' ? 'zh' : 'en'
}

function previousMonthId(monthId: string): string | null {
  const matched = monthId.match(/^(\d{4})-(\d{2})$/)
  if (!matched) {
    return null
  }

  const year = Number.parseInt(matched[1], 10)
  const month = Number.parseInt(matched[2], 10)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null
  }

  const previousMonth = month === 1 ? 12 : month - 1
  const previousYear = month === 1 ? year - 1 : year
  return `${previousYear}-${String(previousMonth).padStart(2, '0')}`
}

function weekIdToMondayUtcDate(weekId: string): Date | null {
  const matched = weekId.match(/^(\d{4})-W(\d{2})$/)
  if (!matched) {
    return null
  }

  const year = Number.parseInt(matched[1], 10)
  const week = Number.parseInt(matched[2], 10)
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) {
    return null
  }

  const jan4 = new Date(Date.UTC(year, 0, 4))
  const day = jan4.getUTCDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - day + 1)

  const targetMonday = new Date(week1Monday)
  targetMonday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7)
  return targetMonday
}

function previousWeekId(weekId: string): string | null {
  const monday = weekIdToMondayUtcDate(weekId)
  if (!monday) {
    return null
  }
  monday.setUTCDate(monday.getUTCDate() - 7)
  return weekIdFromIsoDate(monday.toISOString().slice(0, 10))
}

function previousTargetId(period: ReportPeriod, targetId: string): string | null {
  return period === 'weekly' ? previousWeekId(targetId) : previousMonthId(targetId)
}

function signedNumber(value: number | null, digits = 0, suffix = ''): string {
  if (value == null) {
    return 'n/a'
  }
  const fixed = digits > 0 ? value.toFixed(digits) : String(Math.round(value))
  const withSign = value > 0 ? `+${fixed}` : fixed
  return suffix ? `${withSign}${suffix}` : withSign
}

function formatDailySummary(note: DailyNote): string {
  const core = getQuantifiedStats(note.dailyCore)
  const optional = getQuantifiedStats(note.optional)
  const doneCore = note.dailyCore.filter((item) => item.checked).map((item) => item.text)
  const doneOptional = note.optional.filter((item) => item.checked).map((item) => item.text)

  const lines = [
    `### ${note.date}`,
    `- Daily Core: ${core.checked}/${core.total} (${core.percent}%)`,
    `- Optional: ${optional.checked}/${optional.total} (${optional.percent}%)`,
    `- One Line: ${note.oneLine || '-'}`,
    `- Done Core: ${doneCore.length > 0 ? doneCore.join(' | ') : '-'}`,
    `- Done Optional: ${doneOptional.length > 0 ? doneOptional.join(' | ') : '-'}`,
  ]

  // Add quantified counts if any
  if (core.totalCount > 0 || optional.totalCount > 0) {
    lines.push(`- Quantified Core: ${core.checkedCount}/${core.totalCount}`)
    lines.push(`- Quantified Optional: ${optional.checkedCount}/${optional.totalCount}`)
  }

  return lines.join('\n')
}

function formatWeeklySummary(note: WeeklyNote): string {
  const sectionLines: string[] = []
  let totalQuantifiedCount = 0
  let checkedQuantifiedCount = 0

  for (const [section, items] of Object.entries(note.sections)) {
    const summary = getQuantifiedStats(items)
    sectionLines.push(`- ${section}: ${summary.checked}/${summary.total} (${summary.percent}%)`)
    totalQuantifiedCount += summary.totalCount
    checkedQuantifiedCount += summary.checkedCount
  }

  const lines = [
    `### ${note.weekId}`,
    ...sectionLines,
    `- Good things: ${note.reflection.goodThings.filter(Boolean).join(' | ') || '-'}`,
    `- Next top 3: ${note.reflection.nextWeekTop3.filter(Boolean).join(' | ') || '-'}`,
  ]

  // Add quantified counts if any
  if (totalQuantifiedCount > 0) {
    lines.push(`- Quantified Total: ${checkedQuantifiedCount}/${totalQuantifiedCount}`)
  }

  return lines.join('\n')
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

function averagePercent(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }
  const total = values.reduce((sum, value) => sum + value, 0)
  return Math.round(total / values.length)
}

function selectPeriodSource(
  period: ReportPeriod,
  targetId: string,
  allDates: string[],
  allWeeks: string[],
  allBody: BodyRecord[],
): {
  selectedDates: string[]
  selectedWeekIds: string[]
  selectedBody: BodyRecord[]
} {
  if (period === 'weekly') {
    const selectedDates = allDates
      .filter((date) => weekIdFromIsoDate(date) === targetId)
      .sort(compareIsoDateDesc)
    const selectedWeekIds = allWeeks.includes(targetId) ? [targetId] : []
    const selectedBody = allBody.filter((record) => weekIdFromIsoDate(record.date) === targetId)
    return { selectedDates, selectedWeekIds, selectedBody }
  }

  const selectedDates = allDates
    .filter((date) => date.startsWith(targetId))
    .sort(compareIsoDateDesc)
  const derivedWeekIds = new Set(
    selectedDates
      .map((date) => weekIdFromIsoDate(date))
      .filter((weekId): weekId is string => Boolean(weekId)),
  )
  const selectedWeekIds = allWeeks
    .filter((weekId) => derivedWeekIds.has(weekId))
    .sort((left, right) => right.localeCompare(left))
  const selectedBody = allBody.filter((record) => record.date.startsWith(targetId))
  return { selectedDates, selectedWeekIds, selectedBody }
}

export function buildStructuredSnapshotStats(
  dailyNotes: DailyNote[],
  weeklyNotes: WeeklyNote[],
  bodyRecords: BodyRecord[],
): StructuredSnapshotStats {
  const dailyCoreStats = dailyNotes.map((note) => summarizeChecklist(note.dailyCore).percent)
  const weeklyStats = weeklyNotes.map((note) => {
    const allItems = Object.values(note.sections).flatMap((items) => items)
    return summarizeChecklist(allItems).percent
  })

  const weeklySectionTotals = new Map<string, { checked: number; total: number }>()
  for (const note of weeklyNotes) {
    for (const [section, items] of Object.entries(note.sections)) {
      const stats = summarizeChecklist(items)
      const current = weeklySectionTotals.get(section) ?? { checked: 0, total: 0 }
      weeklySectionTotals.set(section, {
        checked: current.checked + stats.checked,
        total: current.total + stats.total,
      })
    }
  }

  const weakestSection = Array.from(weeklySectionTotals.entries())
    .filter(([, value]) => value.total > 0)
    .map(([section, value]) => ({
      section,
      checked: value.checked,
      total: value.total,
      percent: Math.round((value.checked / value.total) * 100),
    }))
    .sort((left, right) => left.percent - right.percent)[0] ?? null

  const latestBody = bodyRecords[0] ?? null
  const firstBody = bodyRecords[bodyRecords.length - 1] ?? null
  const bodyWeightDelta = latestBody && firstBody && latestBody.weight != null && firstBody.weight != null
    ? Number((latestBody.weight - firstBody.weight).toFixed(2))
    : 'n/a'

  return {
    dailyNotesCount: dailyNotes.length,
    dailyCoreAveragePercent: averagePercent(dailyCoreStats),
    weeklyNotesCount: weeklyNotes.length,
    weeklyChecklistAveragePercent: averagePercent(weeklyStats),
    weakestWeeklySection: weakestSection,
    bodyRecordsCount: bodyRecords.length,
    latestBodyDate: latestBody?.date ?? null,
    bodyWeightDelta: typeof bodyWeightDelta === 'number' ? bodyWeightDelta : null,
  }
}

function buildPeriodComparison(
  current: StructuredSnapshotStats,
  previous: StructuredSnapshotStats | null,
  previousTarget: string | null,
): PeriodComparisonStats {
  if (!previous || !previousTarget) {
    return {
      previousTargetId: null,
      dailyCoreAverageDelta: null,
      weeklyChecklistAverageDelta: null,
      bodyRecordsDelta: null,
    }
  }

  return {
    previousTargetId: previousTarget,
    dailyCoreAverageDelta:
      current.dailyCoreAveragePercent == null || previous.dailyCoreAveragePercent == null
        ? null
        : current.dailyCoreAveragePercent - previous.dailyCoreAveragePercent,
    weeklyChecklistAverageDelta:
      current.weeklyChecklistAveragePercent == null || previous.weeklyChecklistAveragePercent == null
        ? null
        : current.weeklyChecklistAveragePercent - previous.weeklyChecklistAveragePercent,
    bodyRecordsDelta: current.bodyRecordsCount - previous.bodyRecordsCount,
  }
}

function buildStructuredSnapshotMarkdown(
  period: ReportPeriod,
  targetId: string,
  snapshot: StructuredSnapshotStats,
  comparison: PeriodComparisonStats,
  language: ReportLanguage,
): string {
  const bodyWeightDelta = snapshot.bodyWeightDelta == null ? 'n/a' : snapshot.bodyWeightDelta.toFixed(2)
  const isZh = language === 'zh'

  return [
    isZh ? `- 周期类型：${period === 'weekly' ? '周报' : '月报'}` : `- Period: ${period}`,
    isZh ? `- 目标周期：${targetId}` : `- Target: ${targetId}`,
    isZh ? `- Daily 条目数：${snapshot.dailyNotesCount}` : `- Daily notes: ${snapshot.dailyNotesCount}`,
    isZh
      ? `- Daily Core 平均完成率：${snapshot.dailyCoreAveragePercent ?? 'n/a'}%`
      : `- Daily Core average completion: ${snapshot.dailyCoreAveragePercent ?? 'n/a'}%`,
    isZh ? `- Weekly 条目数：${snapshot.weeklyNotesCount}` : `- Weekly notes: ${snapshot.weeklyNotesCount}`,
    isZh
      ? `- Weekly 清单平均完成率：${snapshot.weeklyChecklistAveragePercent ?? 'n/a'}%`
      : `- Weekly checklist average completion: ${snapshot.weeklyChecklistAveragePercent ?? 'n/a'}%`,
    `${isZh ? '- 最薄弱 Weekly 分区：' : '- Weakest weekly section: '}${
      snapshot.weakestWeeklySection
        ? `${snapshot.weakestWeeklySection.section} (${snapshot.weakestWeeklySection.checked}/${snapshot.weakestWeeklySection.total}, ${snapshot.weakestWeeklySection.percent}%)`
        : 'n/a'
    }`,
    isZh ? `- Body 记录条数：${snapshot.bodyRecordsCount}` : `- Body records: ${snapshot.bodyRecordsCount}`,
    isZh ? `- 最新 Body 日期：${snapshot.latestBodyDate ?? '-'}` : `- Latest body date: ${snapshot.latestBodyDate ?? '-'}`,
    isZh ? `- 体重变化（最新-最早）：${bodyWeightDelta}` : `- Weight delta (latest-first): ${bodyWeightDelta}`,
    isZh ? '- 与上一周期对比：' : '- Comparison vs previous period:',
    isZh
      ? `  - 上一周期目标：${comparison.previousTargetId ?? 'n/a'}`
      : `  - Previous target: ${comparison.previousTargetId ?? 'n/a'}`,
    isZh
      ? `  - Daily Core 平均完成率变化：${signedNumber(comparison.dailyCoreAverageDelta, 0, '%')}`
      : `  - Daily Core average delta: ${signedNumber(comparison.dailyCoreAverageDelta, 0, 'pp')}`,
    isZh
      ? `  - Weekly 清单平均完成率变化：${signedNumber(comparison.weeklyChecklistAverageDelta, 0, '%')}`
      : `  - Weekly checklist average delta: ${signedNumber(comparison.weeklyChecklistAverageDelta, 0, 'pp')}`,
    isZh
      ? `  - Body 记录数变化：${signedNumber(comparison.bodyRecordsDelta, 0)}`
      : `  - Body records delta: ${signedNumber(comparison.bodyRecordsDelta, 0)}`,
  ].join('\n')
}

export function buildLocalActionRecommendations(
  snapshot: StructuredSnapshotStats,
  comparison?: PeriodComparisonStats,
  language: ReportLanguage = 'en',
): string[] {
  const recommendations: string[] = []
  const isZh = language === 'zh'

  if ((snapshot.dailyCoreAveragePercent ?? 0) < 70) {
    recommendations.push(
      isZh
        ? '先稳住 Daily Core 一致性：多数天至少完成 4/5 项。'
        : 'Stabilize Daily Core consistency: aim for at least 4/5 completed items on most days.',
    )
  }

  if (snapshot.weakestWeeklySection && snapshot.weakestWeeklySection.percent < 70) {
    recommendations.push(
      isZh
        ? `优先补齐 Weekly 分区「${snapshot.weakestWeeklySection.section}」，先拉到 70% 以上完成率。`
        : `Prioritize weekly section "${snapshot.weakestWeeklySection.section}" until it reaches at least 70% completion.`,
    )
  }

  if (snapshot.bodyRecordsCount === 0) {
    recommendations.push(
      isZh
        ? '下一周期至少补 1 条 body 记录，保持趋势追踪连续。'
        : 'Add at least one body record in the next period to keep trend tracking active.',
    )
  } else if (snapshot.bodyWeightDelta != null && Math.abs(snapshot.bodyWeightDelta) >= 1.0) {
    const direction = snapshot.bodyWeightDelta > 0 ? 'up' : 'down'
    recommendations.push(
      isZh
        ? `本周期体重${snapshot.bodyWeightDelta > 0 ? '上升' : '下降'} ${Math.abs(snapshot.bodyWeightDelta).toFixed(2)}，建议复盘饮食与训练执行稳定性。`
        : `Weight moved ${direction} by ${Math.abs(snapshot.bodyWeightDelta).toFixed(2)} in this period; review nutrition and training consistency.`,
    )
  }

  if ((snapshot.weeklyChecklistAveragePercent ?? 0) < 70) {
    recommendations.push(
      isZh
        ? '固定每周一次复盘时段，在周期结束前集中清掉未完成清单项。'
        : 'Reserve one fixed weekly review slot to close pending checklist items before period end.',
    )
  }

  if (comparison && comparison.dailyCoreAverageDelta != null && comparison.dailyCoreAverageDelta < 0) {
    recommendations.push(
      isZh
        ? '本周期 Daily Core 完成率低于上一周期，建议缩减本周目标数量并先保底核心 3 项。'
        : 'Daily Core completion dropped vs previous period; shrink target scope and protect your top 3 core items first.',
    )
  }

  if (comparison && comparison.weeklyChecklistAverageDelta != null && comparison.weeklyChecklistAverageDelta < 0) {
    recommendations.push(
      isZh
        ? 'Weekly 清单完成率较上周期下降，建议把关键事项提前到周前半完成。'
        : 'Weekly checklist completion dropped vs previous period; move key items earlier in the week.',
    )
  }

  if (recommendations.length === 0) {
    recommendations.push(
      isZh
        ? '当前节奏保持不错，下一周期建议仅增加 1 个略有挑战的延展目标。'
        : 'Keep your current routine and set one slightly harder stretch goal for the next period.',
    )
  }

  return recommendations.slice(0, 5)
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
  structuredSnapshotMarkdown: string,
  recommendations: string[],
  language: ReportLanguage,
  generatedContent: string,
): string {
  const recommendationMarkdown = recommendations.map((item) => `- ${item}`).join('\n')
  const isZh = language === 'zh'
  return [
    `# ${isZh ? (period === 'weekly' ? '周报' : '月报') : (period === 'weekly' ? 'Weekly' : 'Monthly')} - ${targetId}`,
    '',
    `${isZh ? '- 生成日期' : '- Generated at'}: ${todayDateString()}`,
    `${isZh ? '- Provider' : '- Provider'}: ${provider.providerName}`,
    `${isZh ? '- 模型' : '- Model'}: ${provider.model}`,
    '',
    isZh ? '## 结构化快照' : '## Structured Snapshot',
    structuredSnapshotMarkdown,
    '',
    isZh ? '## 本地建议' : '## Local Recommendations',
    recommendationMarkdown,
    '',
    isZh ? '## 叙事复盘' : '## Narrative Review',
    normalizeGeneratedContent(generatedContent),
  ].join('\n')
}

export function buildReportExportPayload(
  period: ReportPeriod,
  targetId: string,
  provider: ReportProviderConfig,
  language: ReportLanguage,
  snapshot: StructuredSnapshotStats,
  comparison: PeriodComparisonStats,
  recommendations: string[],
): ReportExportPayload {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    period,
    targetId,
    language,
    provider: {
      providerName: provider.providerName,
      model: provider.model,
    },
    snapshot,
    comparison,
    recommendations,
  }
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

async function loadDailyNotesByDates(dataRoot: string, dates: string[]): Promise<DailyNote[]> {
  const notes: DailyNote[] = []
  for (const date of dates) {
    try {
      notes.push(await getDailyNote(dataRoot, date))
    } catch {
      // ignore single-file parse/read failure
    }
  }
  return notes
}

async function loadPeriodData(
  dataRoot: string,
  period: ReportPeriod,
  targetId: string,
  allDates: string[],
  allWeeks: string[],
  allBody: BodyRecord[],
): Promise<ReportPeriodData> {
  const selected = selectPeriodSource(period, targetId, allDates, allWeeks, allBody)
  const dailyNotes = await loadDailyNotesByDates(dataRoot, selected.selectedDates)
  const weeklyNotes = await loadWeeklyNotesByIds(dataRoot, selected.selectedWeekIds)

  return {
    dailyNotes,
    weeklyNotes,
    bodyRecords: selected.selectedBody,
  }
}

export function defaultReportTarget(period: ReportPeriod): string {
  return period === 'weekly' ? currentWeekId() : currentMonthId()
}

export async function buildAndSaveAiReport(
  dataRoot: string,
  provider: ReportProviderConfig,
  input: BuildReportInput,
): Promise<BuildReportResult> {
  await flushQueuedTextWrites('build-report')
  const language = normalizeReportLanguage(input.language)
  const allDates = await listDailyDates(dataRoot, { fresh: true })
  const allWeeks = await listWeeklyIds(dataRoot, { fresh: true })
  const allBody = await getBodyRecords(dataRoot, { fresh: true })
  const currentData = await loadPeriodData(dataRoot, input.period, input.targetId, allDates, allWeeks, allBody)
  const context = buildContextMarkdown(
    input.period,
    input.targetId,
    currentData.dailyNotes,
    currentData.weeklyNotes,
    currentData.bodyRecords,
  )
  const snapshot = buildStructuredSnapshotStats(currentData.dailyNotes, currentData.weeklyNotes, currentData.bodyRecords)
  const previousTarget = previousTargetId(input.period, input.targetId)
  const previousData = previousTarget
    ? await loadPeriodData(dataRoot, input.period, previousTarget, allDates, allWeeks, allBody)
    : null
  const previousSnapshot = previousData
    ? buildStructuredSnapshotStats(previousData.dailyNotes, previousData.weeklyNotes, previousData.bodyRecords)
    : null
  const comparison = buildPeriodComparison(snapshot, previousSnapshot, previousTarget)
  const structuredSnapshot = buildStructuredSnapshotMarkdown(
    input.period,
    input.targetId,
    snapshot,
    comparison,
    language,
  )
  const recommendations = buildLocalActionRecommendations(snapshot, comparison, language)
  const result = await generateLlmReport(
    provider.baseUrl,
    provider.apiKey,
    provider.model,
    systemPromptFor(input.period),
    context,
    provider.temperature,
  )

  const finalMarkdown = buildFinalReportMarkdown(
    input.period,
    input.targetId,
    provider,
    structuredSnapshot,
    recommendations,
    language,
    result.content,
  )
  const path = reportPath(dataRoot, input.period, input.targetId)
  const exportPayload = buildReportExportPayload(
    input.period,
    input.targetId,
    provider,
    language,
    snapshot,
    comparison,
    recommendations,
  )
  const jsonPath = reportJsonPath(dataRoot, input.period, input.targetId)
  await Promise.all([
    writeTextFile(dataRoot, path, finalMarkdown),
    writeTextFile(dataRoot, jsonPath, `${JSON.stringify(exportPayload, null, 2)}\n`),
  ])

  return {
    reportPath: path,
    reportJsonPath: jsonPath,
    reportMarkdown: finalMarkdown,
  }
}
