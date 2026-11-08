import{cloneDnd5eHostTransactionInput}from'../../rulesets/dnd5e/hostTransactionClone'
import{resolvePreparedDnd5ePluginFeatureAction}from'../../rulesets/dnd5e/pluginFeatureAction'
import{captureSecondChancePluginFeatureBoundary}from'./secondChancePluginFeatureBoundary'
import{captureSecondChancePreparedHostFacts,restoreSecondChancePreparedHostFacts,restoreSecondChancePreparedHostFactsAsync}from'./secondChancePreparedHostFacts'
import{resolvePreparedDnd5eEquipmentAttack}from'../../rulesets/dnd5e/equipmentAttackAction'
import{resolvePreparedDnd5eMonsterAttack}from'../../rulesets/dnd5e/monsterAttackAction'
import{resolvePreparedDnd5eHunterMultiattack}from'../../rulesets/dnd5e/hunterMultiattackAction'
import{resolvePreparedDnd5eOpportunityAttack}from'../../rulesets/dnd5e/opportunityAttackAction'
import{resolvePreparedDnd5eSpellCast}from'../../rulesets/dnd5e/spellAction'
import{resolvePreparedDnd5ePluginSpellCast}from'../../rulesets/dnd5e/pluginSpellTransaction'
import{resolvePreparedDnd5eClassFeature}from'../../rulesets/dnd5e/classFeatureAction'
import{resolvePreparedDnd5eAdjudicatedSpell}from'../../rulesets/dnd5e/adjudicatedSpellAction'
import type{Dnd5eActionResult,Dnd5eHeadlessCombatState}from"../../application/combat/dnd5eCombatRules"
import type{Dnd5eMapResultPlan}from'../../rulesets/dnd5e/mapBridge'
import type{Character}from'../../types/character'
import type{BattleMap}from'../../store/maps'
import{createDnd5ePreparedDamageCommitSession}from'../../rulesets/dnd5e/damageCommitSession'
import{encodeSecondChanceParentWire,decodeSecondChanceParentWire,type SecondChanceParentWire}from'../../lib/secondChanceParentWire'

const resolvers={'plugin-feature':resolvePreparedDnd5ePluginFeatureAction,equipment:resolvePreparedDnd5eEquipmentAttack,monster:resolvePreparedDnd5eMonsterAttack,hunter:resolvePreparedDnd5eHunterMultiattack,opportunity:resolvePreparedDnd5eOpportunityAttack,spell:resolvePreparedDnd5eSpellCast,'plugin-spell':resolvePreparedDnd5ePluginSpellCast,'class-feature':resolvePreparedDnd5eClassFeature,'adjudicated-spell':resolvePreparedDnd5eAdjudicatedSpell} as const
export type SecondChancePreparedAdapterId=keyof typeof resolvers
export interface SecondChancePreparedOriginal{adapterId:SecondChancePreparedAdapterId;input:SecondChanceParentWire}
export interface SecondChancePreparedInput{prepared:{state:Dnd5eHeadlessCombatState;map:BattleMap;characters:readonly Character[];characterIdByCombatantId:Record<string,string>};[key:string]:unknown}
export interface SecondChancePreparedResult{result:Dnd5eActionResult;application?:Dnd5eMapResultPlan}
export function secondChancePreparedAdapterId(resolver:unknown):SecondChancePreparedAdapterId|undefined{return(Object.keys(resolvers)as SecondChancePreparedAdapterId[]).find(key=>resolvers[key]===resolver)}
export function captureSecondChancePreparedOriginal(resolver:unknown,input:unknown):SecondChancePreparedOriginal|undefined{
 const adapterId=secondChancePreparedAdapterId(resolver);if(!adapterId)return undefined
 // The exact actual facade function is whitelisted by identity. No payload may
 // supply a function name, and all original rolls and Host preparation survive.
 const data=adapterId==='plugin-feature'?{...input as object,resolveDamageBoundary:undefined,resolveMaterialDamageBoundary:undefined}:input
 return{adapterId,input:encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(data))}
}
export function readSecondChancePreparedOriginal(original:SecondChancePreparedOriginal):SecondChancePreparedInput{
 if(!original||!Object.hasOwn(resolvers,original.adapterId))throw Error('second-chance-parent:unknown-prepared-adapter')
 const value=restoreSecondChancePreparedHostFacts(decodeSecondChanceParentWire(original.input))as SecondChancePreparedInput
 if(!value?.prepared?.state?.combatId||!value.prepared.state.combatants||!value.prepared.map?.id||!Array.isArray(value.prepared.characters)||!value.prepared.characterIdByCombatantId)throw Error('second-chance-parent:invalid-prepared-original')
 return value
}
export function createSecondChancePreparedReplay(original:SecondChancePreparedOriginal){
 const input=readSecondChancePreparedOriginal(original)
 if(original.adapterId==='plugin-feature')throw Error('second-chance-parent:async-facade-requires-boundary')
 const resolve=resolvers[original.adapterId]as(input:SecondChancePreparedInput)=>SecondChancePreparedResult
 return createDnd5ePreparedDamageCommitSession(input,resolve,()=>false)
}
export function resolveSecondChancePreparedInput(original:SecondChancePreparedOriginal,input:SecondChancePreparedInput,transactionOptions?:Parameters<typeof resolvePreparedDnd5eSpellCast>[1]):SecondChancePreparedResult{
 if(original.adapterId==='spell')return resolvePreparedDnd5eSpellCast(input as unknown as Parameters<typeof resolvePreparedDnd5eSpellCast>[0],transactionOptions)
 const resolve=resolvers[original.adapterId]as(input:SecondChancePreparedInput)=>SecondChancePreparedResult
 return resolve(input)
}


export async function readSecondChancePreparedOriginalAsync(original:SecondChancePreparedOriginal):Promise<SecondChancePreparedInput>{
 if(!original||!Object.hasOwn(resolvers,original.adapterId))throw Error('second-chance-parent:unknown-prepared-adapter')
 const value=await restoreSecondChancePreparedHostFactsAsync(decodeSecondChanceParentWire(original.input))as SecondChancePreparedInput
 if(!value?.prepared?.state?.combatId||!value.prepared.state.combatants||!value.prepared.map?.id||!Array.isArray(value.prepared.characters)||!value.prepared.characterIdByCombatantId)throw Error('second-chance-parent:invalid-prepared-original')
 return value
}
export async function createSecondChancePreparedReplayAsync(original:SecondChancePreparedOriginal,transactionOptions?:Parameters<typeof resolvePreparedDnd5eSpellCast>[1]){
 const input=await readSecondChancePreparedOriginalAsync(original)
 if(original.adapterId==='plugin-feature'){
  const boundary=captureSecondChancePluginFeatureBoundary(input as unknown as Parameters<typeof resolvePreparedDnd5ePluginFeatureAction>[0])
  const session=createDnd5ePreparedDamageCommitSession({...input,prepared:{...input.prepared,state:boundary.state}},value=>boundary.resolve(value.prepared.state) as SecondChancePreparedResult,()=>false)
  return{...session,originalState:boundary.state,finalize:(value:SecondChancePreparedResult,changes?:readonly import('../../rulesets/dnd5e/damageReactionMaterialLedger').Dnd5eReactionMaterialChange[])=>boundary.complete(value,changes),dispose:()=>boundary.abort()}
 }
 const resolve=original.adapterId==='spell'?((value:SecondChancePreparedInput)=>resolvePreparedDnd5eSpellCast(value as unknown as Parameters<typeof resolvePreparedDnd5eSpellCast>[0],transactionOptions)):resolvers[original.adapterId]as(input:SecondChancePreparedInput)=>SecondChancePreparedResult
 const state=input.currentCombatState as Dnd5eHeadlessCombatState|undefined??input.prepared.state
 const replayInput=cloneDnd5eHostTransactionInput(input)
 replayInput.prepared.state=state
 const session=createDnd5ePreparedDamageCommitSession(replayInput,resolve,()=>false)
 return{...session,originalState:state,finalize:async(value:SecondChancePreparedResult)=>value,dispose:async()=>{}}
}
