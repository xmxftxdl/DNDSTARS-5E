import{validBountifulMonsterZeroCommand}from'./bountiful-monster-zero-command.mjs'
import {validBountifulOriginalSceneScope} from './bountiful-original-scope.mjs'
import {validBountifulHostOperation} from './bountiful-host-operation.mjs'
import {projectBountifulEquipmentD20Prompt} from './bountiful-equipment-d20.mjs'
import {validateBountifulEquipmentD20Command,validateBountifulEquipmentD20Receipt,bountifulEquipmentD20ReceiptComplete} from './bountiful-equipment-d20.mjs'
import {validateBountifulDeferredD20Choices} from './bountiful-deferred-d20.mjs'
import {validateSecondChanceParentWire} from './second-chance-state.mjs'
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const keys=(value,allowed)=>record(value)&&Object.keys(value).every(key=>allowed.includes(key))
const text=value=>typeof value==='string'&&value.length>0&&value.length<=2000&&value.trim()===value
const integer=(value,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=min&&value<=max
const d20=value=>integer(value,1,20)
const rollId=row=>JSON.stringify(['bountiful-original-d20',row.identity.roomId,row.identity.combatId,row.identity.parentId,row.identity.occurrence,row.request.dieIndex])
const validAfterOriginalFalls=value=>Array.isArray(value)&&value.length<=128&&value.every((row,index)=>keys(row,['occurrence','request','snapshotSignature','choice'])&&row.occurrence===index&&typeof row.snapshotSignature==='string'&&row.snapshotSignature.length>0&&row.snapshotSignature.length<=8000000&&keys(row.request,['actorId','actionSignature','falls'])&&text(row.request.actorId)&&typeof row.request.actionSignature==='string'&&row.request.actionSignature.length<=2000000&&Array.isArray(row.request.falls)&&row.request.falls.length>0&&row.request.falls.length<=256&&row.request.falls.every(fall=>keys(fall,['combatantId','fromElevationFeet','groundElevationFeet','fallDistanceFeet','fallingDamageDice','collision','collisionCandidates'])&&text(fall.combatantId)&&[fall.fromElevationFeet,fall.groundElevationFeet,fall.fallDistanceFeet].every(Number.isFinite)&&integer(fall.fallingDamageDice,0,20))&&keys(row.choice,['featherFalls','rollsByCombatantId'])&&Array.isArray(row.choice.featherFalls)&&row.choice.featherFalls.length<=128&&row.choice.featherFalls.every(choice=>keys(choice,['casterId','targetIds','spellcastingSavingThrows'])&&text(choice.casterId)&&Array.isArray(choice.targetIds)&&choice.targetIds.length>0&&choice.targetIds.length<=5&&choice.targetIds.every(text)&&new Set(choice.targetIds).size===choice.targetIds.length)&&record(row.choice.rollsByCombatantId)&&Object.keys(row.choice.rollsByCombatantId).length<=256&&Object.entries(row.choice.rollsByCombatantId).every(([id,rolls])=>text(id)&&Array.isArray(rolls)&&rolls.length<=128&&rolls.every(d20)))
import {validBountifulOpportunitySettlementRolls} from './bountiful-opportunity-settlement.mjs'
export function validateBountifulOriginalParents(value){
 if(!record(value)||Object.keys(value).length>512)return false
 for(const [id,row]of Object.entries(value)){
  if(!text(id)||!keys(row,['schemaVersion','identity','originalAdapterId','originalRoomAction','originalParent','request','controllers','ownerDecisions','rawReroll','hostReroll','processedRequestIds','consumed','continuation','originalCheckpoint','postOriginalD20','postOriginalEquipmentD20','postOriginalCursor','rawIssuer','opportunitySettlementRolls','nativeLuckyChoiceVersion','nativeLuckyDecision'])||row.schemaVersion!==1||!text(row.originalAdapterId)||!validateSecondChanceParentWire(row.originalParent))return false
  if(row.rawIssuer!==undefined&&(!keys(row.rawIssuer,['mode','rollId','cursor'])||!['dm','player'].includes(row.rawIssuer.mode)||!text(row.rawIssuer.rollId)||!integer(row.rawIssuer.cursor,1,100000)))return false
  if(row.opportunitySettlementRolls!==undefined&&!validBountifulOpportunitySettlementRolls(row.opportunitySettlementRolls,row))return false
  const i=row.identity,r=row.request
  if(!record(i)||!record(r))return false
  if(row.postOriginalCursor!==undefined&&(!keys(row.postOriginalCursor,['hostMemberId','rawRollId','cursor','stageSignature'])||i.occurrence!==0||row.originalAdapterId!=='equipment'||row.postOriginalCursor.hostMemberId!==i.hostMemberId||!text(row.postOriginalCursor.rawRollId)||!integer(row.postOriginalCursor.cursor,1,100000)||typeof row.postOriginalCursor.stageSignature!=='string'||row.postOriginalCursor.stageSignature!==JSON.stringify([row.postOriginalD20??[],row.postOriginalEquipmentD20??null])||row.postOriginalEquipmentD20&&!bountifulEquipmentD20ReceiptComplete(row.postOriginalEquipmentD20)))return false
  if(row.postOriginalEquipmentD20!==undefined&&(i.occurrence!==0||row.originalAdapterId!=='equipment'||!validateBountifulEquipmentD20Receipt(row.postOriginalEquipmentD20,i)||row.consumed&&!bountifulEquipmentD20ReceiptComplete(row.postOriginalEquipmentD20)))return false
  if(row.postOriginalD20!==undefined&&(i.occurrence!==0||!validateBountifulDeferredD20Choices(row.postOriginalD20,i.parentId)))return false
  if(row.originalCheckpoint!==undefined&&(!keys(row.originalCheckpoint,['actorId','kind'])||!text(row.originalCheckpoint.actorId)||!['attack','ability-check','saving-throw'].includes(row.originalCheckpoint.kind)))return false
  if(row.continuation!==undefined&&(!keys(row.continuation,['hostMemberId','source','rollCursor','afterOriginalFalls'])||i.occurrence!==0||row.continuation.hostMemberId!==i.hostMemberId||!validateSecondChanceParentWire(row.continuation.source)||row.continuation.rollCursor!==undefined&&!integer(row.continuation.rollCursor,0,100000)||row.continuation.afterOriginalFalls!==undefined&&!validAfterOriginalFalls(row.continuation.afterOriginalFalls)))return false
  if(i.sceneScope!==undefined&&!validBountifulOriginalSceneScope(i.sceneScope))return false
  if(!keys(i,['roomId','mapId','combatId','parentId','occurrence','round','initiativeIndex','reactionEconomySignature','roller','hostMemberId','revisions','effectTimestamp','sceneScope'])||![i.roomId,i.mapId,i.combatId,i.parentId,i.hostMemberId].every(text)||i.effectTimestamp!==undefined&&!integer(i.effectTimestamp,1)||!integer(i.occurrence)||!integer(i.round,1)||!integer(i.initiativeIndex)||typeof i.reactionEconomySignature!=='string'||i.reactionEconomySignature.length>2000000||!keys(i.roller,['tokenId','characterId','memberId','kind'])||!text(i.roller.tokenId)||!text(i.roller.memberId)||(i.roller.kind==='host-token'?(i.roller.characterId!==undefined||i.roller.memberId!==i.hostMemberId):(i.roller.kind!==undefined||!text(i.roller.characterId)))||!record(i.revisions)||Object.keys(i.revisions).length>16||Object.entries(i.revisions).some(([key,value])=>!['characters','maps','map-geometry','campaign-time'].includes(key)||!integer(value))||id!==JSON.stringify(['bountiful-original-parent',i.parentId,i.occurrence]))return false
  const action=row.originalRoomAction
  if(action?.kind==='monster-damage-zero-original'){
    if(!validBountifulMonsterZeroCommand(action)||row.originalAdapterId!=='monster'||action.parentId!==i.parentId||action.mapId!==i.mapId||action.combatId!==i.combatId||action.targetTokenId!==i.roller.tokenId||i.sceneScope||!integer(i.effectTimestamp,1)||r.kind!=='saving-throw'||row.originalCheckpoint?.actorId!==action.targetTokenId||row.originalCheckpoint?.kind!=='saving-throw'||row.rawIssuer?.mode!=='dm'||!/^bountiful-monster-damage-zero-original:[a-f0-9]{64}$/.test(row.rawIssuer.rollId)||row.rawIssuer.cursor!==1)return false
   }else if(action?.kind==='native-host-operation'){
   if(!validBountifulHostOperation(action)||row.originalAdapterId!==action.adapterId||action.parentId!==i.parentId||action.mapId!==i.mapId||action.combatId!==i.combatId||action.hostMemberId!==i.hostMemberId||action.actorTokenId!==i.roller.tokenId||i.sceneScope||r.kind!=='attack'||row.rawIssuer?.mode!=='dm'||row.rawIssuer.rollId!==action.rawRollId||row.rawIssuer.cursor!==action.rawCursor)return false
  }else if(!record(action)||Object.keys(action).length>200||action.id!==i.parentId||action.mapId!==i.mapId||(i.sceneScope?action.combatId!==undefined:action.combatId!==i.combatId)||!text(action.actorTokenId)||!text(action.characterId)||!text(action.roomMemberId)||action.status!=='pending'||!text(action.type))return false
  if(!keys(r,['actorId','kind','skill','originalRolls','dieIndex','nativeLucky','options'])||r.actorId!==i.roller.tokenId||!['attack','ability-check','saving-throw'].includes(r.kind)||r.skill!==undefined&&!text(r.skill)||!Array.isArray(r.originalRolls)||r.originalRolls.length<1||r.originalRolls.length>2||!r.originalRolls.every(d20)||!integer(r.dieIndex,0,r.originalRolls.length-1)||r.originalRolls[r.dieIndex]!==1||r.nativeLucky!==undefined&&r.nativeLucky!==true||!Array.isArray(r.options)||r.options.length<1||r.options.length>128||r.options.some(option=>!keys(option,['ownerId','featureId'])||!text(option.ownerId)||!text(option.featureId))||new Set(r.options.map(option=>JSON.stringify(option))).size!==r.options.length)return false
  if(r.nativeLucky&&(r.options.length!==1||r.options[0].ownerId!==r.actorId||r.options[0].featureId!=='dnd5e-racial-halfling-lucky'))return false
  if(!record(row.controllers)||Object.keys(row.controllers).length>128||Object.entries(row.controllers).some(([owner,control])=>!text(owner)||!keys(control,['characterId','memberId'])||!text(control.characterId)||!text(control.memberId)))return false
  if(!r.nativeLucky&&r.options.some(option=>option.ownerId===r.actorId||!row.controllers[option.ownerId]))return false
  if(row.nativeLuckyChoiceVersion!==undefined&&(row.nativeLuckyChoiceVersion!==1||r.nativeLucky!==true))return false
  if(row.nativeLuckyDecision!==undefined&&(row.nativeLuckyChoiceVersion!==1||!keys(row.nativeLuckyDecision,['memberId','decision'])||row.nativeLuckyDecision.memberId!==i.roller.memberId||!['use','decline'].includes(row.nativeLuckyDecision.decision)))return false
  if(row.nativeLuckyChoiceVersion===1&&(row.rawReroll||row.hostReroll)&&row.nativeLuckyDecision?.decision!=='use')return false
  if(!Array.isArray(row.ownerDecisions)||row.ownerDecisions.length>r.options.length||r.nativeLucky&&row.ownerDecisions.length)return false
  let used
  for(let index=0;index<row.ownerDecisions.length;index++){
   const choice=row.ownerDecisions[index],option=r.options[index]
   if(used||!keys(choice,['ownerId','featureId','memberId','decision'])||choice.ownerId!==option.ownerId||choice.featureId!==option.featureId||choice.memberId!==row.controllers[option.ownerId]?.memberId||!['use','decline'].includes(choice.decision))return false
   if(choice.decision==='use')used=choice
  }
  if(row.rawReroll!==undefined&&(!keys(row.rawReroll,['requestId','memberId','value'])||!r.nativeLucky&&!used||row.rawReroll.requestId!==rollId(row)||row.rawReroll.memberId!==i.roller.memberId||!d20(row.rawReroll.value)))return false
  if(row.hostReroll!==undefined&&(!keys(row.hostReroll,['requestId','memberId','rawValue','value'])||!row.rawReroll||row.hostReroll.requestId!==rollId(row)||row.hostReroll.memberId!==i.hostMemberId||row.hostReroll.rawValue!==row.rawReroll.value||!d20(row.hostReroll.value)))return false
  if(row.consumed!==undefined&&(!keys(row.consumed,['transactionId','result'])||row.consumed.transactionId!==i.parentId||i.occurrence===0&&!validateSecondChanceParentWire(row.consumed.result)||row.consumed.result!==undefined&&!validateSecondChanceParentWire(row.consumed.result)||!bountifulOriginalRowReady(row)))return false
  if(!Array.isArray(row.processedRequestIds)||row.processedRequestIds.length>256||!row.processedRequestIds.every(text)||new Set(row.processedRequestIds).size!==row.processedRequestIds.length)return false
 }
 for(const row of Object.values(value)){
  const child=row.postOriginalEquipmentD20
  if(!child)continue
  const source=value[JSON.stringify(['bountiful-original-parent',row.identity.parentId,child.identity.sourceOccurrence])]
  if(!source||source.request.kind!=='attack'||source.request.actorId!==child.ready.actorId||JSON.stringify(source.request.originalRolls)!==JSON.stringify(child.ready.originalRolls))return false
 }
 return true
}
export function validateBountifulLuckCommand(value){
 if(!keys(value,['parentId','occurrence','command'])||!text(value.parentId)||!integer(value.occurrence)||!record(value.command))return false
 const c=value.command
 if(typeof c.phase==='string'&&c.phase.startsWith('equipment-'))return validateBountifulEquipmentD20Command(c)
 if(c.phase==='native-lucky')return keys(c,['phase','decision'])&&['use','decline'].includes(c.decision)
 if(c.phase==='reaction')return keys(c,['phase','ownerId','featureId','decision'])&&text(c.ownerId)&&text(c.featureId)&&['use','decline'].includes(c.decision)
 if(c.phase==='roll')return keys(c,['phase','rollRequestId','value'])&&text(c.rollRequestId)&&d20(c.value)
 if(c.phase==='confirm')return keys(c,['phase','rollRequestId','rawValue','value'])&&text(c.rollRequestId)&&d20(c.rawValue)&&d20(c.value)
 return false
}
/** Player projections contain only prompts that member may actually answer;
 * neither the private prepared parent nor any supplied principal is exposed. */
export function projectBountifulOriginalPrompts(parents,memberId){
 if(!validateBountifulOriginalParents(parents))return []
 return Object.entries(parents).flatMap(([receiptId,row])=>{
  if(row.consumed)return []
  if(row.postOriginalEquipmentD20){const prompt=projectBountifulEquipmentD20Prompt(row.postOriginalEquipmentD20,memberId);if(prompt)return [prompt]}
  if(row.rawIssuer!==undefined&&(!keys(row.rawIssuer,['mode','rollId','cursor'])||!['dm','player'].includes(row.rawIssuer.mode)||!text(row.rawIssuer.rollId)||!integer(row.rawIssuer.cursor,1,100000)))return false
  const i=row.identity,r=row.request,used=row.ownerDecisions.find(choice=>choice.decision==='use')
  if(r.nativeLucky&&row.nativeLuckyChoiceVersion===1&&!row.nativeLuckyDecision){if(i.roller.memberId===memberId)return [{receiptId,parentId:i.parentId,occurrence:i.occurrence,mapId:i.mapId,combatId:i.combatId,phase:'native-lucky-choice',round:i.round,initiativeIndex:i.initiativeIndex,rollerTokenId:i.roller.tokenId,rollerCharacterId:i.roller.characterId,originalRolls:[...r.originalRolls],dieIndex:r.dieIndex}];return []}
  if(bountifulNativeLuckyDeclined(row))return []
  const next=!r.nativeLucky&&!used?r.options[row.ownerDecisions.length]:undefined
  if(next&&row.controllers[next.ownerId]?.memberId===memberId)return [{receiptId,parentId:i.parentId,occurrence:i.occurrence,mapId:i.mapId,combatId:i.combatId,phase:'owner-choice',ownerId:next.ownerId,featureId:next.featureId,rollerTokenId:i.roller.tokenId,originalRolls:[...r.originalRolls],dieIndex:r.dieIndex}]
  if(!next&&(r.nativeLucky||used)&&!row.rawReroll&&i.roller.memberId===memberId)return [{receiptId,parentId:i.parentId,occurrence:i.occurrence,mapId:i.mapId,combatId:i.combatId,phase:'roll',rollerTokenId:i.roller.tokenId,rollerCharacterId:i.roller.characterId,rollRequestId:rollId(row),count:1,sides:20}]
  return []
 })
}

/** Mechanical completion only; callers retain their full private issuer/source and authenticated-command checks. */
export function bountifulNativeLuckyDeclined(row){return row?.request?.nativeLucky===true&&row.nativeLuckyChoiceVersion===1&&row.nativeLuckyDecision?.decision==='decline'&&row.nativeLuckyDecision.memberId===row.identity?.roller?.memberId&&!row.rawReroll&&!row.hostReroll}
export function bountifulOriginalRowReady(row){if(row?.request?.nativeLucky)return bountifulNativeLuckyDeclined(row)||((row.nativeLuckyChoiceVersion===undefined||row.nativeLuckyChoiceVersion===1&&row.nativeLuckyDecision?.decision==='use')&&!!row.hostReroll);return row?.ownerDecisions?.some(r=>r.decision==='use')?!!row.hostReroll:row?.ownerDecisions?.length===row?.request?.options?.length}
