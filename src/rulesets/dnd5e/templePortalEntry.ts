import {type Dnd5eCombatEvent,type Dnd5eHeadlessCombatState,type Dnd5eOpeningAttackSavingThrowRoll} from './headlessCombatEngine'
import {resolveDnd5eTempleEntryEffectDice,type TempleEntryEffectDiceRoller} from './templeEntryEffectDice'
import type {Dnd5eCompanionSceneSnapshot} from './headlessCompanionHealing'
import {dnd5eTempleEntryRequirements} from './templeEntry'
import {effectiveDnd5eActiveEffects} from './activeEffects'
import {dnd5eSavingThrowMode} from './passiveDefenses'
import type {settleDnd5eTempleMovementEntries} from './templeMovementSettlement'

/** Preflight only: do not publish a destination position or arrival event. */
export async function settleDnd5eTemplePortalEntry(input:{
 state:Dnd5eHeadlessCombatState;destinationScene:Dnd5eCompanionSceneSnapshot;
 event:Extract<Dnd5eCombatEvent,{type:'moved'}>;
 roll:Parameters<typeof settleDnd5eTempleMovementEntries>[0]['roll'];isCurrent:()=>boolean;
 rollEffectDice?:TempleEntryEffectDiceRoller;
}){
 const state=structuredClone(input.state),event=input.event,actor=state.combatants[event.actorId]
 if(!actor||event.movementKind!=='teleport'||event.fromMapId!==state.mapId||event.toMapId!==input.destinationScene.map.id||
  !input.destinationScene.geometry||input.destinationScene.geometry.mapId!==event.toMapId)
  return {ok:false as const,reason:'temple-portal-entry-context-invalid'}
 if(!input.isCurrent())return {ok:false as const,reason:'temple-entry-authority-changed'}
 const entryState={...state,mapId:input.destinationScene.map.id,companionScene:input.destinationScene}
 const entries=dnd5eTempleEntryRequirements(entryState,actor,event.to,event.toElevationFeet,undefined,'teleport',event.fromMapId)
 if(!entries.length)return {ok:true as const,state,events:[] as Dnd5eCombatEvent[],allowed:true,changed:false}
 const rolls:Array<Dnd5eOpeningAttackSavingThrowRoll&{effectId:string}>=[]
 if(!entries.some(entry=>entry.denied))for(const entry of entries){
  if(!input.isCurrent())return {ok:false as const,reason:'temple-entry-authority-changed'}
  const effects=effectiveDnd5eActiveEffects(actor.classState.activeEffects)
  const roll=await input.roll({state,target:actor,requirement:{featureId:entry.effectId,ability:'cha',dc:entry.dc,
   modifier:actor.savingThrowBonuses.cha??Math.floor((actor.abilities.cha-10)/2),
   mode:dnd5eSavingThrowMode(actor,'cha',{sourceIsSpell:true,sourceIsMagical:true}),
   blessed:effects.some(effect=>effect.source.rulesId==='bless'),baned:effects.some(effect=>effect.source.rulesId==='bane'),failureDamageMultiplier:1}})
  if(!roll)return {ok:false as const,reason:'temple-entry-save-cancelled'}
  rolls.push({...roll,effectId:entry.effectId})
 }
 if(!input.isCurrent())return {ok:false as const,reason:'temple-entry-authority-changed'}
 const result=await resolveDnd5eTempleEntryEffectDice({state,action:{type:'temple-entry-attempt',actorId:actor.id,to:event.to,
  toElevationFeet:event.toElevationFeet,distance:1,transportMode:'teleport',originMapId:event.fromMapId,
  entryScene:input.destinationScene,boundarySavingThrows:rolls},rollEffectDice:input.rollEffectDice,isCurrent:input.isCurrent})
 if(!result.ok)return {ok:false as const,reason:result.reason}
 return {ok:true as const,state:result.state,events:result.events,allowed:!result.movementBlocked,changed:true}
}
