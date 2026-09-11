import { MAX_DICE_POOL_COUNT } from '../lib/dicePoolLimits'
import { adoptedD20Index, type DiceCheckPresentation } from '../presentation/maps/diceCheckPresentation'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
// FLY_OFFSETS / stableIndex / 握手 / 时序常量收口到共享模块。
import { DICE_TIMING, parseDiceBoxMessage, resolveFlyOffset } from '../lib/diceOverlayShared'
import DiceOverlayPortal from './DiceOverlayPortal'
import { onDiceDocumentHidden } from '../lib/diceVisibility'

const MIN_VISIBLE_ROLL_MS = DICE_TIMING.ROLL_MIN_VISIBLE_MS

interface DiceBoxRollOverlayProps {
  check?: DiceCheckPresentation
  staging?: boolean
  retainedValues?: number[]
  rerollIndex?: number
  visible?: boolean
  frameBounds?: { top: number; height: number }
  onGrabReroll?: (index: number) => Promise<void>
  count: number
  dieSides?: number[]
  sides: number
  label: string
  targetName: string
  visualOnly?: boolean
  values?: number[]
  requestId?: string
  flyIndex?: number
  settledHoldMs?: number
  layout?: 'center' | 'left-drawer'
  showHud?: boolean
  onComplete: (values: number[]) => void
}

function fallbackValues(count: number, sides: number) {
  return Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides))
}

export default function DiceBoxRollOverlay({
  staging = false,
  check,
  retainedValues,
  rerollIndex,
  visible = true,
  frameBounds,
  onGrabReroll,
  count,
  dieSides,
  sides,
  label,
  targetName,
  visualOnly = false,
  values: forcedValues,
  requestId: forcedRequestId,
  flyIndex,
  settledHoldMs = 0,
  layout = 'center',
  showHud: _showHud = false,
  onComplete,
}: DiceBoxRollOverlayProps) {
  void _showHud
  void visualOnly
  void label
  void targetName
  const rawId = useId()
  const generatedRequestId = `dice-${rawId}`
  const requestId = forcedRequestId ?? generatedRequestId
  const iframeSides = Math.max(2, Math.min(100, Math.round(Number(sides) || 6)))
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [frameReady, setFrameReady] = useState(false)
  const readyRef = useRef(false)
  const completedRef = useRef(false)
  const sentRequestRef = useRef<string | null>(null)
  const onCompleteRef = useRef(onComplete)
  const [flyX, flyY] = useMemo(() => resolveFlyOffset(requestId, flyIndex), [flyIndex, requestId])
  const safeCountForFrame = Math.max(1, Math.min(MAX_DICE_POOL_COUNT, retainedValues?.length ?? Math.round(count)))

  useEffect(() => {
    const setInteractive = (enabled: boolean) => iframeRef.current?.contentWindow?.postMessage(
      { type: 'dice-box-interactive', requestId, enabled }, window.location.origin,
    )
    setInteractive(visible && !!onGrabReroll)
    const handleGrab = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return
      const data = parseDiceBoxMessage(event)
      if (data?.type === 'dice-box-roll-result' && data.requestId === requestId) {
        setInteractive(visible && !!onGrabReroll)
        return
      }
      if (data?.type !== 'dice-box-reroll-die' || data.requestId !== requestId || !visible || !onGrabReroll) return
      if (!Number.isInteger(data.index) || data.index! < 0 || data.index! >= safeCountForFrame) return
      void onGrabReroll(data.index!).catch(() => setInteractive(true))
    }
    window.addEventListener('message', handleGrab)
    return () => { setInteractive(false); window.removeEventListener('message', handleGrab) }
  }, [onGrabReroll, requestId, safeCountForFrame, visible])

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    completedRef.current = false
    let cancelled = false
    let completionTimer: number | undefined
    let deliverPending: (() => void) | undefined
    const startedAt = Date.now()
    const safeCount = Math.max(1, Math.min(MAX_DICE_POOL_COUNT, Math.round(count)))
    const safeSides = Math.max(2, Math.min(100, Math.round(sides)))
    const log = (stage: string, details?: Record<string, unknown>) => {
      console.info('[dice-box-roll-overlay]', {
        requestId,
        stage,
        elapsedMs: Date.now() - startedAt,
        sides: safeSides,
        count: safeCount,
        forcedValues,
        ...details,
      })
    }
    const finish = (values: unknown) => {
      if (cancelled || completedRef.current) return
      completedRef.current = true
      const rolled = Array.isArray(values)
        ? values.map((value) => Math.max(1, Math.min(safeSides, Math.round(Number(value)))))
        : []
      const physicalValues = Array.isArray(values) && values.every((value) =>
        Number.isInteger(value) && value >= 1 && value <= safeSides,
      ) ? values as number[] : []
      const finalValues =
        retainedValues && rerollIndex != null
          ? (physicalValues.length === retainedValues.length && Number.isInteger(physicalValues[rerollIndex])
              ? [physicalValues[rerollIndex]] : [])
          : forcedValues && forcedValues.length > 0
          ? forcedValues.slice(0, safeCount).map((value) => Math.max(1, Math.min(safeSides, Math.round(Number(value)))))
          : rolled.length > 0 ? rolled.slice(0, safeCount) : fallbackValues(safeCount, safeSides)
      log('finish', { finalValues })
      // The iframe posts its result only after arrangeSettledDice() has centered
      // and leveled every die. Secret rolls keep that settled frame visible for
      // a beat before their confirmation drawer is allowed to open.
      const delay = Math.max(
        0,
        MIN_VISIBLE_ROLL_MS - (Date.now() - startedAt),
        DICE_TIMING.ROLL_SETTLED_HOLD_MS,
        Math.max(0, settledHoldMs),
      )
      deliverPending = () => {
        deliverPending = undefined
        window.clearTimeout(completionTimer)
        if (!cancelled) onCompleteRef.current(finalValues)
      }
      if (document.hidden) deliverPending()
      else completionTimer = window.setTimeout(() => deliverPending?.(), delay)
    }
    const sendRoll = () => {
      if (sentRequestRef.current === requestId) return
      sentRequestRef.current = requestId
      log('send-roll')
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: staging ? 'stage-dice' : 'roll-dice',
          requestId,
          qty: retainedValues?.length ?? safeCount,
          sides: safeSides,
          dieSides,
          adoptedIndex: adoptedD20Index(forcedValues ?? [], check),
          values: retainedValues && rerollIndex != null ? [] : forcedValues,
          rerollIndex,
        },
        window.location.origin,
      )
    }
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return
      const data = parseDiceBoxMessage(event)
      if (!data) return
      if (data?.type === 'dice-box-ready' && !readyRef.current) {
        readyRef.current = true
        setFrameReady(true)
        // A pre-ready retry can be lost before the iframe installs its listener.
        // The iframe deduplicates request IDs, so resending after ready is safe.
        sentRequestRef.current = null
        log('iframe-ready')
        sendRoll()
        return
      }
      if (data?.type === 'dice-box-roll-result' && data.requestId === requestId) {
        log('result-message', { values: data.values })
        finish(data.values)
      }
    }
    window.addEventListener('message', handleMessage)
    if (readyRef.current) sendRoll()
    const retry = window.setTimeout(() => {
      if (!readyRef.current) {
        log('ready-retry-send')
        sendRoll()
      }
    }, 900)
    const fallback = window.setTimeout(() => finish(forcedValues), DICE_TIMING.ROLL_FAILSAFE_MS)
    const unsubscribeVisibility = onDiceDocumentHidden(() => {
      if (staging) return
      if (deliverPending) deliverPending()
      // Physical rerolls have no predetermined value; never invent one here.
      else if (forcedValues?.length && rerollIndex == null) finish(forcedValues)
    })
    return () => {
      cancelled = true
      unsubscribeVisibility()
      window.clearTimeout(completionTimer)
      if (!completedRef.current && sentRequestRef.current === requestId) sentRequestRef.current = null
      window.clearTimeout(retry)
      window.clearTimeout(fallback)
      window.removeEventListener('message', handleMessage)
    }
  }, [check, count, dieSides, forcedValues, requestId, retainedValues, rerollIndex, settledHoldMs, sides, staging])

  return (
    <DiceOverlayPortal layer={layout === 'left-drawer' ? 'dice' : 'foreground'}>
      <div className="absolute inset-0" style={{ display: visible ? undefined : 'none' }}>
        <iframe
          ref={iframeRef}
          title={`${sides}-sided dice roller`}
          src={`/dice-box-frame.html?badge=0&ui=2&sides=${iframeSides}&qty=${safeCountForFrame}`}
          className={`dice-box-damage-frame ${layout === 'left-drawer' ? 'dice-box-frame--left-drawer' : 'dice-box-roll-flight'} ${frameReady ? 'dice-box-frame--ready' : 'dice-box-frame--pending'}`}
          style={{ '--dice-fly-x': flyX, '--dice-fly-y': flyY, ...(layout === 'left-drawer' ? frameBounds : undefined), pointerEvents: onGrabReroll ? 'auto' : 'none' } as CSSProperties}
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </DiceOverlayPortal>
  )
}
