import type { settleDnd5eRestActivityV1 } from './dnd5eRestActivitySettlement'
import { validateDnd5eExecuteActivityCommandV1 } from './dnd5eActivityCommand'
import { getRegisteredDnd5eActivity, listRegisteredDnd5eActivityPackages } from './dnd5eActivityRegistry'
import { dnd5eCombatantEntitledToActivityV1 } from './dnd5eActivityEntitlements'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import { dnd5eActivityRootRequirementsSatisfiedV1 } from './dnd5eActivityExecutor'
import { evaluateDnd5eFormulaV1 } from './dnd5eFormula'
import { openDnd5eRestActivityWindow } from '../restActivityWindows'
import { captureDnd5eRestCastingWindow } from '../restActivityCastingWindow'
import { captureDnd5eLongCasting, beginDnd5eLongCasting, invalidateDnd5eLongCasting } from '../longCastingContinuity'
import { dnd5eLastLongRestDestination } from '../restTeleportationDestination'

/** Prepare the actual Host casting start. Publishing and arming remain separate:
 * neither the rest choice nor the feature resource is spent before completion. */
export function prepareDnd5eRestActivityCastingV1(input: Parameters<typeof settleDnd5eRestActivityV1>[0] & { mapId: string }) {
  const fail=(reason:string)=>({ok:false as const,reason})
  const {command,actorCharacter:character,clock,state}=input
  if(input.decision!=='use'||validateDnd5eExecuteActivityCommandV1(command).length||
    command.expectedRevision!==input.combatRevision||!input.mapId.trim())return fail('invalid-command')
  const actor=state.combatants[command.actorId]
  if(!actor||(actor.classState.wardingBondParticipantCharacterId??actor.id)!==character.id||
    character.dnd5eWorldTimeAppliedMinute!==clock.worldMinute||actor.campaignWorldMinute!==clock.worldMinute)return fail('rest-owner-mismatch')
  const activity=getRegisteredDnd5eActivity(command.packageId,command.activityId)
  if(!activity||listRegisteredDnd5eActivityPackages().find(entry=>entry.packageId===command.packageId)?.packageVersion!==command.packageVersion||
    !dnd5eCombatantEntitledToActivityV1({packageId:command.packageId,activity,combatant:actor,character}))return fail('rest-activity-unavailable')
  const window=openDnd5eRestActivityWindow(character,clock.worldMinute)
  if(!window||window.eventId!==input.restEventId||activity.invocation?.kind!=='triggered'||activity.invocation.event!==window.event)return fail('rest-window-unavailable')
  const seconds=activity.activation.kind==='minute'?activity.activation.value*60:activity.activation.kind==='hour'?activity.activation.value*3600:0
  if(!Number.isSafeInteger(seconds)||seconds<=0)return fail('rest-casting-duration-invalid')
  const actorSnapshot=dnd5eActivityActorSnapshotFromCombatantV1(actor,actor,state)
  const targets=command.targetIds.map(id=>state.combatants[id])
  if(targets.some(target=>!target))return fail('invalid-target')
  const context={activity,actor:actorSnapshot,targets:targets.map(target=>dnd5eActivityActorSnapshotFromCombatantV1(target,actor,state)),rolls:{},choices:command.choices}
  if(!dnd5eActivityRootRequirementsSatisfiedV1(context))return fail('requirement-failed')
  try {
    const costs=new Map<string,number>()
    for(const cost of activity.consumption??[])if(cost.kind==='resource') {
      const amount=evaluateDnd5eFormulaV1(cost.amount,context)
      if(!Number.isFinite(amount)||amount<0)return fail('requirement-failed')
      costs.set(cost.resourceId,(costs.get(cost.resourceId)??0)+amount)
    }
    for(const [id,cost] of costs)if((actor.classResources[id]?.current??0)<cost)return fail('requirement-failed')
  } catch {return fail('requirement-failed')}
  if(activity.outcomes.some(outcome=>outcome.operations.some(operation=>operation.kind==='create-persistent-area'&&operation.teleportationPortal?.destination==='last-long-rest'))&&
    (!input.restMapContext||input.restMapContext.sourceMap.id!==input.mapId||!dnd5eLastLongRestDestination({clock,characterId:character.id,...input.restMapContext})))return fail('rest-destination-unavailable')
  const casting={requestId:command.commandId,spellId:activity.spellInvocation?.spellId??`${command.packageId}:${command.activityId}`,
    mapId:input.mapId,actorTokenId:actor.id,actorCharacterId:character.id}
  const castingReceipt=captureDnd5eLongCasting(casting,actor,state.active?{combatId:state.combatId,requiredRounds:Math.ceil(seconds/6),startRound:state.round}:undefined,
    state.active?undefined:{startedAtWorldMinute:clock.worldMinute,requiredSeconds:seconds})
  if(!castingReceipt)return fail('rest-casting-unavailable')
  const binding={packageId:command.packageId,packageVersion:command.packageVersion,activityId:command.activityId,restEventId:input.restEventId,casting}
  const receipt=captureDnd5eRestCastingWindow({character,clock,binding,castingReceipt})
  const proposed=receipt&&beginDnd5eLongCasting(castingReceipt,casting,state)
  if(!receipt||!proposed){invalidateDnd5eLongCasting(castingReceipt);return fail('rest-casting-unavailable')}
  return {ok:true as const,state:proposed,castingReceipt,castingContinuation:{receipt,binding},requiredSeconds:seconds}
}
