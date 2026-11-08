import{ArcaneBaseChoicePending,settleArcaneBasePrefix,readArcaneBasePrefixReady,type ArcaneBasePrefixTransport,type ArcaneBasePrefixUi}from'./arcaneBasePrefixRolls'
import type{SharedRoomGatewayPort,SharedResourceTransactionWrite}from'../../ports/sharedRoomGateway'
import{buildPlayerActionAck,buildPlayerActionProcessedState}from'../../lib/playerActionAck'
import type{SharedPlayerActionState,SharedPlayerActionAckState,SharedPlayerActionProcessedState}from'../../lib/sharedCombatTypes'
import type{SharedCombatState}from'../../lib/sharedCombatTypes'
import{getRoomSession}from'../../lib/roomSession'
import{encodeSecondChanceParentWire,decodeSecondChanceParentWire,type SecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{createDnd5eTurnEconomyCounts,projectDnd5eHeadlessTurnEconomy}from'../../rulesets/dnd5e/turnEconomy'
import{projectHeadlessInitiativeOrder}from'../mapsPageHelpers'
import{listDnd5eActivityTriggerWindowsV1}from'../../rulesets/dnd5e/activities/dnd5eActivityTriggerWindows'
import{restoreArcaneNativeIssuedParent,resumeArcaneNativeIssuedParent,readArcaneNativeIssuedParent}from'./arcaneNativeRoomIssuer'
import{sameArcaneNativeData}from'./arcaneNativeIdentity'
import{readArcaneNativeCheckpointContext}from'./arcaneNativeRoomIssuer'
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
type Rev={_sync?:{revision?:number}}
type Journal=Rev&{schemaVersion:1;parents:Record<string,Record<string,unknown>>}
const names=['maps','characters','combat','map-geometry','campaign-time']as const
function revision(value:Rev|null){if(value===null)return 0;const n=value._sync?.revision;if(!Number.isSafeInteger(n)||n!<0)throw Error('arcane-native:original-revision-required');return n!}
function onlyNewAuthenticatedOwnerChoices(before:Record<string,unknown>,after:Record<string,unknown>|undefined){
 if(!after)return false
 let added=false
 const compare=(prior:Record<string,unknown>,next:Record<string,unknown>,checkpointId?:string)=>{
  if(!['arcane','shroud'].includes(prior.phase as string)||!['arcane','shroud'].includes(next.phase as string)||prior.phase==='shroud'&&next.phase!=='shroud')return false
  const immutable=(row:Record<string,unknown>)=>({...row,phase:undefined,arcaneChoice:undefined,shroudChoice:undefined})
  if(!sameArcaneNativeData(immutable(prior),immutable(next)))return false
  for(const[key,stage]of[['arcaneChoice','arcane'],['shroudChoice','shroud']]as const){
   if(prior[key]!==undefined){if(!sameArcaneNativeData(prior[key],next[key]))return false;continue}
   if(next[key]===undefined)continue
   const choice=next[key]as Record<string,unknown>|null
   if(!choice||choice.parentId!==before.id||choice.checkpointId!==checkpointId||choice.stage!==stage||choice.authenticatedSubmitterMemberId!==prior.controllerMemberId||choice.transport!=='authenticated-room-member'||!['use','decline'].includes(choice.decision as string))return false
   added=true
  }
  return true
 }
 const priorSteps=before.checkpoints,nextSteps=after.checkpoints
 if(priorSteps!==undefined||nextSteps!==undefined){
  if(!Array.isArray(priorSteps)||!Array.isArray(nextSteps)||priorSteps.length!==nextSteps.length)return false
  for(let i=0;i<priorSteps.length;i++){
   const prior=priorSteps[i]as Record<string,unknown>,next=nextSteps[i]as Record<string,unknown>
   if(!prior||!next||typeof prior.id!=='string'||!compare(prior,next,prior.id))return false
  }
 }
 if(!compare({...before,checkpoints:undefined},{...after,checkpoints:undefined}))return false
 return added
}
/** Finite ordinary-DM publisher. Unknown material/Base/SC/death/PC-command
 * continuations stay blocked instead of silently publishing a partial parent. */
export async function publishArcaneNativeRoomParent(id:string,gateway:Gateway,prefixPorts?:{transport:ArcaneBasePrefixTransport;ui:ArcaneBasePrefixUi}){
 const session=getRoomSession(),guard=()=>{const current=getRoomSession();if(!session||session.role!=='dm'||current?.role!=='dm'||current.roomId!==session.roomId||current.memberId!==session.memberId)throw Error('arcane-native:authenticated-host-required')};guard()
 let choiceSnapshotRetry=0
 for(;;){
 const stored=await gateway.loadResource<Journal>('arcane-native-parents');guard();const saved=stored?.parents[id]
 if(!saved||saved.roomId!==session!.roomId||saved.hostMemberId!==session!.memberId)throw Error('arcane-native:issued-parent-required')
 if(saved.phase==='consumed'){const command=saved.originalRoomAction as SharedPlayerActionState;if(command?.sourceMode==='player'){const[ack,processed]=await Promise.all([gateway.loadResource<SharedPlayerActionAckState>('player-action-ack'),gateway.loadResource<SharedPlayerActionProcessedState>('player-action-processed')]);guard();if(!processed?.actionIds.includes(command.id)||ack?.actionId===command.id&&(ack.status!=='accepted'||ack.recipientMemberId!==command.roomMemberId))throw Error('arcane-native:accepted-original-command-witness-required')}return{status:'published' as const,alreadyPublished:true,settlement:decodeSecondChanceParentWire(saved.completed as SecondChanceParentWire)}}
 const parent=await restoreArcaneNativeIssuedParent(id,gateway),context=readArcaneNativeIssuedParent(parent),native=await resumeArcaneNativeIssuedParent(parent,gateway);guard()
 if(native.status!=='resolved')return native
 let envelope=native.result
 let prefixWrite:SharedResourceTransactionWrite|undefined
 if(envelope.result.ok&&envelope.result.events.some(event=>event.type==='concentration-check-required'&&!event.settled)){if(!prefixPorts)throw Error('arcane-native:base-prefix-joint-required');let ready:Awaited<ReturnType<typeof settleArcaneBasePrefix>>;try{ready=await settleArcaneBasePrefix(parent,gateway,prefixPorts.transport,prefixPorts.ui)}catch(error){if(error instanceof ArcaneBaseChoicePending)return{status:error.phase==='shroud'?'pending-shroud-choice' as const:'pending-owner-choice' as const,parentId:error.parentId,checkpointId:error.checkpointId};throw error}const prefix=await readArcaneBasePrefixReady(parent,ready);envelope={...envelope,result:prefix.settlement.result,application:prefix.settlement.application};prefixWrite=prefix.write}
 const result=envelope.result
 if(!result.ok)throw Error('arcane-native:original-result-rejected:'+result.reason)
 if(result.events.some(event=>event.type==='concentration-check-required'&&!event.settled&&!prefixWrite||event.type==='creature-died'))throw Error('arcane-native:base-prefix-joint-required')
 if(listDnd5eActivityTriggerWindowsV1({state:result.state,events:result.events,eventBatchId:context.record.parentTransactionId as string}).some(window=>window.available.length))throw Error('arcane-native:activity-tail-joint-required')
 if(!envelope.application||envelope.application.geometry)throw Error('arcane-native:actual-simple-application-required')
 const application=envelope.application,values=await Promise.all(names.map(name=>gateway.loadResource<Rev>(name))),journal=await gateway.loadResource<Journal>('arcane-native-parents');guard()
 if(names.some((name,index)=>revision(values[index])!==context.dependencies[name]))throw Error('arcane-native:original-world-changed-before-publication')
 if(!sameArcaneNativeData(journal?.parents[id],saved)){
  // A separately authenticated choice may arrive between the first snapshot
  // and genuine native replay. Discard this result and revalidate the complete
  // original once; every world/source/owner guard and final row equality stays.
  if(choiceSnapshotRetry===0&&onlyNewAuthenticatedOwnerChoices(saved,journal?.parents[id])){choiceSnapshotRetry++;continue}
  throw Error('arcane-native:original-world-changed-before-publication')
 }
 const command=context.record.originalRoomAction as SharedPlayerActionState,player=command?.sourceMode==='player',now=Date.now();if(!player&&command?.sourceMode!=='dm'&&!context.record.nativeHostOriginal)throw Error('arcane-native:original-command-required')
 const[queue,ackBefore,processedBefore]=player?await Promise.all([gateway.loadResource<Rev&{requests:SharedPlayerActionState[]}>('player-action-requests'),gateway.loadResource<Rev&SharedPlayerActionAckState>('player-action-ack'),gateway.loadResource<Rev&SharedPlayerActionProcessedState>('player-action-processed')]):[null,null,null];guard();if(player&&!sameArcaneNativeData(queue?.requests.find(row=>row.id===command.id),command))throw Error('arcane-native:original-command-changed')
 const maps=values[0]as Rev&{maps:typeof application.map[]},characters=values[1]as Rev&{characters:typeof application.characters},combat=values[2]as Rev&SharedCombatState,economy={...combat.dnd5eTurnEconomyByToken},baseline=readArcaneNativeCheckpointContext(parent).baseline
 for(const[token,actor]of Object.entries(result.state.combatants)){
  const originalActor=baseline.combatants[token];if(!originalActor)throw Error('arcane-native:canonical-original-actor-required')
  // The ordinary room initializes counted pools lazily. Materialize only an
  // absent entry from the genuine captured original turn, preserving spent
  // flags and movement; never replace an existing canonical pool.
  const activeSlot=combat.initiativeOrder[combat.initiativeIndex]
  const originalPoolTurnKey=`${combat.combatId}:${combat.round}:${activeSlot?.tokenId===token?activeSlot.slotId??token:token}`
  const before=economy[token]??projectDnd5eHeadlessTurnEconomy(createDnd5eTurnEconomyCounts(originalPoolTurnKey,originalActor.speed),originalActor.turn,originalActor.speed)
  const currentHistory=actor.classState.attackActionHistory,priorHistory=baseline.combatants[token]?.classState.attackActionHistory
  let attacksUsed=before.attacksUsed
  if(result.state.initiativeOrder[result.state.initiativeIndex]===token&&currentHistory?.turnKey===before.turnKey){const delta=currentHistory.attacksTaken-(priorHistory?.turnKey===currentHistory.turnKey&&priorHistory.actionOrdinal===currentHistory.actionOrdinal?priorHistory.attacksTaken:0);if(!Number.isSafeInteger(delta)||delta<0)throw Error('arcane-native:invalid-actual-attack-history');attacksUsed+=delta}
  economy[token]={...projectDnd5eHeadlessTurnEconomy(before,actor.turn,actor.speed),attacksUsed}
 }
 const completed=encodeSecondChanceParentWire({result,application}),next={...journal,parents:{...journal!.parents,[id]:{...saved,phase:'consumed',completed}}},writes:SharedResourceTransactionWrite[]=[
  {name:'maps',expectedRevision:context.dependencies.maps,data:{...maps,maps:maps.maps.map(map=>map.id===context.record.mapId?application.map:map)}},
  {name:'characters',expectedRevision:context.dependencies.characters,data:{...characters,characters:application.characters}},
  {name:'combat',expectedRevision:context.dependencies.combat,data:{...combat,round:result.state.round,initiativeOrder:projectHeadlessInitiativeOrder({current:combat.initiativeOrder,state:result.state}),initiativeIndex:result.state.initiativeIndex,dnd5eTurnEconomyByToken:economy,updatedAt:Date.now()}},
  {name:'arcane-native-parents',expectedRevision:revision(journal),data:next},
 ]
 if(prefixWrite)writes.push(prefixWrite)
 if(player)writes.push({name:'player-action-requests',expectedRevision:revision(queue),data:{...queue,requests:queue!.requests.filter(row=>row.id!==command.id),updatedAt:now}},{name:'player-action-ack',expectedRevision:revision(ackBefore),data:buildPlayerActionAck({action:command,status:'accepted',mapId:command.mapId,combatId:command.combatId,round:result.state.round,initiativeIndex:result.state.initiativeIndex,appliedAt:now})},{name:'player-action-processed',expectedRevision:revision(processedBefore),data:buildPlayerActionProcessedState({action:command,current:processedBefore,updatedAt:now})})
 try{await gateway.saveResourcesAtomically(writes,{transactionId:'arcane-native-publish:'+id,readRevisions:{'map-geometry':context.dependencies['map-geometry'],'campaign-time':context.dependencies['campaign-time']}});guard()}
 catch(error){guard();const after=await gateway.loadResource<Journal>('arcane-native-parents');guard();if(after?.parents[id]?.phase!=='consumed'||!sameArcaneNativeData(after.parents[id].completed,completed))throw error}
 return{status:'published' as const,alreadyPublished:false,settlement:{result,application}}
 }
}
