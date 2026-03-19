import { describe, expect, test } from 'vitest'

import { parseWeeklyMarkdown } from './weekly.parser'
import { serializeWeeklyMarkdown } from './weekly.serializer'

describe('weekly parser and serializer', () => {
  test('parses sections and reflection', () => {
    const markdown = `# 2026-W12\n\n## Body\n- [x] Lift\n\n## Research\n- [ ] Work\n\n## Life\n- [ ] Walk\n\n## Output\n- [ ] Post\n\n## Social\n- [x] Meetup\n\n## Reflection\n### 3 good things this week\n1. A\n2. B\n3. C\n\n### 3 most important things next week\n1. D\n2. E\n3. F\n`

    const note = parseWeeklyMarkdown(markdown, '2026-W12')

    expect(note.sections.Body[0]?.checked).toBe(true)
    expect(note.sections.Social[0]?.checked).toBe(true)
    expect(note.reflection.goodThings[1]).toBe('B')
    expect(note.reflection.nextWeekTop3[2]).toBe('F')
  })

  test('roundtrip keeps semantic content', () => {
    const note = parseWeeklyMarkdown(
      `# 2026-W13\n\n## Body\n- [ ] A\n\n## Research\n\n## Life\n\n## Output\n\n## Social\n\n## Reflection\n### 3 good things this week\n1.\n2.\n3.\n\n### 3 most important things next week\n1. X\n2.\n3.\n`,
      '2026-W13',
    )

    const serialized = serializeWeeklyMarkdown(note)
    const reparsed = parseWeeklyMarkdown(serialized, '2026-W13')

    expect(reparsed.sections.Body[0]?.text).toBe('A')
    expect(reparsed.reflection.nextWeekTop3[0]).toBe('X')
    expect(reparsed.reflection.goodThings).toHaveLength(3)
  })
})
