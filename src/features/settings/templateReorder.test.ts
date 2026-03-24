import { describe, expect, it } from 'vitest'

import { reorderByOffset } from './templateReorder'

describe('reorderByOffset', () => {
  it('moves item up by one index', () => {
    const source = ['a', 'b', 'c']
    const result = reorderByOffset(source, 2, -1)
    expect(result).toEqual(['a', 'c', 'b'])
  })

  it('moves item down by one index', () => {
    const source = ['a', 'b', 'c']
    const result = reorderByOffset(source, 0, 1)
    expect(result).toEqual(['b', 'a', 'c'])
  })

  it('returns same reference when move is out of bounds', () => {
    const source = ['a', 'b', 'c']
    const result = reorderByOffset(source, 0, -1)
    expect(result).toBe(source)
  })

  it('returns same reference when index is invalid', () => {
    const source = ['a', 'b', 'c']
    const result = reorderByOffset(source, 9, 1)
    expect(result).toBe(source)
  })
})
