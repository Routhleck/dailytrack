import { describe, expect, test } from 'vitest'

import {
  compareProgress,
  diffIsoDateDays,
  diffWeekId,
  findWeakestSection,
  isPreviousIsoDate,
  isPreviousWeekId,
  recentIsoDates,
  type ProgressSummary,
} from './dashboard.service'

function summary(checked: number, total: number, percent: number): ProgressSummary {
  return { checked, total, percent }
}

describe('dashboard progress comparison', () => {
  test('returns na when previous period is unavailable', () => {
    expect(compareProgress(summary(3, 5, 60), null)).toEqual({
      previousPercent: null,
      deltaPercent: null,
      trend: 'na',
    })
  })

  test('returns up/down/flat trends with delta', () => {
    expect(compareProgress(summary(4, 5, 80), summary(3, 5, 60))).toEqual({
      previousPercent: 60,
      deltaPercent: 20,
      trend: 'up',
    })

    expect(compareProgress(summary(2, 5, 40), summary(4, 5, 80))).toEqual({
      previousPercent: 80,
      deltaPercent: -40,
      trend: 'down',
    })

    expect(compareProgress(summary(3, 5, 60), summary(3, 5, 60))).toEqual({
      previousPercent: 60,
      deltaPercent: 0,
      trend: 'flat',
    })
  })
})

describe('dashboard continuity helpers', () => {
  test('checks previous ISO date exactly one day apart', () => {
    expect(isPreviousIsoDate('2026-03-25', '2026-03-24')).toBe(true)
    expect(isPreviousIsoDate('2026-03-25', '2026-03-23')).toBe(false)
    expect(isPreviousIsoDate('invalid', '2026-03-24')).toBe(false)
  })

  test('computes daily gap between two ISO dates', () => {
    expect(diffIsoDateDays('2026-03-25', '2026-03-25')).toBe(0)
    expect(diffIsoDateDays('2026-03-25', '2026-03-22')).toBe(3)
    expect(diffIsoDateDays('bad', '2026-03-22')).toBeNull()
  })

  test('checks previous week id exactly one ISO week apart', () => {
    expect(isPreviousWeekId('2026-W12', '2026-W11')).toBe(true)
    expect(isPreviousWeekId('2026-W01', '2025-W52')).toBe(true)
    expect(isPreviousWeekId('2026-W12', '2026-W10')).toBe(false)
    expect(isPreviousWeekId('bad', '2026-W11')).toBe(false)
  })

  test('computes week gap between two week ids', () => {
    expect(diffWeekId('2026-W12', '2026-W12')).toBe(0)
    expect(diffWeekId('2026-W12', '2026-W10')).toBe(2)
    expect(diffWeekId('bad', '2026-W10')).toBeNull()
  })

  test('builds recent ISO date range in chronological order', () => {
    expect(recentIsoDates('2026-03-25', 4)).toEqual([
      '2026-03-22',
      '2026-03-23',
      '2026-03-24',
      '2026-03-25',
    ])
  })
})

describe('dashboard weakest section helper', () => {
  test('returns the section with lowest completion among non-empty sections', () => {
    const weakest = findWeakestSection([
      { section: 'Body', summary: summary(0, 0, 0) },
      { section: 'Research', summary: summary(1, 5, 20) },
      { section: 'Life', summary: summary(2, 4, 50) },
    ])

    expect(weakest).toEqual({
      section: 'Research',
      summary: { checked: 1, total: 5, percent: 20 },
    })
  })

  test('returns null when all sections are empty', () => {
    const weakest = findWeakestSection([
      { section: 'Body', summary: summary(0, 0, 0) },
      { section: 'Research', summary: summary(0, 0, 0) },
    ])
    expect(weakest).toBeNull()
  })
})
