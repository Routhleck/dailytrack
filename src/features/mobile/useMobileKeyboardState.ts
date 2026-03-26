import { useSyncExternalStore } from 'react'

const MOBILE_MEDIA_QUERY = '(max-width: 767px)'
const KEYBOARD_OPEN_DELTA_PX = 120

// ---------- Module-level singleton ----------

let currentState = false
let frameId: number | null = null
const listeners = new Set<() => void>()

function computeKeyboardOpen(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  const isMobileLayout = window.matchMedia(MOBILE_MEDIA_QUERY).matches
  if (!isMobileLayout) {
    return false
  }
  const viewport = window.visualViewport
  if (!viewport) {
    return false
  }
  return window.innerHeight - viewport.height - viewport.offsetTop > KEYBOARD_OPEN_DELTA_PX
}

function notify() {
  for (const listener of listeners) {
    listener()
  }
}

function handleViewportEvent() {
  if (frameId != null) {
    window.cancelAnimationFrame(frameId)
  }
  frameId = window.requestAnimationFrame(() => {
    frameId = null
    const next = computeKeyboardOpen()
    if (next !== currentState) {
      currentState = next
      notify()
    }
  })
}

let listenersAttached = false

function ensureListeners() {
  if (listenersAttached || typeof window === 'undefined') {
    return
  }
  listenersAttached = true
  currentState = computeKeyboardOpen()

  window.addEventListener('resize', handleViewportEvent)
  window.addEventListener('orientationchange', handleViewportEvent)
  const viewport = window.visualViewport
  if (viewport) {
    viewport.addEventListener('resize', handleViewportEvent)
    viewport.addEventListener('scroll', handleViewportEvent)
  }
}

function subscribe(callback: () => void): () => void {
  ensureListeners()
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function getSnapshot(): boolean {
  return currentState
}

function getServerSnapshot(): boolean {
  return false
}

// ---------- Hook ----------

export function useMobileKeyboardState(): { isKeyboardOpen: boolean } {
  const isKeyboardOpen = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return { isKeyboardOpen }
}
