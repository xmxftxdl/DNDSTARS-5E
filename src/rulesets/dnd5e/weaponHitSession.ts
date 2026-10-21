import { resolveDnd5eHeadlessAction, type Dnd5eAction, type Dnd5eActionResult, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { withDnd5eWeaponHitCheckpoints, type Dnd5eWeaponHitDecision, type Dnd5eWeaponHitEvent } from './weaponHitCheckpoint'

class PendingHit extends Error {
  readonly event: Dnd5eWeaponHitEvent
  readonly snapshot: Dnd5eHeadlessCombatState
  readonly index: number
  constructor(event: Dnd5eWeaponHitEvent, snapshot: Dnd5eHeadlessCombatState, index: number) {
    super('weapon-hit-decision-required'); this.event = event; this.snapshot = snapshot; this.index = index
  }
}
type Result = { status: 'pending'; event: Dnd5eWeaponHitEvent; snapshot: Dnd5eHeadlessCombatState; index: number }
  | { status: 'resolved'; result: Dnd5eActionResult }
  | { status: 'rejected'; reason: 'session-ended' | 'stale-state' | 'stale-hit' | 'changed-definition' }

/** Host replay primitive. Decisions must already be authorized against installed
 * Activities; this deliberately is not a room/player command handler. */
export function createDnd5eWeaponHitSession(source: Dnd5eHeadlessCombatState, action: Dnd5eAction,
  shouldPause: (event: Dnd5eWeaponHitEvent, snapshot: Dnd5eHeadlessCombatState) => boolean,
  definitionUnchanged: () => boolean = () => true) {
  const baseline = structuredClone(source), frozenAction = structuredClone(action)
  const signature = JSON.stringify(baseline)
  const decisions = new Map<number, { event: Dnd5eWeaponHitEvent; decision?: Dnd5eWeaponHitDecision }>()
  let pending: PendingHit | undefined, ended = false
  const run = (current: Dnd5eHeadlessCombatState): Result => {
    if (ended) return { status: 'rejected', reason: 'session-ended' }
    if (!definitionUnchanged()) { ended = true; return { status: 'rejected', reason: 'changed-definition' } }
    if (JSON.stringify(current) !== signature) { ended = true; return { status: 'rejected', reason: 'stale-state' } }
    let index = 0
    try {
      const result = withDnd5eWeaponHitCheckpoints((event, snapshot) => {
        const occurrence = index++, prior = decisions.get(occurrence)
        if (prior) {
          if (JSON.stringify(event) !== JSON.stringify(prior.event)) throw Error('weapon-hit-replay-changed')
          return prior.decision && structuredClone(prior.decision)
        }
        if (shouldPause(structuredClone(event), structuredClone(snapshot))) throw new PendingHit(event, snapshot, occurrence)
      }, () => resolveDnd5eHeadlessAction(baseline, frozenAction))
      ended = true; pending = undefined
      return { status: 'resolved', result }
    } catch (error) {
      if (!(error instanceof PendingHit)) { ended = true; throw error }
      pending = error
      return { status: 'pending', event: structuredClone(error.event), snapshot: structuredClone(error.snapshot), index: error.index }
    }
  }
  return {
    run,
    resume(current: Dnd5eHeadlessCombatState, event: Dnd5eWeaponHitEvent, index: number, decision?: Dnd5eWeaponHitDecision): Result {
      if (ended) return { status: 'rejected', reason: 'session-ended' }
      if (!pending || index !== pending.index || JSON.stringify(event) !== JSON.stringify(pending.event)) return { status: 'rejected', reason: 'stale-hit' }
      decisions.set(index, { event: structuredClone(pending.event), ...(decision ? { decision: structuredClone(decision) } : {}) })
      pending = undefined
      return run(current)
    },
  }
}
