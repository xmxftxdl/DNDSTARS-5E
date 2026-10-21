import type { Dnd5eAction, Dnd5eHeadlessCombatState } from '../headlessCombatEngine'
import { createDnd5eWeaponHitSession } from '../weaponHitSession'
import type { Dnd5eWeaponHitEvent } from '../weaponHitCheckpoint'
import type { Dnd5eFormulaRollResult } from './dnd5eFormula'
import { getRegisteredDnd5eActivity, listRegisteredDnd5eActivityPackages } from './dnd5eActivityRegistry'
import { resolveDnd5eWeaponHitActivity } from './dnd5eWeaponHitActivity'

/** Host-owned wrapper for one selected imported ability. Wire callers supply
 * identity/choice only; event context and pending snapshot remain internal. */
export function createDnd5eRegisteredWeaponHitSession(input: {
  state: Dnd5eHeadlessCombatState; action: Dnd5eAction; combatRevision: number
  packageId: string; packageVersion: string; activityId: string; eventBatchId: string
  map?: import('../../../store/maps').BattleMap
}) {
  const frozen = structuredClone(input)
  const definition = () => JSON.stringify({
    activity: getRegisteredDnd5eActivity(frozen.packageId, frozen.activityId),
    version: listRegisteredDnd5eActivityPackages().find(entry => entry.packageId === frozen.packageId)?.packageVersion,
  })
  const signature = definition()
  let pending: { event: Dnd5eWeaponHitEvent; snapshot: Dnd5eHeadlessCombatState; index: number } | undefined
  const handled = new Set<number>()
  const session = createDnd5eWeaponHitSession(frozen.state, frozen.action, () => true, () => definition() === signature)
  const remember = (result: ReturnType<typeof session.run>) => {
    pending = result.status === 'pending' ? structuredClone(result) : undefined
    if (result.status === 'resolved' && result.result.ok) {
      let occurrence = 0
      return { ...result, result: { ...result.result, events: result.result.events.map(event => {
        if (event.type !== 'attack-resolved' || !event.hit || (!['weapon', 'spell'].includes(event.attackCategory ?? '') && !event.attackDelivery)) return event
        if (!handled.has(occurrence++)) return event
        return { ...event, handledHitActivities: [...(event.handledHitActivities ?? []),
          { packageId: frozen.packageId, activityId: frozen.activityId }] }
      }) } }
    }
    return result
  }
  return {
    run: (current: Dnd5eHeadlessCombatState) => remember(session.run(current)),
    resume(current: Dnd5eHeadlessCombatState, accepted: boolean,
      authoritativeRolls: Readonly<Record<string, Dnd5eFormulaRollResult>> = {}, selectedSecondaryTargetIds: readonly string[] = [], selectedPushCell?: import('../../../lib/gridCombat').GridCell | null) {
      if (!pending) return { status: 'rejected' as const, reason: 'no-pending-hit' }
      if (definition() !== signature) return remember(session.run(current))
      if (!accepted) {
        handled.add(pending.index)
        return remember(session.resume(current, pending.event, pending.index))
      }
      const selected = resolveDnd5eWeaponHitActivity({ ...frozen, state: pending.snapshot, event: pending.event, authoritativeRolls, selectedSecondaryTargetIds, selectedPushCell })
      if (!selected.ok) return { status: 'rejected' as const, reason: selected.reason }
      if (selected.pushSelectionRequired) return {status:'rejected' as const,reason:'push-selection-required'}
      handled.add(pending.index)
      return remember(session.resume(current, pending.event, pending.index, selected.decision))
    },
  }
}
