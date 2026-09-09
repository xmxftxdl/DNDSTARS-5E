import { useState } from 'react'
import DiceBoxRollOverlay from '../../components/DiceBoxRollOverlay'
import type { DiceTrayHistoryRecord } from './diceTrayHistory'

export interface PersistentDiceRequest {
  id: string
  staging?: boolean
  count: number
  sides: number
  values: number[]
  label: string
  targetName: string
  settledHoldMs?: number
  retainedValues?: number[]
  rerollIndex?: number
  onComplete: (values: number[]) => void
}

/** Keep the same WebGL world after settlement; only a new pool replaces it. */
export default function PersistentDiceTray({ request, visible, onGrabReroll, frameBounds, restoredRecord }: {
  restoredRecord?: DiceTrayHistoryRecord
  request: PersistentDiceRequest | null
  visible: boolean
  frameBounds?: { top: number; height: number }
  onGrabReroll?: (index: number) => Promise<void>
}) {
  const [retained, setRetained] = useState<PersistentDiceRequest | null>(() => request ?? (restoredRecord ? {
    ...restoredRecord,
    id: `restored:${restoredRecord.id}`,
    staging: true,
    count: Math.min(12, restoredRecord.values.length),
    values: restoredRecord.values.slice(0, 12),
    onComplete: () => undefined,
  } : null))
  if (request && request.id !== retained?.id) setRetained(request)
  const current = request && request.id !== retained?.id ? request : retained
  if (!current) return null
  return <DiceBoxRollOverlay
    key={`dice-ui-2:${current.sides}:${current.retainedValues?.length ?? current.count}`}
    staging={current.staging}
    requestId={current.id}
    count={current.count}
    sides={current.sides}
    values={current.values}
    label={current.label}
    targetName={current.targetName}
    settledHoldMs={current.settledHoldMs}
    retainedValues={current.retainedValues}
    rerollIndex={current.rerollIndex}
    visible={visible}
    frameBounds={frameBounds}
    onGrabReroll={request ? undefined : onGrabReroll}
    layout="left-drawer"
    onComplete={current.onComplete}
  />
}
