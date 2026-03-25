import { describe, expect, test } from 'vitest'

import { parseDailyMarkdown } from './daily.parser'
import { diffDailyAgainstTemplate } from './daily.diff'

function parse(markdown: string) {
  return parseDailyMarkdown(markdown.trim(), '2026-03-22')
}

describe('daily template diff', () => {
  test('detects checked-item, mood/energy, and one-line changes', () => {
    const template = parse(`
# 2026-03-22

## Daily Core
- [ ] Train
- [ ] Deep work

## Optional
- [ ] Read

## Mood & Energy
- Mood: steady
- Energy: medium

## One Line
-
`)
    const note = parse(`
# 2026-03-22

## Daily Core
- [x] Train
- [ ] Deep work

## Optional
- [ ] Read

## Mood & Energy
- Mood: low
- Energy: high

## One Line
Nice day
`)

    const diff = diffDailyAgainstTemplate(note, template)
    expect(diff.dailyCore.changedIds.size).toBe(1)
    expect(diff.optional.changedIds.size).toBe(0)
    expect(diff.moodTagChanged).toBe(true)
    expect(diff.energyTagChanged).toBe(true)
    expect(diff.oneLineChanged).toBe(true)
    expect(diff.hasAnyChange).toBe(true)
  })

  test('detects missing template items', () => {
    const template = parse(`
# 2026-03-22

## Daily Core
- [ ] Train
- [ ] Deep work

## Optional
- [ ] Read

## Mood & Energy
- Mood: -
- Energy: -

## One Line
-
`)
    const note = parse(`
# 2026-03-22

## Daily Core
- [ ] Train

## Optional
- [ ] Read

## Mood & Energy
- Mood: -
- Energy: -

## One Line
-
`)

    const diff = diffDailyAgainstTemplate(note, template)
    expect(diff.dailyCore.changedIds.size).toBe(0)
    expect(diff.dailyCore.missingTemplateCount).toBe(1)
    expect(diff.hasAnyChange).toBe(true)
  })
})
