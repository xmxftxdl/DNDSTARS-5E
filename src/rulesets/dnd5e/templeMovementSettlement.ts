import {type Dnd5eCombatEvent,type Dnd5eCombatant,type Dnd5eHeadlessCombatState,type Dnd5eOpeningAttackSavingThrowRoll} from './headlessCombatEngine'
import {resolveDnd5eTempleEntryEffectDice,type TempleEntryEffectDiceRoller,type Dnd5eTempleEntryReplay} from './templeEntryEffectDice'
import {dnd5eTempleEntryRequirements} from './templeEntry'
import {refreshDnd5eMapSpatialRelations} from './mapBridge'
import {effectiveDnd5eActiveEffects} from './activeEffects'
import {dnd5eSavingThrowMode} from './passiveDefenses'
import type {PreparedDnd5eOpeningAttackSavingThrow} from './spellAction'
import type {BattleMap} from '../../store/maps'

/** Resolve the entry save before a push can request falling dice or publish movement. */
export async function prepareDnd5eTempleForcedMovement(input:Omit<Parameters<typeof settleDnd5eTempleMovementEntries>[0],'events'>&{
 targetId:string;to:{x:number;y:number};distanceFeet:number;
}){
 const actor=input.state.combatants[input.targetId]
 if(!actor)return {ok:false as const,reason:'temple-movement-actor-missing'}
 const from={...actor.position},height=actor.elevationFeet
 const result=await settleDnd5eTempleMovementEntries({...input,events:[{type:'moved',actorId:actor.id,from,to:input.to,
  fromElevationFeet:height??actor.groundElevationFeet??0,toElevationFeet:height,
  fromMapId:input.map.id,toMapId:input.map.id,movementKind:'forced',distance:input.distanceFeet}]})
 if(!result.ok)return result
 const allowed=result.events.some(event=>event.type==='moved')
 result.state.combatants[actor.id].position=from
 result.state.combatants[actor.id].elevationFeet=height
 refreshDnd5eMapSpatialRelations(result.state,input.map,[],{geometry:result.state.companionScene?.geometry??undefined})
 return {ok:true as const,state:result.state,allowed,events:result.events.filter(event=>event.type!=='moved')}
}

/** Runs before a staged map movement is published or its arrival triggers fire. */
export async function settleDnd5eTempleMovementEntries(input:{state:Dnd5eHeadlessCombatState;map:BattleMap;events:readonly Dnd5eCombatEvent[];
 roll:(request:{state:Dnd5eHeadlessCombatState;target:Dnd5eCombatant;requirement:PreparedDnd5eOpeningAttackSavingThrow})=>Promise<Dnd5eOpeningAttackSavingThrowRoll|undefined>;
 isCurrent:()=>boolean;
 rollEffectDice?:TempleEntryEffectDiceRoller;
 transactionId?:string;
}):Promise<{ok:true;state:Dnd5eHeadlessCombatState;events:Dnd5eCombatEvent[];changed:boolean;
 entryReplays:Array<{eventIndex:number;receipt:Dnd5eTempleEntryReplay}>}|{ok:false;reason:string}>{
 let state=structuredClone(input.state),changed=false
 const events:Dnd5eCombatEvent[]=[]
 const entryReplays:Array<{eventIndex:number;receipt:Dnd5eTempleEntryReplay}>=[]
 const blockedActors=new Set<string>()
 for(const [eventIndex,event] of input.events.entries()){
  if(event.type!=='moved'){events.push(event);continue}
  if(blockedActors.has(event.actorId))continue
  // A source-map scene cannot prove that the destination has no ward.
  // Reject before the empty-requirements shortcut, including overlapping coordinates.
  if(event.fromMapId&&event.toMapId&&event.fromMapId!==event.toMapId)return {ok:false,reason:'temple-cross-map-entry-context-required'}
  const actor=state.combatants[event.actorId]
  if(!actor)return {ok:false,reason:'temple-movement-actor-missing'}
  const destination={...event.to},height=event.toElevationFeet??actor.elevationFeet
  actor.position={...event.from};actor.elevationFeet=event.fromElevationFeet??actor.groundElevationFeet??0
  const mode=event.movementKind==='teleport'?'teleport':event.movementKind==='forced'?'forced':undefined
  const entries=dnd5eTempleEntryRequirements(state,actor,event.to,event.toElevationFeet,undefined,mode)
  if(!entries.length){
   actor.position=destination;actor.elevationFeet=height;events.push(event)
   refreshDnd5eMapSpatialRelations(state,input.map,[],{geometry:state.companionScene?.geometry??undefined})
   continue
  }
  changed=true
  refreshDnd5eMapSpatialRelations(state,input.map,[],{geometry:state.companionScene?.geometry??undefined})
  const rolls:Array<Dnd5eOpeningAttackSavingThrowRoll&{effectId:string}>=[]
  if(!entries.some(entry=>entry.denied))for(const entry of entries){
   if(!input.isCurrent())return {ok:false,reason:'temple-entry-authority-changed'}
   const target=state.combatants[event.actorId],effects=effectiveDnd5eActiveEffects(target.classState.activeEffects)
   const roll=await input.roll({state,target,requirement:{featureId:entry.effectId,ability:'cha',dc:entry.dc,
    modifier:target.savingThrowBonuses.cha??Math.floor((target.abilities.cha-10)/2),
    mode:dnd5eSavingThrowMode(target,'cha',{sourceIsSpell:true,sourceIsMagical:true}),
    blessed:effects.some(effect=>effect.source.rulesId==='bless'),baned:effects.some(effect=>effect.source.rulesId==='bane'),failureDamageMultiplier:1}})
   if(!roll)return {ok:false,reason:'temple-entry-save-cancelled'}
   rolls.push({...roll,effectId:entry.effectId})
  }
  if(!input.isCurrent())return {ok:false,reason:'temple-entry-authority-changed'}
  const result=await resolveDnd5eTempleEntryEffectDice({state,action:{type:'temple-entry-attempt',actorId:event.actorId,to:event.to,
   toElevationFeet:event.toElevationFeet,distance:Math.max(1,event.distance),transportMode:mode,boundarySavingThrows:rolls},
   rollEffectDice:input.rollEffectDice,isCurrent:input.isCurrent,
   transactionId:input.transactionId==null?undefined:`${input.transactionId}:entry:${eventIndex}`})
  if(!result.ok)return {ok:false,reason:result.reason}
  if('entryReplay' in result)entryReplays.push({eventIndex,receipt:result.entryReplay})
  state=result.state;events.push(...result.events)
  if(result.movementBlocked)blockedActors.add(event.actorId)
  if(!result.movementBlocked){state.combatants[event.actorId].position={...event.to};state.combatants[event.actorId].elevationFeet=event.toElevationFeet??height;events.push(event)}
  refreshDnd5eMapSpatialRelations(state,input.map,[],{geometry:state.companionScene?.geometry??undefined})
 }
 return {ok:true,state,events,changed,entryReplays}
}
