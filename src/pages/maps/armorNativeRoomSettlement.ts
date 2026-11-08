import type {SharedRoomGatewayPort,SharedResourceTransactionWrite} from '../../ports/sharedRoomGateway'
import type {SharedCombatState,SharedPlayerActionState,SharedPlayerActionAckState,SharedPlayerActionProcessedState} from '../../lib/sharedCombatTypes'
import {getRoomSession} from '../../lib/roomSession'
import {encodeSecondChanceParentWire,decodeSecondChanceParentWire,type SecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {buildPlayerActionAck,buildPlayerActionProcessedState} from '../../lib/playerActionAck'
import {planDnd5eMapResultApplication} from '../../rulesets/dnd5e/mapBridge'
import {readSecondChancePreparedOriginalAsync,type SecondChancePreparedOriginal} from './secondChancePreparedParent'
import {settleDnd5eConcentrationChecks} from './settleDnd5eCombatResult'
import {projectHeadlessInitiativeOrder} from '../mapsPageHelpers'
import {projectDnd5eHeadlessTurnEconomy} from '../../rulesets/dnd5e/turnEconomy'
import {dnd5eOrdinaryAttacksUsed} from '../../rulesets/dnd5e/attackActionHistory'
import {readArmorNativeIssuedContext,restoreArmorNativeIssuedParent,resumeArmorNativeIssuedParent,type ArmorNativeIssuedParent} from './armorNativeRoomIssuer'
import {sameActivityParentData} from './postNativeActivityParent'

type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
type Rev={_sync?:{revision?:number}}
type Journal=Rev&{schemaVersion:1;parents:Record<string,Record<string,unknown>>}
const names=['maps','characters','combat','map-geometry','campaign-time'] as const
function revision(value:Rev|null){if(value===null)return 0;const n=value._sync?.revision;if(!Number.isSafeInteger(n)||n!<0)throw Error('armor-native:revision-required');return n!}
type BasePorts=Pick<Parameters<typeof settleDnd5eConcentrationChecks>[0],'rollD20'|'rollD4'|'rollDice'>
function readCompleted(record:Record<string,unknown>,session:{roomId:string;memberId:string}){
 if(record.phase!=='consumed'||!record.completed||record.roomId!==session.roomId||record.hostMemberId!==session.memberId)throw Error('armor-native:consumed-original-parent-required')
 const settlement=decodeSecondChanceParentWire(record.completed as SecondChanceParentWire) as Awaited<ReturnType<typeof settleDnd5eConcentrationChecks>>
 if(!settlement.result.ok||settlement.result.state.combatId!==record.combatId||settlement.application.map.id!==record.mapId)throw Error('armor-native:invalid-completion-witness')
 return settlement
}
/** Initial-load recovery reads the controller-private persisted completion. No
 * old WeakMap frame, session cache, dice request or new world baseline is used. */
export async function resumeArmorNativeRoomParent(id:string,ports:BasePorts,gateway:Gateway){
 const session=getRoomSession(),guard=()=>{const now=getRoomSession();if(!session||session.role!=='dm'||now?.role!=='dm'||now.roomId!==session.roomId||now.memberId!==session.memberId)throw Error('armor-native:authenticated-host-required')};guard()
 const journal=await gateway.loadResource<Journal>('armor-native-parents');guard()
 const record=journal?.parents[id];if(!record)throw Error('armor-native:issued-parent-required')
 if(record.phase==='consumed'){
  const settlement=readCompleted(record,session!),command=record.originalRoomAction as SharedPlayerActionState|undefined
  if(command?.sourceMode==='player'){
   const [ack,processed]=await Promise.all([gateway.loadResource<SharedPlayerActionAckState>('player-action-ack'),gateway.loadResource<SharedPlayerActionProcessedState>('player-action-processed')]);guard()
   if(!processed?.actionIds.includes(command.id)||ack?.actionId===command.id&&(ack.status!=='accepted'||ack.recipientMemberId!==command.roomMemberId))throw Error('armor-native:accepted-original-command-witness-required')
  }
  return{status:'published' as const,alreadyPublished:true,settlement}
 }
 return publishArmorNativeIssuedParent(await restoreArmorNativeIssuedParent(id,gateway),ports,gateway)
}
/** Ordinary native Armor parent publication. A death-trigger/other persistent
 * Activity tail remains suspended for its own explicit joint continuation;
 * it must never be silently omitted or published by a second HP transaction. */
export async function publishArmorNativeIssuedParent(parent:ArmorNativeIssuedParent,ports:BasePorts,gateway:Gateway){
 const session=getRoomSession(),guard=()=>{const now=getRoomSession();if(!session||session.role!=='dm'||now?.role!=='dm'||now.roomId!==session.roomId||now.memberId!==session.memberId)throw Error('armor-native:authenticated-host-required')};guard()
 const original=readArmorNativeIssuedContext(parent),id=original.record.id as string
 const before=await gateway.loadResource<Journal>('armor-native-parents');guard()
 const saved=before?.parents[id]
 const completed=(record:Record<string,unknown>)=>{if(record.parentTransactionId!==original.record.parentTransactionId)throw Error('armor-native:consumed-original-parent-required');return readCompleted(record,session!)}
 if(saved?.phase==='consumed')return{status:'published' as const,alreadyPublished:true,settlement:completed(saved)}
 const restored=await restoreArmorNativeIssuedParent(id,gateway),context=readArmorNativeIssuedContext(restored),native=await resumeArmorNativeIssuedParent(restored,gateway);guard()
 if(native.status!=='resolved')return native
 if(!native.result.result.ok)throw Error('armor-native:original-native-result-rejected')
 const result=native.result.result
 if(result.events.some(event=>event.type==='creature-died'))throw Error('armor-native:death-activity-joint-continuation-required')
 const prepared=await readSecondChancePreparedOriginalAsync(context.record.prepared as SecondChancePreparedOriginal);guard()
 const application=native.result.application??planDnd5eMapResultApplication({map:prepared.prepared.map,characters:prepared.prepared.characters,state:result.state,events:[...result.events],characterIdByCombatantId:prepared.prepared.characterIdByCombatantId})
 const settlement=await settleDnd5eConcentrationChecks({...ports,result,map:prepared.prepared.map,characters:prepared.prepared.characters,characterIdByCombatantId:prepared.prepared.characterIdByCombatantId,priorApplication:application,hostParentTransactionId:context.record.parentTransactionId as string});guard()
 // Source and all original mechanical revisions must still be current AFTER
 // the asynchronous Base prefix. CON cancellation publishes nothing.
 await restoreArmorNativeIssuedParent(id,gateway);guard()
 const values=await Promise.all(names.map(name=>gateway.loadResource<Rev>(name))),journal=await gateway.loadResource<Journal>('armor-native-parents');guard()
 if(names.some((name,index)=>revision(values[index])!==context.dependencies[name])||!sameActivityParentData(journal?.parents[id],context.record))throw Error('armor-native:original-parent-changed-before-publication')
 const maps=values[0] as Rev&{maps:typeof settlement.application.map[]},characters=values[1] as Rev&{characters:typeof settlement.application.characters},combat=values[2] as Rev&SharedCombatState
 const economy={...combat.dnd5eTurnEconomyByToken}
 for(const [token,actor] of Object.entries(settlement.result.state.combatants)){
  const prior=economy[token];if(!prior)continue
  let attacksUsed=prior.attacksUsed
  const after=actor.classState.attackActionHistory,before=prepared.prepared.state.combatants[token]?.classState.attackActionHistory
  if(settlement.result.state.initiativeOrder[settlement.result.state.initiativeIndex]===token&&after?.turnKey===prior.turnKey){
   const delta=after.attacksTaken-(before?.turnKey===after.turnKey&&before.actionOrdinal===after.actionOrdinal?before.attacksTaken:0)
   const projected=prior.attacksUsed+delta
   if(!Number.isSafeInteger(delta)||delta<0||!Number.isSafeInteger(projected)||!Number.isSafeInteger(dnd5eOrdinaryAttacksUsed(after,prior.turnKey,projected)))throw Error('armor-native:invalid-original-attack-history')
   attacksUsed=projected
  }
  economy[token]={...projectDnd5eHeadlessTurnEconomy(prior,actor.turn,actor.speed),attacksUsed}
 }
 const command=context.record.originalRoomAction as SharedPlayerActionState|undefined,player=command?.sourceMode==='player',now=Date.now()
 const [queue,ackBefore,processedBefore]=player?await Promise.all([gateway.loadResource<Rev&{requests:SharedPlayerActionState[]}>('player-action-requests'),gateway.loadResource<Rev&SharedPlayerActionAckState>('player-action-ack'),gateway.loadResource<Rev&SharedPlayerActionProcessedState>('player-action-processed')]):[null,null,null];guard()
 if(player&&!sameActivityParentData(queue?.requests.find(row=>row.id===command.id),command))throw Error('armor-native:original-command-changed')
 const wire=encodeSecondChanceParentWire(settlement),next={...journal,parents:{...journal!.parents,[id]:{...context.record,phase:'consumed',completed:wire}}}
 const writes:SharedResourceTransactionWrite[]=[
  {name:'maps',expectedRevision:context.dependencies.maps,data:{...maps,maps:maps.maps.map(row=>row.id===context.record.mapId?settlement.application.map:row)}},
  {name:'characters',expectedRevision:context.dependencies.characters,data:{...characters,characters:settlement.application.characters}},
  {name:'combat',expectedRevision:context.dependencies.combat,data:{...combat,round:settlement.result.state.round,initiativeOrder:projectHeadlessInitiativeOrder({current:combat.initiativeOrder,state:settlement.result.state}),initiativeIndex:settlement.result.state.initiativeIndex,dnd5eTurnEconomyByToken:economy,updatedAt:now}},
  {name:'armor-native-parents',expectedRevision:revision(journal),data:next},
 ]
 if(settlement.application.geometry)throw Error('armor-native:geometry-activity-joint-continuation-required')
 if(player)writes.push(
  {name:'player-action-requests',expectedRevision:revision(queue),data:{...queue,requests:queue!.requests.filter(row=>row.id!==command.id),updatedAt:now}},
  {name:'player-action-ack',expectedRevision:revision(ackBefore),data:buildPlayerActionAck({action:command,status:'accepted',mapId:command.mapId,combatId:command.combatId,round:settlement.result.state.round,initiativeIndex:settlement.result.state.initiativeIndex,appliedAt:now})},
  {name:'player-action-processed',expectedRevision:revision(processedBefore),data:buildPlayerActionProcessedState({action:command,current:processedBefore,updatedAt:now})},
 )
 const written=new Set(writes.map(row=>row.name))
 try{await gateway.saveResourcesAtomically(writes,{transactionId:'armor-native-publish:'+id,readRevisions:Object.fromEntries(Object.entries(context.dependencies).filter(([name])=>!written.has(name))),undoLabel:'提交原攻击与咒剑护甲反应'});guard()}
 catch(error){guard();const after=await gateway.loadResource<Journal>('armor-native-parents');guard();if(after?.parents[id]?.phase!=='consumed'||!sameActivityParentData(after.parents[id].completed,wire))throw error;completed(after.parents[id])}
 return{status:'published' as const,alreadyPublished:false,settlement}
}
