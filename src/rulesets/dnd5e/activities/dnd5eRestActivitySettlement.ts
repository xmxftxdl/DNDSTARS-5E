import type { Character } from '../../../types/character'
import type { BattleMap } from '../../../store/maps'
import { dnd5eLastLongRestDestination } from '../restTeleportationDestination'
import type { SharedCampaignTimeState } from '../../../lib/campaignTime'
import { consumeDnd5eRestActivityWindow, openDnd5eRestActivityWindow } from '../restActivityWindows'
import { openDnd5eRestCastingWindow, type Dnd5eRestCastingWindowReceipt, type Dnd5eRestCastingBinding } from '../restActivityCastingWindow'
import { endDnd5eConcentration, type Dnd5eCombatEvent } from '../headlessCombatEngine'
import {consumeDnd5eRestStartActivityWindow,openDnd5eRestStartActivityWindow} from '../restStartActivityWindows'
import { getRegisteredDnd5eActivity, listRegisteredDnd5eActivityPackages } from './dnd5eActivityRegistry'
import { dnd5eCombatantEntitledToActivityV1 } from './dnd5eActivityEntitlements'
import { resolveDnd5eActivityInvocationV1 } from './dnd5eActivityInvocation'
import { validateDnd5eExecuteActivityCommandV1 } from './dnd5eActivityCommand'
import { resolveRegisteredDnd5eActivityInCombatV1, type Dnd5eRegisteredActivityCombatAuthorityInputV1 } from './dnd5eActivityCombatAuthority'

/** Host-only rest gate. The caller must atomically commit receiptPatch with the
 * returned combat/character changes; neither may be published independently. */
export function settleDnd5eRestActivityV1(input: Omit<Dnd5eRegisteredActivityCombatAuthorityInputV1,'triggerContext'|'actorCharacter'> & {
  actorCharacter: Character
  clock: SharedCampaignTimeState
  restEventId: string
  decision: 'use' | 'decline'
  restMapContext?: { sourceMap: BattleMap; maps: readonly BattleMap[] }
  castingContinuation?: { receipt: Dnd5eRestCastingWindowReceipt; binding: Dnd5eRestCastingBinding }
}) {
  const reject = (reason:string) => ({ok:false as const,reason})
  const {command,actorCharacter:owner,clock}=input
  if (!['use','decline'].includes(input.decision) || validateDnd5eExecuteActivityCommandV1(command).length || command.expectedRevision !== input.combatRevision) return reject('invalid-command')
  const actor=input.state.combatants[command.actorId]
  if (!actor || (actor.classState.wardingBondParticipantCharacterId ?? actor.id) !== owner.id || owner.dnd5eWorldTimeAppliedMinute !== clock.worldMinute) return reject('rest-owner-mismatch')
  const activity=getRegisteredDnd5eActivity(command.packageId,command.activityId)
  const registered=listRegisteredDnd5eActivityPackages().find(entry=>entry.packageId===command.packageId)
  if (!activity || registered?.packageVersion !== command.packageVersion || !dnd5eCombatantEntitledToActivityV1({packageId:command.packageId,activity,combatant:actor,character:owner})) return reject('rest-activity-unavailable')
  const requiredSeconds=activity.activation.kind==='minute'?activity.activation.value*60:
    activity.activation.kind==='hour'?activity.activation.value*3600:undefined
  const continuation=input.castingContinuation
  const binding=continuation?.binding
  if (binding && (binding.packageId!==command.packageId || binding.packageVersion!==command.packageVersion ||
    binding.activityId!==command.activityId || binding.restEventId!==input.restEventId ||
    binding.casting.actorTokenId!==command.actorId || binding.casting.actorCharacterId!==owner.id ||
    binding.casting.requestId!==command.commandId ||
    (activity.spellInvocation && binding.casting.spellId!==activity.spellInvocation.spellId) ||
    (input.restMapContext && binding.casting.mapId!==input.restMapContext.sourceMap.id))) return reject('rest-casting-mismatch')
  const castingWindow=continuation && openDnd5eRestCastingWindow({receipt:continuation.receipt,binding:continuation.binding,
    character:owner,clock,state:input.state,requiredSeconds})
  if(input.decision==='use' && requiredSeconds!==undefined && !castingWindow) return reject('rest-casting-incomplete')
  const startWindow=openDnd5eRestStartActivityWindow(owner,clock)
  const window=castingWindow ?? (startWindow?.eventId===input.restEventId?startWindow:openDnd5eRestActivityWindow(owner,clock.worldMinute))
  if (!window || window.eventId !== input.restEventId) return reject('rest-window-unavailable')
  if (!castingWindow && 'completedWorldMinute' in window && !clock.advances.some(advance => `${advance.kind}-complete` === window.event && advance.toWorldMinute === window.completedWorldMinute &&
    (advance.beneficiaryCharacterIds == null || advance.beneficiaryCharacterIds.includes(owner.id)))) return reject('rest-event-unavailable')
  const invocation=resolveDnd5eActivityInvocationV1(activity)
  if (invocation.kind !== 'triggered' || invocation.event !== window.event) return reject('rest-trigger-mismatch')
  if (input.decision === 'use' && activity.outcomes.some(outcome => outcome.operations.some(operation =>
    operation.kind === 'create-persistent-area' && operation.teleportationPortal?.destination === 'last-long-rest'))) {
    if (!input.restMapContext || !dnd5eLastLongRestDestination({clock,characterId:owner.id,...input.restMapContext})) {
      return reject('rest-destination-unavailable')
    }
  }
  const receiptInput={eventId:input.restEventId,packageId:command.packageId,activityId:command.activityId,outcome:input.decision==='use'?'used' as const:'declined' as const}
  const consumed='sessionId' in window?consumeDnd5eRestStartActivityWindow(owner,clock,receiptInput):consumeDnd5eRestActivityWindow(owner,{worldMinute:window.completedWorldMinute,...receiptInput})
  if (!consumed) return reject('rest-choice-already-consumed')
  const receiptPatch:Pick<Character,'dnd5eRestActivityWindow'|'dnd5eRestStartActivityWindow'>='sessionId' in window?{dnd5eRestStartActivityWindow:consumed.dnd5eRestStartActivityWindow}:{dnd5eRestActivityWindow:consumed.dnd5eRestActivityWindow}
  if (input.decision==='decline') return {ok:true as const,outcome:'declined' as const,receiptPatch}
  // Clear the casting channel in the proposed transaction before applying the
  // spell: a newly applied concentration effect must survive completion.
  const settlementState=castingWindow?structuredClone(input.state):input.state
  const castingEvents:Dnd5eCombatEvent[]=[]
  if(castingWindow)endDnd5eConcentration(settlementState,settlementState.combatants[actor.id],castingEvents)
  const resolution=resolveRegisteredDnd5eActivityInCombatV1({...input,
    state:settlementState,
    allowInactiveRestCommit:true,
    command:{...command,triggerEventId:window.eventId},
    triggerContext:{event:window.event,eventId:window.eventId,eligibleActorIds:[actor.id],eligibleTargetIds:command.targetIds,
      source:{kind:'combat',id:window.event}},
  })
  if (resolution.phase!=='commit'||!resolution.result.ok) return {ok:false as const,reason:'rest-settlement-rejected',resolution}
  return {ok:true as const,outcome:'used' as const,resolution:{...resolution,
    result:{...resolution.result,events:[...castingEvents,...resolution.result.events]}},receiptPatch}
}
