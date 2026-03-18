import { PageHeader } from '../components/PageHeader'

export function DashboardPage() {
  return (
    <section>
      <PageHeader
        title="Dashboard"
        description="Today, this week, body metrics, and recent files will be displayed here."
      />
      <p className="text-sm text-slate-600">MVP dashboard summary cards are next.</p>
    </section>
  )
}
