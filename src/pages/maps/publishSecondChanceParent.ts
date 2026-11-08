import{assertArcaneBeforeSecondChanceDecline,prepareArcaneBeforeSecondChanceConsumption,type ArcaneBeforeSecondChanceDecline}from'./arcaneBeforeSecondChance'
import{assertArmorBeforeSecondChanceDecline,prepareArmorBeforeSecondChanceConsumption,type ArmorBeforeSecondChanceDecline}from'./armorBeforeSecondChance'
import {settleBountifulReadyWithSecondChance,settleBountifulWithSecondChance} from '../../rulesets/dnd5e/bountifulLuckJointSettlement'
import{readSecondChanceBasePrefixPublication}from'./secondChanceBasePrefixPublication'
import{prepareSecondChanceSpecterPlayerAck}from'./secondChanceSpecterPlayerAck'
import{readSecondChanceSpecterFinalPlan}from'./secondChanceSpecterFinalPlan'
import{insertInitiativeEntriesPreservingActive,projectHeadlessInitiativeOrder}from'../mapsPageHelpers'
import{readSecondChancePostConcentrationClockGuard}from'./secondChancePostConcentrationActivityFrame'
import{captureSecondChancePostNativeFrame,readSecondChancePostNativeSettlement,type SecondChancePostNativeFrame,type SecondChancePostNativeSettlement}from'./secondChancePostNativeBoundary'
import{SecondChanceMapsSettlementSignal}from'./secondChanceMapsSettlement'
import{dnd5eOrdinaryAttacksUsed}from'../../rulesets/dnd5e/attackActionHistory'
import{secondChanceParentScopeMatches,assertSecondChanceSceneScope}from'./secondChanceParentScope'
import{dnd5eDeclarativeResourceKey}from'../../rulesets/dnd5e/plugins/pluginDeclarativeCompiler'
import{SecondChanceAdditionalIncoming}from'./secondChanceAdditionalIncoming'
import{secondChanceParentGroup,secondChanceOccurrence,advanceSecondChanceParentRevisions}from'./secondChanceParentGroup'
import type {Character}from'../../types/character'
import type {BattleMap}from'../../store/maps'
import type {SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import{getRoomSession}from'../../lib/roomSession'
import{planDnd5eMapResultApplication}from'../../rulesets/dnd5e/mapBridge'
import type{Dnd5eActionResult}from"../../application/combat/dnd5eCombatRules"
import type{SecondChanceCombat,PersistedSecondChanceAttack}from'./secondChanceHostCommit'
import{createDnd5eDamageCommitSession}from'../../rulesets/dnd5e/damageCommitSession'
import{validateSecondChanceAttackReceipts}from'../../../shared/second-chance-state.mjs'
import{dnd5ePluginFeatureCurrentEnvelopeFullV1,dnd5ePluginFeatureDefinition}from'../../rulesets/dnd5e/plugins/pluginContentCatalog'
import{createSecondChancePreparedReplayAsync,type SecondChancePreparedResult}from'./secondChancePreparedParent'
import{resolveSecondChanceParentWithFollowups}from'./secondChanceParentFollowups'
import type{Dnd5eDamageReactionFlowOptions}from'../../rulesets/dnd5e/damageReactionFlow'
import type{IncomingCriticalDiceRequest}from'../../rulesets/dnd5e/incomingAttackRerollCheckpoint'
import{secondChanceParentDefinitionSignature}from'../../lib/secondChanceParentSignature'
type Snapshot<T>=T&{_sync?:{revision?:number}}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
function revision(value:Snapshot<object>,name:string){const rev=value._sync?.revision;if(!Number.isSafeInteger(rev)||rev!<0)throw Error(`second-chance-parent:revision-required:${name}`);return rev!}
async function replayOriginalParent(receipt:PersistedSecondChanceAttack,rows:readonly PersistedSecondChanceAttack[]=[receipt],armor?:{brand:ArmorBeforeSecondChanceDecline;gateway:Gateway},arcane?:{brand:ArcaneBeforeSecondChanceDecline;gateway:Gateway}){
 const parent=receipt.parentInput
 if(!parent||parent.state.combatId!==receipt.attack.combatId||!parent.action&&!parent.prepared)throw Error('second-chance-parent:original-parent-required')
 const replay=parent.prepared?await createSecondChancePreparedReplayAsync(parent.prepared,parent.options?.now===undefined?undefined:{...parent.options,transactionId:receipt.attack.transactionId+':second-chance-prepared'}):createDnd5eDamageCommitSession(parent.state,parent.action!,()=>false,{...parent.options,transactionId:receipt.attack.transactionId+':second-chance-native'})
 try{
  let result=replay.run(parent.state)
  for(let count=0;count<192;count++){
   if(result.status==='pending-incoming-armor-class'&&arcane){const pending=result;await assertArcaneBeforeSecondChanceDecline(arcane.brand,{parentTransactionId:receipt.attack.transactionId,preparedOriginal:parent.prepared,facts:pending.facts,occurrence:pending.occurrence,now:parent.options?.now},arcane.gateway);result=replay.resumeIncomingArmorClass(parent.state,pending.occurrence,pending.facts,undefined);continue}
   if(result.status==='pending-incoming-hit-negation'&&armor){const pending=result;await assertArmorBeforeSecondChanceDecline(armor.brand,{parentTransactionId:receipt.attack.transactionId,preparedOriginal:parent.prepared,facts:pending.facts,occurrence:pending.occurrence},armor.gateway);result=replay.resumeIncomingHitNegation(parent.state,pending.occurrence,pending.facts,undefined);continue}
   if(result.status==='pending-incoming-attack'){
    const pending=result,row=rows.find(row=>secondChanceOccurrence(row)===pending.occurrence)
    if(!row)throw new SecondChanceAdditionalIncoming(receipt.attack.transactionId,pending.occurrence,pending.facts,pending.snapshot)
    if(pending.facts.event.actorId!==row.attack.rollerTokenId||pending.facts.event.targetId!==row.attack.targetTokenId||JSON.stringify(pending.facts.dice)!==JSON.stringify(row.attack.dice)||pending.facts.modifier!==row.attack.modifier||pending.facts.mode!==row.attack.mode||!row.committed&&row.reactionDecision?.decision!=='decline')throw Error('second-chance-parent:parent-facts-mismatch')
    result=replay.resumeIncomingAttack(parent.state,pending.occurrence,pending.facts,row.committed?{featureId:row.featureId,dieIndex:row.committed.replacedDieIndex,newD20:row.committed.afterDice[row.committed.replacedDieIndex]}:undefined)
    continue
   }
   if(result.status==='pending-incoming-critical-dice'){
    const request=result.request,row=rows.find(row=>row.pendingCriticalDiceRequests?.[request.id])
    const values=row?.hostControllerMemberId?row.criticalDiceConfirmations?.[request.id]?.values:row?.criticalDice?.[request.id]
    if(!values)break
    if(JSON.stringify(row!.pendingCriticalDiceRequests![request.id])!==JSON.stringify(request))throw Error('second-chance-parent:changed-critical-dice-request')
    result=replay.resumeIncomingCriticalDice(parent.state,request,values);continue
   }
   break
  }
  if(result.status==='resolved'&&parent.prepared){const prepared=await('finalize'in replay?replay.finalize(result.result as SecondChancePreparedResult,result.materialChanges):Promise.resolve(result.result as SecondChancePreparedResult));return{...result,result:prepared.result,application:prepared.application}}
  return result as Exclude<typeof result,{status:'resolved'}>|{status:'resolved';result:Dnd5eActionResult;application?:import('../../rulesets/dnd5e/mapBridge').Dnd5eMapResultPlan}
 }finally{if('dispose'in replay)await replay.dispose()}
}
/** A defender's authenticated explicit decline resumes the same original parent
 * without a replacement die, resource debit or reaction debit. */
export async function prepareDeclinedSecondChanceParent(input:{mapId:string;attackReceiptId:string},gateway:Gateway){
 const session=getRoomSession(),guard=()=>{const current=getRoomSession();if(!session||session.role!=='dm'||current?.roomId!==session.roomId||current.memberId!==session.memberId||current.role!=='dm')throw Error('second-chance-parent:host-room-required')};guard()
 const[characters,combat,maps]=await Promise.all([gateway.loadResource<Snapshot<{characters:Character[]}>>('characters'),gateway.loadResource<Snapshot<SecondChanceCombat>>('combat'),gateway.loadResource<Snapshot<{maps:BattleMap[]}>>('maps')]);guard()
 const receipt=combat?.secondChanceAttacks?.[input.attackReceiptId]
 if(!characters||!combat||!maps||!receipt||receipt.committed||receipt.reactionDecision?.decision!=='decline'||!validateSecondChanceAttackReceipts(combat.secondChanceAttacks))throw Error('second-chance-parent:authenticated-decline-required')
 if(!secondChanceParentScopeMatches(combat,receipt,input.mapId))throw Error('second-chance-parent:parent-scope-mismatch')
 const scopeReads=await assertSecondChanceSceneScope(receipt,combat,gateway);guard()
 if(receipt.parentContinuation)return receipt.parentContinuation
 if(revision(characters,'characters')!==receipt.characterRevision||revision(maps,'maps')!==receipt.mapRevision)throw Error('second-chance-parent:stale-parent-state')
 const continuation={transactionId:receipt.attack.transactionId,phase:'ready' as const,characterRevision:revision(characters,'characters'),combatRevision:revision(combat,'combat')+1}
 await gateway.saveResourcesAtomically([{name:'combat',expectedRevision:revision(combat,'combat'),data:advanceSecondChanceParentRevisions({...combat,secondChanceAttacks:{...combat.secondChanceAttacks,[input.attackReceiptId]:{...receipt,parentContinuation:continuation}}},receipt.attack.transactionId,revision(combat,'combat')+1)}],{transactionId:`second-chance-decline:${receipt.attack.id}`,readRevisions:{...scopeReads,characters:revision(characters,'characters'),maps:revision(maps,'maps')},undoLabel:'保留反应并继续原攻击'});guard();return continuation
}
/** Persist an exact missing-dice request derived by the real parent resolver.
 * No new HP, cost or action is applied while the original roller supplies it. */
export async function prepareSecondChanceParentCriticalDice(input:{arcaneBeforeSecondChance?:ArcaneBeforeSecondChanceDecline;mapId:string;attackReceiptId:string},gateway:Gateway){
 const session=getRoomSession(),guard=()=>{const current=getRoomSession();if(!session||session.role!=='dm'||current?.roomId!==session.roomId||current.memberId!==session.memberId||current.role!=='dm')throw Error('second-chance-parent:host-room-required')};guard()
 const[characters,combat,maps,geometry]=await Promise.all([gateway.loadResource<Snapshot<{characters:Character[]}>>('characters'),gateway.loadResource<Snapshot<SecondChanceCombat>>('combat'),gateway.loadResource<Snapshot<{maps:BattleMap[]}>>('maps'),gateway.loadResource<Snapshot<object>>('map-geometry')]);guard()
 const receipt=combat?.secondChanceAttacks?.[input.attackReceiptId],continuation=receipt?.parentContinuation
 if(!characters||!combat||!maps||!receipt?.committed||!continuation)throw Error('second-chance-parent:committed-receipt-required')
 if(!validateSecondChanceAttackReceipts(combat.secondChanceAttacks))throw Error('second-chance-parent:invalid-persisted-receipts')
 if(receipt.featureDefinitionSignature!=null&&receipt.featureDefinitionSignature!==JSON.stringify(dnd5ePluginFeatureDefinition(receipt.featureId)?.declarativeAbility))throw Error('second-chance-parent:changed-feature-definition')
 if(continuation.phase==='consumed')return undefined
 const feature=dnd5ePluginFeatureDefinition(receipt.featureId);if(feature?.automation!=='full'||feature.declarativeAbility?.automation!=='full')throw Error('second-chance-parent:automatic-feature-required')
 if(!secondChanceParentScopeMatches(combat,receipt,input.mapId))throw Error('second-chance-parent:parent-scope-mismatch')
 const scopeReads=await assertSecondChanceSceneScope(receipt,combat,gateway);guard()
 if(revision(characters,'characters')!==continuation.characterRevision||revision(combat,'combat')!==continuation.combatRevision||revision(maps,'maps')!==receipt.mapRevision||receipt.geometryRevision!=null&&(geometry?revision(geometry,'map-geometry'):0)!==receipt.geometryRevision)throw Error('second-chance-parent:stale-parent-state')
 const resolved=await replayOriginalParent(receipt,secondChanceParentGroup(combat,receipt.attack.transactionId),undefined,input.arcaneBeforeSecondChance?{brand:input.arcaneBeforeSecondChance,gateway}:undefined)
 if(resolved.status==='resolved'&&resolved.result.ok)return undefined
 if(resolved.status!=='pending-incoming-critical-dice')throw Error('second-chance-parent:followup-not-resolved')
 const request=resolved.request,prior=receipt.pendingCriticalDiceRequests?.[request.id]
 if(prior){if(JSON.stringify(prior)!==JSON.stringify(request))throw Error('second-chance-parent:changed-critical-dice-request');return prior}
 const next=advanceSecondChanceParentRevisions({...combat,secondChanceAttacks:{...combat.secondChanceAttacks,[receipt.attack.id]:{...receipt,pendingCriticalDiceRequests:{...receipt.pendingCriticalDiceRequests,[request.id]:request},parentContinuation:{...continuation,combatRevision:revision(combat,'combat')+1}}}},receipt.attack.transactionId,revision(combat,'combat')+1)
 guard();try{await gateway.saveResourcesAtomically([{name:'combat',expectedRevision:revision(combat,'combat'),data:next}],{transactionId:`second-chance-critical-request:${request.id}`,readRevisions:{...scopeReads,characters:revision(characters,'characters'),maps:revision(maps,'maps'),...(receipt.geometryRevision!=null?{'map-geometry':receipt.geometryRevision}:{})},undoLabel:'原攻击等待新增重击骰'});guard();return request}catch(error){guard();if(/failed to fetch|fetch failed|networkerror|state-transaction-(?:conflict|unavailable)/i.test(String(error))){const saved=await gateway.loadResource<Snapshot<SecondChanceCombat>>('combat');guard();const exact=saved?.secondChanceAttacks?.[receipt.attack.id]?.pendingCriticalDiceRequests?.[request.id];if(saved&&secondChanceParentScopeMatches(saved,receipt,input.mapId)&&JSON.stringify(exact)===JSON.stringify(request))return exact}throw error}
}
/** Rebuilds the frozen original attack through the actual resolver. Resource cost
 * was already committed, so this result projects the same final zero, never a
 * second debit. The three-resource CAS consumes continuation with actual HP. */
export interface SecondChanceParentFollowupOptions{settlePostNative?:(frame:SecondChancePostNativeFrame)=>Promise<SecondChancePostNativeSettlement>;options:Dnd5eDamageReactionFlowOptions;criticalDice:(receipt:PersistedSecondChanceAttack,request:IncomingCriticalDiceRequest)=>Promise<readonly number[]>}
async function persistRealCriticalRequest(input:{mapId:string;attackReceiptId:string},request:IncomingCriticalDiceRequest,gateway:Gateway):Promise<PersistedSecondChanceAttack>{
 const session=getRoomSession(),guard=()=>{const current=getRoomSession();if(!session||session.role!=='dm'||current?.roomId!==session.roomId||current.memberId!==session.memberId||current.role!=='dm')throw Error('second-chance-parent:host-room-required')};guard()
 const[characters,combat,maps,geometry]=await Promise.all([gateway.loadResource<Snapshot<{characters:Character[]}>>('characters'),gateway.loadResource<Snapshot<SecondChanceCombat>>('combat'),gateway.loadResource<Snapshot<{maps:BattleMap[]}>>('maps'),gateway.loadResource<Snapshot<object>>('map-geometry')]);guard()
 const receipt=combat?.secondChanceAttacks?.[input.attackReceiptId],continuation=receipt?.parentContinuation
 if(!characters||!combat||!maps||!receipt?.committed||continuation?.phase!=='ready'||!validateSecondChanceAttackReceipts(combat.secondChanceAttacks)||request.actorId!==receipt.attack.rollerTokenId||request.targetId!==receipt.attack.targetTokenId)throw Error('second-chance-parent:invalid-critical-context')
 if(!secondChanceParentScopeMatches(combat,receipt,input.mapId))throw Error('second-chance-parent:parent-scope-mismatch')
 const scopeReads=await assertSecondChanceSceneScope(receipt,combat,gateway);guard()
 if(revision(characters,'characters')!==continuation.characterRevision||revision(combat,'combat')!==continuation.combatRevision||revision(maps,'maps')!==receipt.mapRevision||receipt.geometryRevision!=null&&(geometry?revision(geometry,'map-geometry'):0)!==receipt.geometryRevision)throw Error('second-chance-parent:stale-parent-state')
 const prior=receipt.pendingCriticalDiceRequests?.[request.id]
 if(prior){if(JSON.stringify(prior)!==JSON.stringify(request))throw Error('second-chance-parent:changed-critical-dice-request');return receipt}
 const nextReceipt={...receipt,pendingCriticalDiceRequests:{...receipt.pendingCriticalDiceRequests,[request.id]:request},parentContinuation:{...continuation,combatRevision:revision(combat,'combat')+1}},next=advanceSecondChanceParentRevisions({...combat,secondChanceAttacks:{...combat.secondChanceAttacks,[receipt.attack.id]:nextReceipt}},receipt.attack.transactionId,revision(combat,'combat')+1)
 if(!validateSecondChanceAttackReceipts(next.secondChanceAttacks))throw Error('second-chance-parent:invalid-persisted-receipts')
 try{await gateway.saveResourcesAtomically([{name:'combat',expectedRevision:revision(combat,'combat'),data:next}],{transactionId:`second-chance-critical-request:${request.id}`,readRevisions:{...scopeReads,characters:revision(characters,'characters'),maps:revision(maps,'maps'),...(receipt.geometryRevision!=null?{'map-geometry':receipt.geometryRevision}:{})},undoLabel:'原攻击等待真实新增重击骰'});guard();return nextReceipt}
 catch(error){guard();if(/failed to fetch|fetch failed|networkerror|state-transaction-(?:conflict|unavailable)/i.test(String(error))){const saved=await gateway.loadResource<SecondChanceCombat>('combat');guard();const exact=saved?.secondChanceAttacks?.[receipt.attack.id];if(saved&&secondChanceParentScopeMatches(saved,receipt,input.mapId)&&JSON.stringify(exact?.pendingCriticalDiceRequests?.[request.id])===JSON.stringify(request))return exact!}throw error}
}
export async function publishSecondChanceParent(input:{arcaneBeforeSecondChance?:ArcaneBeforeSecondChanceDecline;armorBeforeSecondChance?:ArmorBeforeSecondChanceDecline;mapId:string;attackReceiptId:string},gateway:Gateway,followups?:SecondChanceParentFollowupOptions):Promise<Dnd5eActionResult>{
 const session=getRoomSession(),guard=()=>{const current=getRoomSession();if(!session||session.role!=='dm'||current?.roomId!==session.roomId||current.memberId!==session.memberId||current.role!=='dm')throw Error('second-chance-parent:host-room-required')}
 guard()
 let[characters,combat,maps,geometry]=await Promise.all([gateway.loadResource<Snapshot<{characters:Character[]}>>('characters'),gateway.loadResource<Snapshot<SecondChanceCombat>>('combat'),gateway.loadResource<Snapshot<{maps:BattleMap[]}>>('maps'),gateway.loadResource<Snapshot<object>>('map-geometry')]);guard()
 if(!characters||!combat||!maps)throw Error('second-chance-parent:snapshot-missing')
 let receipt=combat.secondChanceAttacks?.[input.attackReceiptId],continuation=receipt?.parentContinuation
 if(!receipt||!receipt.committed&&receipt.reactionDecision?.decision!=='decline'||!continuation||continuation.transactionId!==receipt.attack.transactionId)throw Error('second-chance-parent:committed-receipt-required')
 if(!validateSecondChanceAttackReceipts(combat.secondChanceAttacks))throw Error('second-chance-parent:invalid-persisted-receipts')
 if(receipt.featureDefinitionSignature!=null&&receipt.featureDefinitionSignature!==JSON.stringify(dnd5ePluginFeatureDefinition(receipt.featureId)?.declarativeAbility))throw Error('second-chance-parent:changed-feature-definition')
 if(continuation.phase==='consumed'){if(!continuation.result)throw Error('second-chance-parent:saved-result-missing');return continuation.result}
 const feature=dnd5ePluginFeatureDefinition(receipt.featureId);if(receipt.committed&&(feature?.automation!=='full'||feature.declarativeAbility?.automation!=='full'))throw Error('second-chance-parent:automatic-feature-required')
 if(!secondChanceParentScopeMatches(combat,receipt,input.mapId))throw Error('second-chance-parent:parent-scope-mismatch')
 const scopeReads=await assertSecondChanceSceneScope(receipt,combat,gateway);guard()
 if(receipt.parentDefinitionSignature&&(!receipt.parentInput||receipt.parentDefinitionSignature!==await secondChanceParentDefinitionSignature(receipt.parentInput.state)))throw Error('second-chance-parent:changed-parent-definitions')
 if(revision(characters,'characters')!==continuation.characterRevision||revision(combat,'combat')!==continuation.combatRevision||revision(maps,'maps')!==receipt.mapRevision)throw Error('second-chance-parent:stale-parent-state')
 if(receipt.geometryRevision!=null&&(geometry?revision(geometry,'map-geometry'):0)!==receipt.geometryRevision)throw Error('second-chance-parent:stale-parent-geometry')
 const parent=receipt.parentInput,map=maps.maps.find(row=>row.id===input.mapId)
 if(!parent||!map||parent.state.combatId!==receipt.attack.combatId)throw Error('second-chance-parent:original-parent-required')
 const originalIdentity=JSON.stringify([receipt.attack,receipt.committed,receipt.parentInput,receipt.featureDefinitionSignature])
 const originalParentTransactionId=receipt.attack.transactionId
 const group=secondChanceParentGroup(combat,receipt.attack.transactionId)
 const resolved=followups?{status:'resolved' as const,...await resolveSecondChanceParentWithFollowups({receipt,receipts:group,options:{...followups.options,...(input.armorBeforeSecondChance?{chooseIncomingHitNegation:async(request:Parameters<NonNullable<Dnd5eDamageReactionFlowOptions['chooseIncomingHitNegation']>>[0])=>{await assertArmorBeforeSecondChanceDecline(input.armorBeforeSecondChance!,{parentTransactionId:originalParentTransactionId,preparedOriginal:parent.prepared,facts:request.facts,occurrence:request.occurrence},gateway);return undefined}}:{}),...(input.arcaneBeforeSecondChance?{chooseIncomingAttackArmorClass:async(request:Parameters<NonNullable<Dnd5eDamageReactionFlowOptions['chooseIncomingAttackArmorClass']>>[0])=>{await assertArcaneBeforeSecondChanceDecline(input.arcaneBeforeSecondChance!,{parentTransactionId:originalParentTransactionId,preparedOriginal:parent.prepared,facts:request.facts,occurrence:request.occurrence,now:parent.options?.now},gateway);return undefined}}:{})},context:{map,characters:characters.characters,characterIdByCombatantId:parent.characterIdByCombatantId},criticalDice:async request=>{
  const candidates=group.filter(row=>row.attack.rollerTokenId===request.actorId&&row.attack.targetTokenId===request.targetId&&row.committed?.critical)
  if(candidates.length!==1)throw Error('second-chance-parent:critical-owner-ambiguous')
  const current=await persistRealCriticalRequest({mapId:input.mapId,attackReceiptId:candidates[0].attack.id},request,gateway);guard()
  const values=current.hostControllerMemberId?current.criticalDiceConfirmations?.[request.id]?.values:current.criticalDice?.[request.id]
  return values??await followups.criticalDice(current,request)
 }})}:await replayOriginalParent(receipt,group,input.armorBeforeSecondChance?{brand:input.armorBeforeSecondChance,gateway}:undefined,input.arcaneBeforeSecondChance?{brand:input.arcaneBeforeSecondChance,gateway}:undefined)
 if(resolved.status!=='resolved'||!resolved.result.ok)throw Error('second-chance-parent:followup-not-resolved')
 if(followups){
  ;[characters,combat,maps,geometry]=await Promise.all([gateway.loadResource<Snapshot<{characters:Character[]}>>('characters'),gateway.loadResource<Snapshot<SecondChanceCombat>>('combat'),gateway.loadResource<Snapshot<{maps:BattleMap[]}>>('maps'),gateway.loadResource<Snapshot<object>>('map-geometry')]);guard()
  receipt=combat?.secondChanceAttacks?.[input.attackReceiptId];continuation=receipt?.parentContinuation
  if(!characters||!combat||!maps||!receipt||continuation?.phase!=='ready'||!validateSecondChanceAttackReceipts(combat.secondChanceAttacks)||JSON.stringify([receipt.attack,receipt.committed,receipt.parentInput,receipt.featureDefinitionSignature])!==originalIdentity)throw Error('second-chance-parent:changed-original-during-followups')
  if(revision(characters,'characters')!==continuation.characterRevision||revision(combat,'combat')!==continuation.combatRevision||revision(maps,'maps')!==receipt.mapRevision||receipt.geometryRevision!=null&&(geometry?revision(geometry,'map-geometry'):0)!==receipt.geometryRevision)throw Error('second-chance-parent:stale-parent-state')
  if(receipt.parentDefinitionSignature!==undefined&&receipt.parentDefinitionSignature!==await secondChanceParentDefinitionSignature(parent.state))throw Error('second-chance-parent:changed-parent-definitions')
 }
 let prefixPlan:Awaited<ReturnType<typeof readSecondChanceBasePrefixPublication>>
 let specterPlan:Awaited<ReturnType<typeof readSecondChanceSpecterFinalPlan>>
 let result=resolved.result
 for(const row of secondChanceParentGroup(combat,receipt.attack.transactionId)){
  if(!row.sceneScope||!row.committed)continue
  const actor=result.state.combatants[row.attack.targetTokenId],feature=dnd5ePluginFeatureDefinition(row.featureId),cost=feature?.declarativeAbility?.cost?.resources?.[0]
  const key=feature&&cost?dnd5eDeclarativeResourceKey(feature.ownerPluginId,cost):undefined
  if(!actor||!key||actor.turn.reactionAvailable||actor.classResources[key]?.current!==0)throw Error('second-chance-scene:original-cost-not-applied')
  actor.classState.sceneReactionSpent={schemaVersion:1,roomId:row.sceneScope.roomId,parentTransactionId:row.attack.transactionId}
 }
 let plan=resolved.application??planDnd5eMapResultApplication({...parent.nativeContext,state:result.state,map:parent.nativeContext?.map??map,characters:parent.nativeContext?.characters??characters.characters,characterIdByCombatantId:parent.characterIdByCombatantId,events:[...result.events]})
 if(receipt.sceneScope){plan.characters=plan.characters.map(character=>{const tokenId=Object.keys(parent.characterIdByCombatantId).find(id=>parent.characterIdByCombatantId[id]===character.id),marker=tokenId&&result.state.combatants[tokenId]?.classState.sceneReactionSpent;return marker?{...character,dnd5eCombatState:{...character.dnd5eCombatState,sceneReactionSpent:marker}}:character})}
 let armorFinalFrame:SecondChancePostNativeFrame|undefined,armorFinalSettlement:SecondChancePostNativeSettlement|undefined
 if(followups?.settlePostNative){
  const frame=captureSecondChancePostNativeFrame({phase:'native-before-base',roomId:session!.roomId,hostMemberId:session!.memberId,mapId:input.mapId,combatId:receipt.attack.combatId,parentTransactionId:receipt.attack.transactionId,scGroupIdentity:JSON.stringify(secondChanceParentGroup(combat,receipt.attack.transactionId)),revisions:{maps:revision(maps,'maps'),characters:revision(characters,'characters'),combat:revision(combat,'combat'),'map-geometry':geometry?revision(geometry,'map-geometry'):0,...(scopeReads['campaign-time']!=null?{'campaign-time':scopeReads['campaign-time']}:{})},result,application:plan,map,characters:characters.characters,characterIdByCombatantId:parent.characterIdByCombatantId,originalRoomAction:receipt.originalRoomAction})
  let settled:SecondChancePostNativeSettlement
  try{settled=await followups.settlePostNative(frame)}catch(error){if(error instanceof Error&&/combat-dice-cancelled|player-owned-roll-unavailable|player-damage-roll-unavailable/.test(error.message))throw new SecondChanceMapsSettlementSignal({kind:'second-chance-parent-pending',mapId:input.mapId,combatId:receipt.attack.combatId,parentTransactionId:receipt.attack.transactionId,attackReceiptId:receipt.attack.id});throw error}
  for(const row of secondChanceParentGroup(combat,receipt.attack.transactionId)){const feature=dnd5ePluginFeatureDefinition(row.featureId);if(!dnd5ePluginFeatureCurrentEnvelopeFullV1(row.featureId)||feature?.automation!=='full'||feature.declarativeAbility?.automation!=='full'||row.featureDefinitionSignature!=null&&JSON.stringify(feature.declarativeAbility)!==row.featureDefinitionSignature)throw Error('second-chance-parent:changed-feature-definition')}
  const completed=readSecondChancePostNativeSettlement(frame,settled);prefixPlan=await readSecondChanceBasePrefixPublication(frame,settled);if(prefixPlan){for(const[name,value]of Object.entries(prefixPlan.readRevisions)){if(scopeReads[name]!=null&&scopeReads[name]!==value)throw Error('second-chance-prefix:conflicting-original-guard');scopeReads[name]=value}}specterPlan=await readSecondChanceSpecterFinalPlan(frame,settled);guard();if(specterPlan)Object.assign(scopeReads,specterPlan.readRevisions);Object.assign(scopeReads,readSecondChancePostConcentrationClockGuard(frame));
  if(receipt.parentDefinitionSignature!==undefined&&receipt.parentDefinitionSignature!==await secondChanceParentDefinitionSignature(parent.state))throw Error('second-chance-parent:changed-parent-definitions')
  armorFinalFrame=frame;armorFinalSettlement=settled;result=completed.result;plan=completed.application
 }else if(result.events.some(event=>event.type==='concentration-check-required'&&!event.settled))throw Error('second-chance-parent:post-native-settlement-required')
 let armorPlan:Awaited<ReturnType<typeof prepareArmorBeforeSecondChanceConsumption>>|undefined
 if(input.armorBeforeSecondChance){
  const armorFrame=armorFinalFrame??captureSecondChancePostNativeFrame({phase:'native-before-base',roomId:session!.roomId,hostMemberId:session!.memberId,mapId:input.mapId,combatId:receipt.attack.combatId,parentTransactionId:receipt.attack.transactionId,scGroupIdentity:JSON.stringify(secondChanceParentGroup(combat,receipt.attack.transactionId)),revisions:{maps:revision(maps,'maps'),characters:revision(characters,'characters'),combat:revision(combat,'combat'),'map-geometry':geometry?revision(geometry,'map-geometry'):0},result,application:plan,map,characters:characters.characters,characterIdByCombatantId:parent.characterIdByCombatantId,originalRoomAction:receipt.originalRoomAction})
  armorPlan=await prepareArmorBeforeSecondChanceConsumption(input.armorBeforeSecondChance,armorFrame,gateway,armorFinalSettlement);Object.assign(scopeReads,armorPlan.readRevisions)
 }
 let arcanePlan:Awaited<ReturnType<typeof prepareArcaneBeforeSecondChanceConsumption>>|undefined
 if(input.arcaneBeforeSecondChance){
  const arcaneFrame=armorFinalFrame??captureSecondChancePostNativeFrame({phase:'native-before-base',roomId:session!.roomId,hostMemberId:session!.memberId,mapId:input.mapId,combatId:receipt.attack.combatId,parentTransactionId:receipt.attack.transactionId,scGroupIdentity:JSON.stringify(secondChanceParentGroup(combat,receipt.attack.transactionId)),revisions:{maps:revision(maps,'maps'),characters:revision(characters,'characters'),combat:revision(combat,'combat'),'map-geometry':geometry?revision(geometry,'map-geometry'):0},result,application:plan,map,characters:characters.characters,characterIdByCombatantId:parent.characterIdByCombatantId,originalRoomAction:receipt.originalRoomAction})
  arcanePlan=await prepareArcaneBeforeSecondChanceConsumption(input.arcaneBeforeSecondChance,arcaneFrame,gateway,armorFinalSettlement);Object.assign(scopeReads,arcanePlan.readRevisions)
 }
 if(plan.map.id!==input.mapId)throw Error('second-chance-parent:application-map-mismatch')
 const economy={...combat.dnd5eTurnEconomyByToken}
 for(const[id,actor]of Object.entries(result.state.combatants)){const prior=economy[id];if(!prior)continue;const after=actor.classState.attackActionHistory,before=parent.state.combatants[id]?.classState.attackActionHistory
  let attacksUsed=prior.attacksUsed
  if(result.state.initiativeOrder[result.state.initiativeIndex]===id&&after?.turnKey===prior.turnKey){
   const previousTaken=before?.turnKey===after.turnKey&&before.actionOrdinal===after.actionOrdinal?before.attacksTaken:0
   const delta=after.attacksTaken-previousTaken
   const projected=prior.attacksUsed+delta
   if(!Number.isSafeInteger(delta)||delta<0||!Number.isSafeInteger(projected)||!Number.isSafeInteger(dnd5eOrdinaryAttacksUsed(after,prior.turnKey,projected)))throw Error('second-chance-parent:invalid-attack-history')
   attacksUsed=projected
  }
  economy[id]={...prior,attacksUsed,action:{...prior.action,current:actor.turn.actionAvailable?prior.action.current:0},bonusAction:{...prior.bonusAction,current:actor.turn.bonusActionAvailable?prior.bonusAction.current:0},reaction:{...prior.reaction,current:actor.turn.reactionAvailable?prior.reaction.current:0},movement:{...prior.movement,current:actor.turn.movementRemaining,spent:actor.turn.movementSpent}}}
 const finalGroup=secondChanceParentGroup(combat,receipt.attack.transactionId)
 if(finalGroup.some(row=>row.parentContinuation?.phase!=='ready'||row.parentContinuation.combatRevision!==revision(combat,'combat')||row.parentContinuation.characterRevision!==revision(characters,'characters')))throw Error('second-chance-parent:group-not-ready')
 const bountifulReadyParents=await settleBountifulReadyWithSecondChance({combat,receipt,result,application:plan,gateway})
 const bountifulOriginalParents=await settleBountifulWithSecondChance({combat,receipt,result,application:plan,gateway})
 const inserted=specterPlan?insertInitiativeEntriesPreservingActive(projectHeadlessInitiativeOrder({current:combat.initiativeOrder,state:result.state}),result.state.initiativeIndex,specterPlan.initiativeEntries):undefined
 const next:SecondChanceCombat={...combat,...(inserted?{initiativeOrder:inserted.order,initiativeIndex:inserted.index}:{}),...(bountifulReadyParents?{bountifulReadyParents}:{}),...(bountifulOriginalParents?{bountifulOriginalParents}:{}),...(!receipt.sceneScope?{dnd5eTurnEconomyByToken:economy}:{}),secondChanceAttacks:{...combat.secondChanceAttacks,...Object.fromEntries(finalGroup.map(row=>[row.attack.id,{...row,attack:{...row.attack,phase:'damage-committed' as const},parentContinuation:{...row.parentContinuation!,phase:'consumed' as const,result}}]))}}
 const originalAckWrites=(specterPlan||armorPlan||arcanePlan)&&receipt.originalRoomAction?await prepareSecondChanceSpecterPlayerAck({action:receipt.originalRoomAction,before:{characters:characters.characters,map},after:{characters:plan.characters,map:plan.map},round:combat.round,initiativeIndex:next.initiativeIndex},gateway):[]
 guard()
 try{await gateway.saveResourcesAtomically([
  {name:'characters',expectedRevision:revision(characters,'characters'),data:{...characters,characters:plan.characters}},
  {name:'maps',expectedRevision:revision(maps,'maps'),data:{...maps,maps:maps.maps.map(row=>row.id===map.id?plan.map:row)}},
  {name:'combat',expectedRevision:revision(combat,'combat'),data:next},
  ...(plan.geometry?[{name:'map-geometry',expectedRevision:geometry?revision(geometry,'map-geometry'):0,data:plan.geometry}]:[]),
  ...(specterPlan?[specterPlan.journalWrite]:[]),
  ...(armorPlan?[armorPlan.journalWrite]:[]),
  ...(arcanePlan?[arcanePlan.journalWrite]:[]),
  ...(prefixPlan?[prefixPlan.write]:[]),
  ...originalAckWrites,
 ],{transactionId:`second-chance-parent:${receipt.attack.transactionId}`,readRevisions:Object.fromEntries(Object.entries({...scopeReads,...(receipt.geometryRevision!=null?{'map-geometry':receipt.geometryRevision}:{})}).filter(([name])=>!['characters','maps','combat',...(plan.geometry?['map-geometry']:[])].includes(name))),undoLabel:'继续原攻击与花开二度结果'});guard();return result}
 catch(error){guard();if(/failed to fetch|fetch failed|networkerror|state-transaction-(?:conflict|unavailable)/i.test(String(error))){const saved=await gateway.loadResource<Snapshot<SecondChanceCombat>>('combat');guard();const done=saved?.secondChanceAttacks?.[receipt.attack.id]?.parentContinuation;if(saved&&secondChanceParentScopeMatches(saved,receipt,input.mapId)&&done?.phase==='consumed'&&done.transactionId===receipt.attack.transactionId&&JSON.stringify(done.result)===JSON.stringify(result))return result}throw error}
}



