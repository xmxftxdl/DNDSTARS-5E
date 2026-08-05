import { useCallback, useEffect, useRef, useState } from 'react'
import type { DiceRoll } from '../../components/DiceRollOverlay'
import { DICE_TIMING } from '../../lib/diceOverlayShared'

export interface DiceBoxD20Request {
  id: number
  label: string
  targetName: string
  value?: number
  requestKey?: string
  flyIndex?: number
  resolve: (value: number) => void
}

export interface DiceBoxRollRequest {
  id: number
  count: number
  sides: number
  label: string
  targetName: string
  values: number[]
  requestKey?: string
  flyIndex?: number
  resolve: (values: number[]) => void
}

export interface SharedRollRequestPreview {
  id: string
  kind: 'd20' | 'dice'
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
  const [rollRequestPreview, setRollRequestPreview] = useState<SharedRollRequestPreview | null>(null)

  useEffect(() => {
    if (!diceBoxD20) return
    const request = diceBoxD20
    const timer = window.setTimeout(() => {
      setDiceBoxD20((current) => (current?.id === request.id ? null : current))
      request.resolve(request.value ?? fallbackD20(request))
    }, 4500)
    return () => window.clearTimeout(timer)
  }, [diceBoxD20, fallbackD20])

  useEffect(() => {
    if (!diceBoxRoll) return
    const request = diceBoxRoll
    const timer = window.setTimeout(() => {
      setDiceBoxRoll((current) => (current?.id === request.id ? null : current))
      request.resolve(request.values)
    }, DICE_TIMING.ROLL_FAILSAFE_MS + 1000)
    return () => window.clearTimeout(timer)
  }, [diceBoxRoll])

  useEffect(() => {
    if (!rollRequestPreview) return
    const id = rollRequestPreview.id
    const duration = rollRequestPreview.kind === 'd20' ? 4500 : 16000
    const timer = window.setTimeout(() => {
      setRollRequestPreview((current) => (current?.id === id ? null : current))
    }, duration)
    return () => window.clearTimeout(timer)
  }, [rollRequestPreview])

  const completeDiceBoxD20 = useCallback((request: DiceBoxD20Request, value: number) => {
    request.resolve(value)
    window.setTimeout(() => {
      setDiceBoxD20((current) => (current?.id === request.id ? null : current))
    }, 600)
  }, [])

  const completeDiceBoxRoll = useCallback((request: DiceBoxRollRequest, values: number[]) => {
    request.resolve(request.values.length > 0 ? request.values : values)
    window.setTimeout(() => {
      setDiceBoxRoll((current) => (current?.id === request.id ? null : current))
    }, 3000)
  }, [])

  const completeRollRequestPreview = useCallback((id: string, delayMs: number) => {
    window.setTimeout(() => {
      setRollRequestPreview((current) => (current?.id === id ? null : current))
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
