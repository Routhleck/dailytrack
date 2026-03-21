import { describe, expect, it } from 'vitest'

import { buildLineDiffRows } from './lineDiff'

describe('buildLineDiffRows', () => {
  it('marks unchanged lines as same', () => {
    const rows = buildLineDiffRows('a\nb', 'a\nb')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.kind).toBe('same')
    expect(rows[1]?.kind).toBe('same')
  })

  it('marks added and removed lines', () => {
    const rows = buildLineDiffRows('a\nb\nc', 'a\nc\nd')
    expect(rows.map((row) => row.kind)).toEqual(['same', 'remove', 'same', 'add'])
    expect(rows[1]).toMatchObject({ leftText: 'b', rightText: '' })
    expect(rows[3]).toMatchObject({ leftText: '', rightText: 'd' })
  })
})
