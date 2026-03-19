import { escapeCsvCell, splitCsvLine } from '../../lib/csv/csv'
import type { BodyRecord } from '../../types/tracker'

const HEADER = ['date', 'weight', 'waist', 'bodyFat', 'muscleMass', 'chest', 'hip', 'note'] as const

function parseNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeHeaderKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function readCell(cells: string[], index?: number): string {
  if (index == null || index < 0 || index >= cells.length) {
    return ''
  }
  return cells[index] ?? ''
}

function readTailCell(cells: string[], index?: number): string {
  if (index == null || index < 0 || index >= cells.length) {
    return ''
  }
  return cells.slice(index).join(',').trim()
}

export function parseBodyCsv(raw: string): BodyRecord[] {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) {
    return []
  }

  const firstLineCells = splitCsvLine(lines[0] ?? '')
  const headerFirstCell = normalizeHeaderKey(firstLineCells[0] ?? '')
  const hasHeader = headerFirstCell === 'date'

  const headerIndex: Record<string, number> = {}
  if (hasHeader) {
    firstLineCells.forEach((cell, index) => {
      headerIndex[normalizeHeaderKey(cell)] = index
    })
  }

  const dataLines = hasHeader ? lines.slice(1) : lines

  return dataLines
    .map((line) => splitCsvLine(line))
    .map((cells) => {
      if (hasHeader) {
        return {
          date: readCell(cells, headerIndex.date).trim(),
          weight: parseNumber(readCell(cells, headerIndex.weight)),
          waist: parseNumber(readCell(cells, headerIndex.waist)),
          bodyFat: parseNumber(readCell(cells, headerIndex.bodyfat)),
          muscleMass: parseNumber(readCell(cells, headerIndex.musclemass)),
          chest: parseNumber(readCell(cells, headerIndex.chest)),
          hip: parseNumber(readCell(cells, headerIndex.hip)),
          note: readTailCell(cells, headerIndex.note),
        }
      }

      return {
        date: (cells[0] ?? '').trim(),
        weight: parseNumber(cells[1] ?? ''),
        waist: parseNumber(cells[2] ?? ''),
        bodyFat: null,
        muscleMass: null,
        chest: null,
        hip: null,
        note: cells.slice(3).join(',').trim(),
      }
    })
    .filter((record) => record.date.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function serializeBodyCsv(records: BodyRecord[]): string {
  const lines = [HEADER.join(',')]

  for (const record of records) {
    lines.push(
      [
        record.date,
        record.weight == null ? '' : String(record.weight),
        record.waist == null ? '' : String(record.waist),
        record.bodyFat == null ? '' : String(record.bodyFat),
        record.muscleMass == null ? '' : String(record.muscleMass),
        record.chest == null ? '' : String(record.chest),
        record.hip == null ? '' : String(record.hip),
        escapeCsvCell(record.note),
      ].join(','),
    )
  }

  return `${lines.join('\n')}\n`
}
