import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type ToastKind = 'success' | 'error' | 'info'

type ToastItem = {
  id: number
  kind: ToastKind
  message: string
}

type ToastContextValue = {
  toasts: ToastItem[]
  pushToast: (message: string, kind?: ToastKind) => void
  pushSuccess: (message: string) => void
  pushError: (message: string) => void
  pushInfo: (message: string) => void
  dismissToast: (id: number) => void
}

const MAX_TOASTS = 4
const SUCCESS_LIFETIME_MS = 2600
const INFO_LIFETIME_MS = 3000
const ERROR_LIFETIME_MS = 5200

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

function toastLifetime(kind: ToastKind): number {
  switch (kind) {
    case 'success':
      return SUCCESS_LIFETIME_MS
    case 'error':
      return ERROR_LIFETIME_MS
    default:
      return INFO_LIFETIME_MS
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextIdRef = useRef(1)
  const timersRef = useRef(new Map<number, number>())

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const pushToast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextIdRef.current++
    setToasts((prev) => {
      const next = [...prev, { id, kind, message }]
      return next.slice(Math.max(0, next.length - MAX_TOASTS))
    })

    const timerId = window.setTimeout(() => {
      dismissToast(id)
    }, toastLifetime(kind))
    timersRef.current.set(id, timerId)
  }, [dismissToast])

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      pushToast,
      pushSuccess: (message) => pushToast(message, 'success'),
      pushError: (message) => pushToast(message, 'error'),
      pushInfo: (message) => pushToast(message, 'info'),
      dismissToast,
    }),
    [dismissToast, pushToast, toasts],
  )

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function ToastViewport() {
  const { toasts, dismissToast } = useToast()

  return (
    <aside className="pointer-events-none fixed right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[80] w-[min(24rem,calc(100vw-1.5rem))] space-y-2 md:right-6">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto dt-toast dt-toast-${toast.kind}`}
          role="status"
          aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
        >
          <p className="pr-6 text-sm">{toast.message}</p>
          <button
            type="button"
            className="absolute right-2 top-2 rounded-md px-1 text-xs text-slate-500 hover:bg-white/70"
            aria-label="Dismiss toast"
            onClick={() => dismissToast(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </aside>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used inside ToastProvider')
  }
  return ctx
}
