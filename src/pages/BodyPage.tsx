import { PageHeader } from '../components/PageHeader'

export function BodyPage() {
  return (
    <section>
      <PageHeader
        title="Body Progress"
        description="Track local body metrics from body.csv."
      />
      <p className="text-sm text-slate-600">CSV table, form, and trend charts will be added in a later step.</p>
    </section>
  )
}
