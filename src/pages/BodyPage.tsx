import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { PageHeader } from '../components/PageHeader'
import { getBodyRecords, saveBodyRecords } from '../features/body/body.service'
import { useI18n } from '../features/i18n/I18nContext'
import { usePreferences } from '../features/preferences/PreferencesContext'
import { useDataRoot } from '../features/settings/DataRootContext'
import { todayDateString } from '../lib/date/date'
import { emitDataChanged } from '../lib/liveSync'
import type { BodyRecord } from '../types/tracker'

type FormState = {
  date: string
  weight: string
  waist: string
  note: string
}

function parseNullableNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function toFormState(record?: BodyRecord): FormState {
  if (!record) {
    return { date: todayDateString(), weight: '', waist: '', note: '' }
  }

  return {
    date: record.date,
    weight: record.weight == null ? '' : String(record.weight),
    waist: record.waist == null ? '' : String(record.waist),
    note: record.note,
  }
}

export function BodyPage() {
  const { t } = useI18n()
  const { dataRoot } = useDataRoot()
  const { preferences, loading: preferencesLoading } = usePreferences()

  const [records, setRecords] = useState<BodyRecord[]>([])
  const [form, setForm] = useState<FormState>(toFormState())
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  const recordsRef = useRef<BodyRecord[]>([])
  const editingIndexRef = useRef<number | null>(null)
  const syncingRef = useRef(false)

  useEffect(() => {
    recordsRef.current = records
  }, [records])

  useEffect(() => {
    editingIndexRef.current = editingIndex
  }, [editingIndex])

  useEffect(() => {
    if (!dataRoot) {
      return
    }

    void getBodyRecords(dataRoot)
      .then((items) => {
        setRecords(items)
      })
      .catch(() => setMessage(t('body.loadFailed')))
  }, [dataRoot, t])

  async function persist(nextRecords: BodyRecord[]) {
    if (!dataRoot) {
      return
    }

    try {
      const saved = await saveBodyRecords(dataRoot, nextRecords)
      setRecords(saved)
      setMessage(t('body.saved'))
      emitDataChanged({ scope: 'body' })
    } catch {
      setMessage(t('body.saveFailed'))
    }
  }

  useEffect(() => {
    if (!dataRoot) {
      return
    }

    const timer = window.setInterval(() => {
      if (editingIndexRef.current != null || syncingRef.current) {
        return
      }

      syncingRef.current = true
      void getBodyRecords(dataRoot)
        .then((latest) => {
          const currentSignature = JSON.stringify(recordsRef.current)
          const latestSignature = JSON.stringify(latest)
          if (currentSignature !== latestSignature) {
            setRecords(latest)
            setMessage(t('body.updatedFromDisk'))
          }
        })
        .catch(() => {
          // ignore polling failures
        })
        .finally(() => {
          syncingRef.current = false
        })
    }, 3000)

    return () => {
      window.clearInterval(timer)
    }
  }, [dataRoot, t])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const editingRecord = editingIndex == null ? undefined : records[editingIndex]

    const nextRecord: BodyRecord = {
      date: form.date,
      weight: preferences.body.weight
        ? parseNullableNumber(form.weight)
        : (editingRecord?.weight ?? null),
      waist: preferences.body.waist
        ? parseNullableNumber(form.waist)
        : (editingRecord?.waist ?? null),
      note: preferences.body.note ? form.note.trim() : (editingRecord?.note ?? ''),
    }

    if (!nextRecord.date) {
      setMessage(t('body.dateRequired'))
      return
    }

    const nextRecords = [...records]
    if (editingIndex == null) {
      nextRecords.unshift(nextRecord)
    } else {
      nextRecords[editingIndex] = nextRecord
    }

    await persist(nextRecords)
    setForm(toFormState())
    setEditingIndex(null)
  }

  async function handleDelete(index: number) {
    const nextRecords = records.filter((_, idx) => idx !== index)
    await persist(nextRecords)

    if (editingIndex === index) {
      setForm(toFormState())
      setEditingIndex(null)
    }
  }

  const chartData = useMemo(() => [...records].reverse(), [records])

  if (preferencesLoading) {
    return (
      <section>
        <PageHeader title={t('body.title')} description={t('body.loadingPreferences')} />
      </section>
    )
  }

  const showWeight = preferences.body.weight
  const showWaist = preferences.body.waist
  const showNote = preferences.body.note

  return (
    <section className="space-y-6">
      <PageHeader
        title={t('body.title')}
        description={t('body.description')}
      />

      <form
        onSubmit={handleSubmit}
        className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-4"
      >
        <input
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          type="date"
          value={form.date}
          onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
          required
        />

        {showWeight ? (
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            type="number"
            step="0.1"
            placeholder={t('body.weight')}
            value={form.weight}
            onChange={(event) => setForm((prev) => ({ ...prev, weight: event.target.value }))}
          />
        ) : null}

        {showWaist ? (
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            type="number"
            step="0.1"
            placeholder={t('body.waist')}
            value={form.waist}
            onChange={(event) => setForm((prev) => ({ ...prev, waist: event.target.value }))}
          />
        ) : null}

        {showNote ? (
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder={t('body.note')}
            value={form.note}
            onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
          />
        ) : null}

        <div className="md:col-span-4 flex items-center gap-2">
          <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white" type="submit">
            {editingIndex == null ? t('body.addRecord') : t('body.updateRecord')}
          </button>
          {editingIndex != null ? (
            <button
              type="button"
              className="rounded-md bg-slate-300 px-4 py-2 text-sm text-slate-800"
              onClick={() => {
                setEditingIndex(null)
                setForm(toFormState())
              }}
            >
              {t('common.cancelEdit')}
            </button>
          ) : null}
          {message ? <span className="text-sm text-slate-600">{message}</span> : null}
        </div>
      </form>

      {showWeight || showWaist ? (
        <div className={`grid gap-4 ${showWeight && showWaist ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
          {showWeight ? (
            <article className="rounded-lg border border-slate-200 p-4">
              <h2 className="mb-3 text-base font-semibold text-slate-900">{t('body.weightTrend')}</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="weight" stroke="#0f766e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>
          ) : null}

          {showWaist ? (
            <article className="rounded-lg border border-slate-200 p-4">
              <h2 className="mb-3 text-base font-semibold text-slate-900">{t('body.waistTrend')}</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="waist" stroke="#334155" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>
          ) : null}
        </div>
      ) : (
        <article className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
          {t('body.allDisabled')}
        </article>
      )}

      <article className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-base font-semibold text-slate-900">{t('body.history')}</h2>
        <div className="overflow-auto">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2">{t('body.date')}</th>
                {showWeight ? <th className="py-2">{t('body.weight')}</th> : null}
                {showWaist ? <th className="py-2">{t('body.waist')}</th> : null}
                {showNote ? <th className="py-2">{t('body.note')}</th> : null}
                <th className="py-2">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, index) => (
                <tr key={`${record.date}-${index}`} className="border-b border-slate-100">
                  <td className="py-2">{record.date}</td>
                  {showWeight ? <td className="py-2">{record.weight ?? '-'}</td> : null}
                  {showWaist ? <td className="py-2">{record.waist ?? '-'}</td> : null}
                  {showNote ? <td className="py-2">{record.note || '-'}</td> : null}
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button
                        className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-700"
                        onClick={() => {
                          setEditingIndex(index)
                          setForm(toFormState(record))
                        }}
                        type="button"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        className="rounded bg-rose-100 px-2 py-1 text-xs text-rose-700"
                        onClick={() => void handleDelete(index)}
                        type="button"
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  )
}
