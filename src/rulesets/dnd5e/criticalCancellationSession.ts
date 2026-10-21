import { dnd5eCriticalCancellationOptions, resolveDnd5eCriticalCancellation, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { dnd5ePluginFeatureDefinition } from './pluginApi'
import { withDnd5eCriticalCancellationCheckpoints, type Dnd5eCriticalHitEvent, type Dnd5eCriticalCancellationSelection } from './criticalCancellationCheckpoint'

class PendingCritical extends Error {
  readonly event: Dnd5eCriticalHitEvent
  readonly snapshot: Dnd5eHeadlessCombatState
  readonly occurrence: number
  constructor(event: Dnd5eCriticalHitEvent, snapshot: Dnd5eHeadlessCombatState, occurrence: number) {
    super('critical-cancellation-choice-required')
    this.event = event; this.snapshot = snapshot; this.occurrence = occurrence
  }
}
class ChangedCritical extends Error {}

export type Dnd5eCriticalCancellationSessionResult<T> =
  | { status: 'pending'; event: Dnd5eCriticalHitEvent; snapshot: Dnd5eHeadlessCombatState; occurrence: number }
  | { status: 'resolved'; result: T }
  | { status: 'rejected'; reason: 'session-ended' | 'stale-state' | 'stale-checkpoint' | 'changed-definition' | 'invalid-selection' }

/** Host replay adapter. The resolver must close over frozen command/dice inputs.
 * No caller state is committed until the entire resolver returns successfully. */
export function createDnd5eCriticalCancellationSession<T>(source: Dnd5eHeadlessCombatState, resolve: (state: Dnd5eHeadlessCombatState) => T) {
  const baseline = structuredClone(source), signature = JSON.stringify(baseline)
  const featureIds = [...new Set(Object.values(baseline.combatants).flatMap(actor => actor.pluginFeatureIds))]
  const definitions = () => JSON.stringify(featureIds.map(id => [id, dnd5ePluginFeatureDefinition(id)?.declarativeAbility]))
  const definitionSignature = definitions()
  const decisions = new Map<number, { event: Dnd5eCriticalHitEvent; selection?: Dnd5eCriticalCancellationSelection }>()
  let pending: PendingCritical | undefined, ended = false
  const run = (current: Dnd5eHeadlessCombatState): Dnd5eCriticalCancellationSessionResult<T> => {
    if (ended) return { status: 'rejected', reason: 'session-ended' }
    if (JSON.stringify(current) !== signature) { ended = true; return { status: 'rejected', reason: 'stale-state' } }
    if (definitions() !== definitionSignature) { ended = true; return { status: 'rejected', reason: 'changed-definition' } }
    let occurrence = 0
    try {
      const result = withDnd5eCriticalCancellationCheckpoints((event, snapshot) => {
        const index = occurrence++, prior = decisions.get(index)
        if (prior) {
          if (JSON.stringify(prior.event) !== JSON.stringify(event)) throw new ChangedCritical()
          return prior.selection && structuredClone(prior.selection)
        }
        if (dnd5eCriticalCancellationOptions(snapshot, event).length > 0) throw new PendingCritical(event, snapshot, index)
      }, () => resolve(structuredClone(baseline)))
      ended = true; pending = undefined
      return { status: 'resolved', result }
    } catch (error) {
      if (error instanceof PendingCritical) {
        pending = error
        return { status: 'pending', event: structuredClone(error.event), snapshot: structuredClone(error.snapshot), occurrence: error.occurrence }
      }
      ended = true
      if (error instanceof ChangedCritical) return { status: 'rejected', reason: 'stale-checkpoint' }
      throw error
    }
  }
  return {
    run,
    resume(current: Dnd5eHeadlessCombatState, occurrence: number, event: Dnd5eCriticalHitEvent,
      selection?: Dnd5eCriticalCancellationSelection): Dnd5eCriticalCancellationSessionResult<T> {
      if (ended) return { status: 'rejected', reason: 'session-ended' }
      if (!pending || occurrence !== pending.occurrence || JSON.stringify(event) !== JSON.stringify(pending.event)) return { status: 'rejected', reason: 'stale-checkpoint' }
      if (JSON.stringify(current) !== signature) { ended = true; return { status: 'rejected', reason: 'stale-state' } }
      if (definitions() !== definitionSignature) { ended = true; return { status: 'rejected', reason: 'changed-definition' } }
      if (selection && !resolveDnd5eCriticalCancellation(pending.snapshot, pending.event, selection).ok) return { status: 'rejected', reason: 'invalid-selection' }
      decisions.set(occurrence, { event: structuredClone(pending.event), ...(selection ? { selection: structuredClone(selection) } : {}) })
      pending = undefined
      return run(current)
    },
    cancel() { ended = true; pending = undefined; decisions.clear() },
  }
}
