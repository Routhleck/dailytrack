import type { CheckboxItem } from '../../types/tracker'

export function checkboxId(prefix: string, text: string, index: number): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${prefix}-${slug || 'item'}-${index}`
}

export function parseCheckbox(line: string): { checked: boolean; text: string } | null {
  const match = line.match(/^- \[( |x|X)\] (.*)$/)
  if (!match) {
    return null
  }

  return {
    checked: match[1].toLowerCase() === 'x',
    text: match[2].trim(),
  }
}

export function serializeChecklist(
  items: Array<Pick<CheckboxItem, 'checked' | 'text'>>,
): string[] {
  return items.map((item) => `- [${item.checked ? 'x' : ' '}] ${item.text}`)
}
