import {validBountifulOriginalSceneScope} from './bountiful-original-scope.mjs'
import {validateBountifulDeferredD20Choices} from './bountiful-deferred-d20.mjs'
import {validateSecondChanceParentWire} from './second-chance-state.mjs'
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const keys=(value,allowed)=>record(value)&&Object.keys(value).every(key=>allowed.includes(key))
const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=2000
const integer=(value,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=min&&value<=max
const faces=value=>Array.isArray(value)&&value.length>=1&&value.length<=2&&value.every(face=>integer(face,1,20))
export function validateBountifulReadyParents(value){
 if(!record(value)||Object.keys(value).length>512)return false
 return Object.entries(value).every(([id,row])=>{
  if(!keys(row,['schemaVersion','id','roomId','hostMemberId','parentId','mapId','combatId','round','initiativeIndex','reactionEconomySignature','source','originalRoomAction','request','owners','qualifiedSources','controller','versions','postReadyD20','consumed','continuation','rawIssuer','sceneScope'])||row.schemaVersion!==1||id!==row.id||![row.id,row.roomId,row.hostMemberId,row.parentId,row.mapId,row.combatId].every(text)||!integer(row.round,1)||!integer(row.initiativeIndex)||typeof row.reactionEconomySignature!=='string'||row.reactionEconomySignature.length>2000000||!validateSecondChanceParentWire(row.source))return false
  if(row.sceneScope!==undefined&&!validBountifulOriginalSceneScope(row.sceneScope))return false
  if(row.continuation!==undefined&&(!keys(row.continuation,['source','rollCursor'])||!validateSecondChanceParentWire(row.continuation.source)||!integer(row.continuation.rollCursor,0,100000)))return false
  if(row.consumed!==undefined&&(!keys(row.consumed,['transactionId'])||row.consumed.transactionId!==row.parentId))return false
  if(row.postReadyD20!==undefined){
   if(!Array.isArray(row.postReadyD20)||row.postReadyD20.length>2||new Set(row.postReadyD20.map(choice=>choice.dieIndex)).size!==row.postReadyD20.length)return false
   for(const choice of row.postReadyD20){
    if(!record(choice)||'sourceOccurrence'in choice||choice.readyFrameId!==id||choice.parentId!==row.parentId||choice.readyOrdinal!==row.request?.ordinal||choice.actorId!==row.request?.actorId||choice.characterId!==row.controller?.characterId||choice.originalValue!==row.request?.originalRolls?.[choice.dieIndex])return false
    const {readyFrameId,...mechanical}=choice;void readyFrameId
    if(!validateBountifulDeferredD20Choices([{...mechanical,sourceOccurrence:0}],row.parentId))return false
   }
  }
  if(!keys(row.rawIssuer,['mode','rollId','cursor'])||!['dm','player'].includes(row.rawIssuer.mode)||!text(row.rawIssuer.rollId)||!integer(row.rawIssuer.cursor,1,100000))return false
  const request=row.request,action=row.originalRoomAction
  if(!keys(request,['actorId','kind','skill','ordinal','rollMode','attackAbility','originalRolls','values','finalizedDice'])||!text(request.actorId)||!['saving-throw','attack'].includes(request.kind)||!integer(request.ordinal,0,100000)||!['normal','advantage','disadvantage'].includes(request.rollMode)||!faces(request.originalRolls)||JSON.stringify(request.values)!==JSON.stringify(request.originalRolls)||!Array.isArray(request.finalizedDice)||request.finalizedDice.length||id!==JSON.stringify(['bountiful-original-ready',row.parentId,request.ordinal,request.actorId,request.kind]))return false
  if(!record(action)||action.id!==row.parentId||action.mapId!==row.mapId||(row.sceneScope?action.combatId!==undefined:action.combatId!==row.combatId)||action.status!=='pending'||!text(action.roomMemberId)||!text(action.actorTokenId)||!text(action.characterId)||action.type!=='dnd5e-spell-cast')return false
  if(!keys(row.controller,['characterId','memberId','kind'])||!text(row.controller.memberId)||(row.controller.kind==='host-token'?(row.controller.characterId!==undefined||row.controller.memberId!==row.hostMemberId||!!row.postReadyD20?.length):(row.controller.kind!==undefined||!text(row.controller.characterId)))||!Array.isArray(row.owners)||row.owners.length>128||row.owners.some(owner=>!keys(owner,['ownerId','featureId'])||!text(owner.ownerId)||owner.ownerId===request.actorId||!text(owner.featureId))||new Set(row.owners.map(owner=>JSON.stringify(owner))).size!==row.owners.length)return false
  if(!Array.isArray(row.qualifiedSources)||!row.qualifiedSources.length||row.qualifiedSources.length>256||row.qualifiedSources.some(source=>!keys(source,['actorId','ownerId','featureId'])||![source.actorId,source.ownerId,source.featureId].every(text)||source.actorId===source.ownerId)||new Set(row.qualifiedSources.map(source=>JSON.stringify(source))).size!==row.qualifiedSources.length)return false
  return (row.sceneScope?row.versions['campaign-time']===row.sceneScope.campaignTimeRevision:row.versions['campaign-time']===undefined)&&keys(row.versions,['combat','characters','maps','map-geometry','player-action-requests','campaign-time'])&&['combat','characters','maps','map-geometry','player-action-requests'].every(key=>integer(row.versions[key]))
 })
}
const canonical=value=>Array.isArray(value)?value.map(canonical):record(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value
/** Combined with the real authenticated resource role, this protects existing
 * frames and rejects newly seeded frames in player full-document writes. */
export function bountifulReadyParentsUnchanged(before,after){return JSON.stringify(canonical(before?.bountifulReadyParents??{}))===JSON.stringify(canonical(after?.bountifulReadyParents??{}))}
