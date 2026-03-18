import { useParams } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'

export function WeeklyNotePage() {
  const { weekId } = useParams()

  return (
    <section>
      <PageHeader
        title={weekId ? `Weekly Note: ${weekId}` : 'This Week'}
        description="Structured and raw markdown editing for weekly notes will live here."
      />
      <p className="text-sm text-slate-600">Weekly editor module is planned in next implementation step.</p>
    </section>
  )
}
