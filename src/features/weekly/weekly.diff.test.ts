import { describe, expect, test } from 'vitest'

import { parseWeeklyMarkdown } from './weekly.parser'
import { diffWeeklyAgainstTemplate } from './weekly.diff'

function parse(markdown: string) {
  return parseWeeklyMarkdown(markdown.trim(), '2026-W12')
}

describe('weekly template diff', () => {
  test('detects checklist and reflection changes', () => {
    const template = parse(`
# 2026-W12

## Body
- [ ] Lift

## Research
- [ ] Focus

## Life
- [ ] Walk

## Output
- [ ] Publish

## Social
- [ ] Reach out

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
`)
    const note = parse(`
# 2026-W12

## Body
- [x] Lift

## Research
- [ ] Focus

## Life
- [ ] Walk

## Output
- [ ] Publish

## Social
- [ ] Reach out

## Reflection
### 3 good things this week
1. one
2.
3.

### 3 most important things next week
1.
2.
3.
`)

    const diff = diffWeeklyAgainstTemplate(note, template)
    expect(diff.sections.Body.changedIds.size).toBe(1)
    expect(diff.reflection.goodThings.has(0)).toBe(true)
    expect(diff.hasAnyChange).toBe(true)
  })

  test('detects missing template items in section', () => {
    const template = parse(`
# 2026-W12

## Body
- [ ] Lift
- [ ] Cardio

## Research

## Life

## Output

## Social

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
`)
    const note = parse(`
# 2026-W12

## Body
- [ ] Lift

## Research

## Life

## Output

## Social

## Reflection
### 3 good things this week
1.
2.
3.

### 3 most important things next week
1.
2.
3.
`)

    const diff = diffWeeklyAgainstTemplate(note, template)
    expect(diff.sections.Body.changedIds.size).toBe(0)
    expect(diff.sections.Body.missingTemplateCount).toBe(1)
    expect(diff.hasAnyChange).toBe(true)
  })
})

