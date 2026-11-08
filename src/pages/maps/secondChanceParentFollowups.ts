import{SecondChanceAdditionalIncoming}from'./secondChanceAdditionalIncoming'
import{secondChanceOccurrence}from'./secondChanceParentGroup'
import{resolvePreparedDnd5ePluginFeatureAction}from'../../rulesets/dnd5e/pluginFeatureAction'
import{resolveDnd5eDamageBoundaryWithMaterials}from'../../rulesets/dnd5e/damageReactionFlow'
import{resolveDnd5eActionWithMaterialDamageReactions,resolveDnd5ePreparedWithMaterialDamageReactions,type Dnd5eDamageReactionFlowOptions,type Dnd5eDamageReactionMapContext}from'../../rulesets/dnd5e/damageReactionFlow'
import type{IncomingCriticalDiceRequest}from'../../rulesets/dnd5e/incomingAttackRerollCheckpoint'
import type{PersistedSecondChanceAttack}from'./secondChanceHostCommit'
import{readSecondChancePreparedOriginalAsync,resolveSecondChancePreparedInput,type SecondChancePreparedResult}from'./secondChancePreparedParent'

/** All existing critical, damage, material, push and after-damage windows remain
 * in the official Flow and resolve the same frozen original parent. Only this
 * feature's committed choice and authenticated supplement are supplied here. */
export async function resolveSecondChanceParentWithFollowups(input:{receipt:PersistedSecondChanceAttack;receipts?:readonly PersistedSecondChanceAttack[];options:Dnd5eDamageReactionFlowOptions;context:Dnd5eDamageReactionMapContext;criticalDice:(request:IncomingCriticalDiceRequest)=>Promise<readonly number[]>}):Promise<SecondChancePreparedResult>{
 const receipt=input.receipt,parent=receipt.parentInput
 if(!parent||!receipt.committed&&receipt.reactionDecision?.decision!=='decline')throw Error('second-chance-parent:original-parent-required')
 const rows=input.receipts??[receipt],visited=new Set<string>()
 const options:Dnd5eDamageReactionFlowOptions={...input.options,replayEventBatchId:receipt.attack.transactionId,
  chooseIncomingAttackReroll:async({facts,state,occurrence})=>{
   const row=rows.find(row=>secondChanceOccurrence(row)===occurrence)
   if(!row)throw new SecondChanceAdditionalIncoming(receipt.attack.transactionId,occurrence,facts,state)
   if(facts.event.actorId!==row.attack.rollerTokenId||facts.event.targetId!==row.attack.targetTokenId||JSON.stringify(facts.dice)!==JSON.stringify(row.attack.dice)||facts.modifier!==row.attack.modifier||facts.mode!==row.attack.mode||facts.event.armorClass!==row.attack.armorClass)throw Error('second-chance-parent:changed-original-incoming')
   if(visited.has(row.attack.id))throw Error('second-chance-parent:duplicate-original-incoming')
   if(!row.committed&&row.reactionDecision?.decision!=='decline')throw Error('second-chance-parent:undecided-incoming')
   visited.add(row.attack.id)
   return row.committed?{featureId:row.featureId,dieIndex:row.committed.replacedDieIndex,newD20:row.committed.afterDice[row.committed.replacedDieIndex]}:undefined
  },rollIncomingCriticalDice:input.criticalDice,
 }
 let result:SecondChancePreparedResult
 if(parent.prepared){
  const original=await readSecondChancePreparedOriginalAsync(parent.prepared)
  result=parent.prepared.adapterId==='plugin-feature'?await resolvePreparedDnd5ePluginFeatureAction({...original as unknown as Parameters<typeof resolvePreparedDnd5ePluginFeatureAction>[0],resolveMaterialDamageBoundary:(state,resolve,succeeded)=>resolveDnd5eDamageBoundaryWithMaterials(options,state,resolve,succeeded)}):await resolveDnd5ePreparedWithMaterialDamageReactions(options,original,value=>resolveSecondChancePreparedInput(parent.prepared!,value,parent.options?.now===undefined?undefined:{...parent.options,transactionId:receipt.attack.transactionId+':second-chance-prepared'}))
 }else{
  if(!parent.action)throw Error('second-chance-parent:original-action-required')
  const settled=await resolveDnd5eActionWithMaterialDamageReactions({...options,state:parent.state,action:parent.action,options:{...parent.options,transactionId:receipt.attack.transactionId+':second-chance-native'}},parent.nativeContext??input.context)
  result={result:settled,application:settled.application}
 }
 if(visited.size!==rows.length)throw Error('second-chance-parent:original-incoming-not-replayed')
 return result
}
