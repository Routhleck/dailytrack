import { describe, expect, it } from 'vitest'

import { TEMPLATE_PRESETS, getTemplatePresetById, getTemplateVariant } from './templateCatalog'

describe('template catalog', () => {
  it('loads presets from repository config', () => {
    expect(TEMPLATE_PRESETS.length).toBeGreaterThanOrEqual(2)
    const ids = new Set(TEMPLATE_PRESETS.map((preset) => preset.id))
    expect(ids.size).toBe(TEMPLATE_PRESETS.length)
  })

  it('supports bilingual variants for every preset', () => {
    for (const preset of TEMPLATE_PRESETS) {
      expect(preset.labels.en.trim().length).toBeGreaterThan(0)
      expect(preset.labels.zh.trim().length).toBeGreaterThan(0)
      expect(preset.variants.en.dailyTemplate).toContain('## Daily Core')
      expect(preset.variants.zh.weeklyTemplate).toContain('## Reflection')
    }
  })

  it('falls back to first preset when id is missing', () => {
    const missing = getTemplatePresetById('__missing__')
    expect(missing.id).toBe(TEMPLATE_PRESETS[0].id)
    const variant = getTemplateVariant(missing, 'en')
    expect(variant.dailyTemplate).toContain('{{date}}')
  })
})
