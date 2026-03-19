export function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value))

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-teal-600 transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
