import {visitDnd5eAutomaticHitRetaliationCheckpoint,rejectDnd5eAutomaticHitRetaliation,type Dnd5eAutomaticHitRetaliationRolls} from '../automaticHitRetaliationCheckpoint'
import {dnd5eCombatantPairKey} from '../headlessCombatPrimitives'
import {dnd5eActivityRootRequirementsSatisfiedV1} from './dnd5eActivityExecutor'
import type { Dnd5eCombatEvent, Dnd5eHeadlessCombatState } from '../headlessCombatEngine'
import { listDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerWindows'
import { collectDnd5eActivityFormulaRollDeclarationsV1 } from './dnd5eActivityHeadlessCompiler'
import { dnd5eActivityActorSnapshotFromCombatantV1, resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { withDnd5eIncapacitatedActivityAuthority } from '../incapacitatedActivityAuthority'
import { dnd5eAutonomousRetaliationGrant,isDnd5eAutonomousMaintainedRetaliation } from './dnd5eAutonomousRetaliationContract'

/** No-choice hit retaliation is due before the hit's damage can incapacitate
 * its owner. Resolve through normal Activity authority, not an HP bypass. */
export function settleDnd5eAutomaticHitRetaliation(
  state: Dnd5eHeadlessCombatState,
  event: Extract<Dnd5eCombatEvent, { type: 'attack-resolved' }>,
  events: Dnd5eCombatEvent[],
): void {
  if (!event.hit) return
  const eventBatchId = `automatic-hit:${globalThis.crypto.randomUUID()}`
  const windows = listDnd5eActivityTriggerWindowsV1({ state, events: [event], eventBatchId })
  for (const window of windows) {
    if (window.triggerContext.event !== 'reaction-window') continue
    for (const available of window.available) {
      const activity = available.activity
      if (available.confirmation !== 'automatic' ||
          !['special', 'free'].includes(activity.activation.kind) ||
          activity.target.kind !== 'creature' || activity.target.count !== 1 ||
          activity.checks?.length || activity.choices?.length || activity.consumption?.length ||
          !activity.outcomes.length || activity.outcomes.some(outcome =>
            !outcome.operations.length || outcome.operations.some(operation =>
              operation.kind !== 'damage' || operation.target !== 'target'))) continue
      if(!dnd5eActivityRootRequirementsSatisfiedV1({activity,actor:dnd5eActivityActorSnapshotFromCombatantV1(state.combatants[event.targetId],state.combatants[event.actorId],state),targets:[dnd5eActivityActorSnapshotFromCombatantV1(state.combatants[event.actorId],state.combatants[event.targetId],state)],rolls:{},triggerContext:window.triggerContext,distanceFeetByTargetId:{[event.actorId]:state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(event.actorId,event.targetId)]??Number.POSITIVE_INFINITY}}))continue
      const grant=dnd5eAutonomousRetaliationGrant(state.combatants[event.targetId],available.packageId,activity)
      let authoritativeRolls:Dnd5eAutomaticHitRetaliationRolls={}
      const declarations=collectDnd5eActivityFormulaRollDeclarationsV1(activity)
      if(declarations.length){
        if(!grant||!isDnd5eAutonomousMaintainedRetaliation(activity))continue
        authoritativeRolls=visitDnd5eAutomaticHitRetaliationCheckpoint({actorId:event.targetId,targetId:event.actorId,packageId:available.packageId,packageVersion:available.packageVersion,activityId:activity.id,activityName:activity.name,definitionSignature:JSON.stringify(activity),grantEffectId:grant.id,rolls:declarations},state)
      }
      const result = withDnd5eIncapacitatedActivityAuthority(state, available.packageId, activity,
        window.triggerContext, event.targetId, () => resolveRegisteredDnd5eActivityInCombatV1({
        state, combatRevision: 0, authoritativeRolls, triggerContext: window.triggerContext, confirmedBy: 'system',
        command: { schemaVersion: 1, commandId: `${eventBatchId}:${available.packageId}:${activity.id}`.slice(0, 160),
          actorId: event.targetId, targetIds: [event.actorId], expectedRevision: 0,
          triggerEventId: window.triggerContext.eventId,
          grantEffectId: grant?.id, castLevel: grant?.source.spellLevel,
          packageId: available.packageId, packageVersion: available.packageVersion, activityId: activity.id },
      }))
      if (!result.result.ok || result.phase !== 'commit'){if(declarations.length)rejectDnd5eAutomaticHitRetaliation('automatic-hit-retaliation-authority-rejected');continue}
      // Attack resolvers hold references to their combatants. Preserve those
      // references while accepting the authoritative nested transaction.
      const combatants = state.combatants
      for (const [id, next] of Object.entries(result.result.state.combatants)) {
        if (combatants[id]) Object.assign(combatants[id], next)
        else combatants[id] = next
      }
      Object.assign(state, result.result.state, { combatants })
      events.push(...result.result.events)
      event.handledHitActivities = [...(event.handledHitActivities ?? []),
        { packageId: available.packageId, activityId: activity.id }]
    }
  }
}
