type PerfMark = {
  name: string
  atEpochMs: number
  sinceStartMs: number
}

type NumericSeriesPoint = {
  atEpochMs: number
  valueMs: number
  meta?: Record<string, string | number | boolean | null>
}

type LongTaskPoint = {
  atEpochMs: number
  durationMs: number
}

type RuntimePerfState = {
  bootAtEpochMs: number
  bootAtPerfNowMs: number
  marks: PerfMark[]
  longTasks: LongTaskPoint[]
  firstInputDelayMs: number | null
  firstContentfulPaintMs: number | null
  largestContentfulPaintMs: number | null
  series: Record<string, NumericSeriesPoint[]>
}

const MAX_MARKS = 80
const MAX_SERIES_POINTS = 80
const MAX_LONG_TASKS = 80

const state: RuntimePerfState = {
  bootAtEpochMs: Date.now(),
  bootAtPerfNowMs: typeof performance !== 'undefined' ? performance.now() : 0,
  marks: [],
  longTasks: [],
  firstInputDelayMs: null,
  firstContentfulPaintMs: null,
  largestContentfulPaintMs: null,
  series: {},
}

let initialized = false

function trimArray<T>(items: T[], max: number) {
  if (items.length <= max) {
    return
  }
  items.splice(0, items.length - max)
}

function safeNowPerfMs() {
  if (typeof performance === 'undefined') {
    return 0
  }
  return performance.now()
}

function sinceStartMs(nowPerfMs = safeNowPerfMs()) {
  return Math.max(0, nowPerfMs - state.bootAtPerfNowMs)
}

function readPaintMetric(name: 'first-contentful-paint') {
  if (typeof performance === 'undefined') {
    return null
  }
  const entry = performance.getEntriesByName(name)[0]
  return entry ? Math.round(entry.startTime) : null
}

function pushMark(name: string) {
  state.marks.push({
    name,
    atEpochMs: Date.now(),
    sinceStartMs: Math.round(sinceStartMs()),
  })
  trimArray(state.marks, MAX_MARKS)
}

export function markRuntimePerf(name: string) {
  pushMark(name)
}

export function recordRuntimePerfSeries(
  key: string,
  valueMs: number,
  meta?: Record<string, string | number | boolean | null>,
) {
  const points = state.series[key] ?? []
  points.push({
    atEpochMs: Date.now(),
    valueMs: Math.round(valueMs),
    meta,
  })
  trimArray(points, MAX_SERIES_POINTS)
  state.series[key] = points
}

function observeLongTasks() {
  if (typeof PerformanceObserver === 'undefined') {
    return
  }
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      for (const entry of entries) {
        state.longTasks.push({
          atEpochMs: Date.now(),
          durationMs: Math.round(entry.duration),
        })
      }
      trimArray(state.longTasks, MAX_LONG_TASKS)
    })
    observer.observe({ type: 'longtask', buffered: true as boolean })
  } catch {
    // ignore unsupported observer type
  }
}

function observeFirstInputDelay() {
  if (typeof PerformanceObserver === 'undefined') {
    return
  }
  try {
    const observer = new PerformanceObserver((list) => {
      const entry = list.getEntries()[0]
      if (!entry || state.firstInputDelayMs != null) {
        return
      }

      const firstInputEntry = entry as PerformanceEventTiming
      const delay = firstInputEntry.processingStart - firstInputEntry.startTime
      state.firstInputDelayMs = Math.max(0, Math.round(delay))
      observer.disconnect()
    })
    observer.observe({ type: 'first-input', buffered: true as boolean })
  } catch {
    // ignore unsupported observer type
  }
}

function observeLargestContentfulPaint() {
  if (typeof PerformanceObserver === 'undefined') {
    return
  }
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const latest = entries[entries.length - 1]
      if (latest) {
        state.largestContentfulPaintMs = Math.round(latest.startTime)
      }
    })
    observer.observe({ type: 'largest-contentful-paint', buffered: true as boolean })
  } catch {
    // ignore unsupported observer type
  }
}

function trackVisibilityResume() {
  if (typeof document === 'undefined') {
    return
  }
  let visibleAtPerfMs: number | null = null
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
      return
    }

    visibleAtPerfMs = safeNowPerfMs()
    pushMark('visibility_visible')

    window.requestAnimationFrame(() => {
      if (visibleAtPerfMs == null) {
        return
      }
      recordRuntimePerfSeries('resume_to_first_frame_ms', safeNowPerfMs() - visibleAtPerfMs)
      visibleAtPerfMs = null
    })
  })
}

export function initRuntimePerf() {
  if (initialized) {
    return
  }
  initialized = true

  state.firstContentfulPaintMs = readPaintMetric('first-contentful-paint')
  pushMark('perf_init')

  observeLongTasks()
  observeFirstInputDelay()
  observeLargestContentfulPaint()
  trackVisibilityResume()
}

export function captureRuntimePerfSnapshot() {
  const navigationEntry = typeof performance !== 'undefined'
    ? (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)
    : undefined

  return {
    capturedAt: new Date().toISOString(),
    boot: {
      atEpochMs: state.bootAtEpochMs,
      nowSinceBootMs: Math.round(sinceStartMs()),
    },
    navigation: navigationEntry
      ? {
        type: navigationEntry.type,
        domContentLoadedMs: Math.round(navigationEntry.domContentLoadedEventEnd),
        loadEventMs: Math.round(navigationEntry.loadEventEnd),
        responseStartMs: Math.round(navigationEntry.responseStart),
      }
      : null,
    paint: {
      firstContentfulPaintMs: state.firstContentfulPaintMs,
      largestContentfulPaintMs: state.largestContentfulPaintMs,
      firstInputDelayMs: state.firstInputDelayMs,
    },
    longTasks: {
      count: state.longTasks.length,
      maxDurationMs: state.longTasks.reduce((max, item) => Math.max(max, item.durationMs), 0),
      recent: state.longTasks.slice(-20),
    },
    marks: state.marks.slice(),
    series: Object.fromEntries(
      Object.entries(state.series).map(([key, points]) => [key, points.slice()]),
    ),
  }
}
