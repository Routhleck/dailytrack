import type { WeeklySectionKey } from './tracker'
import type { BodyNumericMetricKey } from './tracker'

export type BodyMetricDisplay = {
  unit: string
  decimals: number
}

export type SyncMode = 'watch' | 'poll'
export type TypographyScale = 'sm' | 'md' | 'lg'

export type TrackerPreferences = {
  schemaVersion: number
  sync: {
    mode: SyncMode
  }
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
  }
}
