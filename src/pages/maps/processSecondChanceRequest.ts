import{secondChanceParentScopeMatches,assertSecondChanceSceneScope}from'./secondChanceParentScope'
import{advanceSecondChanceParentRevisions}from'./secondChanceParentGroup'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import{getRoomSession}from'../../lib/roomSession'
import type{SecondChanceCombat}from'./secondChanceHostCommit'
import{validateSecondChanceAttackReceipts}from'../../../shared/second-chance-state.mjs'
type Request={id:string;mapId:string;combatId?:string;type:string;sourceMode:'player'|'dm';status:'pending'|'done';roomMemberId?:string;actorTokenId:string;characterId:string;secondChance?:unknown}
type Snapshot<T>=T&{_sync?:{revision?:number}}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
function revision(value:Snapshot<object>){const rev=value._sync?.revision;if(!Number.isSafeInteger(rev)||rev!<0)throw Error('second-chance-request:revision-required');return rev!}
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
/** Existing append-player-action transport server-stamps roomMemberId from its
 * authenticated room token. Never call this with a supplied action/principal:
 * the Host reloads the persisted, stamped queue by request ID. */
export async function processSecondChanceRequest(input:{mapId:string;requestId:string},gateway:Gateway){
 const session=getRoomSession(),guard=()=>{const current=getRoomSession();if(!session||session.role!=='dm'||current?.roomId!==session.roomId||current.memberId!==session.memberId||current.role!=='dm')throw Error('second-chance-request:host-room-required')};guard()
 const[queue,combat]=await Promise.all([gateway.loadResource<Snapshot<{requests:Request[]}>>('player-action-requests'),gateway.loadResource<Snapshot<SecondChanceCombat>>('combat')]);guard()
 const request=queue?.requests.find(row=>row.id===input.requestId)
 if(!queue||!combat||!request||request.type!=='dnd5e-second-chance'||request.mapId!==input.mapId||!record(request.secondChance))throw Error('second-chance-request:request-unavailable')
 const command=request.secondChance,phase=command.phase,attackId=command.attackReceiptId
 if(typeof attackId!=='string')throw Error('second-chance-request:invalid-command')
 const receipt=combat.secondChanceAttacks?.[attackId]
 if(!receipt||!secondChanceParentScopeMatches(combat,receipt,input.mapId)||request.combatId!==receipt.attack.combatId)throw Error('second-chance-request:attack-unavailable')
 const scopeReads=await assertSecondChanceSceneScope(receipt,combat,gateway);guard()
 if(receipt.processedRequestIds?.includes(request.id))return receipt
 if(receipt.attack.phase!=='hit-confirmation'||receipt.committed&&!['critical-roll-result','confirm-critical-roll'].includes(String(phase)))throw Error('second-chance-request:attack-unavailable')
 if(request.status!=='pending'||!request.roomMemberId||!['player','dm'].includes(request.sourceMode))throw Error('second-chance-request:authenticated-request-required')
 const memberId=request.sourceMode==='dm'&&request.roomMemberId===session!.memberId?session!.memberId:request.sourceMode==='player'?request.roomMemberId:undefined
 const next=structuredClone(receipt)
 if(phase==='reaction'){
  if(Object.keys(command).some(key=>!['phase','attackReceiptId','decision'].includes(key))||!['use','decline'].includes(String(command.decision)))throw Error('second-chance-request:invalid-reaction-command')
  if(memberId!==receipt.attack.targetControllerMemberId||request.actorTokenId!==receipt.attack.targetTokenId||request.characterId!==receipt.attack.targetCharacterId)throw Error('second-chance-request:reaction-not-authorized')
  if(receipt.reactionDecision)throw Error('second-chance-request:reaction-already-decided')
  if(receipt.sceneScope&&command.decision==='use'&&Object.values(combat.secondChanceAttacks??{}).some(row=>row.attack.id!==receipt.attack.id&&row.attack.targetCharacterId===receipt.attack.targetCharacterId&&row.attack.phase==='hit-confirmation'&&row.reactionDecision?.decision==='use'))throw Error('second-chance-request:scene-reaction-reserved')
  next.reactionDecision={authenticatedMemberId:memberId!,decision:command.decision as'use'|'decline'}
 }else if(phase==='select-die'){
  if(Object.keys(command).some(key=>!['phase','attackReceiptId','dieIndex'].includes(key))||!Number.isInteger(command.dieIndex)||Number(command.dieIndex)<0||Number(command.dieIndex)>=receipt.attack.dice.length)throw Error('second-chance-request:invalid-selection-command')
  if(memberId!==receipt.attack.rollerControllerMemberId||request.actorTokenId!==receipt.attack.rollerTokenId||receipt.attack.rollerCharacterId&&request.characterId!==receipt.attack.rollerCharacterId)throw Error('second-chance-request:roller-not-authorized')
  if(receipt.reactionDecision?.decision!=='use'||receipt.rollerSelection)throw Error('second-chance-request:selection-not-awaited')
  next.rollerSelection={authenticatedMemberId:memberId!,dieIndex:Number(command.dieIndex)};next.rollRequestId=`second-chance:${receipt.attack.id}:die:${command.dieIndex}`
 }else if(phase==='roll-result'){
  if(Object.keys(command).some(key=>!['phase','attackReceiptId','rollRequestId','value'].includes(key))||!Number.isInteger(command.value)||Number(command.value)<1||Number(command.value)>20)throw Error('second-chance-request:invalid-roll-result')
  if(memberId!==receipt.attack.rollerControllerMemberId||request.actorTokenId!==receipt.attack.rollerTokenId||receipt.attack.rollerCharacterId&&request.characterId!==receipt.attack.rollerCharacterId)throw Error('second-chance-request:roller-not-authorized')
  if(!receipt.rollerSelection||receipt.rollerD20||!receipt.rollRequestId||receipt.rollRequestId!==command.rollRequestId)throw Error('second-chance-request:roll-not-awaited')
  next.rollerD20={authenticatedMemberId:memberId!,dieIndex:receipt.rollerSelection.dieIndex,value:Number(command.value)}
 }else if(phase==='critical-roll-result'){
  if(Object.keys(command).some(key=>!['phase','attackReceiptId','supplementRequestId','values'].includes(key))||typeof command.supplementRequestId!=='string'||!Array.isArray(command.values))throw Error('second-chance-request:invalid-critical-result')
  const pending=receipt.pendingCriticalDiceRequests?.[command.supplementRequestId]
  if(memberId!==receipt.attack.rollerControllerMemberId||request.actorTokenId!==receipt.attack.rollerTokenId||receipt.attack.rollerCharacterId&&request.characterId!==receipt.attack.rollerCharacterId)throw Error('second-chance-request:roller-not-authorized')
  if(!receipt.committed||!pending||receipt.criticalDice?.[pending.id]||command.values.length!==pending.count||command.values.some(value=>!Number.isInteger(value)||value<1||value>pending.sides))throw Error('second-chance-request:critical-roll-not-awaited')
  next.criticalDice={...receipt.criticalDice,[pending.id]:[...command.values]}
 }else if(phase==='confirm-roll'){
  if(Object.keys(command).some(key=>!['phase','attackReceiptId','rollRequestId','value'].includes(key))||!Number.isInteger(command.value)||Number(command.value)<1||Number(command.value)>20)throw Error('second-chance-request:invalid-confirmation')
  if(!receipt.hostControllerMemberId||memberId!==receipt.hostControllerMemberId||memberId!==session!.memberId||request.actorTokenId!==receipt.attack.rollerTokenId)throw Error('second-chance-request:confirmation-not-authorized')
  if(!receipt.rollerD20||receipt.rollerConfirmation||command.rollRequestId!==receipt.rollRequestId)throw Error('second-chance-request:confirmation-not-awaited')
  next.rollerConfirmation={authenticatedMemberId:memberId,rollRequestId:String(command.rollRequestId),rawValue:receipt.rollerD20.value,value:Number(command.value)}
 }else if(phase==='confirm-critical-roll'){
  if(Object.keys(command).some(key=>!['phase','attackReceiptId','supplementRequestId','values'].includes(key))||typeof command.supplementRequestId!=='string'||!Array.isArray(command.values))throw Error('second-chance-request:invalid-confirmation')
  if(!receipt.hostControllerMemberId||memberId!==receipt.hostControllerMemberId||memberId!==session!.memberId||request.actorTokenId!==receipt.attack.rollerTokenId)throw Error('second-chance-request:confirmation-not-authorized')
  const values=receipt.criticalDice?.[command.supplementRequestId]
  const profile=receipt.pendingCriticalDiceRequests?.[command.supplementRequestId]
  if(!receipt.committed||!values||!profile||receipt.criticalDiceConfirmations?.[command.supplementRequestId]||command.values.length!==profile.count||command.values.some(value=>!Number.isInteger(value)||value<1||value>profile.sides))throw Error('second-chance-request:confirmation-not-awaited')
  next.criticalDiceConfirmations={...receipt.criticalDiceConfirmations,[command.supplementRequestId]:{authenticatedMemberId:memberId,rawValues:[...values],values:[...command.values]}}
 }else throw Error('second-chance-request:unknown-phase')
 next.processedRequestIds=[...(receipt.processedRequestIds??[]),request.id]
 if(next.parentContinuation?.phase==='ready')next.parentContinuation={...next.parentContinuation,combatRevision:revision(combat)+1}
 const nextCombat=advanceSecondChanceParentRevisions({...combat,secondChanceAttacks:{...combat.secondChanceAttacks,[attackId]:next}},receipt.attack.transactionId,revision(combat)+1)
 if(!validateSecondChanceAttackReceipts(nextCombat.secondChanceAttacks))throw Error('second-chance-request:invalid-persisted-receipts')
 guard();await gateway.saveResourcesAtomically([{name:'combat',expectedRevision:revision(combat),data:nextCombat},{name:'player-action-requests',expectedRevision:revision(queue),data:{...queue,requests:queue.requests.map(row=>row.id===request.id?{...row,status:'done'}:row)}}],{transactionId:`second-chance-request:${request.id}`,readRevisions:scopeReads,undoLabel:'花开二度已认证选择'});guard();return next
}
