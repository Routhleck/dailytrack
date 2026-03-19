const TOUR_COMPLETED_KEY = 'dailytrack.tour.completed.v1'
const TOUR_PENDING_KEY = 'dailytrack.tour.pending.v1'
const TOUR_SESSION_DISMISSED_KEY = 'dailytrack.tour.dismissed.session.v1'

function parseFlag(value: string | null): boolean {
  return value === '1'
}

export function isTutorialCompleted(): boolean {
  return parseFlag(window.localStorage.getItem(TOUR_COMPLETED_KEY))
}

export function markTutorialCompleted(): void {
  window.localStorage.setItem(TOUR_COMPLETED_KEY, '1')
  clearTutorialPending()
  clearTutorialDismissedForSession()
}

export function isTutorialPending(): boolean {
  return parseFlag(window.localStorage.getItem(TOUR_PENDING_KEY))
}

export function markTutorialPending(): void {
  window.localStorage.setItem(TOUR_PENDING_KEY, '1')
}

export function clearTutorialPending(): void {
  window.localStorage.removeItem(TOUR_PENDING_KEY)
}

export function isTutorialDismissedForSession(): boolean {
  return parseFlag(window.sessionStorage.getItem(TOUR_SESSION_DISMISSED_KEY))
}

export function dismissTutorialForSession(): void {
  window.sessionStorage.setItem(TOUR_SESSION_DISMISSED_KEY, '1')
}

export function clearTutorialDismissedForSession(): void {
  window.sessionStorage.removeItem(TOUR_SESSION_DISMISSED_KEY)
}

export function resetTutorialState(): void {
  window.localStorage.removeItem(TOUR_COMPLETED_KEY)
  window.localStorage.removeItem(TOUR_PENDING_KEY)
  window.sessionStorage.removeItem(TOUR_SESSION_DISMISSED_KEY)
}
