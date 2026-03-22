import { readTextFile, writeTextFile } from '../../lib/fs/fileApi'
import { joinPath } from '../../lib/fs/pathApi'
import type { TemplateLanguage } from './templateCatalog'

export type TemplateApplyMode = 'merge' | 'overwrite'

export type TemplateMeta = {
  schemaVersion: number
  presetId: string
  templateLanguage: TemplateLanguage
  lastAppliedAt: string
  lastAppliedMode: TemplateApplyMode
}

const TEMPLATE_META_SCHEMA_VERSION = 1

function templateMetaPath(dataRoot: string): string {
  return joinPath(dataRoot, 'templates', 'template-meta.json')
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value != null ? (value as Record<string, unknown>) : {}
}

function toMode(value: unknown): TemplateApplyMode | null {
  return value === 'merge' || value === 'overwrite' ? value : null
}

function toLanguage(value: unknown): TemplateLanguage | null {
  return value === 'en' || value === 'zh' ? value : null
}

function normalizeTemplateMeta(raw: unknown): TemplateMeta | null {
  const record = asRecord(raw)
  const presetId = typeof record.presetId === 'string' ? record.presetId.trim() : ''
  const templateLanguage = toLanguage(record.templateLanguage)
  const lastAppliedMode = toMode(record.lastAppliedMode)
  const lastAppliedAt = typeof record.lastAppliedAt === 'string' ? record.lastAppliedAt.trim() : ''
  if (!presetId || !templateLanguage || !lastAppliedMode || !lastAppliedAt) {
    return null
  }
  const schemaVersion =
    typeof record.schemaVersion === 'number' && Number.isFinite(record.schemaVersion)
      ? record.schemaVersion
      : TEMPLATE_META_SCHEMA_VERSION
  return {
    schemaVersion,
    presetId,
    templateLanguage,
    lastAppliedAt,
    lastAppliedMode,
  }
}

export async function getTemplateMeta(dataRoot: string): Promise<TemplateMeta | null> {
  const path = templateMetaPath(dataRoot)
  try {
    const raw = await readTextFile(dataRoot, path)
    return normalizeTemplateMeta(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export async function saveTemplateMeta(
  dataRoot: string,
  input: Omit<TemplateMeta, 'schemaVersion'>,
): Promise<TemplateMeta> {
  const meta: TemplateMeta = {
    schemaVersion: TEMPLATE_META_SCHEMA_VERSION,
    presetId: input.presetId.trim(),
    templateLanguage: input.templateLanguage,
    lastAppliedAt: input.lastAppliedAt,
    lastAppliedMode: input.lastAppliedMode,
  }
  await writeTextFile(dataRoot, templateMetaPath(dataRoot), `${JSON.stringify(meta, null, 2)}\n`)
  return meta
}
