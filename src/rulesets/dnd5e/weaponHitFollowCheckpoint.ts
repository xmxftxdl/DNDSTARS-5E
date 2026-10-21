import type {Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import type {Dnd5eWeaponHitDecision} from './weaponHitCheckpoint'
import {planDnd5eHitFollowContinuation} from './weaponHitFollowPlan'
import {resolveDnd5eHitFollowMovementAfterReactions} from './weaponHitFollowMovement'
import {replayDnd5eHitFollowContinuation,type Dnd5eHitFollowOpportunityChoice,type Dnd5eHitFollowSegmentRolls,type Dnd5eHitFollowCompletionRolls,type Dnd5eHitFollowAreaReceipt,type Dnd5eHitFollowConcentrationReceipt} from './weaponHitFollowReplay'
export type Dnd5eHitFollowRequest=NonNullable<Dnd5eWeaponHitDecision['followRequests']>[number]
export type Dnd5eHitFollowChoice={declined:true}|({declined:false;concentrationReceipts?:readonly Dnd5eHitFollowConcentrationReceipt[];areaReceipts?:readonly Dnd5eHitFollowAreaReceipt[];opportunities?:readonly Dnd5eHitFollowOpportunityChoice[];segmentRolls?:Dnd5eHitFollowSegmentRolls;completionRolls?:Dnd5eHitFollowCompletionRolls}&Pick<Parameters<typeof planDnd5eHitFollowContinuation>[0],'map'|'characters'|'cell'>&Pick<Parameters<typeof resolveDnd5eHitFollowMovementAfterReactions>[0],'rolls'>)
type Listener=(request:Dnd5eHitFollowRequest,state:Dnd5eHeadlessCombatState)=>Dnd5eHitFollowChoice
let active:{listener:Listener;interrupted?:boolean;error?:unknown}|undefined
export function withDnd5eHitFollowCheckpoints<T>(listener:Listener,run:()=>T):T{
 const previous=active;active={listener}
 try{return run()}finally{active=previous}
}
/** Positive movement revalidates the path; unresolved opportunities cannot be skipped. */
export function visitDnd5eHitFollowCheckpoint(request:Dnd5eHitFollowRequest,state:Dnd5eHeadlessCombatState){
 if(!active)throw Error('weapon-hit-follow-settlement-required')
 try{
  const choice=active.listener(structuredClone(request),structuredClone(state))
  if(choice?.declined===true)return undefined
  if(choice?.declined!==false)throw Error('weapon-hit-follow-settlement-required')
  const plan=planDnd5eHitFollowContinuation({...choice,state,actorId:request.actorId,targetId:request.targetId})
  if(!plan.ok)throw Error(plan.reason)
  if(choice.map.dnd5ePluginAreas?.some(area=>area.triggers?.some(trigger=>trigger.timing==='on-enter'||trigger.timing==='on-move-distance'))||choice.concentrationReceipts!=null||choice.areaReceipts!=null||plan.opportunities.length||choice.opportunities!=null||choice.segmentRolls!=null||choice.completionRolls!=null){
   if(plan.opportunities.length&&!choice.opportunities)throw Error('weapon-hit-follow-opportunities-required')
   const replay=replayDnd5eHitFollowContinuation({...choice,opportunities:choice.opportunities??[],state,actorId:request.actorId,targetId:request.targetId})
   if(!replay.ok)throw Error(replay.reason)
   return replay
  }
  const moved=resolveDnd5eHitFollowMovementAfterReactions({...choice,state,map:plan.map,actorId:request.actorId,targetId:request.targetId})
  if(!moved.ok)throw Error(moved.reason)
  return moved
 }catch(error){active.interrupted=true;active.error=error;throw error}
}
export function rethrowDnd5eHitFollowInterruption(){if(active?.interrupted)throw active.error}
