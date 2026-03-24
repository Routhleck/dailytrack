import { useEffect, useState } from 'react'

const MOBILE_MEDIA_QUERY = '(max-width: 767px)'
const KEYBOARD_OPEN_DELTA_PX = 120

function getKeyboardOpenState(): boolean {
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

  const keyboardDelta = window.innerHeight - viewport.height - viewport.offsetTop
  return keyboardDelta > KEYBOARD_OPEN_DELTA_PX
}

export function useMobileKeyboardState(): { isKeyboardOpen: boolean } {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(() => getKeyboardOpenState())

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const viewport = window.visualViewport
    const updateKeyboardState = () => {
      setIsKeyboardOpen(getKeyboardOpenState())
    }

    updateKeyboardState()
    window.addEventListener('resize', updateKeyboardState)
    window.addEventListener('orientationchange', updateKeyboardState)

    if (viewport) {
      viewport.addEventListener('resize', updateKeyboardState)
      viewport.addEventListener('scroll', updateKeyboardState)
    }

    return () => {
      window.removeEventListener('resize', updateKeyboardState)
      window.removeEventListener('orientationchange', updateKeyboardState)
      if (viewport) {
        viewport.removeEventListener('resize', updateKeyboardState)
        viewport.removeEventListener('scroll', updateKeyboardState)
      }
    }
  }, [])

  return { isKeyboardOpen }
}
