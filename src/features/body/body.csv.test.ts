import { describe, expect, test } from 'vitest'

import { parseBodyCsv, serializeBodyCsv } from './body.csv'

describe('body csv parser', () => {
  test('parses csv rows with null-safe numeric values', () => {
    const raw = `date,weight,waist,note\n2026-03-18,71.2,82.0,ok\n2026-03-17,,abc,bad waist\n`
    const records = parseBodyCsv(raw)

    expect(records).toHaveLength(2)
    expect(records[0]?.date).toBe('2026-03-18')
    expect(records[1]?.weight).toBeNull()
    expect(records[1]?.waist).toBeNull()
  })

  test('roundtrip serialization keeps records', () => {
    const serialized = serializeBodyCsv([
      { date: '2026-03-18', weight: 70.5, waist: 81.2, note: 'steady' },
      { date: '2026-03-17', weight: null, waist: null, note: 'rest day' },
    ])

    const parsed = parseBodyCsv(serialized)

    expect(parsed[0]?.date).toBe('2026-03-18')
    expect(parsed[0]?.weight).toBe(70.5)
    expect(parsed[1]?.note).toBe('rest day')
  })
})
