import { describe, expect, test } from 'vitest'

import {
  DEFAULT_BODY_METRIC_DISPLAY,
  formatBodyMetricValue,
  normalizeBodyMetricDisplay,
} from './body.format'

describe('body display format helpers', () => {
  test('normalizes invalid display with fallback defaults', () => {
    const normalized = normalizeBodyMetricDisplay(
      { unit: 123, decimals: 99 },
      DEFAULT_BODY_METRIC_DISPLAY.weight,
    )

    expect(normalized.unit).toBe('kg')
    expect(normalized.decimals).toBe(3)
  })

  test('formats value with decimals and unit', () => {
    const value = formatBodyMetricValue(71.234, { unit: 'kg', decimals: 2 })
    expect(value).toBe('71.23 kg')
  })

  test('formats null as dash', () => {
    const value = formatBodyMetricValue(null, { unit: 'cm', decimals: 1 })
    expect(value).toBe('-')
  })
})
