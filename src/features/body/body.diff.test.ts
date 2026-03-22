import { describe, expect, test } from 'vitest'

import { diffBodyRecord, hasAnyBodyRecordChanges } from './body.diff'

describe('body diff', () => {
  test('marks non-null metrics and non-empty note as changes', () => {
    const diff = diffBodyRecord({
      date: '2026-03-22',
      weight: 70,
      waist: null,
      bodyFat: null,
      muscleMass: null,
      chest: null,
      hip: null,
      note: 'felt good',
    })

    expect(diff.changedMetrics.weight).toBe(true)
    expect(diff.changedMetrics.waist).toBe(false)
    expect(diff.noteChanged).toBe(true)
    expect(diff.hasAnyChange).toBe(true)
  })

  test('detects whether records contain any changes', () => {
    const unchanged = {
      date: '2026-03-22',
      weight: null,
      waist: null,
      bodyFat: null,
      muscleMass: null,
      chest: null,
      hip: null,
      note: '',
    }
    const changed = {
      ...unchanged,
      weight: 68.5,
    }

    expect(hasAnyBodyRecordChanges([unchanged])).toBe(false)
    expect(hasAnyBodyRecordChanges([unchanged, changed])).toBe(true)
  })
})

