import { describe, expect, test } from 'vitest'

import type { BodyRecord, DailyNote, WeeklyNote } from '../../types/tracker'
import {
  buildLocalActionRecommendations,
  buildReportExportPayload,
  buildStructuredSnapshotStats,
} from './reports.service'

function makeDaily(date: string, checkedCore: number, totalCore: number): DailyNote {
  return {
    kind: 'daily',
    date,
    title: date,
    dailyCore: Array.from({ length: totalCore }, (_, index) => ({
      id: `c-${date}-${index}`,
      text: `core-${index}`,
      checked: index < checkedCore,
    })),
    optional: [],
    moodTag: '',
    energyTag: '',
    oneLine: '',
    raw: '',
  }
}

function makeWeekly(
  weekId: string,
  sections: Partial<Record<'Body' | 'Research' | 'Life' | 'Output' | 'Social', { checked: number; total: number }>>,
): WeeklyNote {
  const sectionKeys = ['Body', 'Research', 'Life', 'Output', 'Social'] as const
  return {
    kind: 'weekly',
    weekId,
    title: weekId,
    sections: Object.fromEntries(
      sectionKeys.map((section) => {
        const target = sections[section] ?? { checked: 0, total: 0 }
        return [
          section,
          Array.from({ length: target.total }, (_, index) => ({
            id: `${section}-${index}`,
            text: `${section}-${index}`,
            checked: index < target.checked,
          })),
        ]
      }),
    ) as WeeklyNote['sections'],
    reflection: { goodThings: ['', '', ''], nextWeekTop3: ['', '', ''] },
    raw: '',
  }
}

describe('reports structured snapshot stats', () => {
  test('builds deterministic completion and weakest-section stats', () => {
    const dailyNotes = [makeDaily('2026-03-24', 4, 5), makeDaily('2026-03-25', 2, 5)]
    const weeklyNotes = [
      makeWeekly('2026-W12', {
        Body: { checked: 3, total: 5 },
        Research: { checked: 1, total: 4 },
      }),
    ]
    const bodyRecords: BodyRecord[] = [
      { date: '2026-03-25', weight: 71.5, waist: 82, bodyFat: null, muscleMass: null, chest: null, hip: null, note: '' },
      { date: '2026-03-20', weight: 70.5, waist: 82, bodyFat: null, muscleMass: null, chest: null, hip: null, note: '' },
    ]

    const stats = buildStructuredSnapshotStats(dailyNotes, weeklyNotes, bodyRecords)
    expect(stats.dailyNotesCount).toBe(2)
    expect(stats.dailyCoreAveragePercent).toBe(60)
    expect(stats.weeklyNotesCount).toBe(1)
    expect(stats.weeklyChecklistAveragePercent).toBe(44)
    expect(stats.weakestWeeklySection?.section).toBe('Research')
    expect(stats.bodyRecordsCount).toBe(2)
    expect(stats.latestBodyDate).toBe('2026-03-25')
    expect(stats.bodyWeightDelta).toBe(1)
  })
})

describe('reports local recommendations', () => {
  test('outputs focused actions for weak data signals', () => {
    const recommendations = buildLocalActionRecommendations({
      dailyNotesCount: 3,
      dailyCoreAveragePercent: 52,
      weeklyNotesCount: 1,
      weeklyChecklistAveragePercent: 58,
      weakestWeeklySection: { section: 'Research', checked: 2, total: 6, percent: 33 },
      bodyRecordsCount: 0,
      latestBodyDate: null,
      bodyWeightDelta: null,
    })

    expect(recommendations.length).toBeGreaterThanOrEqual(3)
    expect(recommendations.some((item) => item.includes('Daily Core consistency'))).toBe(true)
    expect(recommendations.some((item) => item.includes('"Research"'))).toBe(true)
    expect(recommendations.some((item) => item.includes('body record'))).toBe(true)
  })

  test('adds period-drop guidance when comparison indicates decline', () => {
    const recommendations = buildLocalActionRecommendations(
      {
        dailyNotesCount: 3,
        dailyCoreAveragePercent: 74,
        weeklyNotesCount: 1,
        weeklyChecklistAveragePercent: 71,
        weakestWeeklySection: { section: 'Research', checked: 7, total: 10, percent: 70 },
        bodyRecordsCount: 1,
        latestBodyDate: '2026-03-25',
        bodyWeightDelta: 0.1,
      },
      {
        previousTargetId: '2026-W11',
        dailyCoreAverageDelta: -12,
        weeklyChecklistAverageDelta: -8,
        bodyRecordsDelta: 0,
      },
    )

    expect(recommendations.some((item) => item.includes('Daily Core completion dropped'))).toBe(true)
    expect(recommendations.some((item) => item.includes('Weekly checklist completion dropped'))).toBe(true)
  })

  test('supports zh recommendation wording', () => {
    const recommendations = buildLocalActionRecommendations(
      {
        dailyNotesCount: 3,
        dailyCoreAveragePercent: 50,
        weeklyNotesCount: 1,
        weeklyChecklistAveragePercent: 80,
        weakestWeeklySection: { section: 'Research', checked: 2, total: 10, percent: 20 },
        bodyRecordsCount: 0,
        latestBodyDate: null,
        bodyWeightDelta: null,
      },
      undefined,
      'zh',
    )

    expect(recommendations.some((item) => item.includes('Daily Core 一致性'))).toBe(true)
    expect(recommendations.some((item) => item.includes('Weekly 分区'))).toBe(true)
  })

  test('falls back to maintain/stretch recommendation when signals are healthy', () => {
    const recommendations = buildLocalActionRecommendations({
      dailyNotesCount: 5,
      dailyCoreAveragePercent: 92,
      weeklyNotesCount: 2,
      weeklyChecklistAveragePercent: 88,
      weakestWeeklySection: { section: 'Body', checked: 8, total: 10, percent: 80 },
      bodyRecordsCount: 3,
      latestBodyDate: '2026-03-25',
      bodyWeightDelta: 0.2,
    })

    expect(recommendations).toEqual([
      'Keep your current routine and set one slightly harder stretch goal for the next period.',
    ])
  })
})

describe('reports export payload', () => {
  test('builds deterministic schema with snapshot/comparison/recommendations', () => {
    const payload = buildReportExportPayload(
      'weekly',
      '2026-W12',
      {
        providerName: 'test-provider',
        baseUrl: 'https://example.com/v1',
        apiKey: 'secret',
        model: 'gpt-test',
        temperature: 0.2,
      },
      'en',
      {
        dailyNotesCount: 3,
        dailyCoreAveragePercent: 70,
        weeklyNotesCount: 1,
        weeklyChecklistAveragePercent: 68,
        weakestWeeklySection: { section: 'Research', checked: 2, total: 5, percent: 40 },
        bodyRecordsCount: 2,
        latestBodyDate: '2026-03-25',
        bodyWeightDelta: -0.6,
      },
      {
        previousTargetId: '2026-W11',
        dailyCoreAverageDelta: -5,
        weeklyChecklistAverageDelta: -4,
        bodyRecordsDelta: 1,
      },
      ['Action A', 'Action B'],
    )

    expect(payload.schemaVersion).toBe(1)
    expect(payload.period).toBe('weekly')
    expect(payload.targetId).toBe('2026-W12')
    expect(payload.language).toBe('en')
    expect(payload.provider).toEqual({
      providerName: 'test-provider',
      model: 'gpt-test',
    })
    expect(payload.snapshot.dailyCoreAveragePercent).toBe(70)
    expect(payload.comparison.previousTargetId).toBe('2026-W11')
    expect(payload.recommendations).toEqual(['Action A', 'Action B'])
    expect(typeof payload.generatedAt).toBe('string')
  })
})
