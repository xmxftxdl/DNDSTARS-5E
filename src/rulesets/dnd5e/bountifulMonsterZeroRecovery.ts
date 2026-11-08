import{getRoomSession}from'../../lib/roomSession'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import{validBountifulMonsterZeroCommand}from'../../../shared/bountiful-monster-zero-command.mjs'
import{validateBountifulOriginalParents}from'../../../shared/bountiful-luck-state.mjs'
import{decodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import type{BountifulOriginalDieReceipt}from'./bountifulLuckReceipt'
import{restoreBountifulMonsterDamageZeroOriginalParent,type BountifulMonsterDamageZeroOriginalParentLoader}from'./bountifulMonsterDamageZeroOriginalPreparation'
import{createBountifulMonsterDamageZeroOriginalRaw,type BountifulMonsterDamageZeroOriginalRawLoader}from'./bountifulMonsterDamageZeroOriginalRaw'
import{captureBountifulMonsterDamageZeroOriginalQualification,encodeBountifulMonsterDamageZeroOriginalQualification}from'./bountifulMonsterDamageZeroOriginalQualification'
import type{Dnd5eDamageZeroOriginalRecord}from'./damageCommitSession'
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'publishEvent'>
/** A cold caller supplies only an original identity. The private raw book and
 * current server-protected row are replayed through the real Native issuer;
 * decoded JSON never becomes a capability by itself. */
export async function recoverBountifulMonsterZeroOriginal(parentId:string,gateway:Gateway,load:BountifulMonsterDamageZeroOriginalRawLoader){
 const host=getRoomSession(),combat=await gateway.loadResource<{active?:boolean;mapId?:string;combatId?:string;round?:number;initiativeIndex?:number;bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat'),first=combat?.bountifulOriginalParents?.[JSON.stringify(['bountiful-original-parent',parentId,0])]
 if(!host||host.role!=='dm'||!first||first.consumed||!validateBountifulOriginalParents(combat?.bountifulOriginalParents)||!validBountifulMonsterZeroCommand(first.originalRoomAction)||first.originalAdapterId!=='monster'||first.identity.parentId!==parentId||first.originalRoomAction.parentId!==parentId||first.identity.roomId!==host.roomId||first.identity.hostMemberId!==host.memberId||combat?.active!==true||combat.mapId!==first.identity.mapId||combat.combatId!==first.identity.combatId||combat.round!==first.identity.round||combat.initiativeIndex!==first.identity.initiativeIndex)throw Error('monster-zero-recovery:protected-current-original-required')
 const identity={parentId,mapId:first.identity.mapId,combatId:first.identity.combatId},book=await load(identity)
 if(book.sourceKind!=='monster-damage-zero-original-v1'||book.effectTimestamp!==first.identity.effectTimestamp||book.parentId!==parentId||book.roomId!==host.roomId||book.hostMemberId!==host.memberId||book.rows.some(row=>!row.raw||!row.confirmed))throw Error('monster-zero-recovery:protected-adopted-book-required')
 const decoded=decodeSecondChanceParentWire(first.originalParent)
 if(!decoded||typeof decoded!=='object'||!('hostDamageZeroSavingThrows'in decoded)||!Array.isArray(decoded.hostDamageZeroSavingThrows)||decoded.hostDamageZeroSavingThrows.length!==1)throw Error('monster-zero-recovery:exact-recorded-class-choice-required')
 const record=decoded.hostDamageZeroSavingThrows[0]as Dnd5eDamageZeroOriginalRecord
 if(!record?.choice||!same(record.frame,book.frame)||record.prefixSignature!==book.prefixSignature)throw Error('monster-zero-recovery:changed-protected-class-frame')
 const loadParent:BountifulMonsterDamageZeroOriginalParentLoader=load,restored=await restoreBountifulMonsterDamageZeroOriginalParent(identity,loadParent)
 try{
  if(!same(restored.frame,record.frame)||restored.session.originalEffectTimestamp()!==book.effectTimestamp)throw Error('monster-zero-recovery:changed-actual-class-frame')
  const labels={...book.labels},handle=await createBountifulMonsterDamageZeroOriginalRaw(restored.operation,gateway,load,labels)
  const actual=restored.session.resumeDamageZeroSavingThrow(restored.source.prepared.state,restored.frame,record.choice)
  if(actual.status!=='pending-ally-natural-one'||actual.occurrence!==0||!same(actual.request,first.request))throw Error('monster-zero-recovery:actual-original-request-required')
  const qualified=await captureBountifulMonsterDamageZeroOriginalQualification(actual,handle),wire=await encodeBountifulMonsterDamageZeroOriginalQualification(qualified.qualification,qualified.source)
  if(!same(wire,first.originalParent))throw Error('monster-zero-recovery:changed-protected-original-source')
  return{...qualified,receipt:structuredClone(first)}
 }finally{restored.dispose()}
}
