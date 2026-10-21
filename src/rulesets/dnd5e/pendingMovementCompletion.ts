import type {Dnd5eOpeningAttackSavingThrowRoll} from './headlessCombatEngine'
export interface Dnd5ePendingMovementCompletion {
 id:string; actorTokenId:string;
 rolls?:Array<Dnd5eOpeningAttackSavingThrowRoll&{effectId:string}>;
 effectRollDice?:Record<string,number[]>;
 /** Local/acknowledged state already contains the result; retry only its save. */
 settled?:true;
}
function savedRolls(value:unknown):Dnd5ePendingMovementCompletion['rolls']{
 if(!Array.isArray(value)||value.length>128)return undefined
 const numeric=['d20','d20Second','halflingLuckyD20','halflingLuckyD20Second','blessRoll','baneRoll','rerollD20','rerollD20Second','bardicInspirationRoll','darkOnesOwnLuckRoll']
 const result:Dnd5ePendingMovementCompletion['rolls']=[]
 for(const raw of value){
  if(!raw||typeof raw!=='object'||typeof raw.effectId!=='string'||!raw.effectId||raw.effectId.length>512||!Number.isInteger(raw.d20)||raw.d20<1||raw.d20>20)return undefined
  const roll:Record<string,unknown>&{effectId:string;d20:number}={effectId:raw.effectId,d20:raw.d20}
  for(const key of numeric)if(raw[key]!==undefined){if(!Number.isInteger(raw[key])||raw[key]<1||raw[key]>1000)return undefined;roll[key]=raw[key]}
  if(raw.rerollResourceKey!==undefined){if(typeof raw.rerollResourceKey!=='string'||raw.rerollResourceKey.length>512)return undefined;roll.rerollResourceKey=raw.rerollResourceKey}
  if(raw.legendaryResistance!==undefined){if(typeof raw.legendaryResistance!=='boolean')return undefined;roll.legendaryResistance=raw.legendaryResistance}
  if(raw.optionalBonusDice!==undefined){
   if(!Array.isArray(raw.optionalBonusDice)||raw.optionalBonusDice.length>1)return undefined
   const dice=[]
   for(const die of raw.optionalBonusDice){
    if(!die||typeof die.effectId!=='string'||!die.effectId||die.effectId.length>512||
     typeof die.targetId!=='string'||!die.targetId||die.targetId.length>256||
     die.rollKind!=='saving-throw'||!Number.isInteger(die.roll)||die.roll<1||die.roll>1000)return undefined
    dice.push({effectId:die.effectId,targetId:die.targetId,rollKind:'saving-throw' as const,roll:die.roll})
   }
   roll.optionalBonusDice=dice
  }
  if(raw.postD20Adjustment!==undefined){const v=raw.postD20Adjustment
   if(!v||typeof v.sourceId!=='string'||typeof v.featureId!=='string'||!['add','subtract'].includes(v.direction)||!Number.isInteger(v.roll)||v.roll<1||v.roll>1000)return undefined
   roll.postD20Adjustment={sourceId:v.sourceId,featureId:v.featureId,direction:v.direction,roll:v.roll}
  }
  result.push(roll as Dnd5eOpeningAttackSavingThrowRoll&{effectId:string})
 }
 return new Set(result.map(r=>r.effectId)).size===result.length?result:undefined
}
function savedDice(value:unknown):Record<string,number[]>|undefined{
 if(!value||typeof value!=='object'||Array.isArray(value))return undefined
 const entries=Object.entries(value)
 if(entries.length>128)return undefined
 if(entries.some(([id,rolls])=>id.length>4096||!Array.isArray(rolls)||rolls.length>128||rolls.some(n=>!Number.isInteger(n)||n<1||n>1000)))return undefined
 return Object.fromEntries(entries.map(([id,rolls])=>[id,[...(rolls as number[])]]))
}
export function normalizeDnd5ePendingMovementCompletions(value:unknown):Dnd5ePendingMovementCompletion[]{
 if(!Array.isArray(value))return []
 const actors=new Set<string>()
 return value.slice(0,128).flatMap(entry=>{
  if(!entry||typeof entry!=='object'||typeof entry.id!=='string'||!entry.id.trim()||entry.id.length>256||
   typeof entry.actorTokenId!=='string'||!entry.actorTokenId.trim()||entry.actorTokenId.length>256||actors.has(entry.actorTokenId))return []
  actors.add(entry.actorTokenId)
  const rolls=savedRolls(entry.rolls),effectRollDice=savedDice(entry.effectRollDice)
  return [{id:entry.id,actorTokenId:entry.actorTokenId,...(rolls?{rolls}:{}),...(effectRollDice?{effectRollDice}:{}),...(entry.settled===true?{settled:true as const}:{})}]
 })
}
export function removeDnd5ePendingMovementCompletion(entries:readonly Dnd5ePendingMovementCompletion[]|undefined,id:string){
 return (entries??[]).filter(entry=>entry.id!==id)
}

import {dnd5eActiveMovementRepeatSaves} from './activeEffects'
import type {Dnd5eMapResultPlan} from './mapBridge'
/** Put the recovery receipt in the same map application as the committed move. */
export function withDnd5ePendingMovementCompletion(application:Dnd5eMapResultPlan,actorTokenId:string,id:string,moved:boolean):Dnd5eMapResultPlan{
 if(!moved)return application
 const token=application.map.tokens.find(token=>token.id===actorTokenId)
 if(!token)return application
 const character=token.characterId?application.characters.find(character=>character.id===token.characterId):undefined
 if(!dnd5eActiveMovementRepeatSaves(character?.dnd5eCombatState?.activeEffects??token.dnd5eCombatState?.activeEffects).length)return application
 const entries=application.map.dnd5ePendingMovementCompletions??[]
 if(entries.some(entry=>entry.actorTokenId===actorTokenId))return application
 return {...application,map:{...application.map,dnd5ePendingMovementCompletions:[...entries,{id,actorTokenId}]}}
}

