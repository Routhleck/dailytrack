import rawCatalog from '../../../config/template-presets.json'

export type TemplateLanguage = 'en' | 'zh'

export type TemplateVariant = {
  dailyTemplate: string
  weeklyTemplate: string
}

export type TemplatePreset = {
  id: string
  labels: Record<TemplateLanguage, string>
  descriptions?: Partial<Record<TemplateLanguage, string>>
  variants: Record<TemplateLanguage, TemplateVariant>
}

type TemplateCatalog = {
  schemaVersion: number
  presets: TemplatePreset[]
}

export const TEMPLATE_CATALOG_SCHEMA_VERSION = 1

const FALLBACK_BLANK_TEMPLATE: TemplateVariant = {
  dailyTemplate: `# {{date}}

## Daily Core
- [ ] 

## Optional
- [ ] 

## One Line
-
`,
  weeklyTemplate: `# {{week}}

## Body
- [ ] 

## Research
- [ ] 

## Life
- [ ] 

## Output
- [ ] 

## Social
- [ ] 

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
`,
}

const FALLBACK_PRESET: TemplatePreset = {
  id: 'blank',
  labels: {
    en: 'Blank Skeleton',
    zh: '空白骨架',
  },
  descriptions: {
    en: 'Fallback template catalog.',
    zh: '回退模板目录。',
  },
  variants: {
    en: FALLBACK_BLANK_TEMPLATE,
    zh: FALLBACK_BLANK_TEMPLATE,
  },
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value != null ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function asTemplateVariant(value: unknown): TemplateVariant | null {
  const record = asRecord(value)
  const dailyTemplate = asString(record.dailyTemplate)
  const weeklyTemplate = asString(record.weeklyTemplate)
  if (!dailyTemplate || !weeklyTemplate) {
    return null
  }
  return {
    dailyTemplate,
    weeklyTemplate,
  }
}

function asTemplatePreset(value: unknown): TemplatePreset | null {
  const record = asRecord(value)
  const id = asString(record.id)
  if (!id) {
    return null
  }

  const labels = asRecord(record.labels)
  const labelEn = asString(labels.en)
  const labelZh = asString(labels.zh)
  if (!labelEn || !labelZh) {
    return null
  }

  const variants = asRecord(record.variants)
  const variantEn = asTemplateVariant(variants.en)
  const variantZh = asTemplateVariant(variants.zh)
  if (!variantEn || !variantZh) {
    return null
  }

  const descriptionsRecord = asRecord(record.descriptions)
  const descriptionEn = asString(descriptionsRecord.en)
  const descriptionZh = asString(descriptionsRecord.zh)
  const descriptions: Partial<Record<TemplateLanguage, string>> = {}
  if (descriptionEn) {
    descriptions.en = descriptionEn
  }
  if (descriptionZh) {
    descriptions.zh = descriptionZh
  }

  return {
    id,
    labels: {
      en: labelEn,
      zh: labelZh,
    },
    descriptions: Object.keys(descriptions).length > 0 ? descriptions : undefined,
    variants: {
      en: variantEn,
      zh: variantZh,
    },
  }
}

function normalizeCatalog(raw: unknown): TemplateCatalog {
  const record = asRecord(raw)
  const schemaVersion = Number(record.schemaVersion)
  const presetsRaw = Array.isArray(record.presets) ? record.presets : []
  const seen = new Set<string>()

  const presets = presetsRaw
    .map(asTemplatePreset)
    .filter((preset): preset is TemplatePreset => Boolean(preset))
    .filter((preset) => {
      if (seen.has(preset.id)) {
        return false
      }
      seen.add(preset.id)
      return true
    })

  return {
    schemaVersion: Number.isFinite(schemaVersion) ? schemaVersion : TEMPLATE_CATALOG_SCHEMA_VERSION,
    presets: presets.length > 0 ? presets : [FALLBACK_PRESET],
  }
}

const catalog = normalizeCatalog(rawCatalog as unknown)
export const TEMPLATE_PRESETS: TemplatePreset[] = catalog.presets

export function getTemplatePresetById(id: string): TemplatePreset {
  return TEMPLATE_PRESETS.find((preset) => preset.id === id) ?? TEMPLATE_PRESETS[0]
}

export function getTemplateVariant(
  preset: TemplatePreset,
  language: TemplateLanguage,
): TemplateVariant {
  return preset.variants[language]
}

export function resolvePreferredTemplateLanguage(): TemplateLanguage {
  if (typeof navigator === 'undefined') {
    return 'en'
  }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}
