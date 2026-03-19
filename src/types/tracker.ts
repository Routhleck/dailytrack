export type CheckboxItem = {
  id: string
  text: string
  checked: boolean
}

export type DailyNote = {
  kind: 'daily'
  date: string
  title: string
  dailyCore: CheckboxItem[]
  optional: CheckboxItem[]
  oneLine: string
  raw: string
}

export type WeeklyReflection = {
  goodThings: string[]
  nextWeekTop3: string[]
}

export type WeeklySectionKey = 'Body' | 'Research' | 'Life' | 'Output' | 'Social'

export type WeeklyNote = {
  kind: 'weekly'
  weekId: string
  title: string
  sections: Record<WeeklySectionKey, CheckboxItem[]>
  reflection: WeeklyReflection
  raw: string
}

export type BodyRecord = {
  date: string
  weight: number | null
  waist: number | null
  bodyFat: number | null
  muscleMass: number | null
  chest: number | null
  hip: number | null
  note: string
}

export type BodyNumericMetricKey = keyof Omit<BodyRecord, 'date' | 'note'>
