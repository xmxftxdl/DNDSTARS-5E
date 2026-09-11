import { createDiceCheckCueLedger } from './diceCheckCueLedger'
import type { DiceCheckPresentation } from './diceCheckPresentation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { enqueueDicePreview, finishDicePreview } from './dicePreviewQueue'
import type { DiceRoll } from '../../components/DiceRollOverlay'
import { DICE_TIMING } from '../../lib/diceOverlayShared'
import type { DiceCheckOutcome } from './diceCheckOutcome'

export interface DiceBoxD20Request {
  check?: DiceCheckPresentation
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
  check?: DiceCheckPresentation
  dieSides?: number[]
  formula?: string
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
  check?: DiceCheckPresentation
  settlement?: DiceRoll['settlement']
  dieSides?: number[]
  formula?: string
  total?: number
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
  type AuthorityRequest = { kind: 'd20'; request: DiceBoxD20Request } | { kind: 'dice'; request: DiceBoxRollRequest }
  const [authorityPaused, setAuthorityPaused] = useState(false)
  const [authorityQueue, setAuthorityQueue] = useState<AuthorityRequest[]>([])
  const authorityQueueRef = useRef<AuthorityRequest[]>([])
  const fallbackD20Ref = useRef(fallbackD20)
  useEffect(() => { fallbackD20Ref.current = fallbackD20 }, [fallbackD20])
  const publishAuthorityQueue = useCallback((queue: AuthorityRequest[]) => {
    authorityQueueRef.current = queue
    setAuthorityQueue(queue)
  }, [])
  const enqueueAuthority = useCallback((incoming: AuthorityRequest) => {
    const queue = authorityQueueRef.current
    if (queue.some(item => item.kind === incoming.kind && item.request.id === incoming.request.id)) return
    publishAuthorityQueue([...queue, incoming])
  }, [publishAuthorityQueue])
  const clearAuthorityKind = useCallback((kind: AuthorityRequest['kind']) => {
    const removed = authorityQueueRef.current.filter(item => item.kind === kind)
    publishAuthorityQueue(authorityQueueRef.current.filter(item => item.kind !== kind))
    // Ending combat must release waiting presentations as well as the visible one.
    for (const item of removed) {
      if (item.kind === 'd20') item.request.resolve(item.request.value ?? fallbackD20Ref.current(item.request))
      else item.request.resolve(item.request.rerollIndex != null ? [] : item.request.values)
    }
  }, [publishAuthorityQueue])
  const setDiceBoxD20 = useCallback((request: DiceBoxD20Request | null) => {
    if (request) enqueueAuthority({ kind: 'd20', request })
    else clearAuthorityKind('d20')
  }, [enqueueAuthority, clearAuthorityKind])
  const setDiceBoxRoll = useCallback((request: DiceBoxRollRequest | null) => {
    if (request) enqueueAuthority({ kind: 'dice', request })
    else clearAuthorityKind('dice')
  }, [enqueueAuthority, clearAuthorityKind])
  const diceBoxD20 = !authorityPaused && authorityQueue[0]?.kind === 'd20' ? authorityQueue[0].request : null
  const diceBoxRoll = !authorityPaused && authorityQueue[0]?.kind === 'dice' ? authorityQueue[0].request : null
  const finishAuthority = useCallback((request: DiceBoxD20Request | DiceBoxRollRequest) => {
    if (authorityQueueRef.current[0]?.request !== request) return false
    publishAuthorityQueue(authorityQueueRef.current.slice(1))
    return true
  }, [publishAuthorityQueue])
  const [previewQueue, setPreviewQueue] = useState<SharedRollRequestPreview[]>([])
  const [previewPaused, setPreviewPaused] = useState(false)
  const setDicePreviewPaused = useCallback((paused: boolean, pauseAuthority = false) => {
    setPreviewPaused(paused)
    setAuthorityPaused(pauseAuthority)
  }, [])
  const [checkResult, setCheckResult] = useState<DiceCheckOutcome | null>(null)
  const [checkOutcomes, setCheckOutcomes] = useState<DiceCheckOutcome[]>([])
  // A resolved check must not wait behind unrelated damage or room dice animations.
  const checkOutcome = checkOutcomes[0] ?? null
  const cueLedgerRef = useRef<ReturnType<typeof createDiceCheckCueLedger> | null>(null)
  if (cueLedgerRef.current === null) {
    let storage: Storage | undefined
    try { storage = window.sessionStorage } catch { /* Storage can be disabled. */ }
    cueLedgerRef.current = createDiceCheckCueLedger(storage)
  }
  const enqueueCheckOutcome = useCallback((outcome: DiceCheckOutcome) => {
    if (outcome.rollId) setCheckResult(outcome)
    if (!cueLedgerRef.current!(outcome)) return
    setCheckOutcomes(queue => outcome.provisional ? [outcome, ...queue.filter(item => !item.provisional)]
      : queue.some(item => item.id === outcome.id) ? queue : [...queue, outcome])
  }, [])
  const clearCheckOutcomes = useCallback(() => setCheckOutcomes([]), [])
  useEffect(() => {
    if (!checkOutcome) return
    const timer = window.setTimeout(() => setCheckOutcomes(queue => queue.filter(item => item.id !== checkOutcome.id)), 2400)
    return () => window.clearTimeout(timer)
  }, [checkOutcome])
  const rollRequestPreview = diceBoxD20 || diceBoxRoll || previewPaused ? null : previewQueue[0] ?? null
  const setRollRequestPreview = useCallback((incoming: SharedRollRequestPreview | null) => {
    setPreviewQueue(queue => enqueueDicePreview(queue, incoming))
  }, [])

  useEffect(() => {
    if (!diceBoxD20) return
    const request = diceBoxD20
    const timer = window.setTimeout(() => {
      if (finishAuthority(request)) request.resolve(request.value ?? fallbackD20Ref.current(request))
    }, DICE_TIMING.D20_FAILSAFE_MS + (request.settledHoldMs ?? 0) + 1000)
    return () => window.clearTimeout(timer)
  }, [diceBoxD20, finishAuthority])

  useEffect(() => {
    if (!diceBoxRoll) return
    const request = diceBoxRoll
    const timer = window.setTimeout(() => {
      if (finishAuthority(request)) request.resolve(request.rerollIndex != null ? [] : request.values)
    }, DICE_TIMING.ROLL_FAILSAFE_MS + (request.settledHoldMs ?? 0) + 1000)
    return () => window.clearTimeout(timer)
  }, [diceBoxRoll, finishAuthority])

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
    if (finishAuthority(request)) request.resolve(value)
  }, [finishAuthority])

  const completeDiceBoxRoll = useCallback((request: DiceBoxRollRequest, values: number[]) => {
    if (finishAuthority(request)) request.resolve(request.rerollIndex != null ? values : request.values.length > 0 ? request.values : values)
  }, [finishAuthority])

  const completeRollRequestPreview = useCallback((id: string, delayMs: number) => {
    window.setTimeout(() => {
      setPreviewQueue(queue => finishDicePreview(queue, id))
    }, delayMs)
  }, [])

  return {
    checkOutcome,
    checkResult,
    enqueueCheckOutcome,
    clearCheckOutcomes,
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
    setDicePreviewPaused,
    completeDiceBoxD20,
    completeDiceBoxRoll,
    completeRollRequestPreview,
  }
}
