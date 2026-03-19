import { useMemo, useState } from 'react'

import { PageHeader } from '../components/PageHeader'
import { usePreferences } from '../features/preferences/PreferencesContext'
import type { TrackerPreferences } from '../types/preferences'
import type { WeeklySectionKey } from '../types/tracker'

const WEEKLY_ORDER: WeeklySectionKey[] = ['Body', 'Research', 'Life', 'Output', 'Social']

export function PreferencesPage() {
  const { preferences, loading, error, updatePreferences } = usePreferences()
  const [message, setMessage] = useState('')
  const draft = useMemo(() => preferences, [preferences])

  async function update(next: TrackerPreferences) {
    setMessage('')
    try {
      await updatePreferences(next)
      setMessage('Preferences saved.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save preferences.')
    }
  }

  if (loading) {
    return (
      <section>
        <PageHeader title="Preferences" description="Loading profile preferences..." />
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Preferences"
        description="Choose sections and metrics you want to track for the active profile."
      />

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}

      <article className="space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-900">Daily</h2>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={draft.daily.showOptional}
            onChange={(event) => {
              void update({
                ...draft,
                daily: {
                  ...draft.daily,
                  showOptional: event.target.checked,
                },
              })
            }}
          />
          Show Optional section
        </label>
      </article>

      <article className="space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-900">Weekly Sections</h2>
        <div className="space-y-2">
          {WEEKLY_ORDER.map((section) => (
            <label key={section} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.weekly.sections[section]}
                onChange={(event) => {
                  void update({
                    ...draft,
                    weekly: {
                      ...draft.weekly,
                      sections: {
                        ...draft.weekly.sections,
                        [section]: event.target.checked,
                      },
                    },
                  })
                }}
              />
              {section}
            </label>
          ))}
        </div>
      </article>

      <article className="space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-900">Body Metrics</h2>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={draft.body.weight}
            onChange={(event) => {
              void update({
                ...draft,
                body: {
                  ...draft.body,
                  weight: event.target.checked,
                },
              })
            }}
          />
          Track Weight
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={draft.body.waist}
            onChange={(event) => {
              void update({
                ...draft,
                body: {
                  ...draft.body,
                  waist: event.target.checked,
                },
              })
            }}
          />
          Track Waist
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={draft.body.note}
            onChange={(event) => {
              void update({
                ...draft,
                body: {
                  ...draft.body,
                  note: event.target.checked,
                },
              })
            }}
          />
          Track Body Note
        </label>
      </article>
    </section>
  )
}
