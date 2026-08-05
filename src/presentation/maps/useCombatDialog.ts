import { useCallback, useEffect, useRef, useState } from 'react'

export type CombatDialogTone = 'sky' | 'violet' | 'amber' | 'rose'

export interface CombatDialogState {
  id: number
  title: string
  message: string
  confirmText: string
  cancelText?: string
  tone: CombatDialogTone
}

export interface CombatDialogRequest {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  tone?: CombatDialogTone
}

interface PendingCombatDialog extends CombatDialogState {
  resolve: (accepted: boolean) => void
}

/**
 * Browser-local modal continuation. The shared combat transaction remains the
 * authority; this hook only owns the promise waiting for a human UI choice.
 */
export function useCombatDialog() {
  const nextIdRef = useRef(0)
  const pendingRef = useRef<PendingCombatDialog | null>(null)
  const [combatDialog, setCombatDialog] = useState<CombatDialogState | null>(null)

  const closeCombatDialog = useCallback((accepted: boolean) => {
    const pending = pendingRef.current
    pendingRef.current = null
    setCombatDialog(null)
    pending?.resolve(accepted)
  }, [])

  const showCombatDialog = useCallback((request: CombatDialogRequest) =>
    new Promise<boolean>((resolve) => {
      pendingRef.current?.resolve(false)
      const pending: PendingCombatDialog = {
        id: ++nextIdRef.current,
        title: request.title,
        message: request.message,
        confirmText: request.confirmText ?? '确认',
        cancelText: request.cancelText,
        tone: request.tone ?? 'sky',
        resolve,
      }
      pendingRef.current = pending
      setCombatDialog({
        id: pending.id,
        title: pending.title,
        message: pending.message,
        confirmText: pending.confirmText,
        cancelText: pending.cancelText,
        tone: pending.tone,
      })
    }), [])

  const showCombatNotice = useCallback(
    (title: string, message: string, tone: CombatDialogTone = 'sky') =>
      showCombatDialog({ title, message, confirmText: '知道了', tone }),
    [showCombatDialog],
  )

  useEffect(() => () => {
    pendingRef.current?.resolve(false)
    pendingRef.current = null
  }, [])

  return {
    combatDialog,
    showCombatDialog,
    showCombatNotice,
    closeCombatDialog,
    cancelCombatDialog: () => closeCombatDialog(false),
  }
}
