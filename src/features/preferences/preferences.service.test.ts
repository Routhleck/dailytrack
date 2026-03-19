import { describe, expect, test } from 'vitest'

import {
  defaultPreferences,
  normalizePreferences,
  PREFERENCES_SCHEMA_VERSION,
} from './preferences.service'

describe('preferences normalization', () => {
  test('fills missing fields with defaults', () => {
    const normalized = normalizePreferences({})

    expect(normalized.schemaVersion).toBe(PREFERENCES_SCHEMA_VERSION)
    expect(normalized.sync.mode).toBe('watch')
    expect(normalized.daily.showOptional).toBe(true)
    expect(normalized.weekly.sections.Body).toBe(true)
    expect(normalized.body.weight).toBe(true)
    expect(normalized.body.display.weight.unit).toBe('kg')
  })

  test('keeps valid sync mode and strips invalid display config', () => {
    const normalized = normalizePreferences({
      schemaVersion: 1,
      sync: { mode: 'poll' },
      body: {
        display: {
          weight: { unit: 123, decimals: 99 },
        },
      },
    })

    expect(normalized.schemaVersion).toBe(1)
    expect(normalized.sync.mode).toBe('poll')
    expect(normalized.body.display.weight.unit).toBe('kg')
    expect(normalized.body.display.weight.decimals).toBe(3)
  })

  test('returns deep-cloned defaults', () => {
    const first = defaultPreferences()
    const second = defaultPreferences()

    first.body.display.weight.unit = 'lbs'
    expect(second.body.display.weight.unit).toBe('kg')
  })
})
