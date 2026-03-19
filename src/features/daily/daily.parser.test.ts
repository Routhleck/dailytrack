import { describe, expect, test } from 'vitest'

import { parseDailyMarkdown } from './daily.parser'
import { serializeDailyMarkdown } from './daily.serializer'

describe('daily parser and serializer', () => {
  test('parses known sections and checkboxes', () => {
    const markdown = `# 2026-03-18\n\n## Daily Core\n- [x] Train\n- [ ] Research\n\n## Optional\n- [ ] Read\n\n## One Line\nGood day\n`

    const note = parseDailyMarkdown(markdown, '2026-03-18')

    expect(note.title).toBe('2026-03-18')
    expect(note.dailyCore).toHaveLength(2)
    expect(note.dailyCore[0]?.checked).toBe(true)
    expect(note.optional[0]?.text).toBe('Read')
    expect(note.oneLine).toBe('Good day')
  })

  test('roundtrip keeps semantic content', () => {
    const original = parseDailyMarkdown(
      `# 2026-03-18\n\n## Daily Core\n- [ ] A\n\n## Optional\n- [x] B\n\n## One Line\n-\n`,
      '2026-03-18',
    )

    const serialized = serializeDailyMarkdown(original)
    const reparsed = parseDailyMarkdown(serialized, '2026-03-18')

    expect(reparsed.dailyCore[0]?.text).toBe('A')
    expect(reparsed.optional[0]?.checked).toBe(true)
    expect(reparsed.oneLine).toBe('')
  })
})
