import { escapeCsvCell, splitCsvLine } from '../../lib/csv/csv'
import type { BodyRecord } from '../../types/tracker'

function parseNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseBodyCsv(raw: string): BodyRecord[] {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) {
    return []
  }

  const dataLines = lines[0].toLowerCase().startsWith('date,') ? lines.slice(1) : lines

  return dataLines
    .map((line) => splitCsvLine(line))
    .filter((cells) => cells.length >= 4)
    .map((cells) => ({
      date: cells[0].trim(),
      weight: parseNumber(cells[1]),
      waist: parseNumber(cells[2]),
      note: cells.slice(3).join(',').trim(),
    }))
    .filter((record) => record.date.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function serializeBodyCsv(records: BodyRecord[]): string {
  const lines = ['date,weight,waist,note']

  for (const record of records) {
    lines.push(
      [
        record.date,
        record.weight == null ? '' : String(record.weight),
        record.waist == null ? '' : String(record.waist),
        escapeCsvCell(record.note),
      ].join(','),
    )
  }

  return `${lines.join('\n')}\n`
}
