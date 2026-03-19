import { readTextFile, writeTextFile } from '../../lib/fs/fileApi'
import { joinPath } from '../../lib/fs/pathApi'
import type { TrackerPreferences } from '../../types/preferences'
import type { WeeklySectionKey } from '../../types/tracker'

const WEEKLY_KEYS: WeeklySectionKey[] = ['Body', 'Research', 'Life', 'Output', 'Social']

const DEFAULT_PREFERENCES: TrackerPreferences = {
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
  },
}

function preferencesPath(dataRoot: string): string {
  return joinPath(dataRoot, 'preferences.json')
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizePreferences(raw: unknown): TrackerPreferences {
  const object = typeof raw === 'object' && raw ? (raw as Record<string, unknown>) : {}

  const dailyRaw =
    typeof object.daily === 'object' && object.daily ? (object.daily as Record<string, unknown>) : {}
  const weeklyRaw =
    typeof object.weekly === 'object' && object.weekly
      ? (object.weekly as Record<string, unknown>)
      : {}
  const bodyRaw =
    typeof object.body === 'object' && object.body ? (object.body as Record<string, unknown>) : {}

  const weeklySectionsRaw =
    typeof weeklyRaw.sections === 'object' && weeklyRaw.sections
      ? (weeklyRaw.sections as Record<string, unknown>)
      : {}

  const sections = WEEKLY_KEYS.reduce<Record<WeeklySectionKey, boolean>>((acc, key) => {
    acc[key] = toBoolean(weeklySectionsRaw[key], DEFAULT_PREFERENCES.weekly.sections[key])
    return acc
  }, {} as Record<WeeklySectionKey, boolean>)

  return {
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
    },
  }
}

export function defaultPreferences(): TrackerPreferences {
  return JSON.parse(JSON.stringify(DEFAULT_PREFERENCES)) as TrackerPreferences
}

export async function getPreferences(dataRoot: string): Promise<TrackerPreferences> {
  const path = preferencesPath(dataRoot)

  try {
    const raw = await readTextFile(path)
    const parsed = JSON.parse(raw) as unknown
    const normalized = normalizePreferences(parsed)
    await writeTextFile(path, `${JSON.stringify(normalized, null, 2)}\n`)
    return normalized
  } catch {
    const defaults = defaultPreferences()
    await writeTextFile(path, `${JSON.stringify(defaults, null, 2)}\n`)
    return defaults
  }
}

export async function savePreferences(
  dataRoot: string,
  preferences: TrackerPreferences,
): Promise<TrackerPreferences> {
  const normalized = normalizePreferences(preferences)
  await writeTextFile(
    preferencesPath(dataRoot),
    `${JSON.stringify(normalized, null, 2)}\n`,
  )
  return normalized
}
