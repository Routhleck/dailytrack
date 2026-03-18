import { PageHeader } from '../components/PageHeader'

export function DailyListPage() {
  return (
    <section>
      <PageHeader
        title="Daily Notes"
        description="Browse daily markdown files from local storage."
      />
      <p className="text-sm text-slate-600">Daily file list and quick-open actions are coming next.</p>
    </section>
  )
}
