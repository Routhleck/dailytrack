import { PageHeader } from '../components/PageHeader'
import { useI18n } from '../features/i18n/I18nContext'

export function SyncPage() {
  const { t } = useI18n()

  return (
    <section className="space-y-4">
      <PageHeader
        title={t('sync.title')}
        description={t('sync.description')}
      />

      <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-700">{t('sync.placeholder')}</p>
      </article>
    </section>
  )
}
