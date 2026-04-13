import { useEffect, useRef, useState } from 'react'

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  value: string
  onChange: React.ChangeEventHandler<HTMLInputElement>
}

export function ExpandableInput({ value, className, ...props }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [overflowing, setOverflowing] = useState(false)

  const check = () => {
    const el = inputRef.current
    if (el) setOverflowing(el.scrollWidth > el.clientWidth)
  }

  useEffect(() => {
    check()
  }, [value])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="space-y-1">
      {overflowing && value && (
        <p className="break-all text-xs leading-relaxed text-slate-500">{value}</p>
      )}
      <input ref={inputRef} className={className} value={value} {...props} />
    </div>
  )
}
