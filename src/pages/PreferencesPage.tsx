import { useMemo, useState } from 'react'

import { PageHeader } from '../components/PageHeader'
import { decimalInputStep } from '../features/body/body.format'
import { useI18n } from '../features/i18n/I18nContext'
import { usePreferences } from '../features/preferences/PreferencesContext'
import type { TrackerPreferences } from '../types/preferences'
import type { BodyNumericMetricKey, WeeklySectionKey } from '../types/tracker'

const WEEKLY_ORDER: WeeklySectionKey[] = ['Body', 'Research', 'Life', 'Output', 'Social']
const BODY_METRIC_ORDER: {
  key: BodyNumericMetricKey
  toggleLabelKey:
    | 'preferences.trackWeight'
    | 'preferences.trackWaist'
    | 'preferences.trackBodyFat'
    | 'preferences.trackMuscleMass'
    | 'preferences.trackChest'
    | 'preferences.trackHip'
}[] = [
  { key: 'weight', toggleLabelKey: 'preferences.trackWeight' },
  { key: 'waist', toggleLabelKey: 'preferences.trackWaist' },
  { key: 'bodyFat', toggleLabelKey: 'preferences.trackBodyFat' },
  { key: 'muscleMass', toggleLabelKey: 'preferences.trackMuscleMass' },
  { key: 'chest', toggleLabelKey: 'preferences.trackChest' },
  { key: 'hip', toggleLabelKey: 'preferences.trackHip' },
]

export function PreferencesPage() {
  const { t } = useI18n()
  const { preferences, loading, error, updatePreferences } = usePreferences()
  const [message, setMessage] = useState('')
  const draft = useMemo(() => preferences, [preferences])

  async function update(next: TrackerPreferences) {
    setMessage('')
    try {
      await updatePreferences(next)
      setMessage(t('preferences.saved'))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('preferences.saveFailed'))
    }
  }

  function updateBodyMetricToggle(key: BodyNumericMetricKey, checked: boolean) {
    void update({
      ...draft,
      body: {
        ...draft.body,
        [key]: checked,
      },
    })
  }

  function updateBodyMetricUnit(key: BodyNumericMetricKey, unit: string) {
    void update({
      ...draft,
      body: {
        ...draft.body,
        display: {
          ...draft.body.display,
          [key]: {
            ...draft.body.display[key],
            unit,
          },
        },
      },
    })
  }

  function updateBodyMetricDecimals(key: BodyNumericMetricKey, decimals: number) {
    void update({
      ...draft,
      body: {
        ...draft.body,
        display: {
          ...draft.body.display,
          [key]: {
            ...draft.body.display[key],
            decimals,
          },
        },
      },
    })
  }

  function updateBodyMetricGoalToggle(key: BodyNumericMetricKey, enabled: boolean) {
    void update({
      ...draft,
      body: {
        ...draft.body,
        goals: {
          ...draft.body.goals,
          [key]: {
            ...draft.body.goals[key],
            enabled,
          },
        },
      },
    })
  }

  function updateBodyMetricGoalValue(key: BodyNumericMetricKey, rawValue: string) {
    const trimmed = rawValue.trim()
    const parsed = trimmed ? Number(trimmed) : null
    const value = parsed != null && Number.isFinite(parsed) ? parsed : null

    void update({
      ...draft,
      body: {
        ...draft.body,
        goals: {
          ...draft.body.goals,
          [key]: {
            ...draft.body.goals[key],
            value,
          },
        },
      },
    })
  }

  function updateReminderEnabled(enabled: boolean) {
    void update({
      ...draft,
      reminders: {
        ...draft.reminders,
        enabled,
      },
    })
  }

  function updateReminderThreshold(
    key: 'dailyGapDays' | 'weeklyGapWeeks' | 'bodyGapDays',
    rawValue: string,
    min: number,
    max: number,
  ) {
    const parsed = Number.parseInt(rawValue, 10)
    if (!Number.isFinite(parsed)) {
      return
    }
    const normalized = Math.max(min, Math.min(max, parsed))
    void update({
      ...draft,
      reminders: {
        ...draft.reminders,
        [key]: normalized,
      },
    })
  }

  if (loading) {
    return (
      <section>
        <PageHeader title={t('preferences.title')} description={t('preferences.loadingDescription')} />
      </section>
    )
  }

  return (
    <section className="dt-page">
      <PageHeader
        title={t('preferences.title')}
        description={t('preferences.description')}
      />

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}

      <article className="dt-panel space-y-3 p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('preferences.daily')}</h2>
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
          {t('preferences.showOptional')}
        </label>
      </article>

      <article className="dt-panel space-y-3 p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('preferences.weeklySections')}</h2>
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
              {t(`section.${section}` as 'section.Body')}
            </label>
          ))}
        </div>
      </article>

      <article className="dt-panel space-y-3 p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('preferences.ui')}</h2>
        <p className="text-xs text-slate-500">{t('preferences.uiHint')}</p>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <span>{t('preferences.typographyScale')}</span>
          <select
            className="dt-input w-44 px-2 py-1 text-xs"
            value={draft.ui.typographyScale}
            onChange={(event) => {
              void update({
                ...draft,
                ui: {
                  ...draft.ui,
                  typographyScale: event.target.value as TrackerPreferences['ui']['typographyScale'],
                },
              })
            }}
          >
            <option value="sm">{t('preferences.typographySmall')}</option>
            <option value="md">{t('preferences.typographyMedium')}</option>
            <option value="lg">{t('preferences.typographyLarge')}</option>
          </select>
        </label>
      </article>

      <article className="dt-panel space-y-3 p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('preferences.sync')}</h2>
        <p className="text-xs text-slate-500">{t('preferences.syncHint')}</p>
        <div className="flex items-center gap-4 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="sync-mode"
              value="watch"
              checked={draft.sync.mode === 'watch'}
              onChange={() => {
                void update({
                  ...draft,
                  sync: {
                    mode: 'watch',
                  },
                })
              }}
            />
            {t('preferences.syncWatch')}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="sync-mode"
              value="poll"
              checked={draft.sync.mode === 'poll'}
              onChange={() => {
                void update({
                  ...draft,
                  sync: {
                    mode: 'poll',
                  },
                })
              }}
            />
            {t('preferences.syncPoll')}
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={draft.ui.mobile.showSyncBanner}
            onChange={(event) => {
              void update({
                ...draft,
                ui: {
                  ...draft.ui,
                  mobile: {
                    ...draft.ui.mobile,
                    showSyncBanner: event.target.checked,
                  },
                },
              })
            }}
          />
          {t('preferences.mobileSyncBanner')}
        </label>
      </article>

      <article className="dt-panel space-y-3 p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('preferences.reminders')}</h2>
        <p className="text-xs text-slate-500">{t('preferences.remindersHint')}</p>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={draft.reminders.enabled}
            onChange={(event) => updateReminderEnabled(event.target.checked)}
          />
          {t('preferences.remindersEnabled')}
        </label>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs text-slate-600">{t('preferences.reminderDailyGap')}</span>
            <input
              className="dt-input px-2 py-1 text-xs"
              type="number"
              min={1}
              max={30}
              value={draft.reminders.dailyGapDays}
              onChange={(event) => updateReminderThreshold('dailyGapDays', event.target.value, 1, 30)}
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs text-slate-600">{t('preferences.reminderWeeklyGap')}</span>
            <input
              className="dt-input px-2 py-1 text-xs"
              type="number"
              min={1}
              max={12}
              value={draft.reminders.weeklyGapWeeks}
              onChange={(event) => updateReminderThreshold('weeklyGapWeeks', event.target.value, 1, 12)}
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs text-slate-600">{t('preferences.reminderBodyGap')}</span>
            <input
              className="dt-input px-2 py-1 text-xs"
              type="number"
              min={1}
              max={90}
              value={draft.reminders.bodyGapDays}
              onChange={(event) => updateReminderThreshold('bodyGapDays', event.target.value, 1, 90)}
            />
          </label>
        </div>
      </article>

      <article className="dt-panel space-y-3 p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('preferences.viewFilters')}</h2>
        <p className="text-xs text-slate-500">{t('preferences.viewFiltersHint')}</p>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={draft.ui.showOnlyChanges.daily}
            onChange={(event) => {
              void update({
                ...draft,
                ui: {
                  ...draft.ui,
                  showOnlyChanges: {
                    ...draft.ui.showOnlyChanges,
                    daily: event.target.checked,
                  },
                },
              })
            }}
          />
          {t('preferences.showOnlyChangesDaily')}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={draft.ui.showOnlyChanges.weekly}
            onChange={(event) => {
              void update({
                ...draft,
                ui: {
                  ...draft.ui,
                  showOnlyChanges: {
                    ...draft.ui.showOnlyChanges,
                    weekly: event.target.checked,
                  },
                },
              })
            }}
          />
          {t('preferences.showOnlyChangesWeekly')}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={draft.ui.showOnlyChanges.body}
            onChange={(event) => {
              void update({
                ...draft,
                ui: {
                  ...draft.ui,
                  showOnlyChanges: {
                    ...draft.ui.showOnlyChanges,
                    body: event.target.checked,
                  },
                },
              })
            }}
          />
          {t('preferences.showOnlyChangesBody')}
        </label>
      </article>

      <article className="dt-panel space-y-3 p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('preferences.bodyMetrics')}</h2>
        <p className="text-xs text-slate-500">{t('preferences.bodyDisplayHint')}</p>
        {BODY_METRIC_ORDER.map((metric) => (
          <div key={metric.key} className="grid gap-2 rounded-md border border-slate-200 p-3 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.body[metric.key]}
                onChange={(event) => updateBodyMetricToggle(metric.key, event.target.checked)}
              />
              {t(metric.toggleLabelKey)}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <span>{t('preferences.unit')}</span>
              <input
                className="dt-input w-20 px-2 py-1 text-xs"
                value={draft.body.display[metric.key].unit}
                placeholder={t('preferences.unitPlaceholder')}
                onChange={(event) => updateBodyMetricUnit(metric.key, event.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <span>{t('preferences.decimals')}</span>
              <select
                className="dt-input w-20 px-2 py-1 text-xs"
                value={String(draft.body.display[metric.key].decimals)}
                onChange={(event) => updateBodyMetricDecimals(metric.key, Number(event.target.value))}
              >
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.body.goals[metric.key].enabled}
                  onChange={(event) => updateBodyMetricGoalToggle(metric.key, event.target.checked)}
                />
                {t('preferences.goalLine')}
              </label>
              <input
                className="dt-input w-24 px-2 py-1 text-xs"
                type="number"
                step={decimalInputStep(draft.body.display[metric.key].decimals)}
                disabled={!draft.body.goals[metric.key].enabled}
                value={
                  draft.body.goals[metric.key].value == null
                    ? ''
                    : String(draft.body.goals[metric.key].value)
                }
                placeholder={t('preferences.goalValuePlaceholder')}
                onChange={(event) => updateBodyMetricGoalValue(metric.key, event.target.value)}
              />
            </div>
          </div>
        ))}
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
          {t('preferences.trackBodyNote')}
        </label>
      </article>
    </section>
  )
}
