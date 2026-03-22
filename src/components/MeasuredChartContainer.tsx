import { useEffect, useRef, useState, type ReactNode } from 'react'

type Size = {
  width: number
  height: number
}

type MeasuredChartContainerProps = {
  className?: string
  children: (size: Size) => ReactNode
}

export function MeasuredChartContainer({ className, children }: MeasuredChartContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useEffect(() => {
    const element = containerRef.current
    if (!element) {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const [entry] = entries
      if (!entry) {
        return
      }
      const nextWidth = Math.floor(entry.contentRect.width)
      const nextHeight = Math.floor(entry.contentRect.height)
      setSize((prev) =>
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight },
      )
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className={className}>
      {size.width > 0 && size.height > 0 ? children(size) : null}
    </div>
  )
}

