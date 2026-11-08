import {decodeSecondChanceParentWire} from '../../../src/lib/secondChanceParentWire'
import {validateOriginalD20ReplayFacts,preparedOriginalD20Replay} from './allyNaturalOneCheckpoint'
import type {AllyNaturalOneRequest,AllyNaturalOneDecision} from './allyNaturalOneCheckpoint'
import type {SecondChanceParentWire} from '../../../src/lib/secondChanceParentWire'

export interface BountifulOriginalParentIdentity{
  sceneScope?:import('./bountifulOriginalSceneScope').BountifulOriginalSceneScope
  roomId:string;mapId:string;combatId:string;parentId:string;occurrence:number
  round:number;initiativeIndex:number;reactionEconomySignature:string
  roller:{tokenId:string;characterId?:string;memberId:string;kind?:'host-token'}
  hostMemberId:string;effectTimestamp?:number
  revisions:Readonly<Record<string,number>>
}
export interface BountifulOriginalDieReceipt{
  nativeLuckyChoiceVersion?:1
  nativeLuckyDecision?:{memberId:string;decision:'use'|'decline'}
  rawIssuer?:{mode:'dm'|'player';rollId:string;cursor:number}
  schemaVersion:1;identity:BountifulOriginalParentIdentity;originalAdapterId:string;originalRoomAction:Readonly<Record<string,unknown>>;originalParent:SecondChanceParentWire
  opportunitySettlementRolls?:Array<{requestId:string;spec:{parentId:string;roomId:string;mapId:string;combatId:string;hostMemberId:string;phase:'attack-late'|'post-native'|'movement-hazards';ordinal:number;sourceDigest:string;opportunityActorId?:string;postNativeWindowIndex?:number;movementSegmentIndex?:number;actorId:string;characterId?:string;memberId:string;count:number;sides:number;rollKind:'attack'|'saving-throw'|'ability-check'|'damage'|'other';label:string;targetName?:string};rawValues?:number[];values?:number[]}>
  continuation?:{hostMemberId:string;source:SecondChanceParentWire;rollCursor?:number;afterOriginalFalls?:import('./allyNaturalOneCheckpoint').OriginalD20ReplayFacts['afterOriginalFalls']}
  postOriginalCursor?:{hostMemberId:string;rawRollId:string;cursor:number;stageSignature:string}
  postOriginalEquipmentD20?:import('./bountifulEquipmentD20Receipt').BountifulEquipmentD20Receipt
  postOriginalD20?:readonly import('./bountifulLuckDeferredD20').BountifulDeferredD20Choice[]
  originalCheckpoint?:{actorId:string;kind:AllyNaturalOneRequest['kind']}
  request:AllyNaturalOneRequest
  controllers:Readonly<Record<string,{characterId:string;memberId:string}>>
  ownerDecisions:ReadonlyArray<{ownerId:string;featureId:string;memberId:string;decision:'use'|'decline'}>
  rawReroll?:{requestId:string;memberId:string;value:number}
  hostReroll?:{requestId:string;memberId:string;rawValue:number;value:number}
  consumed?:{transactionId:string;result?:SecondChanceParentWire}
  processedRequestIds:readonly string[]
}
export type BountifulOriginalDieCommand=
  |{phase:'native-lucky';decision:'use'|'decline'}
  |{phase:'reaction';ownerId:string;featureId:string;decision:'use'|'decline'}
  |{phase:'roll';rollRequestId:string;value:number}
  |{phase:'confirm';rollRequestId:string;rawValue:number;value:number}
export interface BountifulStampedDieResponse{
  id:string;roomId:string;mapId:string;combatId:string;parentId:string;occurrence:number
  roomMemberId:string;sourceMode:'dm'|'player';actorTokenId:string;characterId?:string
  command:BountifulOriginalDieCommand
}
const validD20=(value:number)=>Number.isInteger(value)&&value>=1&&value<=20
const selected=(receipt:BountifulOriginalDieReceipt)=>receipt.ownerDecisions.find(row=>row.decision==='use')
export function nextBountifulOriginalDieOwner(receipt:BountifulOriginalDieReceipt){
  if(receipt.request.nativeLucky||selected(receipt))return undefined
  return receipt.request.options.find(option=>!receipt.ownerDecisions.some(row=>row.ownerId===option.ownerId&&row.featureId===option.featureId))
}
export function bountifulOriginalDiePhase(receipt:BountifulOriginalDieReceipt){
  if(receipt.request.nativeLucky&&receipt.nativeLuckyChoiceVersion===1){if(!receipt.nativeLuckyDecision)return 'native-lucky-choice' as const;if(receipt.nativeLuckyDecision.decision==='decline')return 'declined' as const}
  if(nextBountifulOriginalDieOwner(receipt))return 'owner-choice' as const
  if(!receipt.request.nativeLucky&&!selected(receipt))return 'declined' as const
  if(!receipt.rawReroll)return 'roller' as const
  if(!receipt.hostReroll)return 'host-confirmation' as const
  return 'ready' as const
}
export function bountifulOriginalDieRollId(receipt:BountifulOriginalDieReceipt){
  const id=receipt.identity
  return JSON.stringify(['bountiful-original-d20',id.roomId,id.combatId,id.parentId,id.occurrence,receipt.request.dieIndex])
}
/** Only a suspended, real Host parent may issue this data. The transport adapter
 * must persist it before exposing a prompt; client commands never carry it. */
export function createBountifulOriginalDieReceipt(input:Omit<BountifulOriginalDieReceipt,'schemaVersion'|'ownerDecisions'|'processedRequestIds'>):BountifulOriginalDieReceipt{
  const {request,identity}=input
  if(identity.effectTimestamp!==undefined&&(!Number.isSafeInteger(identity.effectTimestamp)||identity.effectTimestamp<=0))throw Error('bountiful-parent:invalid-effect-clock')
  if(!input.originalAdapterId||!identity.roomId||!identity.mapId||!identity.combatId||!identity.parentId||!Number.isSafeInteger(identity.occurrence)||identity.occurrence<0||!Number.isSafeInteger(identity.round)||identity.round<1||!Number.isSafeInteger(identity.initiativeIndex)||identity.initiativeIndex<0||
    request.actorId!==identity.roller.tokenId||!identity.roller.memberId||(identity.roller.kind==='host-token'?(identity.roller.characterId!==undefined||identity.roller.memberId!==identity.hostMemberId):!identity.roller.characterId)||!identity.hostMemberId||typeof identity.reactionEconomySignature!=='string'||
    !request.originalRolls.length||request.originalRolls.length>2||request.originalRolls.some(face=>!validD20(face))||request.originalRolls[request.dieIndex]!==1||
    !request.options.length||request.options.some(option=>!option.ownerId||!option.featureId)||Object.values(identity.revisions).some(value=>!Number.isSafeInteger(value)||value<0))throw Error('bountiful-parent:invalid-original-identity')
  if(request.nativeLucky){if(request.options.length!==1||request.options[0].ownerId!==request.actorId||request.options[0].featureId!=='dnd5e-racial-halfling-lucky')throw Error('bountiful-parent:invalid-native-lucky')}
  else if(request.options.some(option=>!input.controllers[option.ownerId]?.memberId||!input.controllers[option.ownerId]?.characterId))throw Error('bountiful-parent:missing-owner-controller')
  if(input.nativeLuckyChoiceVersion!==undefined&&(!request.nativeLucky||input.nativeLuckyChoiceVersion!==1)||input.nativeLuckyDecision!==undefined||input.rawReroll||input.hostReroll||input.consumed)throw Error('bountiful-parent:preloaded-replacement-forbidden')
  return structuredClone({...input,identity:{...identity,effectTimestamp:identity.effectTimestamp??Date.now()},schemaVersion:1,...(request.nativeLucky&&input.nativeLuckyChoiceVersion===1?{nativeLuckyChoiceVersion:1 as const}:{}),ownerDecisions:[],processedRequestIds:[]})
}
/** The actual Host adapter must reload this stamped row by ID from the existing
 * authenticated append queue. It must never accept a caller-supplied principal. */
export function applyBountifulStampedDieResponse(receipt:BountifulOriginalDieReceipt,response:BountifulStampedDieResponse):BountifulOriginalDieReceipt{
  const identity=receipt.identity,command=response.command
  if(response.roomId!==identity.roomId||response.mapId!==identity.mapId||response.combatId!==identity.combatId||response.parentId!==identity.parentId||response.occurrence!==identity.occurrence||!response.id||!response.roomMemberId)throw Error('bountiful-parent:wrong-original-parent')
  if(receipt.processedRequestIds.includes(response.id))return structuredClone(receipt)
  if(receipt.identity.roller.kind==='host-token'&&response.actorTokenId===receipt.identity.roller.tokenId&&response.sourceMode!=='dm')throw Error('bountiful-parent:host-token-roller-required')
  if(!['dm','player'].includes(response.sourceMode))throw Error('bountiful-parent:authenticated-response-required')
  if(response.sourceMode==='dm'&&response.roomMemberId!==identity.hostMemberId)throw Error('bountiful-parent:foreign-host')
  if(receipt.consumed)throw Error('bountiful-parent:parent-already-consumed')
  const next=structuredClone(receipt),phase=bountifulOriginalDiePhase(receipt)
  const allowedKeys=command.phase==='native-lucky'?['phase','decision']:command.phase==='reaction'?['phase','ownerId','featureId','decision']:command.phase==='roll'?['phase','rollRequestId','value']:command.phase==='confirm'?['phase','rollRequestId','rawValue','value']:[]
  if(Object.keys(command).some(key=>!allowedKeys.includes(key)))throw Error('bountiful-parent:invalid-response-shape')
  if(command.phase==='native-lucky'){
    const roller=identity.roller
    if(phase!=='native-lucky-choice'||!receipt.request.nativeLucky||receipt.nativeLuckyChoiceVersion!==1||receipt.nativeLuckyDecision||receipt.rawReroll||receipt.hostReroll||roller.kind==='host-token'||response.roomMemberId!==roller.memberId||response.actorTokenId!==roller.tokenId||response.characterId!==roller.characterId||!['use','decline'].includes(command.decision))throw Error('bountiful-parent:native-lucky-choice-not-authorized')
    next.nativeLuckyDecision={memberId:response.roomMemberId,decision:command.decision}
  }else if(command.phase==='reaction'){
    const expected=nextBountifulOriginalDieOwner(receipt),controller=expected&&receipt.controllers[expected.ownerId]
    if(phase!=='owner-choice'||!expected||expected.ownerId!==command.ownerId||expected.featureId!==command.featureId||!controller||
      response.roomMemberId!==controller.memberId||response.actorTokenId!==expected.ownerId||response.characterId!==controller.characterId||!['use','decline'].includes(command.decision))throw Error('bountiful-parent:owner-choice-not-authorized')
    next.ownerDecisions=[...receipt.ownerDecisions,{...expected,memberId:response.roomMemberId,decision:command.decision}]
  }else if(command.phase==='roll'){
    const roller=identity.roller
    if(phase!=='roller'||command.rollRequestId!==bountifulOriginalDieRollId(receipt)||!validD20(command.value)||response.roomMemberId!==roller.memberId||response.actorTokenId!==roller.tokenId||response.characterId!==roller.characterId)throw Error('bountiful-parent:original-roller-required')
    next.rawReroll={requestId:command.rollRequestId,memberId:response.roomMemberId,value:command.value}
  }else if(command.phase==='confirm'){
    if(phase!=='host-confirmation'||response.actorTokenId!==identity.roller.tokenId||response.characterId!==identity.roller.characterId||response.roomMemberId!==identity.hostMemberId||command.rollRequestId!==bountifulOriginalDieRollId(receipt)||command.rawValue!==receipt.rawReroll?.value||!validD20(command.value))throw Error('bountiful-parent:host-confirmation-required')
    next.hostReroll={requestId:command.rollRequestId,memberId:response.roomMemberId,rawValue:command.rawValue,value:command.value}
  }else throw Error('bountiful-parent:unknown-response-phase')
  next.processedRequestIds=[...receipt.processedRequestIds,response.id]
  return next
}
export function decisionFromBountifulOriginalDieReceipt(receipt:BountifulOriginalDieReceipt,request:AllyNaturalOneRequest):AllyNaturalOneDecision|undefined{
  if(JSON.stringify(request)!==JSON.stringify(receipt.request))throw Error('bountiful-parent:changed-real-checkpoint')
  const phase=bountifulOriginalDiePhase(receipt)
  if(phase==='declined')return undefined
  if(phase!=='ready'||!receipt.hostReroll)throw Error('bountiful-parent:decision-still-pending')
  const option=receipt.request.nativeLucky?receipt.request.options[0]:selected(receipt)!
  return {ownerId:option.ownerId,featureId:option.featureId,replacement:receipt.hostReroll.value}
}

/** Converts only private Host-issued, authenticated stored choices into explicit
 * replay facts that survive a prepared parent's independent capture/recovery. */
export function bountifulPreparedReplayFacts(input:{parentId:string;source:{prepared:{state:import('../../../src/rulesets/dnd5e/headlessCombatEngine').Dnd5eHeadlessCombatState;action:unknown}};receipts:readonly BountifulOriginalDieReceipt[]}):import('./allyNaturalOneCheckpoint').OriginalD20ReplayFacts{
 const effectTimestamp=input.receipts[0]?.identity.effectTimestamp
 if(input.receipts.some(row=>row.identity.effectTimestamp!==effectTimestamp))throw Error('bountiful-parent:foreign-effect-clock')
 const facts=input.receipts.map((receipt,index)=>{
  if(receipt.identity.parentId!==input.parentId||receipt.identity.occurrence!==index||receipt.identity.combatId!==input.source.prepared.state.combatId)throw Error('bountiful-parent:wrong-replay-lineage')
  return {occurrence:index,request:structuredClone(receipt.request),decision:decisionFromBountifulOriginalDieReceipt(receipt,receipt.request)}
 })
 const afterOriginalFalls=input.receipts[0]?.continuation?.afterOriginalFalls
 const deferredD20Choices=input.receipts[0]?.postOriginalD20
 const equipmentD20=input.receipts[0]?.postOriginalEquipmentD20
 const first=input.receipts[0]
 if(first?.continuation&&first.continuation.hostMemberId!==first.identity.hostMemberId)throw Error('bountiful-parent:foreign-ready-continuation')
 const original=first?decodeSecondChanceParentWire(first.continuation?.source??first.originalParent):undefined
 const originalReplay=preparedOriginalD20Replay(original).binding
 const readyFrames=originalReplay?validateOriginalD20ReplayFacts(originalReplay,input.parentId,input.source.prepared.state,input.source.prepared.action)?.readyFrames:undefined
 return {...(readyFrames===undefined?{}:{readyFrames:structuredClone(readyFrames)}),...(equipmentD20===undefined?{}:{equipmentD20:structuredClone(equipmentD20)}),...(deferredD20Choices===undefined?{}:{deferredD20Choices:structuredClone(deferredD20Choices)}),parentId:input.parentId,sourceKey:JSON.stringify([input.parentId,input.source.prepared.state,input.source.prepared.action,...(effectTimestamp===undefined?[]:[effectTimestamp])]),facts,...(effectTimestamp===undefined?{}:{effectTimestamp}),...(afterOriginalFalls===undefined?{}:{afterOriginalFalls:structuredClone(afterOriginalFalls)})}
}
