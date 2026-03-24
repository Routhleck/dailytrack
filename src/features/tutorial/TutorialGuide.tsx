import { useCallback, useEffect, useMemo, useState } from 'react'

import { useI18n } from '../i18n/I18nContext'
import type { MessageKey } from '../i18n/messages'
import { onTutorialOpen } from './tutorial.events'
import {
  clearTutorialDismissedForSession,
  clearTutorialPending,
  dismissTutorialForSession,
  isTutorialCompleted,
  isTutorialDismissedForSession,
  isTutorialPending,
  markTutorialCompleted,
} from './tutorial.store'

type TutorialStep = {
  target?: string
  titleKey: MessageKey
  bodyKey: MessageKey
}

type TutorialMode = 'auto' | 'manual'

const HIGHLIGHT_PADDING = 6
const TOOLTIP_WIDTH = 360
const EDGE_GAP = 16

const STEPS: TutorialStep[] = [
  {
    target: 'nav-dashboard',
    titleKey: 'tutorial.stepDashboardTitle',
    bodyKey: 'tutorial.stepDashboardBody',
  },
  {
    target: 'nav-today',
    titleKey: 'tutorial.stepTodayTitle',
    bodyKey: 'tutorial.stepTodayBody',
  },
  {
    target: 'nav-week',
    titleKey: 'tutorial.stepWeekTitle',
    bodyKey: 'tutorial.stepWeekBody',
  },
  {
    target: 'nav-body',
    titleKey: 'tutorial.stepBodyTitle',
    bodyKey: 'tutorial.stepBodyBody',
  },
  {
    target: 'nav-reports',
    titleKey: 'tutorial.stepReportsTitle',
    bodyKey: 'tutorial.stepReportsBody',
  },
  {
    target: 'nav-daily-list',
    titleKey: 'tutorial.stepDailyListTitle',
    bodyKey: 'tutorial.stepDailyListBody',
  },
  {
    target: 'nav-weekly-list',
    titleKey: 'tutorial.stepWeeklyListTitle',
    bodyKey: 'tutorial.stepWeeklyListBody',
  },
  {
    target: 'nav-sync',
    titleKey: 'tutorial.stepSyncTitle',
    bodyKey: 'tutorial.stepSyncBody',
  },
  {
    target: 'nav-profiles',
    titleKey: 'tutorial.stepProfilesTitle',
    bodyKey: 'tutorial.stepProfilesBody',
  },
  {
    target: 'nav-preferences',
    titleKey: 'tutorial.stepPreferencesTitle',
    bodyKey: 'tutorial.stepPreferencesBody',
  },
  {
    target: 'nav-settings',
    titleKey: 'tutorial.stepSettingsTitle',
    bodyKey: 'tutorial.stepSettingsBody',
  },
  {
    target: 'shell-language',
    titleKey: 'tutorial.stepLanguageTitle',
    bodyKey: 'tutorial.stepLanguageBody',
  },
  {
    titleKey: 'tutorial.stepSourceOfTruthTitle',
    bodyKey: 'tutorial.stepSourceOfTruthBody',
  },
  {
    titleKey: 'tutorial.stepFeatureMapTitle',
    bodyKey: 'tutorial.stepFeatureMapBody',
  },
  {
    titleKey: 'tutorial.stepWorkflowTitle',
    bodyKey: 'tutorial.stepWorkflowBody',
  },
]

function findStepRect(step: TutorialStep): DOMRect | null {
  if (!step.target) {
    return null
  }
  const element = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
  if (!element) {
    return null
  }
  return element.getBoundingClientRect()
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getTooltipPosition(rect: DOMRect | null): { left: number; top: number } {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const estimatedHeight = 260

  if (!rect) {
    return {
      left: clamp((viewportWidth - TOOLTIP_WIDTH) / 2, EDGE_GAP, viewportWidth - TOOLTIP_WIDTH - EDGE_GAP),
      top: clamp(viewportHeight * 0.16, EDGE_GAP, viewportHeight - estimatedHeight - EDGE_GAP),
    }
  }

  let left = rect.right + 16
  if (left + TOOLTIP_WIDTH > viewportWidth - EDGE_GAP) {
    left = rect.left - TOOLTIP_WIDTH - 16
  }

  left = clamp(left, EDGE_GAP, viewportWidth - TOOLTIP_WIDTH - EDGE_GAP)

  const top = clamp(rect.top, EDGE_GAP, viewportHeight - estimatedHeight - EDGE_GAP)
  return { left, top }
}

export function TutorialGuide({ blocked }: { blocked: boolean }) {
  const { t } = useI18n()
  const [active, setActive] = useState(false)
  const [mode, setMode] = useState<TutorialMode>('manual')
  const [stepIndex, setStepIndex] = useState(0)
  const [stepRect, setStepRect] = useState<DOMRect | null>(null)

  const currentStep = STEPS[stepIndex]
  const isFinalStep = stepIndex >= STEPS.length - 1

  const openTutorial = useCallback((nextMode: TutorialMode) => {
    clearTutorialDismissedForSession()
    setMode(nextMode)
    setStepIndex(0)
    setActive(true)
  }, [])

  const closeTutorial = useCallback(() => {
    setActive(false)
    setStepRect(null)
  }, [])

  const handleSkip = useCallback(() => {
    if (mode === 'auto') {
      dismissTutorialForSession()
      clearTutorialPending()
    }
    closeTutorial()
  }, [closeTutorial, mode])

  const handleFinish = useCallback(() => {
    markTutorialCompleted()
    closeTutorial()
  }, [closeTutorial])

  useEffect(() => {
    return onTutorialOpen(() => {
      openTutorial('manual')
    })
  }, [openTutorial])

  useEffect(() => {
    if (blocked || active) {
      return
    }
    if (!isTutorialPending()) {
      return
    }
    if (isTutorialCompleted()) {
      clearTutorialPending()
      return
    }
    if (isTutorialDismissedForSession()) {
      return
    }

    const timerId = window.setTimeout(() => openTutorial('auto'), 0)
    return () => window.clearTimeout(timerId)
  }, [active, blocked, openTutorial])

  useEffect(() => {
    if (!active) {
      return
    }

    const refreshRect = () => {
      setStepRect(findStepRect(STEPS[stepIndex]))
    }

    refreshRect()
    const intervalId = window.setInterval(refreshRect, 350)
    window.addEventListener('resize', refreshRect)
    window.addEventListener('scroll', refreshRect, true)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('resize', refreshRect)
      window.removeEventListener('scroll', refreshRect, true)
    }
  }, [active, stepIndex])

  useEffect(() => {
    if (!active) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleSkip()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, handleSkip])

  const tooltipPosition = useMemo(() => getTooltipPosition(stepRect), [stepRect])

  if (!active) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      <div className="absolute inset-0 bg-slate-900/45" />

      {stepRect ? (
        <div
          className="absolute rounded-md border-2 border-sky-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.55)] transition-all duration-200"
          style={{
            left: `${Math.max(EDGE_GAP, stepRect.left - HIGHLIGHT_PADDING)}px`,
            top: `${Math.max(EDGE_GAP, stepRect.top - HIGHLIGHT_PADDING)}px`,
            width: `${stepRect.width + HIGHLIGHT_PADDING * 2}px`,
            height: `${stepRect.height + HIGHLIGHT_PADDING * 2}px`,
          }}
        />
      ) : null}

      <div
        className="absolute w-[320px] rounded-lg border border-slate-200 bg-white p-4 shadow-2xl pointer-events-auto"
        style={{
          left: `${tooltipPosition.left}px`,
          top: `${tooltipPosition.top}px`,
          width: `${TOOLTIP_WIDTH}px`,
        }}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {t('tutorial.progress', { current: stepIndex + 1, total: STEPS.length })}
        </p>
        <h3 className="mt-1 text-base font-semibold text-slate-900">{t(currentStep.titleKey)}</h3>
        <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{t(currentStep.bodyKey)}</p>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={handleSkip}
            className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            {t('tutorial.skip')}
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
              disabled={stepIndex === 0}
              className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 disabled:opacity-50"
            >
              {t('tutorial.back')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (isFinalStep) {
                  handleFinish()
                  return
                }
                setStepIndex((current) => Math.min(STEPS.length - 1, current + 1))
              }}
              className="rounded-md bg-slate-900 px-3 py-1 text-sm font-medium text-white"
            >
              {isFinalStep ? t('tutorial.finish') : t('tutorial.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
