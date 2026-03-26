import { useCallback, useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'

type ConfirmState = {
  open: boolean
  title: string
  body: string
  danger?: boolean
  resolve: ((confirmed: boolean) => void) | null
}

const CLOSED_STATE: ConfirmState = { open: false, title: '', body: '', resolve: null }

/**
 * Hook that provides an imperative `confirm(title, body)` that returns a promise
 * resolving to true/false, backed by a ConfirmDialog rendered at the call site.
 */
export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState>(CLOSED_STATE)

  const confirm = useCallback((title: string, body: string, danger = false): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, title, body, danger, resolve })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    state.resolve?.(true)
    setState(CLOSED_STATE)
  }, [state])

  const handleCancel = useCallback(() => {
    state.resolve?.(false)
    setState(CLOSED_STATE)
  }, [state])

  const dialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      body={state.body}
      danger={state.danger}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )

  return { confirm, dialog }
}
