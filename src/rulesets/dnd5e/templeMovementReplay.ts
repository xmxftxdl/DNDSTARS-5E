import {dnd5eFallingDamageDice} from './traversal'
import {resolveDnd5eFeatherFallReaction,resolveDnd5eForcedMovementLanding,type Dnd5eCombatEvent,type Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import {dnd5eForcedMovementFall} from './spellAction'
import {replayDnd5eTempleEntry,type Dnd5eTempleEntryReplay} from './templeEntryEffectDice'
import {dnd5eTempleEntryRequirements} from './templeEntry'
import {refreshDnd5eMapSpatialRelations} from './mapBridge'
import type {BattleMap} from '../../store/maps'

export interface Dnd5eTempleMovementReplay {
 eventIndex:number
 receipt:Dnd5eTempleEntryReplay
}
export interface Dnd5eForcedMovementLandingReplay {
 eventIndex:number
 fallingDamageRolls?:readonly number[]
}

export type Dnd5eForcedFallReactionReplay = Pick<Parameters<typeof resolveDnd5eFeatherFallReaction>[1],'casterId'|'spellcastingSavingThrows'> & {targetIds:readonly string[]}

export function dnd5eAcceptedForcedFalls(state:Dnd5eHeadlessCombatState,map:BattleMap,events:readonly Dnd5eCombatEvent[]){
 return events.flatMap(event=>{
  if(event.type!=='moved'||event.movementKind!=='forced')return []
  const token=map.tokens.find(token=>token.id===event.actorId)
  if(!token)return []
  const fall=dnd5eForcedMovementFall({geometry:state.companionScene?.geometry??undefined,
   target:{...token,...event.from,elevationFeet:event.fromElevationFeet},targetCombatant:state.combatants[event.actorId],to:event.to})
  return fall.fallDistanceFeet>0?[{combatantId:event.actorId,fromElevationFeet:event.fromElevationFeet??0,
   groundElevationFeet:fall.landingGroundElevationFeet,fallDistanceFeet:fall.fallDistanceFeet,fallingDamageDice:dnd5eFallingDamageDice(fall.fallDistanceFeet)}]:[]
 })
}

/** Apply recorded entry rolls to speculative movement before later actions
 * inspect positions. Never accepts a recorded state or an unbound destination. */
export function replayDnd5eTempleMovementEntries(input:{
 state:Dnd5eHeadlessCombatState;map:BattleMap;events:readonly Dnd5eCombatEvent[];
 entryReplays:readonly Dnd5eTempleMovementReplay[];
 /** Present only after Host entry settlement; one record per accepted push. */
 landings?:readonly Dnd5eForcedMovementLandingReplay[];
 fallReactions?:readonly Dnd5eForcedFallReactionReplay[];
}):{ok:true;state:Dnd5eHeadlessCombatState;events:Dnd5eCombatEvent[]}|{ok:false;reason:string}{
 if(input.fallReactions!=null){
  if(input.landings==null)return {ok:false,reason:'forced-landing-replay-missing'}
  const entry=replayDnd5eTempleMovementEntries({...input,landings:undefined,fallReactions:undefined})
  if(!entry.ok)return entry
  let state=entry.state
  const events=[...entry.events],falls=dnd5eAcceptedForcedFalls(state,input.map,entry.events),protectedIds=new Set<string>()
  if(new Set(falls.map(fall=>fall.combatantId)).size!==falls.length)return {ok:false,reason:'forced-fall-duplicate-target'}
  for(const choice of input.fallReactions){
   if(choice.targetIds.some(id=>protectedIds.has(id)||!falls.some(fall=>fall.combatantId===id))||new Set(choice.targetIds).size!==choice.targetIds.length)
    return {ok:false,reason:'forced-fall-reaction-target-invalid'}
   const reacted=resolveDnd5eFeatherFallReaction(state,{casterId:choice.casterId,spellcastingSavingThrows:choice.spellcastingSavingThrows,
    falls:choice.targetIds.map(id=>falls.find(fall=>fall.combatantId===id)!)})
   if(!reacted.ok)return {ok:false,reason:reacted.reason}
   state=reacted.state;events.push(...reacted.events);choice.targetIds.forEach(id=>protectedIds.add(id))
  }
  const used=new Set<number>()
  for(const landing of input.landings){
   const event=input.events[landing.eventIndex]
   if(used.has(landing.eventIndex)||!event||event.type!=='moved'||event.movementKind!=='forced'||!entry.events.includes(event))return {ok:false,reason:'forced-landing-replay-unused'}
   const token=input.map.tokens.find(token=>token.id===event.actorId)
   if(!token)return {ok:false,reason:'temple-movement-actor-missing'}
   const fall=dnd5eForcedMovementFall({geometry:state.companionScene?.geometry??undefined,
    target:{...token,...event.from,elevationFeet:event.fromElevationFeet},targetCombatant:state.combatants[event.actorId],to:event.to})
   const landed=resolveDnd5eForcedMovementLanding({state,targetId:event.actorId,toElevationFeet:fall.toElevationFeet,
    toGroundElevationFeet:fall.landingGroundElevationFeet,fallingDamageRolls:landing.fallingDamageRolls})
   if(!landed.ok)return {ok:false,reason:landed.reason}
   used.add(landing.eventIndex);state=landed.state;events.push(...landed.events)
  }
  if(used.size!==entry.events.filter(event=>event.type==='moved'&&event.movementKind==='forced').length)return {ok:false,reason:'forced-landing-replay-missing'}
  refreshDnd5eMapSpatialRelations(state,input.map,[],{geometry:state.companionScene?.geometry??undefined})
  return {ok:true,state,events}
 }
 let state=structuredClone(input.state)
 const events:Dnd5eCombatEvent[]=[],blocked=new Set<string>(),used=new Set<number>()
 const receipts=new Map(input.entryReplays.map(entry=>[entry.eventIndex,entry.receipt]))
 const landings=new Map((input.landings??[]).map(entry=>[entry.eventIndex,entry]))
 const usedLandings=new Set<number>()
 if(landings.size!==(input.landings?.length??0))return {ok:false,reason:'forced-landing-replay-duplicate'}
 if(receipts.size!==input.entryReplays.length || input.entryReplays.some(entry=>
  !Number.isInteger(entry.eventIndex)||entry.eventIndex<0||entry.eventIndex>=input.events.length))
  return {ok:false,reason:'temple-entry-replay-index-invalid'}
 for(const [eventIndex,event] of input.events.entries()){
  if(event.type!=='moved'){events.push(event);continue}
  if(blocked.has(event.actorId))continue
  if(event.fromMapId&&event.toMapId&&event.fromMapId!==event.toMapId)
   return {ok:false,reason:'temple-cross-map-entry-context-required'}
  const actor=state.combatants[event.actorId]
  if(!actor)return {ok:false,reason:'temple-movement-actor-missing'}
  const height=event.toElevationFeet??actor.elevationFeet
  actor.position={...event.from};actor.elevationFeet=event.fromElevationFeet??actor.groundElevationFeet??0
  const mode=event.movementKind==='teleport'?'teleport':event.movementKind==='forced'?'forced':undefined
  const requirements=dnd5eTempleEntryRequirements(state,actor,event.to,event.toElevationFeet,undefined,mode)
  if(requirements.length){
   const receipt=receipts.get(eventIndex),action=receipt?.action
   if(!receipt||!action)return {ok:false,reason:'temple-entry-replay-missing'}
   if(!receipt.transactionId || action.type!=='temple-entry-attempt'||action.actorId!==event.actorId||
    action.to.x!==event.to.x||action.to.y!==event.to.y||action.toElevationFeet!==event.toElevationFeet||
    action.distance!==Math.max(1,event.distance)||action.transportMode!==mode||action.entryScene||action.originMapId)
    return {ok:false,reason:'temple-entry-replay-mismatch'}
   refreshDnd5eMapSpatialRelations(state,input.map,[],{geometry:state.companionScene?.geometry??undefined})
   // Reconstruct the action from authoritative movement; only recorded dice
   // enter the resolver. Extra action fields cannot alter the replay context.
   const result=replayDnd5eTempleEntry(state,{transactionId:receipt.transactionId,action:{
    type:'temple-entry-attempt',actorId:event.actorId,to:{...event.to},toElevationFeet:event.toElevationFeet,
    distance:Math.max(1,event.distance),transportMode:mode,boundarySavingThrows:action.boundarySavingThrows,
    effectRollDice:action.effectRollDice}})
   if(!result.ok)return {ok:false,reason:result.reason}
   used.add(eventIndex);state=result.state;events.push(...result.events)
   if(result.movementBlocked)blocked.add(event.actorId)
  }
  if(!blocked.has(event.actorId)){
   state.combatants[event.actorId].position={...event.to}
   state.combatants[event.actorId].elevationFeet=height
   events.push(event)
   if(input.landings!=null&&event.movementKind==='forced'){
    const landing=landings.get(eventIndex),token=input.map.tokens.find(token=>token.id===event.actorId)
    if(!landing||!token)return {ok:false,reason:'forced-landing-replay-missing'}
    const fall=dnd5eForcedMovementFall({geometry:state.companionScene?.geometry??undefined,
     target:{...token,...event.from,elevationFeet:event.fromElevationFeet??actor.groundElevationFeet??0},
     targetCombatant:state.combatants[event.actorId],to:event.to})
    const landed=resolveDnd5eForcedMovementLanding({state,targetId:event.actorId,toElevationFeet:fall.toElevationFeet,
     toGroundElevationFeet:fall.landingGroundElevationFeet,fallingDamageRolls:landing.fallingDamageRolls})
    if(!landed.ok)return {ok:false,reason:landed.reason}
    usedLandings.add(eventIndex);state=landed.state;events.push(...landed.events)
   }
  }
  refreshDnd5eMapSpatialRelations(state,input.map,[],{geometry:state.companionScene?.geometry??undefined})
 }
 if(used.size!==receipts.size)return {ok:false,reason:'temple-entry-replay-unused'}
 if(usedLandings.size!==landings.size)return {ok:false,reason:'forced-landing-replay-unused'}
 return {ok:true,state,events}
}
