import { Link } from 'react-router-dom'

import { MORE_PAGE_ITEMS } from '../app/navigation'
import { NavGlyph } from '../components/NavGlyph'
import { PageHeader } from '../components/PageHeader'
import { useI18n } from '../features/i18n/I18nContext'

export function MorePage() {
  const { t } = useI18n()

  return (
    <section className="dt-page">
      <PageHeader title={t('more.title')} description={t('more.description')} />

      <ul className="grid gap-2 sm:grid-cols-2">
        {MORE_PAGE_ITEMS.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              data-tour={item.tourTarget}
              className="dt-panel-soft flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:-translate-y-0.5 hover:bg-white"
            >
              <span className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-700 shadow-sm">
                <NavGlyph name={item.icon} className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium text-slate-800">{t(item.labelKey)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
