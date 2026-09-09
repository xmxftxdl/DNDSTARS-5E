import { useCallback, useEffect, useRef, useState } from 'react'
import { enqueueDicePreview, finishDicePreview } from './dicePreviewQueue'
import type { DiceRoll } from '../../components/DiceRollOverlay'
import { DICE_TIMING } from '../../lib/diceOverlayShared'

export interface DiceBoxD20Request {
  id: number
  label: string
  targetName: string
  value?: number
  requestKey?: string
  flyIndex?: number
  settledHoldMs?: number
  resolve: (value: number) => void
}

export interface DiceBoxRollRequest {
  retainedValues?: number[]
  rerollIndex?: number
  id: number
  /** Full authoritative pool; `count` may be capped for 3D rendering. */
  totalCount?: number
  count: number
  sides: number
  label: string
  targetName: string
  values: number[]
  requestKey?: string
  flyIndex?: number
  settledHoldMs?: number
  resolve: (values: number[]) => void
}

export interface SharedRollRequestPreview {
  id: string
  kind: 'd20' | 'dice'
  settled?: boolean
  count: number
  sides: number
  values: number[]
  label: string
  targetName: string
}

/** Browser-only dice animation state. Authoritative results are supplied by callers. */
export function useDicePresentation(
  fallbackD20: (request: DiceBoxD20Request) => number,
) {
  const [roll, setRoll] = useState<DiceRoll | null>(null)
  const afterRollRef = useRef<(() => void) | null>(null)
  const d20RequestCounterRef = useRef(0)
  const diceBoxRollRequestCounterRef = useRef(0)
  const [diceBoxD20, setDiceBoxD20] = useState<DiceBoxD20Request | null>(null)
  const [diceBoxRoll, setDiceBoxRoll] = useState<DiceBoxRollRequest | null>(null)
  const [previewQueue, setPreviewQueue] = useState<SharedRollRequestPreview[]>([])
  const rollRequestPreview = previewQueue[0] ?? null
  const setRollRequestPreview = useCallback((incoming: SharedRollRequestPreview | null) => {
    setPreviewQueue(queue => enqueueDicePreview(queue, incoming))
  }, [])

  useEffect(() => {
    if (!diceBoxD20) return
    const request = diceBoxD20
    const timer = window.setTimeout(() => {
      setDiceBoxD20((current) => (current?.id === request.id ? null : current))
      request.resolve(request.value ?? fallbackD20(request))
    }, DICE_TIMING.D20_FAILSAFE_MS + (request.settledHoldMs ?? 0) + 1000)
    return () => window.clearTimeout(timer)
  }, [diceBoxD20, fallbackD20])

  useEffect(() => {
    if (!diceBoxRoll) return
    const request = diceBoxRoll
    const timer = window.setTimeout(() => {
      setDiceBoxRoll((current) => (current?.id === request.id ? null : current))
      request.resolve(request.rerollIndex != null ? [] : request.values)
    }, DICE_TIMING.ROLL_FAILSAFE_MS + (request.settledHoldMs ?? 0) + 1000)
    return () => window.clearTimeout(timer)
  }, [diceBoxRoll])

  useEffect(() => {
    if (!rollRequestPreview) return
    const id = rollRequestPreview.id
    const duration = DICE_TIMING.ROLL_FAILSAFE_MS + 1000
    const timer = window.setTimeout(() => {
      setPreviewQueue(queue => finishDicePreview(queue, id))
    }, duration)
    return () => window.clearTimeout(timer)
  }, [rollRequestPreview])

  const completeDiceBoxD20 = useCallback((request: DiceBoxD20Request, value: number) => {
    request.resolve(value)
    setDiceBoxD20((current) => (current?.id === request.id ? null : current))
  }, [])

  const completeDiceBoxRoll = useCallback((request: DiceBoxRollRequest, values: number[]) => {
    request.resolve(request.rerollIndex != null ? values : request.values.length > 0 ? request.values : values)
    setDiceBoxRoll((current) => (current?.id === request.id ? null : current))
  }, [])

  const completeRollRequestPreview = useCallback((id: string, delayMs: number) => {
    window.setTimeout(() => {
      setPreviewQueue(queue => finishDicePreview(queue, id))
    }, delayMs)
  }, [])

  return {
    roll,
    setRoll,
    afterRollRef,
    d20RequestCounterRef,
    diceBoxRollRequestCounterRef,
    diceBoxD20,
    setDiceBoxD20,
    diceBoxRoll,
    setDiceBoxRoll,
    rollRequestPreview,
    setRollRequestPreview,
    completeDiceBoxD20,
    completeDiceBoxRoll,
    completeRollRequestPreview,
  }
}
