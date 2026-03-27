import { invoke } from '@tauri-apps/api/core'

type QueueWriteOptions = {
  maxDelayMs?: number
  idleTimeoutMs?: number
}

type Deferred = {
  resolve: () => void
  reject: (error: unknown) => void
}

type PendingWrite = {
  dataRoot: string
  path: string
  content: string
  createdAt: number
  deadlineAt: number
  deferreds: Deferred[]
}

const DEFAULT_MAX_DELAY_MS = 2200
const DEFAULT_IDLE_TIMEOUT_MS = 1000

const pendingWrites = new Map<string, PendingWrite>()

let idleFallbackTimerId: number | null = null
let deadlineTimerId: number | null = null
let idleCallbackId: number | null = null
let flushInFlight: Promise<void> | null = null
let lifecycleHookBound = false

function nowMs(): number {
  return Date.now()
}

function writeKey(dataRoot: string, path: string): string {
  return `${dataRoot}::${path}`
}

function clearIdleScheduledTask() {
  if (typeof window === 'undefined') {
    return
  }

  if (idleCallbackId != null && typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(idleCallbackId)
    idleCallbackId = null
  }

  if (idleFallbackTimerId != null) {
    window.clearTimeout(idleFallbackTimerId)
    idleFallbackTimerId = null
  }
}

function scheduleIdleFlush(timeoutMs: number) {
  if (typeof window === 'undefined') {
    return
  }
  if (idleCallbackId != null || idleFallbackTimerId != null) {
    return
  }

  if (typeof window.requestIdleCallback === 'function') {
    idleCallbackId = window.requestIdleCallback(
      () => {
        idleCallbackId = null
        void flushQueuedTextWrites('idle')
      },
      { timeout: timeoutMs },
    )
    return
  }

  idleFallbackTimerId = window.setTimeout(() => {
    idleFallbackTimerId = null
    void flushQueuedTextWrites('idle-fallback')
  }, 32)
}

function scheduleDeadlineFlush() {
  if (typeof window === 'undefined') {
    return
  }

  if (deadlineTimerId != null) {
    window.clearTimeout(deadlineTimerId)
    deadlineTimerId = null
  }

  if (pendingWrites.size === 0) {
    return
  }

  const nextDeadline = Array.from(pendingWrites.values()).reduce(
    (min, item) => Math.min(min, item.deadlineAt),
    Number.POSITIVE_INFINITY,
  )
  const delayMs = Math.max(0, nextDeadline - nowMs())
  deadlineTimerId = window.setTimeout(() => {
    deadlineTimerId = null
    void flushQueuedTextWrites('deadline')
  }, delayMs)
}

function bindLifecycleHooks() {
  if (lifecycleHookBound) {
    return
  }
  lifecycleHookBound = true

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void flushQueuedTextWrites('visibility-hidden')
    }
  })

  window.addEventListener('beforeunload', () => {
    void flushQueuedTextWrites('beforeunload')
  })

  window.addEventListener('pagehide', () => {
    void flushQueuedTextWrites('pagehide')
  })
}

function drainPendingWrites(): PendingWrite[] {
  const writes = Array.from(pendingWrites.values()).sort((left, right) => {
    if (left.deadlineAt !== right.deadlineAt) {
      return left.deadlineAt - right.deadlineAt
    }
    return left.createdAt - right.createdAt
  })
  pendingWrites.clear()
  return writes
}

export function queueWriteTextFile(
  dataRoot: string,
  path: string,
  content: string,
  options?: QueueWriteOptions,
): Promise<void> {
  bindLifecycleHooks()

  const maxDelayMs = Math.max(16, Math.trunc(options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS))
  const idleTimeoutMs = Math.max(16, Math.trunc(options?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS))
  const key = writeKey(dataRoot, path)
  const deadlineAt = nowMs() + maxDelayMs

  return new Promise<void>((resolve, reject) => {
    const existing = pendingWrites.get(key)
    if (existing) {
      existing.content = content
      existing.deadlineAt = Math.min(existing.deadlineAt, deadlineAt)
      existing.deferreds.push({ resolve, reject })
    } else {
      pendingWrites.set(key, {
        dataRoot,
        path,
        content,
        createdAt: nowMs(),
        deadlineAt,
        deferreds: [{ resolve, reject }],
      })
    }

    scheduleIdleFlush(idleTimeoutMs)
    scheduleDeadlineFlush()
  })
}

export async function flushQueuedTextWrites(reason = 'manual'): Promise<void> {
  bindLifecycleHooks()

  if (flushInFlight) {
    return flushInFlight
  }

  flushInFlight = (async () => {
    clearIdleScheduledTask()
    if (typeof window !== 'undefined' && deadlineTimerId != null) {
      window.clearTimeout(deadlineTimerId)
      deadlineTimerId = null
    }

    while (pendingWrites.size > 0) {
      const writes = drainPendingWrites()
      for (const entry of writes) {
        try {
          await invoke<void>('write_text_file', {
            path: entry.path,
            content: entry.content,
            dataRoot: entry.dataRoot,
          })
          for (const deferred of entry.deferreds) {
            deferred.resolve()
          }
        } catch (error) {
          console.warn('[write-behind] failed to flush queued write', {
            reason,
            path: entry.path,
            error,
          })
          for (const deferred of entry.deferreds) {
            deferred.reject(error)
          }
        }
      }
    }
  })().finally(() => {
    flushInFlight = null
    if (pendingWrites.size > 0) {
      scheduleIdleFlush(DEFAULT_IDLE_TIMEOUT_MS)
      scheduleDeadlineFlush()
    }
  })

  return flushInFlight
}
