import { describe, expect, it } from 'vitest'

import { getActiveMobileTab } from './navigation'

describe('getActiveMobileTab', () => {
  it('maps dashboard paths', () => {
    expect(getActiveMobileTab('/')).toBe('dashboard')
  })

  it('maps record paths', () => {
    expect(getActiveMobileTab('/today')).toBe('record')
    expect(getActiveMobileTab('/week')).toBe('record')
    expect(getActiveMobileTab('/body')).toBe('record')
  })

  it('maps history paths', () => {
    expect(getActiveMobileTab('/daily')).toBe('history')
    expect(getActiveMobileTab('/daily/2026-03-24')).toBe('history')
    expect(getActiveMobileTab('/weekly')).toBe('history')
    expect(getActiveMobileTab('/weekly/2026-W12')).toBe('history')
  })

  it('maps all other paths to more', () => {
    expect(getActiveMobileTab('/more')).toBe('more')
    expect(getActiveMobileTab('/sync')).toBe('more')
    expect(getActiveMobileTab('/profiles')).toBe('more')
    expect(getActiveMobileTab('/preferences')).toBe('more')
    expect(getActiveMobileTab('/settings')).toBe('more')
    expect(getActiveMobileTab('/reports')).toBe('more')
  })
})
