import type { CheckboxItem } from '../../types/tracker'

export function checkboxId(prefix: string, text: string, index: number): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${prefix}-${slug || 'item'}-${index}`
}

export function parseCheckbox(line: string): { checked: boolean; text: string; count: number } | null {
  const match = line.match(/^- \[( |x|X)\] (.*)$/)
  if (!match) {
    return null
  }

  const checked = match[1].toLowerCase() === 'x'
  const rawText = match[2].trim()

  // Match count pattern: ⏴\d+ at the end of text
  const countMatch = rawText.match(/^(.*)⏴(\d+)$/)
  if (countMatch) {
    return {
      checked,
      text: countMatch[1].trim(),
      count: parseInt(countMatch[2], 10),
    }
  }

  return {
    checked,
    text: rawText,
    count: 0,
  }
}

export function serializeChecklist(
  items: Array<Pick<CheckboxItem, 'checked' | 'text' | 'count'>>,
): string[] {
  return items.map((item) => {
    const count = item.count ?? 0
    const text = count > 0 ? `${item.text}⏴${count}` : item.text
    return `- [${item.checked ? 'x' : ' '}] ${text}`
  })
}
