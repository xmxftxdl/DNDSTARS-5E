import {createDnd5eMechanicalEffect,effectiveDnd5eActiveEffects,type Dnd5eActiveEffectInstance} from './activeEffects'
import type {Dnd5eCombatEvent,Dnd5eCombatant,Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import {dnd5eMapTokenDistanceFeet} from './verticalCombatGeometry'
import {dnd5eSummonDurationExpired} from '../../../shared/summon-linger.mjs'
import {recordDnd5eTargetLocation} from './knownCreatureLocations'

const AURA='ill-omen-hound-spell-save'
const KNOWLEDGE='ill-omen-hound-target-location'

/** Reads the actual current parent world; no caller location/DC/result registration. */
export function dnd5eLiveIllOmenTarget(state:Dnd5eHeadlessCombatState,hound:Dnd5eCombatant):Dnd5eCombatant|undefined {
 const binding=hound.illOmenHound,scene=state.companionScene
 if(!binding||!scene||scene.map.id!==state.mapId||hound.currentHp<=0||hound.deathSaves.dead)return
 const token=scene.map.tokens.find(token=>token.id===hound.id),summon=token?.dnd5eSummon
 if(!summon?.illOmenTarget||summon.sourceTokenId!==binding.sourceTokenId||summon.sourceCharacterId!==binding.sourceCharacterId||
  summon.illOmenTarget.targetTokenId!==binding.targetTokenId||summon.illOmenTarget.targetCharacterId!==binding.targetCharacterId||
  dnd5eSummonDurationExpired(summon,state.round,scene.worldMinute))return
 const target=state.combatants[binding.targetTokenId]
 if(!target||target.currentHp<=0||target.deathSaves.dead||binding.targetCharacterId!=null&&
  target.classState.wardingBondParticipantCharacterId!==binding.targetCharacterId)return
 return target
}

/** Only the chosen target, and only this hound's actual caster's spells. */
export function syncDnd5eIllOmenHoundAuras(state:Dnd5eHeadlessCombatState,events:Dnd5eCombatEvent[]=[]):void {
 const desired=new Map<string,{hound:Dnd5eCombatant;target:Dnd5eCombatant}>(),scene=state.companionScene
 if(scene)for(const hound of Object.values(state.combatants)){
  const target=dnd5eLiveIllOmenTarget(state,hound);if(!target)continue
  const left=scene.map.tokens.find(token=>token.id===hound.id),right=scene.map.tokens.find(token=>token.id===target.id)
  if(!left||!right)continue
  const distance=dnd5eMapTokenDistanceFeet({map:scene.map,geometry:scene.geometry??undefined,
   left:{...left,...hound.position,elevationFeet:hound.elevationFeet},right:{...right,...target.position,elevationFeet:target.elevationFeet}})
  if(Number.isFinite(distance)&&distance<=5)desired.set(hound.id+':ill-omen-save:'+target.id,{hound,target})
 }
 for(const target of Object.values(state.combatants)){
  const before=target.classState.activeEffects??[],next=before.filter(effect=>{
   if(effect.definitionId!==AURA)return true
   const wanted=desired.get(effect.id)
   const valid=wanted?.target.id===target.id&&effect.source.actorId===wanted.hound.id&&
    effect.modifiers?.spellSavingThrowDisadvantageFromActorIds?.length===1&&
    effect.modifiers.spellSavingThrowDisadvantageFromActorIds[0]===wanted.hound.illOmenHound!.sourceTokenId
   if(valid){desired.delete(effect.id);return true}
   events.push({type:'active-effect-removed',targetId:target.id,effectId:effect.id,definitionId:effect.definitionId,reason:'invalid-relation'});return false
  })
  if(next.length!==before.length)target.classState.activeEffects=next.length?next:undefined
 }
 for(const[id,{hound,target}]of desired){
  const effect=createDnd5eMechanicalEffect({id,definitionId:AURA,label:'凶兆猎犬：仅召唤者法术豁免劣势',targetId:target.id,
   source:{kind:'feature',rulesId:'ill-omen-hound',actorId:hound.id,magical:true},duration:{type:'permanent'},
   removal:{sourceLink:{maximumDistanceFeet:5}},breakOn:['source-dies'],
   modifiers:{spellSavingThrowDisadvantageFromActorIds:[hound.illOmenHound!.sourceTokenId]}})
  target.classState.activeEffects=[...(target.classState.activeEffects??[]),effect]
  events.push({type:'active-effect-applied',targetId:target.id,effectId:effect.id,definitionId:effect.definitionId})
 }
}

/** Start-of-own-turn knowledge is private to the hound; it never reveals sight to the caster. */
export function recordDnd5eIllOmenHoundTurnLocation(state:Dnd5eHeadlessCombatState,houndId:string,events:Dnd5eCombatEvent[]):void {
 const hound=state.combatants[houndId];if(!hound?.illOmenHound)return
 for(const target of Object.values(state.combatants)){
  const removed=(target.classState.activeEffects??[]).filter(effect=>effect.definitionId===KNOWLEDGE&&effect.source.actorId===houndId)
  if(removed.length){target.classState.activeEffects=target.classState.activeEffects!.filter(effect=>!removed.includes(effect));for(const effect of removed)events.push({type:'active-effect-removed',targetId:target.id,effectId:effect.id,definitionId:effect.definitionId,reason:'expired'})}
 }
 const target=dnd5eLiveIllOmenTarget(state,hound);if(!target||!recordDnd5eTargetLocation(state,houndId,target.id,'ill-omen-hound'))return
 const effect=createDnd5eMechanicalEffect({id:hound.id+':ill-omen-location:'+target.id,definitionId:KNOWLEDGE,label:'凶兆猎犬：本回合起始所知位置',targetId:target.id,
  source:{kind:'feature',rulesId:'ill-omen-hound',actorId:houndId,magical:true},duration:{type:'permanent'},breakOn:['source-dies'],
  modifiers:{locationKnownToSource:true,locationKnowledgeRetainsUnseenAttackBenefits:true}})
 target.classState.activeEffects=[...(target.classState.activeEffects??[]),effect]
 events.push({type:'active-effect-applied',targetId:target.id,effectId:effect.id,definitionId:effect.definitionId})
}

export function dnd5eLinkedLocationRevealsInvisibleForAttack(target:Dnd5eCombatant,viewer:Dnd5eCombatant):boolean {
 return effectiveDnd5eActiveEffects(target.classState.activeEffects).some(effect=>effect.modifiers?.locationKnownToSource===true&&
  effect.modifiers.locationKnowledgeRetainsUnseenAttackBenefits!==true&&
  (effect.source.characterId!=null?effect.source.characterId===viewer.classState.wardingBondParticipantCharacterId:effect.source.actorId===viewer.id))
}

/** Learning a start-of-turn position is not continuous tracking after the target moves. */
export function dnd5eIllOmenLocationIsCurrent(state:Dnd5eHeadlessCombatState,viewer:Dnd5eCombatant,target:Dnd5eCombatant,effect:Dnd5eActiveEffectInstance):boolean{
 if(effect.definitionId!==KNOWLEDGE)return true
 const known=viewer.classState.knownCreatureLocations?.[target.id]
 return viewer.illOmenHound?.targetTokenId===target.id && effect.source.actorId===viewer.id && !!known && known.mapId===state.mapId &&
  known.x===target.position.x && known.y===target.position.y && (known.elevationFeet??0)===(target.elevationFeet??0)
}

/** The old Hide result ended for this hound; walking alone does not reuse that old Hide result. */
export function dnd5eIllOmenTargetNoLongerHidden(state:Dnd5eHeadlessCombatState,viewer:Dnd5eCombatant,target:Dnd5eCombatant):boolean{
 return viewer.illOmenHound?.targetTokenId===target.id && dnd5eLiveIllOmenTarget(state,viewer)?.id===target.id &&
  effectiveDnd5eActiveEffects(target.classState.activeEffects).some(effect=>effect.definitionId===KNOWLEDGE&&effect.source.actorId===viewer.id)
}

export function clearDnd5eIllOmenKnowledgeAfterNewHide(state:Dnd5eHeadlessCombatState,events:Dnd5eCombatEvent[]):void{
 for(const id of new Set(events.flatMap(event=>event.type==='hide-resolved'?[event.actorId]:[]))){
  const target=state.combatants[id];if(!target)continue
  const old=target.classState.activeEffects??[],removed=old.filter(effect=>effect.definitionId===KNOWLEDGE)
  if(removed.length){target.classState.activeEffects=old.filter(effect=>!removed.includes(effect));for(const effect of removed)events.push({type:'active-effect-removed',targetId:id,effectId:effect.id,definitionId:effect.definitionId,reason:'expired'})}
 }
}
