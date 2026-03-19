export function MarkdownEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  return (
    <textarea
      className="h-[60vh] w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-800 shadow-sm"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      spellCheck={false}
    />
  )
}
