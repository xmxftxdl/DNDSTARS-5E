import {submitSharedActivityDeathInitiativeRaw} from '../../lib/sharedApi'
import {getRoomSession} from '../../lib/roomSession'
import {secondChanceCanonicalControllerMemberId} from '../../../shared/second-chance-controller.mjs'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {dnd5eExecutionEventKey} from '../../rulesets/dnd5e/activities/dnd5eActivityIdentity'
import {getRegisteredDnd5eActivity} from '../../rulesets/dnd5e/activities/dnd5eActivityRegistry'
import {readDnd5eKilledSummonContinuationV1,type Dnd5eActivityTriggerMapHandoffRequestV1} from '../../rulesets/dnd5e/activities/dnd5eActivityTriggerSettlement'
import {ACTIVITY_DEATH_PARENT_RESOURCE,activityDeathParentKey,restoreActivityDeathParent,restoreActivityDeathParentContinuation,readPostNativeActivityStage,sameActivityParentData,type ActivityDeathParentIdentity,type ActivityDeathParentRecord} from './postNativeActivityParent'

type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>&{submitInitiativeRaw?:typeof submitSharedActivityDeathInitiativeRaw}
interface Journal {schemaVersion:1;parents:Record<string,ActivityDeathParentRecord>;_sync?:{revision:number}}
export interface ActivityDeathInitiativeRoll {
 schemaVersion:1;id:string;receiptId:string;eventId:string;packageId:string;activityId:string
 actorId:string;targetId:string;actorCharacterId:string;controllerMemberId:string;occurrenceIndex:0;count:1;sides:20
 raw?:{values:[number];sourceMemberId:string;recordedByHost:string;recordedAt:number;authenticatedSubmitterMemberId?:string;transport?:'authenticated-room-member'}
 confirmed?:{values:[number];confirmedBy:string;confirmedAt:number}
}
function requireAuthenticatedRaw(roll:ActivityDeathInitiativeRoll,hostMemberId:string){if(!roll.raw||roll.raw.transport!=='authenticated-room-member'||roll.raw.authenticatedSubmitterMemberId!==roll.controllerMemberId||roll.raw.sourceMemberId!==roll.controllerMemberId||roll.raw.recordedByHost!==hostMemberId)throw Error('activity-death-initiative:authenticated-original-raw-required')}
const prefix='host-death-init:'
export function activityDeathInitiativeRequestId(parent:ActivityDeathParentIdentity&{roomId:string},receiptId:string,index:number):string{return prefix+dnd5eExecutionEventKey(JSON.stringify([parent.roomId,parent.parentTransactionId,parent.mapId,parent.combatId,parent.actorId,parent.targetId,parent.deathEventIndex,receiptId,index]))}
function one(values:readonly number[],sides:number):[number]{if(sides!==20||values.length!==1||!Number.isInteger(values[0])||values[0]!<1||values[0]!>20)throw Error('activity-death-initiative:one-real-d20-required');return[values[0]!]}
function identity(row:ActivityDeathParentRecord):ActivityDeathParentIdentity{return{parentTransactionId:row.parentTransactionId,mapId:row.mapId,combatId:row.combatId,actorId:row.actorId,targetId:row.targetId,deathEventIndex:row.deathEventIndex}}
function host(){const session=getRoomSession();if(session?.role!=='dm')throw Error('activity-death-initiative:host-required');return session}
async function recordFor(id:ActivityDeathParentIdentity,gateway:Gateway){
 const session=host(),stage=await restoreActivityDeathParent(id,gateway),frame=await restoreActivityDeathParentContinuation(id,gateway)
 const journal=await gateway.loadResource<Journal>(ACTIVITY_DEATH_PARENT_RESOURCE),row=journal?.parents[activityDeathParentKey(id)]
 const now=host()
 if(!journal||!Number.isSafeInteger(journal._sync?.revision)||!row||row.roomId!==session.roomId||row.hostMemberId!==session.memberId||now.roomId!==session.roomId||now.memberId!==session.memberId||row.choice?.decision!=='use'||!frame)throw Error('activity-death-initiative:accepted-original-parent-required')
 return{journal,row,stage,frame,session}
}
async function saveRoll(original:Awaited<ReturnType<typeof recordFor>>,roll:ActivityDeathInitiativeRoll,gateway:Gateway){
 const {journal,row,session}=original,key=row.id
 const prior=row.initiativeRolls?.[roll.id]
 if(sameActivityParentData(prior,roll))return roll
 const next={...journal,parents:{...journal.parents,[key]:{...row,initiativeRolls:{...row.initiativeRolls,[roll.id]:roll}}}}
 try{await gateway.saveResourcesAtomically([{name:ACTIVITY_DEATH_PARENT_RESOURCE,expectedRevision:journal._sync!.revision,data:next}],{transactionId:`activity-death-initiative:${roll.id}:${roll.confirmed?'confirmed':roll.raw?'raw':'request'}`,readRevisions:row.dependencies,undoLabel:'保留幽灵的独立先攻骰'})}
 catch(error){const saved=await gateway.loadResource<Journal>(ACTIVITY_DEATH_PARENT_RESOURCE);if(!sameActivityParentData(saved?.parents[key]?.initiativeRolls?.[roll.id],roll))throw error}
 const now=host();if(now.roomId!==session.roomId||now.memberId!==session.memberId)throw Error('activity-death-initiative:changed-room')
 return roll
}
export async function prepareActivityDeathInitiativeRoll(id:ActivityDeathParentIdentity,request:Dnd5eActivityTriggerMapHandoffRequestV1,index:number,gateway:Gateway):Promise<ActivityDeathInitiativeRoll>{
 const original=await recordFor(id,gateway),{row,stage,frame,session}=original,data=readDnd5eKilledSummonContinuationV1(frame),pending=data.phase==='owner-choice'?data.pendingChoice:data.pending
 const current=getRegisteredDnd5eActivity(request.packageId,request.activity.id),snapshot=readPostNativeActivityStage(stage),actorCharacterId=snapshot.characterIdByCombatantId[id.actorId],actor=snapshot.characters.find(character=>character.id===actorCharacterId)
 const controller=secondChanceCanonicalControllerMemberId(actor,{roomId:session.roomId,hostMemberId:session.memberId})
 const summons=request.committed.activityHandoffs?.summons
 if(index!==0||!current||!sameActivityParentData(current,request.activity)||pending.eventId!==request.eventId||pending.packageId!==request.packageId||pending.activity.id!==request.activity.id||pending.actorId!==request.actorId||request.actorId!==id.actorId||row.choice?.eventId!==request.eventId||row.choice.packageId!==request.packageId||row.choice.activityId!==request.activity.id||!actorCharacterId||!controller||row.choice.controllerMemberId!==controller||summons?.length!==1||summons[0].count!==1||summons[0].monsterId!=='srd-5.1:specter'||summons[0].killedCreatureOriginId!==id.targetId)throw Error('activity-death-initiative:exact-specter-handoff-required')
 const requestId=activityDeathInitiativeRequestId({...id,roomId:session.roomId},request.receiptId,index)
 const base:ActivityDeathInitiativeRoll={schemaVersion:1,id:requestId,receiptId:request.receiptId,eventId:request.eventId,packageId:request.packageId,activityId:request.activity.id,actorId:id.actorId,targetId:id.targetId,actorCharacterId,controllerMemberId:controller,occurrenceIndex:0,count:1,sides:20}
 const existing=row.initiativeRolls?.[requestId]
 if(existing){const withoutFaces=Object.fromEntries(Object.entries(existing).filter(([key])=>key!=='raw'&&key!=='confirmed'));if(!sameActivityParentData(withoutFaces,base))throw Error('activity-death-initiative:changed-original-request');return existing}
 return saveRoll(original,base,gateway)
}
async function findRoll(requestId:string,gateway:Gateway){
 if(!requestId.startsWith(prefix))return undefined
 const session=host(),journal=await gateway.loadResource<Journal>(ACTIVITY_DEATH_PARENT_RESOURCE)
 const matches=Object.values(journal?.parents??{}).filter(row=>row.initiativeRolls?.[requestId])
 if(matches.length!==1)throw Error('activity-death-initiative:issued-request-required')
 const row=matches[0]
 if(row.roomId!==session.roomId||row.hostMemberId!==session.memberId)throw Error('activity-death-initiative:foreign-parent')
 const original=await recordFor(identity(row),gateway),roll=original.row.initiativeRolls?.[requestId]
 if(!roll)throw Error('activity-death-initiative:issued-request-required')
 return{...original,roll}
}
/** Called only by the real Host confirmation UI before it opens. Other roll
 * namespaces are untouched. This is not an author/player payload decoder. */
export async function recordActivityDeathInitiativeRaw(input:{requestId:string;rollerTokenId?:string;sides:number;values:readonly number[]},gateway:Gateway):Promise<void>{
 const original=await findRoll(input.requestId,gateway);if(!original)return
 const values=one(input.values,input.sides),{roll,session}=original
 if(input.rollerTokenId!==roll.actorId)throw Error('activity-death-initiative:original-controller-token-required')
 if(roll.raw){requireAuthenticatedRaw(roll,session.memberId);if(!sameActivityParentData(roll.raw.values,values))throw Error('activity-death-initiative:locked-raw-changed');return}
 if(roll.controllerMemberId!==session.memberId)throw Error('activity-death-initiative:actual-member-raw-required')
 await (gateway.submitInitiativeRaw??submitSharedActivityDeathInitiativeRaw)({requestId:input.requestId,rollerTokenId:roll.actorId,sides:20,values})
 const saved=await findRoll(input.requestId,gateway)
 if(!saved)throw Error('activity-death-initiative:issued-request-required')
 requireAuthenticatedRaw(saved.roll,session.memberId)
 if(!sameActivityParentData(saved.roll.raw!.values,values))throw Error('activity-death-initiative:locked-raw-changed')
}
/** Called after the actual authenticated DM confirmation UI has returned. */
export async function recordActivityDeathInitiativeConfirmation(input:{requestId:string;rollerTokenId?:string;sides:number;values:readonly number[]},gateway:Gateway):Promise<void>{
 const original=await findRoll(input.requestId,gateway);if(!original)return
 const values=one(input.values,input.sides),{roll,session}=original
 if(input.rollerTokenId!==roll.actorId||!roll.raw)throw Error('activity-death-initiative:locked-original-raw-required')
 requireAuthenticatedRaw(roll,session.memberId)
 if(roll.confirmed){if(!sameActivityParentData(roll.confirmed.values,values)||roll.confirmed.confirmedBy!==session.memberId)throw Error('activity-death-initiative:confirmed-result-changed');return}
 await saveRoll(original,{...roll,confirmed:{values,confirmedBy:session.memberId,confirmedAt:Date.now()}},gateway)
}
export async function collectActivityDeathInitiative(id:ActivityDeathParentIdentity,request:Dnd5eActivityTriggerMapHandoffRequestV1,index:number,gateway:Gateway,ui:{roll:(request:ActivityDeathInitiativeRoll)=>Promise<number>;confirmStored:(request:ActivityDeathInitiativeRoll)=>Promise<number>}):Promise<number>{
 const roll=await prepareActivityDeathInitiativeRoll(id,request,index,gateway)
 if(roll.raw)requireAuthenticatedRaw(roll,host().memberId)
 if(roll.confirmed)return roll.confirmed.values[0]
 const value=roll.raw?await ui.confirmStored(roll):await ui.roll(roll)
 one([value],20)
 const saved=await findRoll(roll.id,gateway)
 if(saved)requireAuthenticatedRaw(saved.roll,host().memberId)
 if(saved?.roll.confirmed?.values[0]!==value)throw Error('activity-death-initiative:actual-dm-confirmation-not-persisted')
 return value
}
