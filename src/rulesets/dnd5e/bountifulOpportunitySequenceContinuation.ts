import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{getRoomSession}from'../../lib/roomSession'
import type{SharedPlayerActionState}from'../../lib/sharedCombatTypes'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import type{BountifulOriginalDieReceipt}from'./bountifulLuckReceipt'
import{readBountifulOriginalSource}from'./bountifulLuckPersistentRoomDriver'
import{readBountifulOpportunitySequenceWindow,type BountifulOpportunitySequenceWindow}from'./bountifulOpportunitySequenceWindow'
import type{resolveDnd5eOpportunityMoveSequenceOriginal}from'./opportunityMoveSequence'
type Gateway=Pick<SharedRoomGatewayPort,'publishEvent'|'loadResource'|'saveResourcesAtomically'>
type Combat={_sync?:{revision?:number};bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}
/** Append only the next server-confirmed original OA slot. The server issues
 * a private stamp before this exact metadata-only CAS, and checks it in both
 * ordinary PUT and atomic publication. No resolver, state or final ACK setter
 * is exposed by this seam. */
export async function appendBountifulOpportunitySequenceOriginal<Input extends{prepared:{action:SharedPlayerActionState};transactionId:string}>(input:{action:SharedPlayerActionState;source:Input;rollCursor:number},gateway:Gateway){
 return saveBountifulSequenceSource(input,gateway,'append-parent-source')
}
/** Only this actual native ready window and its authenticated damage journal
 * may fill previously empty damage dice. It cannot change original d20s,
 * prepared facts, another OA, or any movement/cost/material snapshot. */
export async function recordBountifulOpportunitySequenceDamage(window:BountifulOpportunitySequenceWindow,values:readonly number[],rollCursor:number,gateway:Gateway){
 const proof=readBountifulOpportunitySequenceWindow(window)
 if(!proof.hit||values.length!==proof.damage.count||values.some(value=>!Number.isInteger(value)||value<1||value>proof.damage.sides))throw Error('opportunity-sequence:actual-native-damage-pool-required')
 const combat=await gateway.loadResource<Combat>('combat'),id=JSON.stringify(['bountiful-original-parent',proof.action.id,0]),first=combat?.bountifulOriginalParents?.[id]
 if(!first)throw Error('opportunity-sequence:actual-private-parent-required')
 const original=await readBountifulOriginalSource(first,{includeContinuation:true}),source=original.source as unknown as Parameters<typeof resolveDnd5eOpportunityMoveSequenceOriginal>[0]&{transactionId:string},attack=source.attacks[proof.actorId]
 if(!attack)throw Error('opportunity-sequence:actual-native-damage-parent-required')
 const next={...source,attacks:{...source.attacks,[proof.actorId]:{...attack,damageRolls:[...values]}}}
 return saveBountifulSequenceSource({action:proof.action,source:next,rollCursor},gateway,'record-late-source',proof.actorId)
}
async function saveBountifulSequenceSource<Input extends{prepared:{action:SharedPlayerActionState};transactionId:string}>(input:{action:SharedPlayerActionState;source:Input;rollCursor:number},gateway:Gateway,phase:'append-parent-source'|'record-late-source',actorId?:string){
 const host=getRoomSession(),combat=await gateway.loadResource<Combat>('combat'),id=JSON.stringify(['bountiful-original-parent',input.action.id,0]),first=combat?.bountifulOriginalParents?.[id]
 if(host?.role!=='dm'||!combat||!first||first.originalAdapterId!=='opportunity-move-sequence'||first.consumed||first.identity.roomId!==host.roomId||first.identity.hostMemberId!==host.memberId||JSON.stringify(first.originalRoomAction)!==JSON.stringify(input.action)||JSON.stringify(input.source.prepared.action)!==JSON.stringify(input.action)||input.source.transactionId!==input.action.id||!Number.isSafeInteger(input.rollCursor)||input.rollCursor<1||!Number.isSafeInteger(combat._sync?.revision))throw Error('opportunity-sequence:actual-private-parent-required')
 const source=encodeSecondChanceParentWire(input.source),continuation={hostMemberId:host.memberId,source,rollCursor:input.rollCursor}
 if(JSON.stringify(first.continuation)===JSON.stringify(continuation))return
 await gateway.publishEvent('bountiful-opportunity-source-dm-to-host',{sourceKind:'opportunity-sequence-v1',phase,parentId:input.action.id,mapId:input.action.mapId,combatId:input.action.combatId,source,rollCursor:input.rollCursor,...(actorId?{actorId}:{})})
 if(getRoomSession()?.role!=='dm'||getRoomSession()?.roomId!==host.roomId||getRoomSession()?.memberId!==host.memberId)throw Error('opportunity-sequence:host-changed')
 try{await gateway.saveResourcesAtomically([{name:'combat',expectedRevision:combat._sync!.revision!,data:{...combat,bountifulOriginalParents:{...combat.bountifulOriginalParents,[id]:{...first,continuation}}}}],{transactionId:'bountiful-opportunity-sequence-'+(phase==='record-late-source'?'damage':'append')+':'+input.action.id+':'+input.rollCursor})}catch(error){
  const current=await gateway.loadResource<Combat>('combat');if(JSON.stringify(current?.bountifulOriginalParents?.[id]?.continuation)===JSON.stringify(continuation))return;throw error
 }
}
