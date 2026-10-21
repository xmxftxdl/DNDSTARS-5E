import {createDnd5eHitFollowMovementSession,dnd5eHitFollowInterrupted} from './weaponHitFollowMovementSession'
export {dnd5eHitFollowInterrupted} from './weaponHitFollowMovementSession'

type Session=Extract<ReturnType<typeof createDnd5eHitFollowMovementSession>,{ok:true}>
export type Dnd5eHitFollowOpportunityChoice=Parameters<Session['settleOpportunity']>[0]
export type Dnd5eHitFollowSegmentRolls=Parameters<Session['advance']>[1]
export type Dnd5eHitFollowCompletionRolls=Parameters<Session['finish']>[0]
export type Dnd5eHitFollowAreaReceipt=Parameters<Session['settleArea']>[0]
export type Dnd5eHitFollowConcentrationReceipt=Parameters<Session['settleConcentration']>[0]

/** Deterministic Host replay; a stopped follow is a successful partial movement,
 * so the owning hit transaction retains its damage, cost and reactions. */
export function replayDnd5eHitFollowContinuation(input:Parameters<typeof createDnd5eHitFollowMovementSession>[0]&{
 opportunities:readonly Dnd5eHitFollowOpportunityChoice[]
 segmentRolls?:Dnd5eHitFollowSegmentRolls
 completionRolls?:Parameters<Session['finish']>[0]
 areaReceipts?:readonly Dnd5eHitFollowAreaReceipt[]
 concentrationReceipts?:readonly Dnd5eHitFollowConcentrationReceipt[]
}){
 const session=createDnd5eHitFollowMovementSession(input)
 if(!session.ok)return session
 let used=0,usedAreas=0,usedConcentration=0
 const interrupted=()=>session.snapshot().movementBlocked||dnd5eHitFollowInterrupted(session.snapshot().state,input.actorId)
 for(;;){
  const snapshot=session.snapshot()
  if(snapshot.concentrationChecks.length){
   const receipt=input.concentrationReceipts?.[usedConcentration]
   if(!receipt)return {ok:false as const,reason:'weapon-hit-follow-concentration-receipts-required'}
   const settled=session.settleConcentration(receipt)
   if(!settled.ok)return settled
   usedConcentration++;continue
  }
  if(snapshot.areas.length){
   const receipt=input.areaReceipts?.[usedAreas]
   if(!receipt)return {ok:false as const,reason:'weapon-hit-follow-area-receipts-required'}
   const settled=session.settleArea(receipt)
   if(!settled.ok)return settled
   usedAreas++;continue
  }
  if(interrupted())break
  const window=snapshot.opportunities[0]
  if(window&&window.pathSegmentIndex+(window.trigger==='leave-reach'?0:1)===snapshot.pathIndex){
   const receipt=input.opportunities[used]
   if(!receipt||receipt.attackerId!==window.attacker.id)return {ok:false as const,reason:'weapon-hit-follow-opportunities-required'}
   const settled=session.settleOpportunity(receipt)
   if(!settled.ok)return settled
   used++;continue
  }
  if(snapshot.pathIndex===session.path.length-1)break
  const moved=session.advance(snapshot.pathIndex+1,input.segmentRolls)
  if(!moved.ok)return moved
 }
 if(used!==input.opportunities.length)return {ok:false as const,reason:'unused-follow-opportunity-receipts'}
 if(usedAreas!==(input.areaReceipts?.length??0))return {ok:false as const,reason:'unused-follow-area-receipts'}
 if(usedConcentration!==(input.concentrationReceipts?.length??0))return {ok:false as const,reason:'unused-follow-concentration-receipts'}
 const completed=session.finish(input.completionRolls)
 if(!completed.ok)return completed
 const snapshot=session.snapshot()
 return {ok:true as const,state:snapshot.state,map:snapshot.map,characters:snapshot.characters,events:snapshot.events,stopped:interrupted()}
}

