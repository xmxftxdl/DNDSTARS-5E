import type { Dnd5eActionResult, Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { createDnd5eRegisteredDeathSaveSession, listDnd5eDeathSaveActivityCandidates, type Dnd5eDeathSaveActivityCandidate } from './deathSaveActivity'
import { listRegisteredDnd5eActivityPackages } from './activities/dnd5eActivityRegistry'
import { rollDnd5eActivityTriggerDiceV1, type Dnd5eActivityTriggerRollRequestV1 } from './activities/dnd5eActivityTriggerSettlement'

export type Dnd5eDeathSaveReactionDecision =
  | {kind:'decline'|'cancel'}
  | {kind:'replace';packageId:string;activityId:string;targetIds:readonly string[];choices?:Readonly<Record<string,string>>}

export type Dnd5eDeathSaveReactionResult =
  | {status:'declined'|'cancelled'}
  | {status:'replaced';result:Dnd5eActionResult}

/** Before any death-save or next-turn dice. The caller alone publishes the final
 * result after checking its room revision. Decline authorizes normal dice later;
 * cancellation, stale authority and failed replacements never fall through. */
export async function resolveDnd5eDeathSaveReaction(input:{
  state:Dnd5eHeadlessCombatState
  actorId:string
  combatRevision:number
  authorityUnchanged:()=>boolean
  choose:(request:{actorId:string;eventId:string;state:Dnd5eHeadlessCombatState;candidates:readonly Dnd5eDeathSaveActivityCandidate[]})=>Promise<Dnd5eDeathSaveReactionDecision>
  roll:(request:Dnd5eActivityTriggerRollRequestV1)=>Promise<readonly number[]>
}):Promise<Dnd5eDeathSaveReactionResult>{
  const state=structuredClone(input.state),signature=JSON.stringify(listRegisteredDnd5eActivityPackages())
  const stateSignature=JSON.stringify(input.state)
  const guard=()=>{
    if(!input.authorityUnchanged() || JSON.stringify(input.state)!==stateSignature ||
      JSON.stringify(listRegisteredDnd5eActivityPackages())!==signature)throw Error('death-save-reaction-stale-authority')
  }
  guard()
  let candidates=listDnd5eDeathSaveActivityCandidates(state,input.actorId)
  if(!candidates.length)return {status:'declined'}
  let checkpointState=state
  const session=createDnd5eRegisteredDeathSaveSession(state,{type:'death-save',actorId:input.actorId,d20:0},(_checkpoint,snapshot,available)=>{
    checkpointState=structuredClone(snapshot);candidates=structuredClone([...available]);return candidates.length>0
  })
  try{
    const pending=session.run(state)
    if(pending.status!=='pending')throw Error('death-save-reaction-missing-checkpoint')
    const eventId=`death-save:${state.combatId}:${state.round}:${state.initiativeIndex}:${input.actorId}`
    const decision=structuredClone(await input.choose({actorId:input.actorId,eventId,state:structuredClone(checkpointState),candidates:structuredClone(candidates)}))
    guard()
    if(decision.kind==='cancel')return {status:'cancelled'}
    if(decision.kind==='decline')return {status:'declined'}
    if(decision.kind!=='replace')throw Error('death-save-reaction-invalid-choice')
    const candidate=candidates.find(entry=>entry.packageId===decision.packageId && entry.activity.id===decision.activityId)
    if(!candidate)throw Error('death-save-reaction-unavailable-activity')
    const triggerContext={event:'before-death-save' as const,eventId,eligibleActorIds:[input.actorId],
      eligibleTargetIds:Object.keys(state.combatants),source:{kind:'combat' as const,id:'death-save'}}
    // The recovery profile has only actor or selected-victim operations. With
    // no victims, do not present dice for damage that will never be applied.
    const rollActivity=decision.targetIds.length ? candidate.activity : {...candidate.activity,
      outcomes:candidate.activity.outcomes.map(outcome=>({...outcome,operations:outcome.operations.filter(operation=>
        !('target' in operation) || operation.target!=='target' && operation.target!=='all-targets')}))}
    const rolled=await rollDnd5eActivityTriggerDiceV1({state:checkpointState,available:{...candidate,activity:rollActivity,confirmation:'actor-choice',retention:'single-event'},
      triggerContext,actorId:input.actorId,targetIds:decision.targetIds,choices:decision.choices,
      roll:async request=>{guard();const values=await input.roll(structuredClone(request));guard();return values}})
    guard()
    if('unsupported' in rolled)throw Error(`death-save-reaction-${rolled.unsupported}`)
    const settled=session.accept(state,pending.checkpoint,{combatRevision:input.combatRevision,confirmedBy:'actor',
      authoritativeRolls:rolled.rolls,checkRollModes:rolled.checkRollModes,
      command:{schemaVersion:1,commandId:`death-save-choice:${globalThis.crypto.randomUUID()}`,actorId:input.actorId,
        packageId:candidate.packageId,packageVersion:candidate.packageVersion,activityId:candidate.activity.id,
        targetIds:decision.targetIds,choices:decision.choices,expectedRevision:input.combatRevision,triggerEventId:eventId}})
    guard()
    if(settled.status!=='resolved')throw Error(`death-save-reaction-${settled.status}`)
    return {status:'replaced',result:settled.result}
  }finally{session.cancel()}
}
