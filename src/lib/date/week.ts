export function currentWeekId(reference = new Date()): string {
  const date = new Date(Date.UTC(reference.getFullYear(), reference.getMonth(), reference.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)

  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNumber = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`
}
