export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayDateString(): string {
  return formatDate(new Date())
}

export function currentMonthId(reference = new Date()): string {
  const year = reference.getFullYear()
  const month = String(reference.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function compareIsoDateDesc(left: string, right: string): number {
  const leftTs = Date.parse(left)
  const rightTs = Date.parse(right)

  if (Number.isFinite(leftTs) && Number.isFinite(rightTs) && leftTs !== rightTs) {
    return rightTs - leftTs
  }

  return right.localeCompare(left)
}
