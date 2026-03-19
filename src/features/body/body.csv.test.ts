import { describe, expect, test } from 'vitest'

import { parseBodyCsv, serializeBodyCsv } from './body.csv'

describe('body csv parser', () => {
  test('parses legacy csv rows with null-safe numeric values', () => {
    const raw = `date,weight,waist,note\n2026-03-18,71.2,82.0,ok\n2026-03-17,,abc,bad waist\n`
    const records = parseBodyCsv(raw)

    expect(records).toHaveLength(2)
    expect(records[0]?.date).toBe('2026-03-18')
    expect(records[1]?.weight).toBeNull()
    expect(records[1]?.waist).toBeNull()
    expect(records[0]?.bodyFat).toBeNull()
    expect(records[0]?.muscleMass).toBeNull()
    expect(records[0]?.chest).toBeNull()
    expect(records[0]?.hip).toBeNull()
  })

  test('parses extended csv header and values', () => {
    const raw =
      'date,weight,waist,bodyFat,muscleMass,chest,hip,note\n' +
      '2026-03-18,71.2,82.0,14.8,33.5,97.0,98.2,ok\n'
    const records = parseBodyCsv(raw)

    expect(records[0]?.bodyFat).toBe(14.8)
    expect(records[0]?.muscleMass).toBe(33.5)
    expect(records[0]?.chest).toBe(97)
    expect(records[0]?.hip).toBe(98.2)
  })

  test('keeps note tail when header exists and row has extra commas', () => {
    const raw =
      'date,weight,waist,bodyFat,muscleMass,chest,hip,note\n' +
      '2026-03-18,71.2,82.0,14.8,33.5,97.0,98.2,felt good,after dinner\n'
    const records = parseBodyCsv(raw)

    expect(records[0]?.note).toBe('felt good,after dinner')
  })

  test('roundtrip serialization keeps records', () => {
    const serialized = serializeBodyCsv([
      {
        date: '2026-03-18',
        weight: 70.5,
        waist: 81.2,
        bodyFat: 15.1,
        muscleMass: 34.3,
        chest: 96.5,
        hip: 99.2,
        note: 'steady',
      },
      {
        date: '2026-03-17',
        weight: null,
        waist: null,
        bodyFat: null,
        muscleMass: null,
        chest: null,
        hip: null,
        note: 'rest day',
      },
    ])

    const parsed = parseBodyCsv(serialized)

    expect(parsed[0]?.date).toBe('2026-03-18')
    expect(parsed[0]?.weight).toBe(70.5)
    expect(parsed[0]?.bodyFat).toBe(15.1)
    expect(parsed[1]?.note).toBe('rest day')
  })
})
