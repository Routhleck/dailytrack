import { describe, expect, it } from 'vitest'

import type { BodyRecord } from '../../types/tracker'
import { filterBodyRecordsByRange, metricDeltaFromLatest } from './body.analytics'

const recordsAsc: BodyRecord[] = [
  {
    date: '2026-03-01',
    weight: 70.5,
    waist: 80.2,
    bodyFat: 18.4,
    muscleMass: 31.2,
    chest: 95.0,
    hip: 92.1,
    note: '',
  },
  {
    date: '2026-03-10',
    weight: 70.2,
    waist: 79.8,
    bodyFat: 18.1,
    muscleMass: 31.4,
    chest: 95.3,
    hip: 92.0,
    note: '',
  },
  {
    date: '2026-03-24',
    weight: 69.9,
    waist: 79.0,
    bodyFat: 17.8,
    muscleMass: 31.7,
    chest: 95.8,
    hip: 91.7,
    note: '',
  },
]

describe('filterBodyRecordsByRange', () => {
  it('returns all records when range is all', () => {
    const result = filterBodyRecordsByRange(recordsAsc, 'all')
    expect(result).toEqual(recordsAsc)
  })

  it('keeps only records in latest 7 days window', () => {
    const result = filterBodyRecordsByRange(recordsAsc, '7d')
    expect(result.map((item) => item.date)).toEqual(['2026-03-24'])
  })

  it('keeps records in latest 30 days window', () => {
    const result = filterBodyRecordsByRange(recordsAsc, '30d')
    expect(result.map((item) => item.date)).toEqual(['2026-03-01', '2026-03-10', '2026-03-24'])
  })
})

describe('metricDeltaFromLatest', () => {
  const recordsDesc = [...recordsAsc].reverse()

  it('computes delta from latest to previous record', () => {
    const delta = metricDeltaFromLatest(recordsDesc, 'weight')
    expect(delta).toBeCloseTo(-0.3, 5)
  })

  it('returns null when either value is missing', () => {
    const missing = [{ ...recordsDesc[0], waist: null }, recordsDesc[1]]
    const delta = metricDeltaFromLatest(missing, 'waist')
    expect(delta).toBeNull()
  })
})
