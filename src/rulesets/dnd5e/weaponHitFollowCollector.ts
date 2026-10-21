import {createDnd5eHitFollowMovementSession} from './weaponHitFollowMovementSession'
import {prepareDnd5eHitFollowOpportunityAtCurrentPosition} from './weaponHitFollowOpportunity'
import {dnd5eHitFollowInterrupted,replayDnd5eHitFollowContinuation,type Dnd5eHitFollowOpportunityChoice,type Dnd5eHitFollowSegmentRolls} from './weaponHitFollowReplay'
import type {PreparedDnd5eOpportunityAttack} from './opportunityAttackAction'
import type {PreparedDnd5ePersistentAreaTrigger} from './pluginAreaTransactions'
import type {Dnd5eHitFollowAreaReceipt} from './weaponHitFollowReplay'
import type {Dnd5eHitFollowConcentrationReceipt} from './weaponHitFollowReplay'

type Session=Extract<ReturnType<typeof createDnd5eHitFollowMovementSession>,{ok:true}>
type Snapshot=ReturnType<Session['snapshot']>
type Decision=Omit<Extract<Dnd5eHitFollowOpportunityChoice,{declined:true}>,'attackerId'|'window'>|Omit<Extract<Dnd5eHitFollowOpportunityChoice,{declined:false;kind?:'weapon'}>,'attackerId'|'window'>|Omit<Extract<Dnd5eHitFollowOpportunityChoice,{kind:'spell'}>,'attackerId'|'window'>

/** Collect choices against private Host state, then verify by deterministic
 * replay. Never publishes map/character changes while a UI awaits input. */
export async function collectDnd5eHitFollowContinuation(input:Parameters<typeof createDnd5eHitFollowMovementSession>[0]&{
 isCurrent:()=>boolean
 chooseOpportunity:(request:{prepared:PreparedDnd5eOpportunityAttack;window:Snapshot['opportunities'][number];spellOptions:ReturnType<Session['prepareOpportunitySpells']>})=>Promise<Decision>
 rollSegment?:(request:{snapshot:Snapshot;pathIndex:number;to:{x:number;y:number;elevationFeet?:number}})=>Promise<NonNullable<Dnd5eHitFollowSegmentRolls>[number]>
 rollCompletion?:(request:{snapshot:Snapshot})=>Promise<Parameters<Session['finish']>[0]>
 rollArea?:(request:{prepared:PreparedDnd5ePersistentAreaTrigger;snapshot:Snapshot})=>Promise<Dnd5eHitFollowAreaReceipt['rolls']>
 rollConcentration?:(request:{check:Snapshot['concentrationChecks'][number];snapshot:Snapshot;preview:(rolls:Dnd5eHitFollowConcentrationReceipt['rolls'])=>ReturnType<Session['previewConcentration']>})=>Promise<Dnd5eHitFollowConcentrationReceipt['rolls']>
}){
 const guard=()=>{if(!input.isCurrent())throw Error('weapon-hit-follow-stale-authority')}
 guard()
 const session=createDnd5eHitFollowMovementSession(input)
 if(!session.ok)throw Error(session.reason)
 const opportunities:Dnd5eHitFollowOpportunityChoice[]=[]
 const areaReceipts:Dnd5eHitFollowAreaReceipt[]=[]
 const concentrationReceipts:Dnd5eHitFollowConcentrationReceipt[]=[]
 const segmentRolls:NonNullable<Dnd5eHitFollowSegmentRolls>={}
 for(;;){
  guard()
  const snapshot=session.snapshot()
  if(snapshot.concentrationChecks.length){
   if(!input.rollConcentration)throw Error('weapon-hit-follow-concentration-roller-required')
   const check=snapshot.concentrationChecks[0]
   const rolls=await input.rollConcentration({check:structuredClone(check),snapshot,preview:rolls=>{
    guard()
    return session.previewConcentration({eventIndex:check.eventIndex,rolls:structuredClone(rolls)})
   }})
   guard()
   const receipt={eventIndex:check.eventIndex,rolls:structuredClone(rolls)}
   const settled=session.settleConcentration(receipt)
   if(!settled.ok)throw Error(settled.reason)
   concentrationReceipts.push(receipt);continue
  }
  if(snapshot.areas.length){
   if(!input.rollArea)throw Error('weapon-hit-follow-area-roller-required')
   const ready=session.prepareArea()
   if(!ready.ok)throw Error(ready.reason)
   const rolls=await input.rollArea({prepared:structuredClone(ready.prepared),snapshot})
   guard()
   const receipt={transactionId:ready.prepared.candidate.transactionId,rolls:structuredClone(rolls)}
   const settled=session.settleArea(receipt)
   if(!settled.ok)throw Error(settled.reason)
   areaReceipts.push(receipt);continue
  }
  if(snapshot.movementBlocked||dnd5eHitFollowInterrupted(snapshot.state,input.actorId))break
  const window=snapshot.opportunities[0]
  const triggerIndex=window?window.pathSegmentIndex+(window.trigger==='leave-reach'?0:1):undefined
  if(window&&triggerIndex===snapshot.pathIndex){
   const ready=prepareDnd5eHitFollowOpportunityAtCurrentPosition({state:snapshot.state,map:snapshot.map,
    characters:snapshot.characters,actorId:input.actorId,attackerId:window.attacker.id})
   if(!ready.ok)throw Error(ready.reason)
   const choice=await input.chooseOpportunity({prepared:structuredClone(ready.prepared),window:structuredClone(window),
    spellOptions:ready.prepared.mandatory?[]:structuredClone(session.prepareOpportunitySpells(window.attacker.id))})
   guard()
   const receipt={...choice,attackerId:window.attacker.id,window:structuredClone(window)}
   const settled=session.settleOpportunity(receipt)
   if(!settled.ok)throw Error(settled.reason)
   opportunities.push(structuredClone(receipt))
   continue
  }
  if(snapshot.pathIndex===session.path.length-1)break
  const next=snapshot.pathIndex+1
  const rolls=await input.rollSegment?.({snapshot,pathIndex:next,to:{...session.path[next],elevationFeet:session.pathElevationsFeet?.[next]}})
  guard()
  const perSegment={...(rolls?{[next]:structuredClone(rolls)}:{})}
  const moved=session.advance(next,perSegment)
  if(!moved.ok)throw Error(moved.reason)
  Object.assign(segmentRolls,perSegment)
 }
 guard()
 const completionRolls=await input.rollCompletion?.({snapshot:session.snapshot()})
 guard()
 const completed=session.finish(completionRolls)
 if(!completed.ok)throw Error(completed.reason)
 const verified=replayDnd5eHitFollowContinuation({...input,opportunities,segmentRolls,completionRolls,areaReceipts,concentrationReceipts})
 if(!verified.ok)throw Error(verified.reason)
 return {opportunities,segmentRolls,completionRolls,areaReceipts,concentrationReceipts,result:verified}
}

