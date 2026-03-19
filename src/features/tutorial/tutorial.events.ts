const EVENT_NAME = 'dailytrack:tutorial-open'

export type TutorialOpenDetail = {
  source: 'settings' | 'auto'
  at: number
}

export function emitTutorialOpen(source: TutorialOpenDetail['source'] = 'settings'): void {
  window.dispatchEvent(
    new CustomEvent<TutorialOpenDetail>(EVENT_NAME, {
      detail: {
        source,
        at: Date.now(),
      },
    }),
  )
}

export function onTutorialOpen(
  handler: (detail: TutorialOpenDetail) => void,
): () => void {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<TutorialOpenDetail>
    handler(customEvent.detail)
  }

  window.addEventListener(EVENT_NAME, listener)
  return () => window.removeEventListener(EVENT_NAME, listener)
}
