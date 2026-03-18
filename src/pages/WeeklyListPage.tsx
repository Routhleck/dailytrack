import { PageHeader } from '../components/PageHeader'

export function WeeklyListPage() {
  return (
    <section>
      <PageHeader
        title="Weekly Notes"
        description="Browse weekly markdown files from local storage."
      />
      <p className="text-sm text-slate-600">Weekly file list and quick-open actions are coming next.</p>
    </section>
  )
}
