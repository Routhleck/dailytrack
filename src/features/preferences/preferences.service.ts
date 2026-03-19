import { readTextFile, writeTextFile } from '../../lib/fs/fileApi'
import {
  cloneDefaultBodyMetricDisplay,
  BODY_NUMERIC_METRIC_KEYS,
  normalizeBodyMetricDisplay,
} from '../body/body.format'
import { joinPath } from '../../lib/fs/pathApi'
import type { SyncMode, TrackerPreferences } from '../../types/preferences'
import type { BodyNumericMetricKey } from '../../types/tracker'
import type { WeeklySectionKey } from '../../types/tracker'

const WEEKLY_KEYS: WeeklySectionKey[] = ['Body', 'Research', 'Life', 'Output', 'Social']
const SYNC_MODES: SyncMode[] = ['watch', 'poll']
export const PREFERENCES_SCHEMA_VERSION = 2

const DEFAULT_PREFERENCES: TrackerPreferences = {
  schemaVersion: PREFERENCES_SCHEMA_VERSION,
  sync: {
    mode: 'watch',
  },
  daily: {
    showOptional: true,
  },
  weekly: {
    sections: {
      Body: true,
      Research: true,
      Life: true,
      Output: true,
      Social: true,
    },
  },
  body: {
    weight: true,
    waist: true,
    bodyFat: false,
    muscleMass: false,
    chest: false,
    hip: false,
    note: true,
    display: cloneDefaultBodyMetricDisplay(),
  },
}

function preferencesPath(dataRoot: string): string {
  return joinPath(dataRoot, 'preferences.json')
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value != null ? (value as Record<string, unknown>) : {}
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function toSyncMode(value: unknown, fallback: SyncMode): SyncMode {
  return typeof value === 'string' && SYNC_MODES.includes(value as SyncMode)
    ? (value as SyncMode)
    : fallback
}

function toSchemaVersion(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : fallback
}

export function normalizePreferences(raw: unknown): TrackerPreferences {
  const object = asRecord(raw)
  const dailyRaw = asRecord(object.daily)
  const weeklyRaw = asRecord(object.weekly)
  const bodyRaw = asRecord(object.body)
  const bodyDisplayRaw = asRecord(bodyRaw.display)
  const weeklySectionsRaw = asRecord(weeklyRaw.sections)
  const syncRaw = asRecord(object.sync)

  const sections = WEEKLY_KEYS.reduce<Record<WeeklySectionKey, boolean>>((acc, key) => {
    acc[key] = toBoolean(weeklySectionsRaw[key], DEFAULT_PREFERENCES.weekly.sections[key])
    return acc
  }, {} as Record<WeeklySectionKey, boolean>)

  const bodyDisplay = BODY_NUMERIC_METRIC_KEYS.reduce<Record<BodyNumericMetricKey, TrackerPreferences['body']['display'][BodyNumericMetricKey]>>((acc, key) => {
    acc[key] = normalizeBodyMetricDisplay(
      bodyDisplayRaw[key],
      DEFAULT_PREFERENCES.body.display[key],
    )
    return acc
  }, {} as Record<BodyNumericMetricKey, TrackerPreferences['body']['display'][BodyNumericMetricKey]>)

  return {
    schemaVersion: toSchemaVersion(object.schemaVersion, DEFAULT_PREFERENCES.schemaVersion),
    sync: {
      mode: toSyncMode(syncRaw.mode, DEFAULT_PREFERENCES.sync.mode),
    },
    daily: {
      showOptional: toBoolean(dailyRaw.showOptional, DEFAULT_PREFERENCES.daily.showOptional),
    },
    weekly: {
      sections,
    },
    body: {
      weight: toBoolean(bodyRaw.weight, DEFAULT_PREFERENCES.body.weight),
      waist: toBoolean(bodyRaw.waist, DEFAULT_PREFERENCES.body.waist),
      bodyFat: toBoolean(bodyRaw.bodyFat, DEFAULT_PREFERENCES.body.bodyFat),
      muscleMass: toBoolean(bodyRaw.muscleMass, DEFAULT_PREFERENCES.body.muscleMass),
      chest: toBoolean(bodyRaw.chest, DEFAULT_PREFERENCES.body.chest),
      hip: toBoolean(bodyRaw.hip, DEFAULT_PREFERENCES.body.hip),
      note: toBoolean(bodyRaw.note, DEFAULT_PREFERENCES.body.note),
      display: bodyDisplay,
    },
  }
}

export function defaultPreferences(): TrackerPreferences {
  return structuredClone(DEFAULT_PREFERENCES)
}

export async function getPreferences(dataRoot: string): Promise<TrackerPreferences> {
  const path = preferencesPath(dataRoot)

  try {
    const raw = await readTextFile(dataRoot, path)
    const parsed = JSON.parse(raw) as unknown
    const normalized = normalizePreferences(parsed)
    await writeTextFile(dataRoot, path, `${JSON.stringify(normalized, null, 2)}\n`)
    return normalized
  } catch {
    const defaults = defaultPreferences()
    await writeTextFile(dataRoot, path, `${JSON.stringify(defaults, null, 2)}\n`)
    return defaults
  }
}

export async function savePreferences(
  dataRoot: string,
  preferences: TrackerPreferences,
): Promise<TrackerPreferences> {
  const normalized = normalizePreferences(preferences)
  await writeTextFile(
    dataRoot,
    preferencesPath(dataRoot),
    `${JSON.stringify(normalized, null, 2)}\n`,
  )
  return normalized
}
