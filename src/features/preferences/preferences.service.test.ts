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
    expect(normalized.ui.typographyScale).toBe('md')
    expect(normalized.ui.showOnlyChanges.daily).toBe(false)
    expect(normalized.ui.showOnlyChanges.weekly).toBe(false)
    expect(normalized.ui.showOnlyChanges.body).toBe(false)
    expect(normalized.ui.mobile.showSyncBanner).toBe(true)
    expect(normalized.daily.showOptional).toBe(true)
    expect(normalized.weekly.sections.Body).toBe(true)
    expect(normalized.body.weight).toBe(true)
    expect(normalized.body.display.weight.unit).toBe('kg')
    expect(normalized.body.goals.weight.enabled).toBe(false)
    expect(normalized.body.goals.weight.value).toBeNull()
  })

  test('keeps valid sync mode, upgrades schema, and strips invalid display config', () => {
    const normalized = normalizePreferences({
      schemaVersion: 1,
      sync: { mode: 'poll' },
      ui: {
        typographyScale: 'lg',
        showOnlyChanges: { daily: true, weekly: false },
        mobile: { showSyncBanner: false },
      },
      body: {
        display: {
          weight: { unit: 123, decimals: 99 },
        },
        goals: {
          weight: { enabled: true, value: 68.5 },
          waist: { enabled: 'yes', value: 'bad' },
        },
      },
    })

    expect(normalized.schemaVersion).toBe(PREFERENCES_SCHEMA_VERSION)
    expect(normalized.sync.mode).toBe('poll')
    expect(normalized.ui.typographyScale).toBe('lg')
    expect(normalized.ui.showOnlyChanges.daily).toBe(true)
    expect(normalized.ui.showOnlyChanges.weekly).toBe(false)
    expect(normalized.ui.showOnlyChanges.body).toBe(false)
    expect(normalized.ui.mobile.showSyncBanner).toBe(false)
    expect(normalized.body.display.weight.unit).toBe('kg')
    expect(normalized.body.display.weight.decimals).toBe(3)
    expect(normalized.body.goals.weight.enabled).toBe(true)
    expect(normalized.body.goals.weight.value).toBe(68.5)
    expect(normalized.body.goals.waist.enabled).toBe(false)
    expect(normalized.body.goals.waist.value).toBeNull()
  })

  test('returns deep-cloned defaults', () => {
    const first = defaultPreferences()
    const second = defaultPreferences()

    first.body.display.weight.unit = 'lbs'
    expect(second.body.display.weight.unit).toBe('kg')
    first.body.goals.weight.enabled = true
    expect(second.body.goals.weight.enabled).toBe(false)
  })
})
