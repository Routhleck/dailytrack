import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

type TaskCheckboxProps = {
  checked: boolean
  ariaLabel: string
  onToggle: (next: boolean) => void
}

export function TaskCheckbox({ checked, ariaLabel, onToggle }: TaskCheckboxProps) {
  const [burst, setBurst] = useState(false)
  const burstTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (burstTimerRef.current != null) {
        window.clearTimeout(burstTimerRef.current)
      }
    }
  }, [])

  function toggle(nextChecked: boolean) {
    if (nextChecked) {
      setBurst(false)
      window.requestAnimationFrame(() => {
        setBurst(true)
      })
      if (burstTimerRef.current != null) {
        window.clearTimeout(burstTimerRef.current)
      }
      burstTimerRef.current = window.setTimeout(() => {
        setBurst(false)
        burstTimerRef.current = null
      }, 380)
    }

    onToggle(nextChecked)
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== ' ' && event.key !== 'Enter') {
      return
    }
    event.preventDefault()
    toggle(!checked)
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      onClick={() => toggle(!checked)}
      className={`relative grid h-5 w-5 shrink-0 place-items-center rounded-full border transition ${
        checked
          ? 'border-teal-600 bg-teal-600 text-white shadow-[0_0_0_3px_rgba(15,118,110,0.15)]'
          : 'border-slate-300 bg-white text-transparent hover:border-teal-400'
      }`}
    >
      {burst ? (
        <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-teal-300 animate-[ping_380ms_ease-out]" />
      ) : null}
      <svg
        viewBox="0 0 16 16"
        className={`h-3.5 w-3.5 stroke-current stroke-[2.2] transition ${
          checked ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
        }`}
        fill="none"
      >
        <path d="M3.5 8.1L6.6 11.2L12.7 5.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
