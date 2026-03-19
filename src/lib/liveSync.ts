const EVENT_NAME = 'dailytrack:data-changed'

export type DataChangedScope =
  | 'daily'
  | 'weekly'
  | 'body'
  | 'preferences'
  | 'profile'
  | 'settings'
  | 'all'

export type DataChangedDetail = {
  scope: DataChangedScope
  path?: string
  profile?: string
  at: number
}

export function emitDataChanged(detail: Omit<DataChangedDetail, 'at'>): void {
  window.dispatchEvent(
    new CustomEvent<DataChangedDetail>(EVENT_NAME, {
      detail: {
        ...detail,
        at: Date.now(),
      },
    }),
  )
}

export function onDataChanged(
  handler: (detail: DataChangedDetail) => void,
): () => void {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<DataChangedDetail>
    handler(customEvent.detail)
  }

  window.addEventListener(EVENT_NAME, listener)
  return () => window.removeEventListener(EVENT_NAME, listener)
}
