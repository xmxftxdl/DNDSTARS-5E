import {dnd5eEffectiveWalkSpeed,dnd5eHeadlessTurnKey,dnd5eCanActAtZeroHitPoints,resolveDnd5eHeadlessAction,resolveDnd5eDeferredMovementRepeatSaves,type Dnd5eCombatEvent,type Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import {dnd5eIsIncapacitated} from './passiveDefenses'
import {planDnd5eHitFollowContinuation,findDnd5eHitFollowOpportunityWindows} from './weaponHitFollowPlan'
import {prepareDnd5eHitFollowOpportunityAtCurrentPosition,type Dnd5eHitFollowOpportunityReceipt} from './weaponHitFollowOpportunity'
import {resolvePreparedDnd5eOpportunityAttack} from './opportunityAttackAction'
import {validMovementDestination} from './activities/dnd5eActivityMapInteraction'
import {tokenAnchorCellFromPixel} from '../../lib/gridCombat'
import type {resolveDnd5eHitFollowMovementAfterReactions} from './weaponHitFollowMovement'
import {mapGeometryRuntimeForMap,mapGeometryTerrainElevationAtPoint} from '../../lib/mapGeometry'
import {collectDnd5eHitFollowAreaCandidates} from './weaponHitFollowAreas'
import {prepareDnd5ePersistentAreaTrigger,resolvePreparedDnd5ePersistentAreaTrigger} from './pluginAreaTransactions'
import {dnd5ePersistentAreaMapChange} from './persistentAreaMapChanges'
import {dnd5eFailedAreaMovementCheckpoint} from './pluginAreas'
import type {Dnd5eAction} from './headlessCombatEngine'
import {previewDnd5eUnsupportedAirborneFalls,previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange,resolveDnd5eFeatherFallReaction,type Dnd5eActionResult} from './headlessCombatEngine'
import {planDnd5eMapResultApplication} from './mapBridge'
import {reconcileDnd5ePluginAreasOnMap} from './pluginAreas'
import {persistentAreaNeedsDmApproval} from './persistentAreaApproval'
import {replayDnd5eTempleMovementEntries} from './templeMovementReplay'
import type {Dnd5eForcedFallReactionReplay} from './templeMovementReplay'
import {prepareDnd5eHitFollowSpells,type Dnd5eHitFollowSpellRolls} from './weaponHitFollowSpell'
import {resolvePreparedDnd5eSpellCast} from './spellAction'
import {dnd5eAttackAttemptWardRequirements,type Dnd5eSpellcastingSavingThrowRoll} from './headlessCombatEngine'

type Input=Parameters<typeof resolveDnd5eHitFollowMovementAfterReactions>[0]&{characters?:Parameters<typeof planDnd5eHitFollowContinuation>[0]['characters']}
export function dnd5eHitFollowInterrupted(state:Dnd5eHeadlessCombatState,actorId:string){
 const actor=state.combatants[actorId]
 return actor.classState.movementStoppedTurnKey===dnd5eHeadlessTurnKey(state,actor.id)||
  actor.deathSaves.dead||dnd5eIsIncapacitated(actor)||
  (actor.currentHp<=0&&!dnd5eCanActAtZeroHitPoints(actor))||dnd5eEffectiveWalkSpeed(actor)<=0
}
/** Host-local staged movement. Snapshots never expose the temporary movement
 * allowance. The caller must settle opportunity windows before advancing past
 * them; this session itself neither authorizes nor publishes a follow. */
export function createDnd5eHitFollowMovementSession(input:Input){
 if(input.state.initiativeOrder[input.state.initiativeIndex]!==input.actorId)return {ok:false as const,reason:'follow-own-turn-required'}
 const plan=planDnd5eHitFollowContinuation({...input,characters:input.characters??[]})
 if(!plan.ok)return plan
 const path=structuredClone(plan.movement.path)
 const source=structuredClone(input.state)
 let map=structuredClone(plan.map),characters=structuredClone(plan.characters)
 const settledAreas=new Set<string>()
 const settled=new Set<string>()
 let state=structuredClone(source),index=0,spent=0,movementBlocked=false,finished=false
 const allowance=dnd5eEffectiveWalkSpeed(state.combatants[input.actorId])
 const ordinary={remaining:state.combatants[input.actorId].turn.movementRemaining,spent:state.combatants[input.actorId].turn.movementSpent}
 const events:Dnd5eCombatEvent[]=[]
 state.combatants[input.actorId].turn.reactionAvailable=false
 events.push({type:'turn-resource-spent',actorId:input.actorId,resource:'reaction'})
 const pending=()=>{
  const projected=planDnd5eMapResultApplication({state:structuredClone(state),map:structuredClone(map),characters:structuredClone(characters),
   characterIdByCombatantId:Object.fromEntries(map.tokens.flatMap(token=>token.characterId&&!token.dnd5eSimulacrum?[[token.id,token.characterId]]:[])),events:[]})
  return findDnd5eHitFollowOpportunityWindows({state,map:projected.map,characters:projected.characters,actorId:input.actorId,path,
   pathElevationsFeet:plan.movement.pathElevationsFeet}).filter(window=>!settled.has(window.attacker.id)&&window.pathSegmentIndex+(window.trigger==='leave-reach'?0:1)>=index)
 }
 const pendingAreas=()=>collectDnd5eHitFollowAreaCandidates({state,map,actorId:input.actorId,path,
  pathElevationsFeet:plan.movement.pathElevationsFeet,pathIndex:index}).filter(candidate=>!settledAreas.has(candidate.transactionId))
 const pendingConcentration=()=>events.flatMap((event,eventIndex)=>event.type==='concentration-check-required'&&!event.settled&&state.combatants[event.targetId]?.concentrating?[{eventIndex,targetId:event.targetId,dc:event.dc,transactionId:JSON.stringify(['hit-follow-concentration',state.combatId,dnd5eHeadlessTurnKey(source,input.actorId),input.actorId,input.targetId,path[0],eventIndex])}]:[])
 const snapshot=()=>({state:structuredClone(state),map:structuredClone(map),characters:structuredClone(characters),events:structuredClone(events),pathIndex:index,remainingFeet:Math.max(0,allowance-spent),opportunities:structuredClone(pending()),areas:structuredClone(pendingAreas()),concentrationChecks:pendingConcentration(),movementBlocked})
 type ConcentrationReceipt={eventIndex:number;rolls:Omit<Extract<Dnd5eAction,{type:'concentration-save'}>,'type'|'actorId'|'dc'>&{fallReactions?:readonly Dnd5eForcedFallReactionReplay[]}}
 const concentrationFallOptions=(receipt:ConcentrationReceipt,capture?:(value:Dnd5eHeadlessCombatState)=>void)=>({beforeAirborneFalls:(result:Dnd5eActionResult):Dnd5eActionResult=>{
  if(!result.ok)return result
  let current=result.state
  const reactionEvents:Dnd5eCombatEvent[]=[]
  for(const choice of receipt.rolls.fallReactions??[]){
   const falls=previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(state,current)
   if(!choice.targetIds.length||new Set(choice.targetIds).size!==choice.targetIds.length||choice.targetIds.some(id=>!falls.some(fall=>fall.combatantId===id)))
    return {ok:false,state,events:[],reason:'invalid-target'}
   const reaction=resolveDnd5eFeatherFallReaction(current,{casterId:choice.casterId,spellcastingSavingThrows:choice.spellcastingSavingThrows,
    falls:choice.targetIds.map(id=>falls.find(fall=>fall.combatantId===id)!)})
   if(!reaction.ok)return {ok:false,state,events:[],reason:reaction.reason}
   current=reaction.state;reactionEvents.push(...reaction.events)
  }
  capture?.(structuredClone(current))
  return {...result,state:current,events:[...result.events,...reactionEvents]}
 }})
 const previewConcentration=(receipt:ConcentrationReceipt)=>{
  if(finished)return {ok:false as const,reason:'follow-movement-finished'}
  const check=pendingConcentration()[0]
  if(!check||check.eventIndex!==receipt.eventIndex)return {ok:false as const,reason:'follow-concentration-receipt-mismatch'}
  let provisional=structuredClone(state)
  const {fallReactions:_,...rolls}=receipt.rolls
  const preview=previewDnd5eUnsupportedAirborneFalls(state,{...rolls,type:'concentration-save',actorId:check.targetId,dc:check.dc},
   {transactionId:check.transactionId},concentrationFallOptions(receipt,value=>{provisional=value}))
  return preview.ok?{...preview,state:provisional}:preview
 }
 const settleConcentration=(receipt:ConcentrationReceipt)=>{
  if(finished)return {ok:false as const,reason:'follow-movement-finished'}
  const check=pendingConcentration()[0]
  if(!check||check.eventIndex!==receipt.eventIndex)return {ok:false as const,reason:'follow-concentration-receipt-mismatch'}
  const {fallReactions:_,...rolls}=receipt.rolls
  const resolved=resolveDnd5eHeadlessAction(state,{...rolls,type:'concentration-save',actorId:check.targetId,dc:check.dc},{transactionId:check.transactionId},concentrationFallOptions(receipt))
  if(!resolved.ok)return {ok:false as const,reason:resolved.reason}
  if(previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(state,resolved.state).length)return {ok:false as const,reason:'follow-concentration-fall-settlement-required'}
  const projected=planDnd5eMapResultApplication({state:resolved.state,map:structuredClone(map),characters,
   characterIdByCombatantId:Object.fromEntries(map.tokens.flatMap(token=>token.characterId&&!token.dnd5eSimulacrum?[[token.id,token.characterId]]:[])),events:[...resolved.events]})
  const nextMap=reconcileDnd5ePluginAreasOnMap(projected.map,projected.characters,resolved.state.round)
  const mapChange=dnd5ePersistentAreaMapChange(map,nextMap)
  state=resolved.state
  map=nextMap;characters=projected.characters
  if(state.companionScene?.map.id===map.id)state.companionScene.map={...state.companionScene.map,dnd5ePluginAreas:structuredClone(map.dnd5ePluginAreas)}
  events[check.eventIndex]={type:'concentration-check-required',targetId:check.targetId,dc:check.dc,settled:true}
  events.push(...resolved.events,...(mapChange?[mapChange]:[]))
  return {ok:true as const,...snapshot()}
 }
 const prepareArea=()=>{
  const candidate=pendingAreas()[0]
  if(!candidate)return {ok:false as const,reason:'follow-area-not-found'}
  return prepareDnd5ePersistentAreaTrigger({map,characters,combatId:state.combatId,round:state.round,
   worldMinute:state.companionScene?.worldMinute,candidate,
   initiativeOrder:state.initiativeOrder.map((id,order)=>({tokenId:id,label:state.combatants[id].name,emoji:'',color:'',roll:-order}))},state)
 }
 const settleArea=(receipt:{transactionId:string;rolls:Omit<Parameters<typeof resolvePreparedDnd5ePersistentAreaTrigger>[0],'prepared'>&{
  skip?:'source-selection'|'dm-adjudication';movement?:Pick<Parameters<typeof replayDnd5eTempleMovementEntries>[0],'entryReplays'|'landings'|'fallReactions'>}})=>{
  if(finished)return {ok:false as const,reason:'follow-movement-finished'}
  if(pendingConcentration().length)return {ok:false as const,reason:'follow-concentration-settlement-required'}
  const ready=prepareArea()
  if(!ready.ok)return ready
  if(receipt.transactionId!==ready.prepared.candidate.transactionId)return {ok:false as const,reason:'follow-area-receipt-mismatch'}
  if(receipt.rolls.skip!=null){
   const candidate=ready.prepared.candidate
   const allowed=receipt.rolls.skip==='source-selection'?candidate.trigger.sourceChoosesTargets===true:
    receipt.rolls.skip==='dm-adjudication'&&persistentAreaNeedsDmApproval(candidate.area.coreSpellId,candidate.trigger.dmAdjustable)
   if(!allowed||Object.keys(receipt.rolls).length!==1)return {ok:false as const,reason:'invalid-follow-area-skip'}
   settledAreas.add(receipt.transactionId)
   return {ok:true as const,...snapshot()}
  }
  let resolved=resolvePreparedDnd5ePersistentAreaTrigger({...receipt.rolls,prepared:ready.prepared})
  if(!resolved.result.ok)return {ok:false as const,reason:resolved.result.reason}
  if(!resolved.application)return {ok:false as const,reason:'follow-area-application-required'}
  const moved=resolved.result.events.some(event=>event.type==='moved')
  if(moved){
   if(!receipt.rolls.movement||receipt.rolls.movement.landings==null)return {ok:false as const,reason:'follow-area-movement-receipts-required'}
   if(resolved.result.events.some(event=>event.type==='moved'&&event.movementKind!=='forced'))return {ok:false as const,reason:'follow-area-movement-kind-unsupported'}
   const replay=replayDnd5eTempleMovementEntries({...receipt.rolls.movement,state:resolved.result.state,map:resolved.application.map,events:resolved.result.events})
   if(!replay.ok)return replay
   const application=planDnd5eMapResultApplication({state:replay.state,map:resolved.application.map,characters:resolved.application.characters,
    characterIdByCombatantId:ready.prepared.characterIdByCombatantId,events:replay.events})
   resolved={...resolved,result:{...resolved.result,state:replay.state,events:replay.events},application}
  }else if(receipt.rolls.movement)return {ok:false as const,reason:'unused-follow-area-movement-receipts'}
  if(!resolved.result.ok||!resolved.application)return {ok:false as const,reason:'follow-area-application-required'}
  if(previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(state,resolved.result.state).length)return {ok:false as const,reason:'follow-area-fall-settlement-required'}
  const mapChange=dnd5ePersistentAreaMapChange(map,resolved.application.map)
  state=resolved.result.state;map=resolved.application.map;characters=resolved.application.characters
  if(state.companionScene?.map.id===map.id)state.companionScene.map={...state.companionScene.map,dnd5ePluginAreas:structuredClone(map.dnd5ePluginAreas)}
  events.push(...resolved.result.events,...(mapChange?[mapChange]:[]));settledAreas.add(receipt.transactionId)
  const actor=state.combatants[input.actorId]
  const token=map.tokens.find(token=>token.id===input.actorId)
  const stopped=token&&dnd5eFailedAreaMovementCheckpoint({map,token,candidates:[ready.prepared.candidate],events:resolved.result.events})
  if(stopped||actor.position.x!==path[index].x||actor.position.y!==path[index].y)movementBlocked=true
  return {ok:true as const,...snapshot()}
 }
 const prepareOpportunitySpells=(attackerId:string,spellState=state)=>prepareDnd5eHitFollowSpells({state:spellState,map,characters,attackerId,targetId:input.actorId,
  transactionId:JSON.stringify(['hit-follow-spell',state.combatId,dnd5eHeadlessTurnKey(source,input.actorId),input.actorId,input.targetId,path[0],index,attackerId])})
 const settleOpportunity=(receipt:Omit<Dnd5eHitFollowOpportunityReceipt,'rolls'>&{wardSaves?:readonly Dnd5eSpellcastingSavingThrowRoll[]}&({declined:true}|{declined:false;kind?:'weapon';rolls:Dnd5eHitFollowOpportunityReceipt['rolls']}|{declined:false;kind:'spell';optionId:string;rolls:Dnd5eHitFollowSpellRolls}))=>{
  if(finished||movementBlocked)return {ok:false as const,reason:'follow-movement-finished'}
  if(pendingConcentration().length)return {ok:false as const,reason:'follow-concentration-settlement-required'}
  if(pendingAreas().length)return {ok:false as const,reason:'follow-area-settlement-required'}
  const window=pending().find(candidate=>candidate.attacker.id===receipt.attackerId),received=receipt.window
  if(!window)return {ok:false as const,reason:'follow-opportunity-not-found'}
  if(receipt.declined!==true&&receipt.declined!==false)return {ok:false as const,reason:'invalid-follow-opportunity-choice'}
  if(!received||received.pathSegmentIndex!==window.pathSegmentIndex||received.trigger!==window.trigger||
   !received.position||received.position.x!==window.position.x||received.position.y!==window.position.y||received.position.elevationFeet!==window.position.elevationFeet)
   return {ok:false as const,reason:'follow-opportunity-window-changed'}
  const mover=state.combatants[input.actorId]
  if(index!==window.pathSegmentIndex+(window.trigger==='leave-reach'?0:1)||
   mover.position.x!==window.position.x||mover.position.y!==window.position.y||(mover.elevationFeet??0)!==window.position.elevationFeet)
   return {ok:false as const,reason:'follow-opportunity-position-not-reached'}
  let opportunityState=state
  const wardEvents:Dnd5eCombatEvent[]=[]
  if(receipt.wardSaves!=null){
   const checked=resolveDnd5eHeadlessAction(state,{type:'attack-ward-attempt',actorId:receipt.attackerId,targetId:input.actorId,
    turnKey:dnd5eHeadlessTurnKey(state,receipt.attackerId),saves:receipt.wardSaves})
   if(!checked.ok)return {ok:false as const,reason:checked.reason}
   opportunityState=checked.state;wardEvents.push(...checked.events)
   if(!dnd5eAttackAttemptWardRequirements(opportunityState,receipt.attackerId,input.actorId).every(entry=>entry.receipt?.success===true)){
    if(receipt.declined!==true)return {ok:false as const,reason:'follow-opportunity-ward-blocked'}
    state=opportunityState;events.push(...wardEvents);settled.add(receipt.attackerId)
    return {ok:true as const,...snapshot()}
   }
  }
  const ready=prepareDnd5eHitFollowOpportunityAtCurrentPosition({state:opportunityState,map,characters,actorId:input.actorId,attackerId:receipt.attackerId})
  if(receipt.declined===true&&ready.ok&&ready.prepared.mandatory)return {ok:false as const,reason:'follow-opportunity-mandatory'}
  if(receipt.declined!==true){
   if(!ready.ok)return ready
   if(receipt.kind==='spell'&&ready.prepared.mandatory)return {ok:false as const,reason:'follow-opportunity-mandatory'}
   const spell=receipt.kind==='spell'?prepareOpportunitySpells(receipt.attackerId,opportunityState).find(option=>option.id===receipt.optionId):undefined
   if(receipt.kind==='spell'&&!spell)return {ok:false as const,reason:'follow-opportunity-spell-unavailable'}
   const resolved=receipt.kind==='spell'
    ?resolvePreparedDnd5eSpellCast({...receipt.rolls,prepared:spell!.prepared,opportunityAttackSpell:true})
    :resolvePreparedDnd5eOpportunityAttack({...receipt.rolls,prepared:ready.prepared})
   if(!resolved.result.ok)return {ok:false as const,reason:resolved.result.reason}
   if(resolved.airborneFalls?.length)return {ok:false as const,reason:'follow-opportunity-fall-settlement-required'}
   if(receipt.kind==='spell'&&resolved.result.events.some(event=>event.type==='moved'))return {ok:false as const,reason:'follow-opportunity-spell-movement-settlement-required'}
   if(receipt.kind==='spell'&&resolved.application){
    const change=dnd5ePersistentAreaMapChange(map,resolved.application.map)
    map=resolved.application.map;characters=resolved.application.characters
    if(change)events.push(change)
   }
   state=resolved.result.state;events.push(...wardEvents,...resolved.result.events)
   ordinary.remaining=state.combatants[input.actorId].turn.movementRemaining
   ordinary.spent=state.combatants[input.actorId].turn.movementSpent
  }else{state=opportunityState;events.push(...wardEvents)}
  settled.add(receipt.attackerId)
  return {ok:true as const,...snapshot()}
 }
 const advance=(toPathIndex:number,rollsByPathIndex?:Readonly<Record<number,Input['rolls']>>)=>{
  if(finished)return {ok:false as const,reason:'follow-movement-finished'}
  if(pendingConcentration().length)return {ok:false as const,reason:'follow-concentration-settlement-required'}
  if(pendingAreas().length)return {ok:false as const,reason:'follow-area-settlement-required'}
  if(movementBlocked)return {ok:false as const,reason:'follow-movement-blocked'}
  if(!Number.isInteger(toPathIndex)||toPathIndex<index||toPathIndex>=path.length)return {ok:false as const,reason:'invalid-follow-path-index'}
  if(pending().some(window=>(window.pathSegmentIndex+(window.trigger==='leave-reach'?0:1))<toPathIndex))
   return {ok:false as const,reason:'follow-opportunity-settlement-required'}
  // Build the entire requested interval in a private copy. A missing save or
  // invalid segment must not partially alter the session before a replay.
  let working=structuredClone(state),nextSpent=spent
  const intervalEvents:Dnd5eCombatEvent[]=[]
  for(let step=index+1;step<=toPathIndex;step++){
   const actor=working.combatants[input.actorId]
   if(actor.classState.movementStoppedTurnKey===dnd5eHeadlessTurnKey(working,actor.id))return {ok:false as const,reason:'follow-movement-stopped'}
   const projected={...map,tokens:map.tokens.map(token=>{
    const combatant=working.combatants[token.id]
    return combatant?{...token,...combatant.position,elevationFeet:combatant.elevationFeet??token.elevationFeet}:token
   })}
   const token=projected.tokens.find(candidate=>candidate.id===input.actorId)
   if(!token)return {ok:false as const,reason:'missing-map-token'}
   const point=path[step]
   const remaining=Math.max(0,Math.min(allowance,dnd5eEffectiveWalkSpeed(actor))-nextSpent)
   const segment=validMovementDestination({map:projected,actorToken:token,targetToken:token,
    destination:tokenAnchorCellFromPixel(point.x,point.y,token,projected),mode:'voluntary',
    distanceFeet:remaining,maximumMovementCostFeet:remaining,requiresDifferentDestination:true})
   if(!segment||segment.path.length!==2||segment.path[0].x!==path[step-1].x||segment.path[0].y!==path[step-1].y||
    segment.position.x!==point.x||segment.position.y!==point.y)return {ok:false as const,reason:'follow-path-changed'}
   actor.turn.movementRemaining=remaining;actor.turn.movementSpent=nextSpent
   const distance=Math.max(Math.abs(point.x-actor.position.x),Math.abs(point.y-actor.position.y))/map.gridSize*Math.max(1,map.feetPerCell??5)
   const toElevationFeet=segment.pathElevationsFeet?.at(-1)??segment.position.elevationFeet
   const toGroundElevationFeet=mapGeometryTerrainElevationAtPoint(mapGeometryRuntimeForMap(map.id),point)
   const moved=resolveDnd5eHeadlessAction(working,{...rollsByPathIndex?.[step],type:'move',actorId:input.actorId,to:segment.position,
    distance,movementCost:segment.movementCostFeet,traversalMode:'walk',jumpPath:segment.path,toElevationFeet,toGroundElevationFeet},{},{deferMovementRepeatSavingThrows:true})
   if(!moved.ok)return {ok:false as const,reason:moved.reason}
   if(moved.movementBlocked){
    const stopped=moved.state.combatants[input.actorId]
    stopped.turn.movementRemaining=ordinary.remaining;stopped.turn.movementSpent=ordinary.spent
    state=moved.state;spent=nextSpent;index=step-1;movementBlocked=true
    events.push(...intervalEvents,...moved.events)
    return {ok:true as const,...snapshot()}
   }
   working=moved.state;nextSpent+=segment.movementCostFeet;intervalEvents.push(...moved.events)
   const updated=working.combatants[input.actorId]
   updated.turn.movementRemaining=ordinary.remaining;updated.turn.movementSpent=ordinary.spent
   // A boundary effect can cancel/redirect the move. Never silently start the
   // next segment from the planned point rather than the resolved position.
   if(updated.position.x!==point.x||updated.position.y!==point.y)return {ok:false as const,reason:'follow-position-changed'}
   if(collectDnd5eHitFollowAreaCandidates({state:working,map:projected,actorId:input.actorId,path,
    pathElevationsFeet:plan.movement.pathElevationsFeet,pathIndex:step}).length){
    state=working;spent=nextSpent;index=step;events.push(...intervalEvents)
    return {ok:true as const,...snapshot()}
   }
  }
  state=working;spent=nextSpent;index=toPathIndex;events.push(...intervalEvents)
  return {ok:true as const,...snapshot()}
 }
 const finish=(rolls?:NonNullable<Input['rolls']>['movementRepeatSavingThrows'])=>{
  if(finished)return {ok:false as const,reason:'follow-movement-finished'}
  if(pendingConcentration().length)return {ok:false as const,reason:'follow-concentration-settlement-required'}
  if(pendingAreas().length)return {ok:false as const,reason:'follow-area-settlement-required'}
  if(!movementBlocked&&!dnd5eHitFollowInterrupted(state,input.actorId)&&(index<path.length-1||pending().length))return {ok:false as const,reason:'follow-movement-incomplete'}
  const saved=resolveDnd5eDeferredMovementRepeatSaves(state,input.actorId,index>0,rolls)
  if(!saved.ok)return {ok:false as const,reason:saved.reason}
  state=saved.state;events.push(...saved.events);finished=true
  return {ok:true as const,...snapshot()}
 }
 return {ok:true as const,path:structuredClone(path),pathElevationsFeet:structuredClone(plan.movement.pathElevationsFeet),snapshot,advance,prepareOpportunitySpells,settleOpportunity,prepareArea,settleArea,previewConcentration,settleConcentration,finish}
}

