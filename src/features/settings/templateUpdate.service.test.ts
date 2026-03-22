import { describe, expect, it } from 'vitest'

import { computeTemplateUpdate } from './templateUpdate.service'
import { getTemplatePresetById, getTemplateVariant } from './templateCatalog'

describe('templateUpdate', () => {
  it('merges preset items while preserving existing custom content', () => {
    const minimal = getTemplateVariant(getTemplatePresetById('minimal'), 'en')
    const balanced = getTemplateVariant(getTemplatePresetById('balanced'), 'en')
    const baseDaily = minimal.dailyTemplate.replace(
      '## Optional',
      '- [ ] Keep my custom habit\n\n## Optional',
    )

    const result = computeTemplateUpdate(
      {
        dailyTemplate: baseDaily,
        weeklyTemplate: minimal.weeklyTemplate,
      },
      {
        dailyTemplate: balanced.dailyTemplate,
        weeklyTemplate: balanced.weeklyTemplate,
      },
      'merge',
    )

    expect(result.dailyTemplate).toContain('Keep my custom habit')
    expect(result.dailyTemplate).toContain('Train / move body')
    expect(result.preview.mode).toBe('merge')
    expect(result.preview.daily.added).toBeGreaterThan(0)
    expect(result.preview.daily.removed).toBe(0)
  })

  it('overwrites templates entirely in overwrite mode', () => {
    const minimal = getTemplateVariant(getTemplatePresetById('minimal'), 'en')
    const balanced = getTemplateVariant(getTemplatePresetById('balanced'), 'en')

    const result = computeTemplateUpdate(
      {
        dailyTemplate: minimal.dailyTemplate,
        weeklyTemplate: minimal.weeklyTemplate,
      },
      {
        dailyTemplate: balanced.dailyTemplate,
        weeklyTemplate: balanced.weeklyTemplate,
      },
      'overwrite',
    )

    expect(result.dailyTemplate).toBe(balanced.dailyTemplate)
    expect(result.weeklyTemplate).toBe(balanced.weeklyTemplate)
    expect(result.preview.mode).toBe('overwrite')
    expect(result.preview.daily.removed).toBeGreaterThanOrEqual(0)
  })

  it('throws when template structure is invalid', () => {
    const balanced = getTemplateVariant(getTemplatePresetById('balanced'), 'en')
    expect(() =>
      computeTemplateUpdate(
        {
          dailyTemplate: '# {{date}}',
          weeklyTemplate: balanced.weeklyTemplate,
        },
        {
          dailyTemplate: balanced.dailyTemplate,
          weeklyTemplate: balanced.weeklyTemplate,
        },
        'merge',
      ),
    ).toThrowError(/invalid/i)
  })
})
