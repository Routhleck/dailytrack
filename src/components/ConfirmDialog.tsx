import { useEffect, useRef } from 'react'
import { useI18n } from '../features/i18n/I18nContext'

type ConfirmDialogProps = {
  open: boolean
  title: string
  body: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useI18n()
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) {
      confirmRef.current?.focus()
    }
  }, [open])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[min(24rem,calc(100vw-2rem))] rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="dt-btn dt-btn-secondary px-3 py-1 text-sm"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel ?? t('common.cancel')}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`dt-btn px-3 py-1 text-sm ${danger ? 'dt-btn-danger' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel ?? t('common.yes')}
          </button>
        </div>
      </div>
    </div>
  )
}
