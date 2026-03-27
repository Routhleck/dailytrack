import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { useI18n } from '../features/i18n/I18nContext'
import { usePreferences } from '../features/preferences/PreferencesContext'
import { useDataRoot } from '../features/settings/DataRootContext'
import { markRuntimePerf, recordRuntimePerfSeries } from '../lib/perf/runtimePerf'

type StartupProgressGateProps = {
  children: ReactNode
  bridgesReady: boolean
}

const MIN_VISIBLE_MS = 420
const EXIT_FADE_MS = 240

function clampPercent(value: number): number {
  return Math.max(1, Math.min(100, Math.round(value)))
}

export function StartupProgressGate({ children, bridgesReady }: StartupProgressGateProps) {
  const { t } = useI18n()
  const { loading: dataRootLoading } = useDataRoot()
  const { loading: preferencesLoading } = usePreferences()

  const [progress, setProgress] = useState(9)
  const [readyFrameReached, setReadyFrameReached] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [hidden, setHidden] = useState(false)

  const mountedAtRef = useRef(0)
  const hiddenAtRef = useRef<number | null>(null)

  useEffect(() => {
    mountedAtRef.current = performance.now()
  }, [])

  const coreReady = !dataRootLoading && !preferencesLoading
  const readyToEnter = coreReady && bridgesReady && readyFrameReached

  const stageLabel = useMemo(() => {
    if (dataRootLoading) {
      return t('startup.stageDataRoot')
    }
    if (preferencesLoading) {
      return t('startup.stagePreferences')
    }
    if (!bridgesReady) {
      return t('startup.stageServices')
    }
    return t('startup.stageRender')
  }, [bridgesReady, dataRootLoading, preferencesLoading, t])

  const targetProgress = useMemo(() => {
    if (readyToEnter) {
      return 100
    }
    if (coreReady && bridgesReady) {
      return 94
    }
    if (coreReady) {
      return 82
    }
    if (!dataRootLoading) {
      return 56
    }
    return 30
  }, [bridgesReady, coreReady, dataRootLoading, readyToEnter])

  useEffect(() => {
    if (!coreReady) {
      return
    }

    let cancelled = false
    const frame = window.requestAnimationFrame(() => {
      if (!cancelled) {
        setReadyFrameReached(true)
      }
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [coreReady])

  useEffect(() => {
    if (hidden) {
      return
    }

    const timer = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= targetProgress) {
          return prev
        }
        const remaining = targetProgress - prev
        const step = Math.max(0.9, remaining * 0.24)
        return Math.min(targetProgress, prev + step)
      })
    }, 34)

    return () => {
      window.clearInterval(timer)
    }
  }, [hidden, targetProgress])

  useEffect(() => {
    if (!readyToEnter || hidden || exiting || progress < 99.5) {
      return
    }

    const elapsed = performance.now() - mountedAtRef.current
    const holdMs = Math.max(0, MIN_VISIBLE_MS - elapsed)
    let hideTimer: number | null = null
    const holdTimer = window.setTimeout(() => {
      setExiting(true)
      hideTimer = window.setTimeout(() => {
        hiddenAtRef.current = performance.now()
        setHidden(true)
        setExiting(false)
        markRuntimePerf('startup_gate_hidden')
        recordRuntimePerfSeries(
          'startup_gate_visible_ms',
          (hiddenAtRef.current ?? performance.now()) - mountedAtRef.current,
        )
      }, EXIT_FADE_MS)
    }, holdMs)

    return () => {
      window.clearTimeout(holdTimer)
      if (hideTimer != null) {
        window.clearTimeout(hideTimer)
      }
    }
  }, [exiting, hidden, progress, readyToEnter])

  return (
    <>
      {children}
      {!hidden ? (
        <div
          className={`dt-startup-gate ${exiting ? 'dt-startup-gate--exit' : ''}`}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="dt-startup-panel">
            <p className="dt-startup-title">{t('startup.loadingTitle')}</p>
            <p className="dt-startup-stage">{stageLabel}</p>
            <div className="dt-startup-progress-track" aria-hidden>
              <div className="dt-startup-progress-fill" style={{ width: `${clampPercent(progress)}%` }} />
            </div>
            <p className="dt-startup-percent">{clampPercent(progress)}%</p>
          </div>
        </div>
      ) : null}
    </>
  )
}
