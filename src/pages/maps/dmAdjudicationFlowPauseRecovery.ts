import type { SharedCombatInterruptQueueState } from '../../lib/combatInterruptQueue'
import { isCombatInterruptKind } from '../../lib/combatInterruptProtocol'
import type { SharedCombatFlowPauseV1 } from '../../lib/sharedCombatTypes'

/**
 * A completed adjudication updates React state before every async continuation
 * has finished updating its ref. The visible control must follow the rendered
 * pause in that narrow window; otherwise a stale `adjudicating` ref makes the
 * enabled "continue combat" button silently return without releasing the gate.
 */
export function resumableCombatFlowPause(input: {
  rendered: SharedCombatFlowPauseV1 | undefined
  current: SharedCombatFlowPauseV1 | undefined
}): SharedCombatFlowPauseV1 | undefined {
  const pause = input.rendered ?? input.current
  return pause && pause.phase !== 'adjudicating' ? pause : undefined
}

/**
 * A browser refresh can destroy the in-memory adjudication promise after the
 * DM response has already been persisted. The combat pause is authoritative,
 * so recover that terminal response into the normal explicit resume gate.
 */
export function recoverableDmAdjudicationPause(input: {
  mapId: string
  pause: SharedCombatFlowPauseV1 | undefined
  queue: SharedCombatInterruptQueueState | null | undefined
}): { interruptId: string } | undefined {
  const { mapId, pause, queue } = input
  if (
    pause?.reason !== 'dm-adjudication' ||
    pause.phase !== 'adjudicating' ||
    !pause.interruptId ||
    !queue ||
    queue.mapId !== mapId
  ) return undefined

  const interrupt = queue.interrupts.find((candidate) => candidate.id === pause.interruptId)
  if (!interrupt || !isCombatInterruptKind(interrupt, 'dm-adjudication')) return undefined
  if (!['answered', 'done', 'rolled-back'].includes(interrupt.status)) return undefined
  return { interruptId: interrupt.id }
}
