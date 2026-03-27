import { describe, expect, it } from 'vitest'

import {
  clearTrackerMemoryCache,
  getCachedDailyDates,
  getCachedDailyNote,
  getCachedWeeklyIds,
  invalidateTrackerMemoryByFsEvent,
  setCachedDailyDates,
  setCachedDailyNote,
  setCachedWeeklyIds,
  touchCachedDailyDate,
  touchCachedWeeklyId,
} from './trackerMemoryStore'

describe('trackerMemoryStore', () => {
  const dataRoot = '/tmp/dailytrack-test'

  it('returns cloned daily notes from memory cache', () => {
    clearTrackerMemoryCache(dataRoot)
    setCachedDailyNote(dataRoot, {
      kind: 'daily',
      date: '2026-03-27',
      title: '2026-03-27',
      dailyCore: [{ id: 'a', text: 'A', checked: false }],
      optional: [],
      moodTag: '',
      energyTag: '',
      oneLine: '',
      raw: '# 2026-03-27\n',
    })

    const first = getCachedDailyNote(dataRoot, '2026-03-27')
    expect(first).not.toBeNull()
    if (first?.dailyCore[0]) {
      first.dailyCore[0].checked = true
    }

    const second = getCachedDailyNote(dataRoot, '2026-03-27')
    expect(second?.dailyCore[0]?.checked).toBe(false)
  })

  it('touches and sorts cached ids', () => {
    clearTrackerMemoryCache(dataRoot)
    setCachedDailyDates(dataRoot, ['2026-03-25'])
    touchCachedDailyDate(dataRoot, '2026-03-27')
    touchCachedDailyDate(dataRoot, '2026-03-26')
    expect(getCachedDailyDates(dataRoot)).toEqual(['2026-03-27', '2026-03-26', '2026-03-25'])

    setCachedWeeklyIds(dataRoot, ['2026-W12'])
    touchCachedWeeklyId(dataRoot, '2026-W13')
    expect(getCachedWeeklyIds(dataRoot)).toEqual(['2026-W13', '2026-W12'])
  })

  it('invalidates only touched daily cache entry from fs event', () => {
    clearTrackerMemoryCache(dataRoot)
    setCachedDailyNote(dataRoot, {
      kind: 'daily',
      date: '2026-03-27',
      title: '2026-03-27',
      dailyCore: [],
      optional: [],
      moodTag: '',
      energyTag: '',
      oneLine: '',
      raw: '# 2026-03-27\n',
    })
    setCachedDailyNote(dataRoot, {
      kind: 'daily',
      date: '2026-03-26',
      title: '2026-03-26',
      dailyCore: [],
      optional: [],
      moodTag: '',
      energyTag: '',
      oneLine: '',
      raw: '# 2026-03-26\n',
    })

    invalidateTrackerMemoryByFsEvent(
      dataRoot,
      'daily',
      '/tmp/dailytrack-data/profiles/default/daily/2026-03-27.md',
    )

    expect(getCachedDailyNote(dataRoot, '2026-03-27')).toBeNull()
    expect(getCachedDailyNote(dataRoot, '2026-03-26')).not.toBeNull()
    expect(getCachedDailyDates(dataRoot)).toBeNull()
  })
})
