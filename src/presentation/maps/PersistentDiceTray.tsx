import { MAX_DICE_POOL_COUNT } from '../../lib/dicePoolLimits'
import type { DiceCheckPresentation } from './diceCheckPresentation'
import { useRef, useState } from 'react'
import DiceBoxRollOverlay from '../../components/DiceBoxRollOverlay'
import type { DiceTrayHistoryRecord } from './diceTrayHistory'

export interface PersistentDiceRequest {
  appendFrom?: number
  check?: DiceCheckPresentation
  dieSides?: number[]
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
export default function PersistentDiceTray({ request, visible, onGrabReroll, frameBounds, restoredRecord, check }: {
  check?: DiceCheckPresentation
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
    count: Math.min(MAX_DICE_POOL_COUNT, restoredRecord.values.length),
    values: restoredRecord.values.slice(0, MAX_DICE_POOL_COUNT),
    onComplete: () => undefined,
  } : null))
  if (request && request.id !== retained?.id) setRetained(request)
  const current = request && request.id !== retained?.id ? request : retained
  const worldCount = useRef(current?.count ?? 1)
  if (!current) return null
  if (!current.staging && current.appendFrom == null) worldCount.current = current.retainedValues?.length ?? current.count
  return <DiceBoxRollOverlay
    key={`dice-ui-2:${current.sides}:${worldCount.current}`}
    appendFrom={current.appendFrom}
    staging={current.staging}
    check={check ?? request?.check ?? current.check}
    requestId={current.id}
    count={current.count}
    sides={current.sides}
    dieSides={current.dieSides}
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
