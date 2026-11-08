import {getRoomSession} from '../../lib/roomSession'
import {dnd5eExecutionEventKey} from '../../rulesets/dnd5e/activities/dnd5eActivityIdentity'
import {requireActiveSpecterScFrame} from './specterScFrameAuthority'
import {readSecondChancePostNativeFrame,type SecondChancePostNativeFrame} from './secondChancePostNativeBoundary'
import {SecondChanceMapsSettlementSignal} from './secondChanceMapsSettlement'
import {persistSpecterScActivityDeathParent,prepareSpecterScActivityReady} from './postNativeActivityParent'
import {captureSecondChanceSpecterFinalSettlement} from './secondChanceSpecterFinalPlan'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {BattleMap} from '../../store/maps'
import type {Character} from '../../types/character'
import {listRegisteredDnd5eActivityPackages} from '../../rulesets/dnd5e/activities/dnd5eActivityRegistry'
import {listDnd5eActivityTriggerWindowsV1} from '../../rulesets/dnd5e/activities/dnd5eActivityTriggerWindows'
import type {Dnd5eActivityDefinitionV1} from '../../rulesets/dnd5e/activities/dnd5eActivityContracts'
import {planDnd5eMapResultApplication} from '../../rulesets/dnd5e/mapBridge'
import {readDnd5eKilledSummonContinuationV1,type Dnd5eKilledSummonContinuationV1,type settleDnd5eActivityTriggerWindowsV1} from '../../rulesets/dnd5e/activities/dnd5eActivityTriggerSettlement'
import {readDnd5eActivityMapMaterializationV1,type Dnd5eActivityMapHandoffResultV1} from '../../rulesets/dnd5e/activities/dnd5eActivityMapInteraction'
import {collectActivityDeathParentChoice,type ActivityDeathChoicePrompt} from './activityDeathChoice'
import {ActivityDeathMapsSettlementSignal} from './activityDeathMapsSettlement'
import {ACTIVITY_DEATH_PARENT_RESOURCE,captureActivityDeathParentBaseline,persistActivityDeathParent,persistActivityDeathParentContinuation,publishActivityDeathParent,readPublishedActivityDeathParent,restoreActivityDeathParent,restoreActivityDeathParentBaseline,restoreActivityDeathParentContinuation,restoreActivityDeathParentMapProgress,readPostNativeActivityStage,postNativeActivityResumeInput,sameActivityParentData,type ActivityDeathParentBaseline,type ActivityDeathParentIdentity,type ActivityDeathParentRecord,type PostNativeActivitySettlement,type PostNativeActivityStage} from './postNativeActivityParent'

type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'mutateCombatInterrupt'>
type TriggerInput=Parameters<typeof settleDnd5eActivityTriggerWindowsV1>[0]
declare const contextBrand:unique symbol
export interface ActivityDeathMapsContext {readonly [contextBrand]:true}
interface ContextData {roomId:string;hostMemberId:string;action?:SharedPlayerActionState;baseline?:ActivityDeathParentBaseline;scFrame?:SecondChancePostNativeFrame;identity?:ActivityDeathParentIdentity;active:boolean;stage?:PostNativeActivityStage;frame?:Dnd5eKilledSummonContinuationV1;earlierMap?:BattleMap;mapResults:Dnd5eActivityMapHandoffResultV1[]}
const contexts=new WeakMap<object,ContextData>()
function data(context:ActivityDeathMapsContext){const value=contexts.get(context);if(!value)throw Error('activity-death-maps:unissued-context');const session=host();if(session.roomId!==value.roomId||session.memberId!==value.hostMemberId)throw Error('activity-death-maps:changed-room');return value}
function host(){const session=getRoomSession();if(session?.role!=='dm')throw Error('activity-death-maps:host-required');return session}
function parentId(value:ContextData){if(value.scFrame)return readSecondChancePostNativeFrame(value.scFrame).parentTransactionId;if(!value.action)throw Error('activity-death-maps:original-command-required');return value.action.id}
function pending(value:ContextData):never{if(!value.identity)throw Error('activity-death-maps:original-death-required');if(value.scFrame){const view=readSecondChancePostNativeFrame(value.scFrame),group=JSON.parse(view.scGroupIdentity);const root=group[0];if(!root?.attack?.id)throw Error('activity-death-maps:original-sc-group-required');throw new SecondChanceMapsSettlementSignal({kind:'second-chance-parent-pending',mapId:view.mapId,combatId:view.combatId,parentTransactionId:view.parentTransactionId,attackReceiptId:root.attack.id})}throw new ActivityDeathMapsSettlementSignal({kind:'activity-death-parent-pending',identity:value.identity})}
function identityFor(record:ActivityDeathParentRecord):ActivityDeathParentIdentity{return{parentTransactionId:record.parentTransactionId,mapId:record.mapId,combatId:record.combatId,actorId:record.actorId,targetId:record.targetId,deathEventIndex:record.deathEventIndex}}
function killedSummon(activity:Dnd5eActivityDefinitionV1):boolean{return activity.outcomes.some(outcome=>outcome.operations.some(operation=>operation.kind==='summon'&&operation.placementOrigin==='killed-target'))}

/** Called before the original native resolver, or before replay can rerun it.
 * An existing private parent is checked first, even after source uninstall. */
export async function prepareActivityDeathMapsContext(input:{action:SharedPlayerActionState;map:BattleMap;characters:readonly Character[]},gateway:Gateway):Promise<ActivityDeathMapsContext|undefined>{
 const session=host(),journal=await gateway.loadResource<{parents:Record<string,ActivityDeathParentRecord>}>(ACTIVITY_DEATH_PARENT_RESOURCE)
 const guard=()=>{const current=host();if(current.roomId!==session.roomId||current.memberId!==session.memberId)throw Error('activity-death-maps:changed-room')};guard()
 const records=Object.values(journal?.parents??{}).filter(row=>row.parentTransactionId===input.action.id&&row.mapId===input.map.id)
 if(records.some(row=>row.scParent)){if(records.some(row=>!row.scParent||row.roomId!==session.roomId||row.hostMemberId!==session.memberId))throw Error('activity-death-maps:mixed-or-foreign-sc-parent');return undefined}
 const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as unknown
 if(records.some(row=>row.roomId!==session.roomId||row.hostMemberId!==session.memberId||!sameActivityParentData(json(row.originalRoomAction),json(input.action))))throw Error('activity-death-maps:changed-original-command')
 const done=records.find(row=>row.phase==='consumed')
 if(done){const identity=identityFor(done),published=await readPublishedActivityDeathParent(identity,gateway);throw new ActivityDeathMapsSettlementSignal({kind:'activity-death-parent-published',identity,result:published.settlement.result})}
 if(!records.length&&!listRegisteredDnd5eActivityPackages().some(pkg=>pkg.activities.some(killedSummon)))return undefined
 const context=Object.freeze({}) as ActivityDeathMapsContext
 if(records.length){
  const candidates=await Promise.all(records.map(async record=>{
   const identity=identityFor(record),stage=await restoreActivityDeathParent(identity,gateway),frame=await restoreActivityDeathParentContinuation(identity,gateway)
   return{identity,stage,frame,rank:frame?readDnd5eKilledSummonContinuationV1(frame).combatRevision:-1}
  }))
  candidates.sort((left,right)=>right.rank-left.rank)
  const current=candidates[0],progress=await restoreActivityDeathParentMapProgress(current.identity,gateway),baseline=await restoreActivityDeathParentBaseline(current.identity,gateway)
  guard();contexts.set(context,{roomId:session.roomId,hostMemberId:session.memberId,action:input.action,baseline,identity:current.identity,active:true,stage:current.stage,frame:current.frame,earlierMap:progress?.map,mapResults:[...(progress?.mapResults??[])]})
 }else{const baseline=await captureActivityDeathParentBaseline({command:input.action,map:input.map,characters:input.characters},gateway);guard();contexts.set(context,{roomId:session.roomId,hostMemberId:session.memberId,action:input.action,baseline,active:false,mapResults:[]})}
 return context
}
/** Shares the existing real UI/mapper ports, with an independent SC issuer.
 * No player command, ordinary baseline, or ordinary HP publisher is invented. */
export async function prepareSpecterScMapsContext(scFrame:SecondChancePostNativeFrame,gateway:Gateway):Promise<ActivityDeathMapsContext>{
 const view=await requireActiveSpecterScFrame(scFrame),session=host(),journal=await gateway.loadResource<{parents:Record<string,ActivityDeathParentRecord>}>(ACTIVITY_DEATH_PARENT_RESOURCE)
 const rows=Object.values(journal?.parents??{}).filter(row=>row.parentTransactionId===view.parentTransactionId&&row.mapId===view.mapId)
 if(rows.some(row=>!row.scParent||row.scParent.groupIdentity!==view.scGroupIdentity||row.roomId!==session.roomId||row.hostMemberId!==session.memberId||row.phase!=='waiting'))throw Error('activity-death-maps:changed-sc-original-parent')
 const context=Object.freeze({}) as ActivityDeathMapsContext
 const candidates=await Promise.all(rows.map(async row=>{const identity=identityFor(row),frame=await restoreActivityDeathParentContinuation(identity,gateway);return{identity,frame,rank:frame?readDnd5eKilledSummonContinuationV1(frame).combatRevision:-1}}));candidates.sort((a,b)=>b.rank-a.rank)
 const current=candidates[0],progress=current?await restoreActivityDeathParentMapProgress(current.identity,gateway):undefined
 await requireActiveSpecterScFrame(scFrame)
 contexts.set(context,{roomId:session.roomId,hostMemberId:session.memberId,scFrame,identity:current?.identity,frame:current?.frame,active:rows.length>0,stage:view.stage,earlierMap:progress?.map,mapResults:[...(progress?.mapResults??[])]})
 return context
}
export async function finishSpecterScMapsContext(native:SecondChancePostNativeFrame,context:ActivityDeathMapsContext,settlement:PostNativeActivitySettlement,gateway:Gateway){
 const value=data(context);if(!value.scFrame)throw Error('activity-death-maps:genuine-sc-context-required')
 await requireActiveSpecterScFrame(value.scFrame)
 if(!value.identity)return undefined
 const ready=await prepareSpecterScActivityReady(value.scFrame,{identity:value.identity,settlement,mapResults:value.mapResults},gateway)
 return captureSecondChanceSpecterFinalSettlement(native,value.scFrame,ready)
}
export function activityDeathMapsRecovery(context:ActivityDeathMapsContext){const value=data(context);return value.stage?postNativeActivityResumeInput(value.stage):undefined}
export function activityDeathMapsParentId(context:ActivityDeathMapsContext){return parentId(data(context))}
export function activityDeathMapsPendingIdentity(context:ActivityDeathMapsContext):ActivityDeathParentIdentity{const identity=data(context).identity;if(!identity)throw Error('activity-death-maps:original-death-required');return structuredClone(identity)}
export function activityDeathMapsEarlierMap(context:ActivityDeathMapsContext){return data(context).earlierMap}
export function activityDeathMapsInitialMap(context:ActivityDeathMapsContext,request:{map:BattleMap;characters:readonly Character[];state:TriggerInput['state'];events:TriggerInput['events'];characterIdByCombatantId:Readonly<Record<string,string>>}):BattleMap{
 const value=data(context)
 return value.earlierMap??planDnd5eMapResultApplication({...request,events:[...request.events]}).map
}
export function activityDeathMapsActive(context:ActivityDeathMapsContext|undefined):boolean{return context?data(context).active:false}
export function activityDeathMapsRecordMap(context:ActivityDeathMapsContext|undefined,result:Dnd5eActivityMapHandoffResultV1):void{
 if(!context||!data(context).active)return
 readDnd5eActivityMapMaterializationV1(result)
 data(context).mapResults.push(result)
}
/** Decorates the existing real coordinator input; all normal UI callbacks and
 * the real mapper remain in place. It does not implement another rule engine. */
export function withActivityDeathMapsTriggers(context:ActivityDeathMapsContext|undefined,stage:PostNativeActivityStage|undefined,input:TriggerInput,gateway:Gateway,choose:(prompt:ActivityDeathChoicePrompt)=>Promise<unknown>):TriggerInput{
 if(!context||!stage)return input
 const value=data(context)
 if(value.scFrame&&value.stage!==stage)throw Error('activity-death-maps:sc-original-stage-required')
 const source=readPostNativeActivityStage(stage)
 const hasWindow=value.active||listDnd5eActivityTriggerWindowsV1(input).some(window=>window.available.some(available=>killedSummon(available.activity)))
 if(!hasWindow)return input
 value.active=true
 const revision=value.frame?readDnd5eKilledSummonContinuationV1(value.frame).initial.combatRevision:input.combatRevision
 return{...input,eventBatchId:`production:${dnd5eExecutionEventKey(parentId(value))}`,combatRevision:revision,resumeKilledSummon:value.frame,
  onBeforeKilledSummonChoice:async(frame,request)=>{
   const targetId=request.triggerContext.eligibleTargetIds[0]
   const deathEventIndex=source.result.events.findIndex(event=>event.type==='creature-died'&&event.killerId===request.actorId&&event.targetId===targetId)
   if(deathEventIndex<0)throw Error('activity-death-maps:nested-death-provenance-required')
   const identity:ActivityDeathParentIdentity={parentTransactionId:parentId(value),mapId:source.map.id,combatId:source.result.state.combatId,actorId:request.actorId,targetId,deathEventIndex}
   if(value.scFrame)await persistSpecterScActivityDeathParent(value.scFrame,identity,gateway)
   else{if(!value.baseline)throw Error('activity-death-maps:original-baseline-required');await persistActivityDeathParent(stage,identity,gateway,value.baseline)}
   value.identity=identity;value.stage=stage
   await persistActivityDeathParentContinuation(identity,frame,gateway,value.mapResults)
  },
  confirm:async request=>{
   if(!killedSummon(request.activity)||request.triggerContext.event!=='creature-killed')return input.confirm(request)
   if(!value.identity)throw Error('activity-death-maps:before-choice-checkpoint-required')
   const choice=await collectActivityDeathParentChoice({identity:value.identity,request,choose},gateway)
   if(choice.status==='waiting')pending(value)
   return choice.accepted
  },
  onPendingKilledSummon:async frame=>{
   if(!value.identity)throw Error('activity-death-maps:original-death-required')
   await persistActivityDeathParentContinuation(value.identity,frame,gateway,value.mapResults)
   pending(value)
  },
 }
}
export async function publishActivityDeathMapsContext(context:ActivityDeathMapsContext|undefined,settlement:PostNativeActivitySettlement,gateway:Gateway):Promise<void>{
 if(!context)return
 const value=data(context)
 if(value.scFrame)throw Error('activity-death-maps:sc-original-publisher-required')
 if(!value.identity)return
 const done=await publishActivityDeathParent({identity:value.identity,settlement,mapResults:value.mapResults},gateway)
 throw new ActivityDeathMapsSettlementSignal({kind:'activity-death-parent-published',identity:value.identity,result:done.settlement.result})
}

/** Initial-load recovery reads only the Host's private issued native parents.
 * PC requests remain on their real queue; never manufacture an ACK or a new
 * command. A pending SC parent requires its joint hook, not another publisher. */
export async function loadActivityDeathMapsPendingActions(mapId:string,gateway:Gateway):Promise<SharedPlayerActionState[]>{
 const session=host(),journal=await gateway.loadResource<{parents:Record<string,ActivityDeathParentRecord>}>(ACTIVITY_DEATH_PARENT_RESOURCE)
 const records=Object.values(journal?.parents??{}).filter(row=>row.mapId===mapId&&row.phase==='waiting'&&!row.scParent&&row.originalRoomAction?.sourceMode==='dm')
 const actions=new Map<string,SharedPlayerActionState>()
 for(const record of records){
  if(record.roomId!==session.roomId||record.hostMemberId!==session.memberId)throw Error('activity-death-maps:foreign-local-parent')
  const action=record.originalRoomAction
  if(!action||action.id!==record.parentTransactionId||action.mapId!==record.mapId||action.combatId!==record.combatId)throw Error('activity-death-maps:changed-original-command')
  const prior=actions.get(action.id)
  if(prior&&!sameActivityParentData(prior,action))throw Error('activity-death-maps:ambiguous-local-parent')
  await restoreActivityDeathParent(identityFor(record),gateway)
  actions.set(action.id,structuredClone(action))
 }
 if(actions.size){
  const combat=await gateway.loadResource<{secondChanceAttacks?:Record<string,{attack:{transactionId:string};parentContinuation?:{phase:string}}>}>('combat')
  if(Object.values(combat?.secondChanceAttacks??{}).some(row=>actions.has(row.attack.transactionId)&&row.parentContinuation?.phase!=='consumed'))throw Error('activity-death-maps:joint-host-hook-required')
 }
 const current=host();if(current.roomId!==session.roomId||current.memberId!==session.memberId)throw Error('activity-death-maps:changed-room')
 return[...actions.values()]
}
