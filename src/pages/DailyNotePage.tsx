import { useParams } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'

export function DailyNotePage() {
  const { date } = useParams()

  return (
    <section>
      <PageHeader
        title={date ? `Daily Note: ${date}` : 'Today'}
        description="Structured and raw markdown editing for daily notes will live here."
      />
      <p className="text-sm text-slate-600">Daily editor module is planned in next implementation step.</p>
    </section>
  )
}
