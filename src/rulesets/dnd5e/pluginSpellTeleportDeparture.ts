import type { GridCell } from '../../lib/gridCombat'
import type { PreparedDnd5ePluginSpellCast } from './pluginSpellTransaction'
import { validMovementDestination } from './activities/dnd5eActivityMapInteraction'
import { planDnd5eTeleportCompanion } from './teleportCompanion'
import {settleDnd5eTempleMovementEntries} from './templeMovementSettlement'
import {refreshDnd5eMapSpatialRelations} from './mapBridge'
import type {Dnd5eCombatEvent} from './headlessCombatEngine'

/** Host pre-roll stage: choose a valid destination before selecting departure blast victims. */
export function prepareDnd5ePluginTeleportDeparture(input: {
  prepared: PreparedDnd5ePluginSpellCast
  destination: GridCell & { elevationFeet?: number }
  companionTargetId?: string
  /** Host controller-choice result; never read from a spell action payload. */
  willingTargetIds: readonly string[]
}): { ok: false; reason: string } | { ok: true; prepared: PreparedDnd5ePluginSpellCast;
  departure: { operationId: string; destination: GridCell & { elevationFeet?: number };
    actorPosition: { x: number; y: number; elevationFeet?: number };
    companion?: { targetId: string; position: { x: number; y: number; elevationFeet: number } };
    leftBehindReason?: string; blockedByTemple?: boolean } } {
  const prepared = input.prepared
  const moves = prepared.activity?.outcomes.flatMap(outcome => outcome.operations)
    .filter(operation => operation.kind === 'move' && operation.optionalCompanion != null) ?? []
  if (moves.length !== 1) return { ok: false, reason: 'invalid-transport-activity' }
  const move = moves[0]
  if (move.kind !== 'move' || !move.optionalCompanion || move.distanceFeet.kind !== 'constant' || move.mode !== 'teleport' || move.target !== 'actor') return { ok: false, reason: 'invalid-transport-activity' }
  const landing = validMovementDestination({map:prepared.map,characters:prepared.characters,
    actorToken:prepared.actorToken,targetToken:prepared.actorToken,destination:input.destination,
    mode:'teleport',distanceFeet:move.distanceFeet.value,requiresVisibleDestination:move.requiresVisibleDestination})
  if (!landing) return {ok:false,reason:'invalid-movement-placement'}
  const companionPlan = input.companionTargetId ? planDnd5eTeleportCompanion({map:prepared.map,state:prepared.state,
    actorId:prepared.actorToken.id,targetId:input.companionTargetId,policy:move.optionalCompanion,
    willingTargetIds:input.willingTargetIds,actorDestination:landing.position}) : undefined
  const companion = companionPlan?.kind === 'travel' ? {targetId:companionPlan.targetId,position:companionPlan.position} : undefined
  const targets = prepared.targets.filter(target => target.token.id !== companion?.targetId)
  const targetTokens = prepared.targetTokens.filter(target => target.id !== companion?.targetId)
  return {ok:true,prepared:{...prepared,targets,targetTokens,targetToken:targetTokens[0] ?? prepared.actorToken,
    activityHeadlessAction:prepared.activityHeadlessAction ? {...prepared.activityHeadlessAction,
      targetId:targets[0]?.token.id,targetIds:targets.map(target=>target.token.id)} : undefined},
    departure:{operationId:move.id,destination:{...input.destination},actorPosition:landing.position,companion,
      leftBehindReason:companionPlan?.kind === 'left-behind' ? companionPlan.reason : undefined}}
}

/** Decide whether a companion actually departs before excluding it from departure damage. */
export async function prepareDnd5ePluginTeleportDepartureWithTempleEntry(input:Parameters<typeof prepareDnd5ePluginTeleportDeparture>[0]&{
 roll:Parameters<typeof settleDnd5eTempleMovementEntries>[0]['roll'];isCurrent:()=>boolean;
 rollEffectDice?:Parameters<typeof settleDnd5eTempleMovementEntries>[0]['rollEffectDice'];
}):Promise<{ok:true;plan:Extract<ReturnType<typeof prepareDnd5ePluginTeleportDeparture>,{ok:true}>;entryEvents:Dnd5eCombatEvent[];checkedTargetId?:string;checkedActorId?:string}|{ok:false;reason:string}>{
 const plan=prepareDnd5ePluginTeleportDeparture(input)
 if(!plan.ok)return plan
 const casterState=structuredClone(input.prepared.state),caster=casterState.combatants[input.prepared.actorToken.id]
 if(!caster)return {ok:false,reason:'temple-caster-actor-missing'}
 const casterFrom={...caster.position},casterHeight=caster.elevationFeet
 caster.position={x:plan.departure.actorPosition.x,y:plan.departure.actorPosition.y}
 caster.elevationFeet=plan.departure.actorPosition.elevationFeet
 const casterEntry=await settleDnd5eTempleMovementEntries({state:casterState,map:input.prepared.map,
  events:[{type:'moved',actorId:caster.id,from:casterFrom,to:caster.position,fromElevationFeet:casterHeight??0,toElevationFeet:caster.elevationFeet,
   fromMapId:input.prepared.map.id,toMapId:input.prepared.map.id,movementKind:'teleport',distance:0}],roll:input.roll,isCurrent:input.isCurrent,rollEffectDice:input.rollEffectDice})
 if(!casterEntry.ok)return casterEntry
 const casterEvents=casterEntry.events.filter(event=>event.type!=='moved')
 casterEntry.state.combatants[caster.id].position=casterFrom
 casterEntry.state.combatants[caster.id].elevationFeet=casterHeight
 refreshDnd5eMapSpatialRelations(casterEntry.state,input.prepared.map,[],{geometry:casterEntry.state.companionScene?.geometry??undefined})
 const checkedActorId=casterEntry.changed?caster.id:undefined
 if(casterEntry.changed&&!casterEntry.events.some(event=>event.type==='moved'&&event.actorId===caster.id)){
  // No disappearance means no departure blast and no accompanying traveler. The cast still commits its resources and denial.
  return {ok:true,checkedActorId,entryEvents:casterEvents,plan:{...plan,
   departure:{...plan.departure,companion:undefined,blockedByTemple:true},
   prepared:{...plan.prepared,state:casterEntry.state,targets:[],targetTokens:[],targetToken:input.prepared.actorToken,
    activityHeadlessAction:plan.prepared.activityHeadlessAction?{...plan.prepared.activityHeadlessAction,targetId:undefined,targetIds:[]}:undefined}}}
 }
 input={...input,prepared:{...input.prepared,state:casterEntry.state}}
 plan.prepared={...plan.prepared,state:casterEntry.state}
 const companion=plan.departure.companion
 if(!companion)return {ok:true,plan,entryEvents:casterEvents,checkedActorId}
 const state=structuredClone(input.prepared.state),actor=state.combatants[companion.targetId]
 if(!actor)return {ok:false,reason:'temple-companion-actor-missing'}
 const from={...actor.position},height=actor.elevationFeet
 actor.position={x:companion.position.x,y:companion.position.y};actor.elevationFeet=companion.position.elevationFeet
 const event:Dnd5eCombatEvent={type:'moved',actorId:actor.id,from,to:actor.position,fromElevationFeet:height??0,toElevationFeet:actor.elevationFeet,
  fromMapId:input.prepared.map.id,toMapId:input.prepared.map.id,movementKind:'teleport',distance:0}
 const entry=await settleDnd5eTempleMovementEntries({state,map:input.prepared.map,events:[event],roll:input.roll,isCurrent:input.isCurrent,rollEffectDice:input.rollEffectDice})
 if(!entry.ok)return entry
 if(!entry.changed)return {ok:true,plan,entryEvents:casterEvents,checkedActorId}
 const departed=entry.events.some(event=>event.type==='moved'&&event.actorId===companion.targetId)
 // This is a preflight: retain resource/effect changes, but leave everyone at the origin until the cast commits.
 entry.state.combatants[companion.targetId].position=from
 entry.state.combatants[companion.targetId].elevationFeet=height
 refreshDnd5eMapSpatialRelations(entry.state,input.prepared.map,[],{geometry:entry.state.companionScene?.geometry??undefined})
 const replanned=prepareDnd5ePluginTeleportDeparture({...input,prepared:{...input.prepared,state:entry.state},willingTargetIds:departed?[companion.targetId]:[]})
 if(!replanned.ok)return replanned
 return {ok:true,plan:replanned,checkedActorId,entryEvents:[...casterEvents,...entry.events.filter(event=>event.type!=='moved')],...(departed?{checkedTargetId:companion.targetId}:{})}
}
