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

export type WeightDisplayMode = 'raw' | 'filtered' | 'both'

export type SyncMode = 'watch' | 'poll'
export type TypographyScale = 'sm' | 'md' | 'lg'
export type WeeklyCalendarView = 'month' | 'year'

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
    weeklyCalendarView: WeeklyCalendarView
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
    weightDisplayMode: WeightDisplayMode
  }
}
