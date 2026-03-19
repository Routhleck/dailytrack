import type { WeeklySectionKey } from './tracker'

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
    note: boolean
  }
}
