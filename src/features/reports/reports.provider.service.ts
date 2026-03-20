import { joinPath } from '../../lib/fs/pathApi'
import { readTextFile, writeTextFile } from '../../lib/fs/fileApi'
import type { ReportProviderConfig } from './reports.types'

const DEFAULT_PROVIDER_CONFIG: ReportProviderConfig = {
  providerName: 'OpenAI-compatible',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.3,
}

function providerConfigPath(dataRoot: string): string {
  return joinPath(dataRoot, 'llm.provider.json')
}

function normalizeConfig(raw: unknown): ReportProviderConfig {
  const object = typeof raw === 'object' && raw ? (raw as Record<string, unknown>) : {}
  const providerName =
    typeof object.providerName === 'string' && object.providerName.trim()
      ? object.providerName.trim()
      : DEFAULT_PROVIDER_CONFIG.providerName
  const baseUrl =
    typeof object.baseUrl === 'string' && object.baseUrl.trim()
      ? object.baseUrl.trim()
      : DEFAULT_PROVIDER_CONFIG.baseUrl
  const apiKey = typeof object.apiKey === 'string' ? object.apiKey.trim() : ''
  const model =
    typeof object.model === 'string' && object.model.trim()
      ? object.model.trim()
      : DEFAULT_PROVIDER_CONFIG.model
  const temperatureRaw = typeof object.temperature === 'number' ? object.temperature : DEFAULT_PROVIDER_CONFIG.temperature
  const temperature = Number.isFinite(temperatureRaw)
    ? Math.min(2, Math.max(0, temperatureRaw))
    : DEFAULT_PROVIDER_CONFIG.temperature

  return {
    providerName,
    baseUrl,
    apiKey,
    model,
    temperature,
  }
}

export function defaultReportProviderConfig(): ReportProviderConfig {
  return structuredClone(DEFAULT_PROVIDER_CONFIG)
}

export async function getReportProviderConfig(dataRoot: string): Promise<ReportProviderConfig> {
  const path = providerConfigPath(dataRoot)
  try {
    const raw = await readTextFile(dataRoot, path)
    const parsed = JSON.parse(raw) as unknown
    const normalized = normalizeConfig(parsed)
    await writeTextFile(dataRoot, path, `${JSON.stringify(normalized, null, 2)}\n`)
    return normalized
  } catch {
    const defaults = defaultReportProviderConfig()
    await writeTextFile(dataRoot, path, `${JSON.stringify(defaults, null, 2)}\n`)
    return defaults
  }
}

export async function saveReportProviderConfig(
  dataRoot: string,
  config: ReportProviderConfig,
): Promise<ReportProviderConfig> {
  const normalized = normalizeConfig(config)
  await writeTextFile(dataRoot, providerConfigPath(dataRoot), `${JSON.stringify(normalized, null, 2)}\n`)
  return normalized
}
