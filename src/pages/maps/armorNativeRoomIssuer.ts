import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import {getRoomSession} from '../../lib/roomSession'
import {migrateMapsState} from '../../store/maps'
import {normalizeCharacter} from '../../store/characters'
import {secondChanceCanonicalControllerMemberId} from '../../../shared/second-chance-controller.mjs'
import {dnd5eExecutionEventKey} from '../../rulesets/dnd5e/activities/dnd5eActivityIdentity'
import {listRegisteredDnd5eActivityPackages} from '../../rulesets/dnd5e/activities/dnd5eActivityRegistry'
import {sameActivityParentData} from './postNativeActivityParent'
import {readSecondChancePreparedOriginalAsync,type SecondChancePreparedOriginal} from './secondChancePreparedParent'
import {captureArmorNativePreparedCheckpoint,restoreArmorNativePreparedCheckpoint,armorNativePreparedCheckpointView,resumeArmorNativePreparedCheckpoint,type ArmorNativePreparedCheckpoint} from './armorNativePreparedCheckpoint'

type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
type Revisioned={_sync?:{revision?:number}}
const resources=['maps','characters','combat','map-geometry','campaign-time'] as const
function revision(value:Revisioned|null,name:string){if(value===null)return 0;const n=value._sync?.revision;if(!Number.isSafeInteger(n)||n!<0)throw Error('armor-native:revision-required:'+name);return n!}
const data=(value:unknown)=>JSON.parse(JSON.stringify(value)) as unknown
/** A private Host issuance context. It is never a raw-roll or owner-choice grant. */
export interface ArmorNativeIssuedParent {readonly armorNativeIssuedParent:unique symbol}
type Issued={frame:ArmorNativePreparedCheckpoint;record:Record<string,unknown>;dependencies:Record<string,number>}
const issued=new WeakMap<object,Issued>()
function host(){const session=getRoomSession();const guard=()=>{const now=getRoomSession();if(!session||session.role!=='dm'||now?.role!=='dm'||now.roomId!==session.roomId||now.memberId!==session.memberId)throw Error('armor-native:authenticated-host-required')};guard();return{session:session!,guard}}
/** Fetch the publication baseline BEFORE running the actual native facade. The
 * resulting incoming-hit checkpoint supplies the target and source; neither is
 * selected by a player payload or by journal metadata. */
export async function captureArmorNativeIssuedParent(input:{resolver:unknown;input:unknown;command?:SharedPlayerActionState;hostParentTransactionId?:string},gateway:Gateway):Promise<ArmorNativeIssuedParent>{
 const {session,guard}=host(),values=await Promise.all(resources.map(name=>gateway.loadResource<Revisioned>(name)));guard()
 const frame=await captureArmorNativePreparedCheckpoint(input.resolver,input.input);guard()
 const view=armorNativePreparedCheckpointView(frame),restored=await readSecondChancePreparedOriginalAsync(view.original);guard()
 const maps=values[0] as (Revisioned&{maps:typeof restored.prepared.map[]})|null,characters=values[1] as (Revisioned&{characters:typeof restored.prepared.characters})|null,combat=values[2] as (Revisioned&{combatId?:string;mapId?:string})|null
 const map=maps?.maps.find(row=>row.id===restored.prepared.map.id)
 if(!map||!characters||combat?.mapId!==map.id||combat.combatId!==view.baseline.combatId)throw Error('armor-native:prepared-world-mismatch:scope')
 if(!sameActivityParentData(migrateMapsState({maps:[map]}).maps[0],migrateMapsState({maps:[restored.prepared.map]}).maps[0]))throw Error('armor-native:prepared-world-mismatch:map')
 if(!sameActivityParentData(data(characters.characters.map(row=>normalizeCharacter(row))),data(restored.prepared.characters.map(row=>normalizeCharacter(row)))))throw Error('armor-native:prepared-world-mismatch:characters')
 const {actorId,targetId}=view.facts.event,targetCharacterId=restored.prepared.characterIdByCombatantId[targetId],character=characters.characters.find(row=>row.id===targetCharacterId),controllerMemberId=secondChanceCanonicalControllerMemberId(character,{roomId:session.roomId,hostMemberId:session.memberId})
 if(!targetCharacterId||!controllerMemberId||!map.tokens.some(row=>row.id===targetId&&row.characterId===targetCharacterId))throw Error('armor-native:canonical-target-controller-required')
 const dependencies:Record<string,number>=Object.fromEntries(resources.map((name,index)=>[name,revision(values[index],name)]))
 let command=input.command
 if(command){
  if(command.mapId!==map.id||command.combatId!==combat.combatId||command.actorTokenId!==actorId||command.targetTokenId!==targetId||command.status!=='pending')throw Error('armor-native:original-command-mismatch')
  if(command.sourceMode==='player'){
   const queue=await gateway.loadResource<Revisioned&{requests:SharedPlayerActionState[]}>('player-action-requests');guard()
   const actual=queue?.requests.find(row=>row.id===command!.id),owner=characters.characters.find(row=>row.id===command!.characterId)
   const strip=(row:SharedPlayerActionState)=>{const copy={...row};delete copy.roomMemberId;return data(copy)}
   if(!actual?.roomMemberId||actual.roomMemberId!==owner?.roomMemberId||!sameActivityParentData(strip(actual),strip(command)))throw Error('armor-native:authenticated-original-command-required')
   command=actual;dependencies['player-action-requests']=revision(queue,'player-action-requests')
  }else if(command.sourceMode!=='dm')throw Error('armor-native:original-command-required')
 }
 if(input.hostParentTransactionId!==undefined&&(typeof input.hostParentTransactionId!=='string'||input.hostParentTransactionId.length===0||input.hostParentTransactionId.length>180||command&&input.hostParentTransactionId!==command.id))throw Error('armor-native:original-host-parent-required')
 const parentTransactionId=command?.id??input.hostParentTransactionId??'host-armor-parent:'+dnd5eExecutionEventKey(JSON.stringify([session.roomId,map.id,combat.combatId,view.original]))
 const id=dnd5eExecutionEventKey(JSON.stringify([parentTransactionId,actorId,targetId,view.occurrence,view.facts]))
 const record={schemaVersion:1,id,phase:'waiting',roomId:session.roomId,hostMemberId:session.memberId,parentTransactionId,mapId:map.id,combatId:combat.combatId,actorId,targetId,targetCharacterId,controllerMemberId,featureId:view.options[0].featureId,occurrence:view.occurrence,dependencies:Object.fromEntries(resources.map(name=>[name,dependencies[name]])),prepared:view.original,attackFacts:view.facts,requestId:'host-armor-d6:'+id,decision:'pending',definitions:data(listRegisteredDnd5eActivityPackages()),originalRoomAction:command}
 const brand=Object.freeze({}) as ArmorNativeIssuedParent;issued.set(brand,{frame,record,dependencies});return brand
}
/** Only this genuine checkpoint can create a pending native journal. Selection
 * remains pending until a separately authenticated owner choice is persisted. */
export async function persistArmorNativeIssuedParent(parent:ArmorNativeIssuedParent,gateway:Gateway){
 const {session,guard}=host(),value=issued.get(parent);if(!value)throw Error('armor-native:issued-parent-brand-required')
 const record=value.record;if(record.roomId!==session.roomId||record.hostMemberId!==session.memberId||!sameActivityParentData(record.definitions,data(listRegisteredDnd5eActivityPackages())))throw Error('armor-native:issued-source-changed')
 const journal=await gateway.loadResource<Revisioned&{schemaVersion:1;parents:Record<string,unknown>}>('armor-native-parents');guard()
 const existing=journal?.parents?.[record.id as string]
 if(existing){if(!sameActivityParentData(existing,record))throw Error('armor-native:existing-parent-mismatch');return structuredClone(record)}
 const next={schemaVersion:1,parents:{...journal?.parents,[record.id as string]:record}}
 await gateway.saveResourcesAtomically([{name:'armor-native-parents',data:next,expectedRevision:revision(journal,'armor-native-parents')}],{transactionId:'armor-native-issue:'+record.id,readRevisions:value.dependencies});guard()
 return structuredClone(record)
}
/** Rebuild from the original private prepared facade and exact original five
 * revisions. A later world snapshot never becomes a replacement baseline. */
export async function restoreArmorNativeIssuedParent(id:string,gateway:Gateway):Promise<ArmorNativeIssuedParent>{
 const {session,guard}=host(),journal=await gateway.loadResource<Revisioned&{parents:Record<string,Record<string,unknown>>}>('armor-native-parents');guard()
 const record=journal?.parents?.[id]
 if(!record||record.id!==id||record.phase!=='waiting'||record.roomId!==session.roomId||record.hostMemberId!==session.memberId||!sameActivityParentData(record.definitions,data(listRegisteredDnd5eActivityPackages())))throw Error('armor-native:current-issued-parent-required')
 const dependencies=record.dependencies as Record<string,number>,values=await Promise.all(resources.map(name=>gateway.loadResource<Revisioned>(name)));guard()
 if(resources.some((name,index)=>revision(values[index],name)!==dependencies[name]))throw Error('armor-native:original-world-changed')
 const frame=await restoreArmorNativePreparedCheckpoint(record.prepared as SecondChancePreparedOriginal),view=armorNativePreparedCheckpointView(frame),restored=await readSecondChancePreparedOriginalAsync(view.original);guard()
 const characters=values[1] as Revisioned&{characters:typeof restored.prepared.characters},maps=values[0] as Revisioned&{maps:typeof restored.prepared.map[]},combat=values[2] as Revisioned&{combatId?:string;mapId?:string}
 const map=maps.maps.find(row=>row.id===record.mapId),character=characters.characters.find(row=>row.id===record.targetCharacterId)
 if(!map||combat.mapId!==map.id||combat.combatId!==record.combatId||!sameActivityParentData(migrateMapsState({maps:[map]}).maps[0],migrateMapsState({maps:[restored.prepared.map]}).maps[0])||!sameActivityParentData(data(characters.characters.map(row=>normalizeCharacter(row))),data(restored.prepared.characters.map(row=>normalizeCharacter(row))))||!sameActivityParentData(record.attackFacts,view.facts)||view.occurrence!==record.occurrence||!view.options.some(option=>option.featureId===record.featureId)||restored.prepared.characterIdByCombatantId[view.facts.event.targetId]!==record.targetCharacterId||secondChanceCanonicalControllerMemberId(character,{roomId:session.roomId,hostMemberId:session.memberId})!==record.controllerMemberId)throw Error('armor-native:restored-parent-mismatch')
 const command=record.originalRoomAction as SharedPlayerActionState|undefined,readDependencies={...dependencies}
 if(command?.sourceMode==='player'){
  const queue=await gateway.loadResource<Revisioned&{requests:SharedPlayerActionState[]}>('player-action-requests');guard()
  if(!sameActivityParentData(queue?.requests.find(row=>row.id===command.id),command))throw Error('armor-native:original-command-changed')
  readDependencies['player-action-requests']=revision(queue,'player-action-requests')
 }
 const brand=Object.freeze({}) as ArmorNativeIssuedParent;issued.set(brand,{frame,record:structuredClone(record),dependencies:readDependencies});return brand
}
/** A cacheless consumer reads only authenticated persisted owner/raw facts.
 * Returning the mechanical result still grants no separate HP publisher. */
export async function resumeArmorNativeIssuedParent(parent:ArmorNativeIssuedParent,gateway:Gateway){
 const {session,guard}=host(),value=issued.get(parent);if(!value)throw Error('armor-native:issued-parent-brand-required')
 // A fresh restore rechecks source/owner and original revisions after any UI wait.
 const restored=await restoreArmorNativeIssuedParent(value.record.id as string,gateway);guard()
 const current=issued.get(restored)!,record=current.record,controller=record.controllerMemberId,decision=record.decision
 if(decision==='pending')return{status:'pending-owner-choice' as const}
 const choice=record.ownerChoice as {decision?:unknown;authenticatedSubmitterMemberId?:unknown;transport?:unknown}|undefined
 if(!choice||choice.decision!==decision||choice.authenticatedSubmitterMemberId!==controller||choice.transport!=='authenticated-room-member')throw Error('armor-native:authenticated-owner-choice-required')
 if(decision==='decline')return resumeArmorNativePreparedCheckpoint(current.frame)
 const raw=record.raw as {values:number[];authenticatedSubmitterMemberId?:unknown;sourceMemberId?:unknown;recordedByHost?:unknown;transport?:unknown}|undefined,confirmed=record.confirmed as {values:number[];confirmedBy?:unknown}|undefined
 if(!raw)return{status:'pending-owner-d6' as const}
 if(raw.authenticatedSubmitterMemberId!==controller||raw.sourceMemberId!==controller||raw.recordedByHost!==session.memberId||raw.transport!=='authenticated-room-member')throw Error('armor-native:authenticated-raw-required')
 if(!confirmed)return{status:'pending-dm-confirmation' as const}
 if(confirmed.confirmedBy!==session.memberId||confirmed.values.length!==1||!Number.isInteger(confirmed.values[0])||confirmed.values[0]<1||confirmed.values[0]>6)throw Error('armor-native:host-d6-confirmation-required')
 return resumeArmorNativePreparedCheckpoint(current.frame,{featureId:record.featureId as string,die:confirmed.values[0]})
}
export function readArmorNativeIssuedContext(parent:ArmorNativeIssuedParent){const {session}=host(),value=issued.get(parent);if(!value||value.record.roomId!==session.roomId||value.record.hostMemberId!==session.memberId)throw Error('armor-native:issued-parent-brand-required');return{record:structuredClone(value.record),dependencies:{...value.dependencies}}}
