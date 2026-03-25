import type { WeeklySectionKey } from './tracker'
import type { BodyNumericMetricKey } from './tracker'

export type BodyMetricDisplay = {
  unit: string
  decimals: number
}

export type BodyMetricGoal = {
  enabled: boolean
  value: number | null
}

export type SyncMode = 'watch' | 'poll'
export type TypographyScale = 'sm' | 'md' | 'lg'

export type ReminderPreferences = {
  enabled: boolean
  dailyGapDays: number
  weeklyGapWeeks: number
  bodyGapDays: number
}

export type TrackerPreferences = {
  schemaVersion: number
  sync: {
    mode: SyncMode
  }
  reminders: ReminderPreferences
  ui: {
    typographyScale: TypographyScale
    showOnlyChanges: {
      daily: boolean
      weekly: boolean
      body: boolean
    }
    mobile: {
      showSyncBanner: boolean
    }
  }
  daily: {
    showOptional: boolean
  }
  weekly: {
    sections: Record<WeeklySectionKey, boolean>
  }
  body: {
    weight: boolean
    waist: boolean
    bodyFat: boolean
    muscleMass: boolean
    chest: boolean
    hip: boolean
    note: boolean
    display: Record<BodyNumericMetricKey, BodyMetricDisplay>
    goals: Record<BodyNumericMetricKey, BodyMetricGoal>
  }
}
