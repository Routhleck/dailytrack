import { describe, expect, it } from 'vitest'

import { moveItemBetweenLists } from './templateMove'

describe('moveItemBetweenLists', () => {
  it('moves selected item from source to target tail', () => {
    const source = ['a', 'b', 'c']
    const target = ['x']

    const result = moveItemBetweenLists(source, target, 1)
    expect(result.moved).toBe(true)
    expect(result.source).toEqual(['a', 'c'])
    expect(result.target).toEqual(['x', 'b'])
  })

  it('returns unchanged arrays when index is out of range', () => {
    const source = ['a', 'b', 'c']
    const target = ['x']

    const result = moveItemBetweenLists(source, target, 9)
    expect(result.moved).toBe(false)
    expect(result.source).toBe(source)
    expect(result.target).toBe(target)
  })
})
