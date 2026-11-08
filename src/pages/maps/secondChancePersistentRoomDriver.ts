import{captureArcaneBeforeSecondChanceDecline,captureArcaneBeforeSecondChanceContinuation,readArcaneBeforeSecondChanceOriginal}from'./arcaneBeforeSecondChance'
import{captureArmorBeforeSecondChanceDecline,captureArmorBeforeSecondChanceContinuation}from'./armorBeforeSecondChance'
import{sameActivityParentData}from'./postNativeActivityParent'
import type{SecondChancePostNativeFrame,SecondChancePostNativeSettlement}from'./secondChancePostNativeBoundary'
import{isSecondChanceAdditionalIncoming}from'./secondChanceAdditionalIncoming'
import{secondChanceParentGroup,activeSecondChanceParentReceipt}from'./secondChanceParentGroup'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import type{Dnd5eAction}from"../../application/combat/dnd5eCombatRules"
import{issueSecondChanceAttack}from'./issueSecondChanceAttack'
import{processSecondChanceRequest}from'./processSecondChanceRequest'
import{commitSecondChanceHostAttack,type PersistedSecondChanceAttack,type SecondChanceCombat}from'./secondChanceHostCommit'
import{prepareSecondChanceParentCriticalDice,publishSecondChanceParent,prepareDeclinedSecondChanceParent}from'./publishSecondChanceParent'
import type{SecondChanceChoiceContext}from'../../lib/secondChanceClientCommands'
import type{IncomingCriticalDiceRequest}from'../../rulesets/dnd5e/incomingAttackRerollCheckpoint'
import{SecondChanceMapsSettlementSignal}from'./secondChanceMapsSettlement'
import type{SecondChancePreparedOriginal}from'./secondChancePreparedParent'
import type{SharedPlayerActionState}from'../../lib/sharedCombatTypes'
import{validateSecondChanceAttackReceipts}from'../../../shared/second-chance-state.mjs'
import{secondChanceParentScopeMatches}from'./secondChanceParentScope'
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
export interface SecondChancePersistentRoomUI{
 showChoice:(input:{receipt:PersistedSecondChanceAttack;context:SecondChanceChoiceContext})=>Promise<void>
 requestRoll:(input:{receipt:PersistedSecondChanceAttack;rollRequestId:string;supplement?:IncomingCriticalDiceRequest})=>Promise<void>
 settlePostNative?:(frame:SecondChancePostNativeFrame)=>Promise<SecondChancePostNativeSettlement>
 prepareFollowups?:()=>Promise<import('../../rulesets/dnd5e/damageReactionFlow').Dnd5eDamageReactionFlowOptions>
}
export async function resumeSecondChancePersistentRoomParent(action:SharedPlayerActionState,gateway:Gateway,ui:SecondChancePersistentRoomUI):Promise<boolean>{
 const combat=await gateway.loadResource<SecondChanceCombat>('combat')
 if(!combat)return false
 if(!validateSecondChanceAttackReceipts(combat.secondChanceAttacks??{}))throw Error('second-chance-driver:invalid-persisted-parent')
 const matches=secondChanceParentGroup(combat,action.id)
 if(!matches.length)return false
 if(!matches.every(row=>secondChanceParentScopeMatches(combat,row,action.mapId)))throw Error('second-chance-driver:parent-scope-mismatch')
 const receipt=activeSecondChanceParentReceipt(matches)!,queue=await gateway.loadResource<{requests:SharedPlayerActionState[]}>('player-action-requests'),original=queue?.requests.find(row=>row.id===action.id)
 if(!receipt.originalRoomAction||!original||JSON.stringify(original)!==JSON.stringify(receipt.originalRoomAction)||JSON.stringify(action)!==JSON.stringify(original))throw Error('second-chance-driver:original-command-mismatch')
 const parent=receipt.parentInput;if(!parent)throw Error('second-chance-driver:original-parent-required')
 return await driveSecondChancePersistentRoomParent({mapId:action.mapId,parentTransactionId:action.id,action:parent.action,state:parent.state,nativeContext:parent.nativeContext,options:parent.options,preparedOriginal:parent.prepared},gateway,ui)
}
/** Maps owns the authorized original action. UI callbacks publish actual owner
 * prompts and dice only; their returned values are deliberately ignored. Each
 * authoritative phase is read from the existing server-stamped append queue. */
async function driveSecondChancePersistentRoomParentOnce(input:{mapId:string;parentTransactionId:string;action?:Dnd5eAction;state?:import("../../application/combat/dnd5eCombatRules").Dnd5eHeadlessCombatState;nativeContext?:import('../../rulesets/dnd5e/damageReactionFlow').Dnd5eDamageReactionMapContext;preparedOriginal?:SecondChancePreparedOriginal;options?:Parameters<typeof import("../../application/combat/dnd5eCombatRules").resolveDnd5eHeadlessAction>[2]},gateway:Gateway,ui:SecondChancePersistentRoomUI):Promise<never>{
 // A persisted Armor decline is only a candidate here. Both issuance and final
 // replay independently rebuild its genuine checkpoint through opaque brands.
 const arcaneJournal=await gateway.loadResource<{parents:Record<string,{id:string;phase:string;mapId:string;parentTransactionId:string;prepared:SecondChancePreparedOriginal}>}>('arcane-native-parents')
 const arcaneParents=Object.values(arcaneJournal?.parents??{}).filter(row=>row.phase!=='consumed'&&row.mapId===input.mapId&&row.parentTransactionId===input.parentTransactionId)
 if(arcaneParents.length>1)throw Error('second-chance-driver:ambiguous-arcane-parent')
 const arcane=arcaneParents[0]
 if(arcane&&!sameActivityParentData(arcane.prepared,input.preparedOriginal))throw Error('second-chance-driver:arcane-original-mismatch')
 const priorArcane=arcane?await gateway.loadResource<SecondChanceCombat>('combat'):undefined,arcaneExisting=priorArcane&&secondChanceParentGroup(priorArcane,input.parentTransactionId)
 const arcaneBeforeSecondChance=arcane&&!arcaneExisting?.length?await captureArcaneBeforeSecondChanceDecline(arcane.id,gateway):undefined
 if(arcaneBeforeSecondChance){const original=readArcaneBeforeSecondChanceOriginal(arcaneBeforeSecondChance);if(input.options?.now!==undefined&&input.options.now!==original.now)throw Error('second-chance-driver:arcane-original-clock-mismatch');input={...input,options:{...input.options,now:original.now}}}
 const armorJournal=await gateway.loadResource<{parents:Record<string,{id:string;phase:string;mapId:string;parentTransactionId:string;prepared:SecondChancePreparedOriginal}>}>('armor-native-parents')
 const armorParents=Object.values(armorJournal?.parents??{}).filter(row=>row.phase==='waiting'&&row.mapId===input.mapId&&row.parentTransactionId===input.parentTransactionId)
 if(armorParents.length>1)throw Error('second-chance-driver:ambiguous-armor-parent')
 const armor=armorParents[0]
 if(armor&&!sameActivityParentData(armor.prepared,input.preparedOriginal))throw Error('second-chance-driver:armor-original-mismatch')
 const prior=armor?await gateway.loadResource<SecondChanceCombat>('combat'):undefined
 const existing=prior&&secondChanceParentGroup(prior,input.parentTransactionId)
 const armorBeforeSecondChance=armor&&!existing?.length?await captureArmorBeforeSecondChanceDecline(armor.id,gateway):undefined
 let receipt=await issueSecondChanceAttack({...input,armorBeforeSecondChance,arcaneBeforeSecondChance},gateway)
 const identity={mapId:input.mapId,combatId:receipt.attack.combatId,parentTransactionId:input.parentTransactionId,attackReceiptId:receipt.attack.id}
 const pending=():never=>{throw new SecondChanceMapsSettlementSignal({kind:'second-chance-parent-pending',...identity})}
 const awaitOwner=async(run:()=>Promise<void>)=>{try{await run()}catch{pending()}}
 const refresh=async()=>{
  const queue=await gateway.loadResource<{requests:{id:string;type:string;status:string;secondChance?:{attackReceiptId?:string}}[]}>('player-action-requests')
  for(const row of queue?.requests??[])if(row.type==='dnd5e-second-chance'&&row.status==='pending'&&row.secondChance?.attackReceiptId===receipt.attack.id){
   try{await processSecondChanceRequest({mapId:input.mapId,requestId:row.id},gateway)}catch(error){
    // Invalid foreign submissions cannot veto another player's pending parent.
    // CAS/network/schema failures still propagate; no partial cost is hidden.
    if(!(error instanceof Error)||!/^second-chance-request:(?:reaction-not-authorized|roller-not-authorized|confirmation-not-authorized|authenticated-request-required|invalid-(?:command|reaction-command|selection-command|roll-result|critical-result|confirmation)|reaction-already-decided|selection-not-awaited|roll-not-awaited|critical-roll-not-awaited|confirmation-not-awaited|unknown-phase|attack-unavailable)$/.test(error.message))throw error
   }
  }
  const combat=await gateway.loadResource<SecondChanceCombat>('combat'),fresh=combat?.secondChanceAttacks?.[receipt.attack.id]
  if(!fresh||fresh.attack.transactionId!==input.parentTransactionId)throw Error('second-chance-driver:parent-lost')
  receipt=fresh
 }
 const publish=async()=>{
  const options=await ui.prepareFollowups?.()
  const continued=armor?await captureArmorBeforeSecondChanceContinuation(armor.id,receipt.attack.id,gateway):undefined
  const continuedArcane=arcane?await captureArcaneBeforeSecondChanceContinuation(arcane.id,receipt.attack.id,gateway):undefined
  return publishSecondChanceParent({mapId:input.mapId,attackReceiptId:receipt.attack.id,armorBeforeSecondChance:continued,arcaneBeforeSecondChance:continuedArcane},gateway,options?{options,settlePostNative:ui.settlePostNative,criticalDice:async(current,request)=>{
   receipt=current
   await awaitOwner(()=>ui.requestRoll({receipt,rollRequestId:request.id,supplement:request}));await refresh()
   const values=receipt.hostControllerMemberId?receipt.criticalDiceConfirmations?.[request.id]?.values:receipt.criticalDice?.[request.id]
   if(!values)pending()
   return values!
  }}:undefined)
 }
 await refresh()
 if(receipt.parentContinuation?.phase==='consumed'){
  if(!receipt.parentContinuation.result)throw Error('second-chance-driver:saved-result-missing')
  throw new SecondChanceMapsSettlementSignal({kind:'second-chance-parent-published',...identity,result:receipt.parentContinuation.result})
 }
 if(!receipt.reactionDecision){
  await awaitOwner(()=>ui.showChoice({receipt,context:{...identity,actorTokenId:receipt.attack.targetTokenId,characterId:receipt.attack.targetCharacterId,phase:'reaction',featureId:receipt.featureId,diceCount:receipt.attack.dice.length as 1|2}}))
  await refresh();if(!receipt.reactionDecision)pending()
 }
 // Decline needs its own cost-free parent continuation; never represent it as
 // a successful spent reaction or fabricate a committed replacement die.
 if(receipt.reactionDecision?.decision==='decline'){
  await prepareDeclinedSecondChanceParent({mapId:input.mapId,attackReceiptId:receipt.attack.id},gateway)
  const result=await publish()
  throw new SecondChanceMapsSettlementSignal({kind:'second-chance-parent-published',...identity,result})
 }
 if(!receipt.rollerSelection){
  await awaitOwner(()=>ui.showChoice({receipt,context:{...identity,actorTokenId:receipt.attack.rollerTokenId,characterId:receipt.attack.rollerCharacterId??receipt.attack.rollerTokenId,phase:'select-die',featureId:receipt.featureId,diceCount:receipt.attack.dice.length as 1|2}}))
  await refresh();if(!receipt.rollerSelection)pending()
 }
 if(!receipt.rollerD20||receipt.hostControllerMemberId&&!receipt.rollerConfirmation){
  if(!receipt.rollRequestId)throw Error('second-chance-driver:roll-request-missing')
  const rollRequestId=receipt.rollRequestId
  await awaitOwner(()=>ui.requestRoll({receipt,rollRequestId}));await refresh();if(!receipt.rollerD20||receipt.hostControllerMemberId&&!receipt.rollerConfirmation)pending()
 }
 if(!receipt.committed){await commitSecondChanceHostAttack({mapId:input.mapId,attackReceiptId:receipt.attack.id},gateway);await refresh()}
 for(let count=0;!ui.prepareFollowups&&count<64;count++){
  const supplement=await prepareSecondChanceParentCriticalDice({mapId:input.mapId,attackReceiptId:receipt.attack.id,arcaneBeforeSecondChance:arcane?await captureArcaneBeforeSecondChanceContinuation(arcane.id,receipt.attack.id,gateway):undefined},gateway)
  if(!supplement)break
  await refresh();if(receipt.criticalDice?.[supplement.id]&&(!receipt.hostControllerMemberId||receipt.criticalDiceConfirmations?.[supplement.id]))continue
  await awaitOwner(()=>ui.requestRoll({receipt,rollRequestId:supplement.id,supplement}));await refresh();if(!receipt.criticalDice?.[supplement.id]||receipt.hostControllerMemberId&&!receipt.criticalDiceConfirmations?.[supplement.id])pending()
 }
 const result=await publish()
 throw new SecondChanceMapsSettlementSignal({kind:'second-chance-parent-published',...identity,result})
}

export async function driveSecondChancePersistentRoomParent(input:Parameters<typeof driveSecondChancePersistentRoomParentOnce>[0],gateway:Gateway,ui:SecondChancePersistentRoomUI,depth=0):Promise<never>{
 if(depth>=96)throw Error('second-chance-driver:parent-occurrence-limit')
 try{return await driveSecondChancePersistentRoomParentOnce(input,gateway,ui)}catch(error){
  if(!isSecondChanceAdditionalIncoming(error))throw error
  await issueSecondChanceAttack({...input,additionalIncoming:error},gateway)
  return await driveSecondChancePersistentRoomParent(input,gateway,ui,depth+1)
 }
}
