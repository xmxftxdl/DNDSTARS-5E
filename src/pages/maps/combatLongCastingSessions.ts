import type {SharedCombatState,SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import {createCombatTransaction} from '../../lib/combatTransaction'
import {dnd5ePreparedLongCastingBinding,invalidateDnd5ePreparedLongCasting,type PreparedDnd5ePluginSpellCast} from '../../rulesets/dnd5e/pluginSpellTransaction'
import {dmPlayerActionAuthorityLockName} from './useMapsPlayerActionTransport'
import type {BrowserLongCastingOwnerClient} from '../../../shared/long-casting-owner-client.mjs'
import {continueDnd5eLongCastingOutsideCombat,continueDnd5eLongCastingInsideCombat} from '../../rulesets/dnd5e/longCastingContinuity'
import type {Dnd5eHeadlessCombatState} from '../../application/combat/dnd5eCombatRules'

export interface CombatCastingLeaseManager {
  request(name:string,options:{mode:'exclusive'},run:(lock:unknown)=>Promise<void>):Promise<unknown>
}
/** A losing background publication does not invalidate the server winner.
 * Reentry changes only the private continuity receipt; it does not authorize
 * an action spend. Require the exact current authoritative combat regardless
 * of whether the earlier local publication succeeded or conflicted.
 */
export async function readCombatLongCastingReentry(input:{
  publication:Promise<unknown>;read:()=>Promise<SharedCombatState|null>;
  mapId:string;combatId:string;round:number;initiativeIndex:number;
}):Promise<SharedCombatState|undefined>{
  await input.publication.catch(()=>undefined)
  const state=await input.read()
  if(!state?.active||state.mapId!==input.mapId||state.combatId!==input.combatId||
    state.round!==input.round||state.initiativeIndex!==input.initiativeIndex)return undefined
  return state
}
/** The current server turn, not a locally proposed turn, authorizes maintenance. */
export async function waitForCombatLongCastingTurn(input:{
  publication:Promise<unknown>;read:()=>Promise<SharedCombatState|null>;
  mapId:string;combatId:string;round:number;initiativeIndex:number;actorTokenId:string;
}):Promise<SharedCombatState|undefined>{
  const state=await readCombatLongCastingReentry(input)
  if(!state||
    state.initiativeOrder[state.initiativeIndex]?.tokenId!==input.actorTokenId||
    (state.dnd5eTurnEconomyByToken?.[input.actorTokenId]?.action.current??0)<1)return undefined
  return state
}
export interface CombatLongCastingSession {
  readonly prepared:PreparedDnd5ePluginSpellCast
  combatId:string
  lastPaidRound:number
  settling:boolean
  transitioning?:boolean
  readonly stopObserving:()=>void
  readonly release:()=>void
  readonly owner?:BrowserLongCastingOwnerClient
  exploration?:Readonly<{remainingSeconds:number;readyAtWorldMinute:number}>
  completedBeforeCombat?:boolean
}
/** Local preparation owns continuity. Persisted casting markers never recreate it. */
export class CombatLongCastingSessions {
  private readonly sessions=new Map<string,CombatLongCastingSession>()
  private key(mapId:string,actorId:string):string{return JSON.stringify([mapId,actorId])}
  get(mapId:string,actorId:string):CombatLongCastingSession|undefined{return this.sessions.get(this.key(mapId,actorId))}
  all():readonly CombatLongCastingSession[]{return [...this.sessions.values()]}
  async continueOutsideCombat(session:CombatLongCastingSession,state:Dnd5eHeadlessCombatState,worldMinute:number):Promise<boolean>{
    if(this.get(session.prepared.map.id,session.prepared.actor.id)!==session||session.settling||!session.owner)return false
    if(!await session.owner.assertOwned())return false
    // A lease request may finish after the live session has been removed.
    if(this.get(session.prepared.map.id,session.prepared.actor.id)!==session||session.settling)return false
    const transition=continueDnd5eLongCastingOutsideCombat(session.prepared.longCastingReceipt,
      dnd5ePreparedLongCastingBinding(session.prepared),state,worldMinute)
    if(!transition)return false
    session.exploration=transition
    session.completedBeforeCombat=false
    return true
  }
  async continueInsideCombat(session:CombatLongCastingSession,state:Dnd5eHeadlessCombatState,worldMinute:number):Promise<boolean>{
    if(this.get(session.prepared.map.id,session.prepared.actor.id)!==session||session.settling||!session.owner)return false
    if(!await session.owner.assertOwned())return false
    if(this.get(session.prepared.map.id,session.prepared.actor.id)!==session||session.settling)return false
    const transition=continueDnd5eLongCastingInsideCombat(session.prepared.longCastingReceipt,
      dnd5ePreparedLongCastingBinding(session.prepared),state,worldMinute)
    if(!transition)return false
    session.combatId=transition.combatId
    session.lastPaidRound=transition.lastPaidRound
    session.completedBeforeCombat=transition.requiredRounds===0
    delete session.exploration
    return true
  }
  start(prepared:PreparedDnd5ePluginSpellCast,stopObserving:()=>void,locks:CombatCastingLeaseManager,owner?:BrowserLongCastingOwnerClient):CombatLongCastingSession|undefined{
    if(!prepared.action.combatId||prepared.castingTime!=='long'||this.get(prepared.map.id,prepared.actor.id))return undefined
    let release!:()=>void
    const held=new Promise<void>(resolve=>{release=resolve})
    const session:CombatLongCastingSession={prepared,combatId:prepared.action.combatId,lastPaidRound:prepared.state.round,settling:false,stopObserving,release,owner}
    this.sessions.set(this.key(prepared.map.id,prepared.actor.id),session)
    // Queue behind the short start-action lock, then keep only this Web Lock
    // across turns. It does not hold the authority transaction/action queue.
    try{
      const binding=dnd5ePreparedLongCastingBinding(prepared)
      void locks.request(dmPlayerActionAuthorityLockName(binding.mapId,binding.requestId),{mode:'exclusive'},async()=>{await held})
        .catch(()=>this.remove(session))
    }catch(error){this.remove(session);throw error}
    return session
  }
  remove(session:CombatLongCastingSession):void{
    if(this.get(session.prepared.map.id,session.prepared.actor.id)!==session)return
    this.sessions.delete(this.key(session.prepared.map.id,session.prepared.actor.id))
    session.stopObserving();invalidateDnd5ePreparedLongCasting(session.prepared);session.release()
    if(session.owner)void session.owner.close().catch(()=>undefined)
  }
  dispose():void{for(const session of this.all())this.remove(session)}
}

/** New authority transaction; the original action identity still binds continuity. */
export function prepareCombatLongCastingCompletion(session:CombatLongCastingSession,action:SharedPlayerActionState,now:number):PreparedDnd5ePluginSpellCast{
  const prepared=session.prepared
  return {...prepared,
    activityHeadlessAction:prepared.activityHeadlessAction?{...prepared.activityHeadlessAction,transactionId:action.id}:undefined,
    transaction:createCombatTransaction({id:action.id,mapId:prepared.map.id,combatId:action.combatId,
      actorId:prepared.actor.id,actionId:action.id,actionKind:'plugin-spell',
      activityDefinitionId:prepared.transaction.activity?.definitionId,activityExecutionId:action.id,
      parentActivityExecutionId:prepared.action.id,now}),
  }
}
