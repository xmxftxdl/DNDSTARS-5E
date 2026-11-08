import {submitSharedActivityDeathChoice} from '../../lib/sharedApi'
import {secondChanceCanonicalControllerMemberId} from '../../../shared/second-chance-controller.mjs'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {SharedCombatInterrupt} from '../../lib/combatInterruptQueue'
import {getRoomSession} from '../../lib/roomSession'
import {dnd5eExecutionEventKey} from '../../rulesets/dnd5e/activities/dnd5eActivityIdentity'
import type {Dnd5eActivityTriggerChoiceRequestV1} from '../../rulesets/dnd5e/activities/dnd5eActivityTriggerSettlement'
import {getRegisteredDnd5eActivity} from '../../rulesets/dnd5e/activities/dnd5eActivityRegistry'
import {activityDeathParentKey,ACTIVITY_DEATH_PARENT_RESOURCE,restoreActivityDeathParent,readPostNativeActivityStage,sameActivityParentData,type ActivityDeathParentIdentity,type ActivityDeathParentRecord} from './postNativeActivityParent'

type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'mutateCombatInterrupt'>&{acceptActivityDeathChoice?:(input:{parentId:string;receiptId:string})=>Promise<void>}
export interface ActivityDeathChoiceState {attempt:number;receiptId:string;eventId:string;packageId:string;activityId:string;decision?:'use'|'decline';controllerMemberId?:string;authenticatedSubmitterMemberId?:string;transport?:'authenticated-room-member';acceptedByHost?:string;acceptedAt?:number}
export interface ActivityDeathChoicePrompt {
  id:string;transactionId:string;mapId:string;actorCharId:string;pluginId:string;featureId:string;featureName:string;
  audience:'actor'|'dm';prompt:string;options:{id:string;label:string}[];defaultOptionId:string;timeoutMs:number;
  phase:'before-action';context:Record<string,unknown>
}
/** A timeout/unknown returns waiting. It never turns into an actor decline,
 * never consumes a use, and never releases the original native action. */
export async function collectActivityDeathParentChoice(input:{identity:ActivityDeathParentIdentity;request:Dnd5eActivityTriggerChoiceRequestV1;choose:(prompt:ActivityDeathChoicePrompt)=>Promise<unknown>},gateway:Gateway):Promise<{status:'waiting'}|{status:'decided';accepted:boolean}> {
  const session=getRoomSession(),guard=()=>{const now=getRoomSession();if(!session||session.role!=='dm'||now?.role!=='dm'||now.roomId!==session.roomId||now.memberId!==session.memberId)throw Error('activity-death-choice:host-required')};guard()
  const stage=await restoreActivityDeathParent(input.identity,gateway);guard()
  const snapshot=readPostNativeActivityStage(stage),request=input.request,activity=getRegisteredDnd5eActivity(request.packageId,request.activity.id)
  if(!activity||!sameActivityParentData(activity,request.activity)||request.actorId!==input.identity.actorId||request.triggerContext.event!=='creature-killed'||!request.triggerContext.eligibleActorIds.includes(input.identity.actorId)||!request.triggerContext.eligibleTargetIds.includes(input.identity.targetId)||!request.targetIds.includes(input.identity.targetId)||request.confirmation!=='actor-choice')throw Error('activity-death-choice:source-mismatch')
  const actorCharacterId=snapshot.characterIdByCombatantId[input.identity.actorId],character=snapshot.characters.find(row=>row.id===actorCharacterId),controllerMemberId=secondChanceCanonicalControllerMemberId(character,{roomId:session!.roomId,hostMemberId:session!.memberId})
  // A missing controller is an unresolved Host fact; never choose an owner.
  if(!actorCharacterId||!controllerMemberId)return{status:'waiting'}
  const binding={schemaVersion:1,...input.identity,eventId:request.eventId,packageId:request.packageId,activityId:activity.id,actorCharacterId,controllerMemberId}
  const journal=await gateway.loadResource<{schemaVersion:1;parents:Record<string,ActivityDeathParentRecord>;_sync:{revision:number}}>(ACTIVITY_DEATH_PARENT_RESOURCE);guard()
  const record=journal?.parents[activityDeathParentKey(input.identity)]
  if(!record||!Number.isSafeInteger(journal?._sync?.revision))throw Error('activity-death-choice:parent-required')
  const choice=record.choice,attempt=choice?.attempt??0
  const id=`host-death-choice:${dnd5eExecutionEventKey(JSON.stringify([binding,attempt]))}`
  if(choice?.decision){
    if(choice.receiptId!==id||choice.controllerMemberId!==controllerMemberId||choice.eventId!==request.eventId||choice.packageId!==request.packageId||choice.activityId!==activity.id)throw Error('activity-death-choice:changed-owner-decision')
    if(choice.authenticatedSubmitterMemberId!==controllerMemberId||choice.transport!=='authenticated-room-member'||choice.acceptedByHost!==session!.memberId||!Number.isSafeInteger(choice.acceptedAt))throw Error('activity-death-choice:authenticated-private-choice-required')
    return{status:'decided',accepted:choice.decision==='use'}
  }
  const validate=(row:SharedCombatInterrupt)=>{
    if(row.id!==id||row.mapId!==input.identity.mapId||row.transactionId!==input.identity.parentTransactionId||row.kind!=='plugin-choice'||row.actorCharId!==actorCharacterId||row.payload.pluginId!==request.packageId||row.payload.featureId!==activity.id||row.payload.audience!==(controllerMemberId===session!.memberId?'dm':'actor')||!sameActivityParentData(row.payload.activityDeathBinding,binding)||!sameActivityParentData((row.payload.options as {id:string}[]).map(option=>option.id),['use','decline','wait'])||row.payload.defaultOptionId!=='wait')throw Error('activity-death-choice:binding-mismatch')
  }
  const load=async()=>{const queue=await gateway.loadResource<{mapId:string;interrupts:SharedCombatInterrupt[]}>('combat-interrupts');guard();return queue?.mapId===input.identity.mapId?queue.interrupts.find(row=>row.id===id):undefined}
  let row=await load()
  if(!row||row.status==='pending'){
    if(row)validate(row)
    await input.choose({id,transactionId:input.identity.parentTransactionId,mapId:input.identity.mapId,actorCharId:actorCharacterId,pluginId:request.packageId,featureId:activity.id,featureName:activity.name,audience:controllerMemberId===session!.memberId?'dm':'actor',prompt:'是否使用本次击杀触发的能力？未确定时会保留本次击杀，稍后继续。',options:[{id:'use',label:'使用能力'},{id:'decline',label:'暂不使用'},{id:'wait',label:'稍后决定'}],defaultOptionId:'wait',timeoutMs:600_000,phase:'before-action',context:{activityDeathBinding:binding}});guard()
    row=await load()
  }
  if(!row)return{status:'waiting'}
  validate(row)
  if(row.status==='answered'){
    await gateway.mutateCombatInterrupt({operation:'finish',mapId:input.identity.mapId,id,response:row.response});guard();row=await load()
    if(!row)throw Error('activity-death-choice:finish-not-persisted');validate(row)
  }
  if(row.status!=='done')return{status:'waiting'}
  const decision=row.response?.optionId
  if(!['use','decline','wait'].includes(String(decision))||row.response?.controllerMemberId!==controllerMemberId)throw Error('activity-death-choice:authenticated-owner-answer-required')
  const choiceSource={eventId:request.eventId,packageId:request.packageId,activityId:activity.id}
  const nextChoice:ActivityDeathChoiceState=decision==='wait'?{...choiceSource,attempt:attempt+1,receiptId:id}:{...choiceSource,attempt,receiptId:id,decision:decision as 'use'|'decline',controllerMemberId}
  // The server re-reads this exact finished protected row and writes the
  // private first decision. Generic Host journal PUT/atomic is never authority.
  const accept=gateway.acceptActivityDeathChoice??submitSharedActivityDeathChoice
  try{await accept({parentId:record.id,receiptId:id});guard()}
  catch(error){guard();const after=await gateway.loadResource<typeof journal>(ACTIVITY_DEATH_PARENT_RESOURCE);guard();const saved=after?.parents[record.id]?.choice;if(!saved||Object.entries(nextChoice).some(([key,value])=>!sameActivityParentData(saved[key as keyof ActivityDeathChoiceState],value))||saved.transport!=='authenticated-room-member'||saved.authenticatedSubmitterMemberId!==controllerMemberId||saved.acceptedByHost!==session!.memberId)throw error}
  const latest=await gateway.loadResource<typeof journal>(ACTIVITY_DEATH_PARENT_RESOURCE);guard();const saved=latest?.parents[record.id]?.choice
  if(!saved||Object.entries(nextChoice).some(([key,value])=>!sameActivityParentData(saved[key as keyof ActivityDeathChoiceState],value))||saved.transport!=='authenticated-room-member'||saved.authenticatedSubmitterMemberId!==controllerMemberId||saved.acceptedByHost!==session!.memberId||!Number.isSafeInteger(saved.acceptedAt))throw Error('activity-death-choice:authenticated-private-choice-required')
  return decision==='wait'?{status:'waiting'}:{status:'decided',accepted:decision==='use'}
}
