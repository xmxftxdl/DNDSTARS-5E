import {saveBountifulPhase} from './bountifulPhaseCommit'
import {assertBountifulOriginalSceneScope} from './bountifulOriginalSceneScope'
import {bountifulOriginalScopeMatches} from '../../../shared/bountiful-original-scope.mjs'
import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {SharedCombatState,SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {Dnd5eActionResult,Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import type {Dnd5eMapResultPlan} from './mapBridge'
import type {Dnd5eAfterOriginalFallChoice,Dnd5eAfterOriginalFallRequest} from './afterOriginalFallCheckpoint'
import {createDnd5ePreparedDamageCommitSession} from './damageCommitSession'
import {bountifulPreparedReplayFacts,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {actualBountifulResolvers,bountifulOriginalParentReceiptId} from './bountifulLuckPersistentHost'
import {readBountifulOriginalSource} from './bountifulLuckPersistentRoomDriver'
import {readBountifulAfterDiceSource,encodeBountifulAfterDiceSource} from './bountifulLuckAfterDice'
import {validateBountifulOriginalParents} from '../../../shared/bountiful-luck-state.mjs'
import {getRoomSession} from '../../lib/roomSession'

type Revisioned<T>=T&{_sync?:{revision?:number}}
type Combat=SharedCombatState&{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}
interface PreparedInput{prepared:{state:Dnd5eHeadlessCombatState;map:BattleMap;characters:readonly Character[];action:{id:string};characterIdByCombatantId:Readonly<Record<string,string>>}}
interface ParentResult{result:Dnd5eActionResult;application?:Dnd5eMapResultPlan}
const revision=(value:Revisioned<object>|null)=>value?._sync?.revision??0
const host=()=>{const session=getRoomSession();if(!session||session.role!=='dm')throw Error('bountiful-fall:host-required');return session}

/** This is a concrete continuation of a real post-action airborne-fall boundary.
 * It replays the unchanged private input through a whitelisted actual facade;
 * no caller state or generic successful result can issue a fall fact. Only
 * combat-private choice data is written. Original HP/costs wait for final ACK. */
export async function recordBountifulOriginalFall<Input extends PreparedInput,Result extends ParentResult>(input:{action:SharedPlayerActionState;source:Input;resolve:(input:Input)=>Result;occurrence:number;request:Dnd5eAfterOriginalFallRequest;choice:Dnd5eAfterOriginalFallChoice;authorityUnchanged:()=>boolean},gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>){
 const session=host(),[combat,characters,maps,geometry,queue]=await Promise.all([
  gateway.loadResource<Revisioned<Combat>>('combat'),gateway.loadResource<Revisioned<object>>('characters'),gateway.loadResource<Revisioned<object>>('maps'),gateway.loadResource<Revisioned<object>>('map-geometry'),gateway.loadResource<Revisioned<{requests:unknown[]}>>('player-action-requests')])
 const first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.action.id,0)]
 const resolver:unknown=input.resolve
 if(!combat||!characters||!maps||!queue||!first||first.consumed||!validateBountifulOriginalParents(combat.bountifulOriginalParents)||!Object.values(actualBountifulResolvers).some(candidate=>candidate===resolver)||
 first.identity.hostMemberId!==session.memberId||first.identity.roomId!==session.roomId||!bountifulOriginalScopeMatches(combat,first.identity)||JSON.stringify(combat.dnd5eTurnEconomyByToken??{})!==first.identity.reactionEconomySignature||JSON.stringify(input.action)!==JSON.stringify(first.originalRoomAction)||!queue.requests.some(row=>JSON.stringify(row)===JSON.stringify(input.action))||!input.authorityUnchanged())throw Error('bountiful-fall:private-parent-required')
 await assertBountifulOriginalSceneScope(combat,first.identity,gateway)
 const reads:Record<string,number>={characters:revision(characters),maps:revision(maps),'map-geometry':revision(geometry),...(first.identity.sceneScope?{'campaign-time':first.identity.sceneScope.campaignTimeRevision}:{})}
 if(Object.entries(first.identity.revisions).some(([name,value])=>reads[name]!==value))throw Error('bountiful-fall:stale-original-resources')
 const original=await readBountifulOriginalSource(first),expected=await readBountifulAfterDiceSource(first)??original.source
 if(JSON.stringify(input.source)!==JSON.stringify(expected))throw Error('bountiful-fall:changed-original-input')
 const rows=Object.values(combat.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===input.action.id).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
 const existing=first.continuation?.afterOriginalFalls??[]
 const prior=existing[input.occurrence]
 if(prior){
  if(JSON.stringify(prior.request)!==JSON.stringify(input.request)||JSON.stringify(prior.choice)!==JSON.stringify(input.choice))throw Error('bountiful-fall:already-confirmed')
  return structuredClone(first)
 }
 if(input.occurrence!==existing.length)throw Error('bountiful-fall:wrong-occurrence')
 const source={...input.source,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source:input.source,receipts:rows})}
 const replay=createDnd5ePreparedDamageCommitSession(source,input.resolve,()=>false)
 try{
  const pending=replay.run(source.prepared.state)
  if(pending.status!=='pending-after-original-fall'||pending.occurrence!==input.occurrence||JSON.stringify(pending.request)!==JSON.stringify(input.request))throw Error('bountiful-fall:actual-checkpoint-required')
  const result=replay.resumeAfterOriginalFall(source.prepared.state,pending.occurrence,pending.request,input.choice)
  if(result.status==='rejected'||result.status==='resolved'&&(!result.result.result.ok||!result.result.application))throw Error('bountiful-fall:actual-choice-rejected')
  const afterOriginalFalls=replay.afterOriginalFallFacts()
  if(afterOriginalFalls.length!==existing.length+1)throw Error('bountiful-fall:missing-actual-fact')
  const continuation={...(first.continuation??{hostMemberId:session.memberId,source:encodeBountifulAfterDiceSource(input.source)}),afterOriginalFalls}
  const parents={...combat.bountifulOriginalParents,[bountifulOriginalParentReceiptId(input.action.id,0)]:{...first,continuation}}
  if(!validateBountifulOriginalParents(parents))throw Error('bountiful-fall:invalid-continuation')
  const current=host();if(current.roomId!==session.roomId||current.memberId!==session.memberId||!input.authorityUnchanged())throw Error('bountiful-fall:stale-host')
  await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:revision(combat),data:{...combat,bountifulOriginalParents:parents}}],{transactionId:'bountiful-fall:'+input.action.id+':'+input.occurrence,readRevisions:{...reads,'player-action-requests':revision(queue)}})
  return structuredClone(parents[bountifulOriginalParentReceiptId(input.action.id,0)])
 }finally{replay.cancel()}
}
