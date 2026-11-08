import type {Dnd5eDamageType} from './damageTypes'
import type {Dnd5eCombatant,Dnd5eCombatEvent,Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import {dnd5eBoundedHostEventId} from './activities/dnd5eActivityIdentity'
import {registeredDnd5ePluginFeatures,dnd5ePluginFeatureCurrentEnvelopeFullV1} from './plugins/pluginContentCatalog'

export interface Dnd5eSpellDamageSelectedAbilityBonusOption {
 featureId:string;actorId:string;targetId:string;spellId:string;castParentId:string
 rollKey:string;damageType:Dnd5eDamageType;ability:'cha';amount:number
}
type Decision=(options:readonly Dnd5eSpellDamageSelectedAbilityBonusOption[],state?:Dnd5eHeadlessCombatState)=>string|null
let active:{decide:Decision;interrupted?:{error:unknown}}|undefined

/** Host-only synchronous native replay scope. Only a selected registered source
 * id is returned; amounts, cast lineage and usage are native-derived. */
export function withDnd5eSpellDamageSelectedAbilityBonus<T>(decide:Decision,run:()=>T):T{
 const previous=active,scope={decide} as NonNullable<typeof active>;active=scope
 try{const result=run();if(scope.interrupted)throw scope.interrupted.error;return result}finally{active=previous}
}

export function selectDnd5eSpellDamageAbilityBonus(input:{
 actor:Dnd5eCombatant;targetId:string;spellId:string;castParentId?:string
 rollKey:string;damageType?:Dnd5eDamageType;diceCount:number;state:Dnd5eHeadlessCombatState
},events:Dnd5eCombatEvent[]):number{
 const {actor,castParentId,damageType}=input
 if(!active||!castParentId||castParentId.length>2000||!castParentId.trim()||
   !damageType||!Number.isSafeInteger(input.diceCount)||input.diceCount<1)return 0
 const used=actor.classState.spellDamageSelectedAbilityBonusUses??{}
 const options=registeredDnd5ePluginFeatures().flatMap(feature=>{
  const mechanic=feature.declarativeAbility?.mechanic
  if(!actor.pluginFeatureIds.includes(feature.id)||feature.automation!=='full'||
    !dnd5ePluginFeatureCurrentEnvelopeFullV1(feature.id)||
    mechanic?.kind!=='spell-damage-selected-ability-modifier'||!mechanic.damageTypes.some(type=>type===damageType))return []
  if(feature.sourceClassId){const level=actor.classLevels?.[feature.sourceClassId]??(actor.classId===feature.sourceClassId?actor.level??0:0)
   if(level<(feature.minimumLevel??1)||feature.sourceSubclassId&&
    (actor.subclassIds?.[feature.sourceClassId]??actor.subclassId)!==feature.sourceSubclassId)return []}
  const key=JSON.stringify([feature.id,castParentId]);if(Object.hasOwn(used,key))return []
  return [{featureId:feature.id,actorId:actor.id,targetId:input.targetId,spellId:input.spellId,
   castParentId,rollKey:input.rollKey,damageType,ability:mechanic.ability,amount:Math.floor((actor.abilities[mechanic.ability]-10)/2)}]
 })
 if(!options.length)return 0
 const scope=active;let selected:string|null
 try{selected=scope.decide(structuredClone(options),structuredClone(input.state))}catch(error){scope.interrupted={error};throw error}
 if(selected===null)return 0
 const option=options.find(o=>o.featureId===selected)
 if(!option||active!==scope||!dnd5ePluginFeatureCurrentEnvelopeFullV1(option.featureId)){const error=new Error('invalid-spell-damage-selected-ability-source');scope.interrupted={error};throw error}
 actor.classState.spellDamageSelectedAbilityBonusUses={...used,[JSON.stringify([option.featureId,castParentId])]:true}
 events.push({type:'spell-damage-selected-ability-modifier-applied',...option})
 return option.amount
}

export interface SpellDamageSelectedAbilityBonusFrame{
 id:string;parentId:string;ordinal:number;options:readonly Dnd5eSpellDamageSelectedAbilityBonusOption[]
}
export interface SpellDamageSelectedAbilityBonusChoice{frameId:string;featureId:string}
export function isSpellDamageSelectedAbilityBonusChoice(frame:Readonly<SpellDamageSelectedAbilityBonusFrame>,choice:SpellDamageSelectedAbilityBonusChoice):boolean{
 return !!choice&&Object.keys(choice).length===2&&choice.frameId===frame.id&&frame.options.some(option=>option.featureId===choice.featureId)
}
/** Ordinary native damage sessions install this listener. Every offered pool
 * comes from the real current spell damage consumer, before its HP commit. */
export function withSpellDamageSelectedAbilityBonusCheckpoints<T>(parentId:string,listener:(frame:Readonly<SpellDamageSelectedAbilityBonusFrame>,snapshot:Dnd5eHeadlessCombatState)=>SpellDamageSelectedAbilityBonusChoice|undefined,run:()=>T):T{
 if(!parentId||parentId.length>2000)throw Error('spell-selected-ability:original-parent-required')
 let ordinal=0
 return withDnd5eSpellDamageSelectedAbilityBonus((options,state)=>{
  if(!state)throw Error('spell-selected-ability:actual-native-state-required')
  const index=ordinal++,frame:Readonly<SpellDamageSelectedAbilityBonusFrame>=Object.freeze({
   parentId,ordinal:index,id:dnd5eBoundedHostEventId(JSON.stringify(['spell-selected-ability',parentId,index,options[0].castParentId,options[0].targetId,options[0].rollKey])),
   options:Object.freeze(options.map(option=>Object.freeze({...option}))),
  }),choice=listener(frame,state)
  if(!choice)return null
  if(!isSpellDamageSelectedAbilityBonusChoice(frame,choice))throw Error('spell-selected-ability:current-native-choice-required')
  return choice.featureId
 },run)
}
