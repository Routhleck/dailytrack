import type { WeeklySectionKey } from './tracker'
import type { BodyNumericMetricKey } from './tracker'

export type BodyMetricDisplay = {
  unit: string
  decimals: number
}

export type TrackerPreferences = {
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
