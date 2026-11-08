import {saveBountifulPhase} from './bountifulPhaseCommit'
import {assertBountifulOriginalSceneScope} from './bountifulOriginalSceneScope'
import {bountifulOriginalScopeMatches} from '../../../shared/bountiful-original-scope.mjs'
import {attachBountifulReadySource} from './bountifulReadySource'
import {assertBountifulSpellCounterattackAppend} from './bountifulSpellCounterattackSource'
import type {BountifulSpellOriginalInput} from './bountifulSpellTargetRaw'
import {bountifulOriginalRawForActor} from './bountifulSpellTargetRaw'
import {assertBountifulSpellPostSaveRows} from './bountifulLuckAfterDice'
import {getRoomSession} from '../../lib/roomSession'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {SharedCombatState,SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import {resolvePreparedDnd5eSpellCast} from './spellAction'
import {createDnd5eOriginalD20Session} from './damageCommitSession'
import {validateBountifulOriginalParents} from '../../../shared/bountiful-luck-state.mjs'
import {bountifulOriginalParentReceiptId} from './bountifulLuckPersistentHost'
import {readBountifulOriginalSource} from './bountifulLuckPersistentRoomDriver'
import {bountifulPreparedReplayFacts,decisionFromBountifulOriginalDieReceipt,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {encodeBountifulAfterDiceSource} from './bountifulLuckAfterDice'

type Source=BountifulSpellOriginalInput
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
type Revisioned<T>=T&{_sync?:{revision?:number}}
type Combat=SharedCombatState&{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}
const revision=(value:Revisioned<object>|null)=>value?._sync?.revision??0
const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right)
const host=()=>{const value=getRoomSession();if(!value||value.role!=='dm')throw Error('bountiful-spell-stream:host-required');return value}

/** The next actual target's raw save is appended after earlier choices finish.
 * Existing raw faces and all other original source fields are immutable. No
 * missing target receives a placeholder die and no HP/cost is published here. */
export async function appendBountifulSpellOriginalSave(input:{action:SharedPlayerActionState;source:Source;actorId:string;rollCursor:number;authorityUnchanged:()=>boolean},gateway:Gateway){
 const session=host(),[combat,characters,maps,geometry,queue]=await Promise.all([
  gateway.loadResource<Revisioned<Combat>>('combat'),gateway.loadResource<Revisioned<object>>('characters'),gateway.loadResource<Revisioned<object>>('maps'),gateway.loadResource<Revisioned<object>>('map-geometry'),gateway.loadResource<Revisioned<{requests:unknown[]}>>('player-action-requests')])
 const key=bountifulOriginalParentReceiptId(input.action.id,0),first=combat?.bountifulOriginalParents?.[key]
 if(!combat||!characters||!maps||!queue||!first||first.consumed||first.originalAdapterId!=='spell'||!validateBountifulOriginalParents(combat.bountifulOriginalParents)||
 first.identity.roomId!==session.roomId||first.identity.hostMemberId!==session.memberId||!bountifulOriginalScopeMatches(combat,first.identity)||!same(combat.dnd5eTurnEconomyByToken??{},JSON.parse(first.identity.reactionEconomySignature))||!same(input.action,first.originalRoomAction)||!queue.requests.some(row=>same(row,input.action))||!input.authorityUnchanged())throw Error('bountiful-spell-stream:private-parent-required')
 await assertBountifulOriginalSceneScope(combat,first.identity,gateway)
 const reads:Record<string,number>={characters:revision(characters),maps:revision(maps),'map-geometry':revision(geometry),...(first.identity.sceneScope?{'campaign-time':first.identity.sceneScope.campaignTimeRevision}:{})}
 if(Object.entries(first.identity.revisions).some(([name,value])=>reads[name]!==value))throw Error('bountiful-spell-stream:stale-original-resources')
 const rows=Object.values(combat.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===input.action.id).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
 for(const row of rows)decisionFromBountifulOriginalDieReceipt(row,row.request)
 const previous=await readBountifulOriginalSource(first,{includeContinuation:true})
 if(!Number.isSafeInteger(input.rollCursor)||input.rollCursor<(first.continuation?.rollCursor??0)||input.rollCursor>100000)throw Error('bountiful-spell-stream:invalid-roll-cursor')
 if(same(previous.source,input.source)){
  if(first.originalCheckpoint?.actorId!==input.actorId||first.originalCheckpoint.kind!=='saving-throw'||first.continuation?.rollCursor!==input.rollCursor)throw Error('bountiful-spell-stream:changed-confirmed-target')
  return
 }
 const omitReplay=(source:object)=>Object.fromEntries(Object.entries(source).filter(([key])=>key!=='hostOriginalD20Replay'))
 if(same(omitReplay(previous.source),omitReplay(input.source))){
  const unsignedSource:Source={...input.source,hostOriginalD20Replay:undefined}
  const canonical=await attachBountifulReadySource({...input,source:unsignedSource},gateway)
  if(!canonical.hostOriginalD20Replay?.readyFrames?.length||!same(canonical,input.source))throw Error('bountiful-spell-stream:private-ready-sync-required')
  const binding={...bountifulPreparedReplayFacts({parentId:input.action.id,source:canonical,receipts:rows}),readyFrames:canonical.hostOriginalD20Replay.readyFrames}
  const probe=createDnd5eOriginalD20Session({...canonical,hostOriginalD20Replay:binding},resolvePreparedDnd5eSpellCast,input.actorId,'saving-throw')
  try{const result=probe.run(canonical.prepared.state);if(result.status!=='original-d20-ready'||result.request.actorId!==input.actorId)throw Error('bountiful-spell-stream:ready-sync-boundary-required')}finally{probe.cancel()}
  const continuation={hostMemberId:session.memberId,source:encodeBountifulAfterDiceSource(canonical),rollCursor:input.rollCursor,...(first.continuation?.afterOriginalFalls?{afterOriginalFalls:structuredClone(first.continuation.afterOriginalFalls)}:{})}
  const parents={...combat.bountifulOriginalParents,[key]:{...first,continuation}}
  if(!validateBountifulOriginalParents(parents)||!input.authorityUnchanged()||host().memberId!==session.memberId||host().roomId!==session.roomId)throw Error('bountiful-spell-stream:changed-ready-sync')
  const result=await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:revision(combat),data:{...combat,bountifulOriginalParents:parents}}],{transactionId:'bountiful-ready-native-sync:'+input.action.id+':'+input.actorId,readRevisions:{...reads,'player-action-requests':revision(queue)}})
  if(result.status!=='committed')throw Error('bountiful-spell-stream:ready-sync-not-committed')
  return
 }
 assertBountifulSpellCounterattackAppend(previous.source.savingThrowCounterattacks,input.source)
 for(const field of new Set([...Object.keys(previous.source),...Object.keys(input.source)]))if(field!=='savingThrowCounterattacks'&&field!=='targetSavingThrows'&&field!=='hostOriginalSpellSavingThrows'&&!same(previous.source[field],input.source[field as keyof Source]))throw Error('bountiful-spell-stream:changed-original-input')
 const before=previous.source.targetSavingThrows,after=input.source.targetSavingThrows
 if(!Array.isArray(before)||!after||after.length<=before.length)throw Error('bountiful-spell-stream:append-only-original-saves-required')
 try{assertBountifulSpellPostSaveRows(before,after.slice(0,before.length))}catch{throw Error('bountiful-spell-stream:append-only-original-saves-required')}
 for(const zero of after.slice(before.length,-1)){
  if(zero.d20!==0||Object.keys(zero).some(key=>!['targetId','d20'].includes(key))||before.some(row=>row.targetId===zero.targetId)||!input.source.prepared.targetSavingThrows?.some(row=>row.targetToken.id===zero.targetId)||!input.source.savingThrowCounterattacks?.some(use=>use.targetId===zero.targetId))throw Error('bountiful-spell-stream:actual-counterattack-zero-required')
 }
 if(new Set(after.map(row=>row.targetId)).size!==after.length)throw Error('bountiful-spell-stream:duplicate-save-target')
 const raw=after[after.length-1]
 if(raw.targetId!==input.actorId||before.some(row=>row.targetId===raw.targetId)||!input.source.prepared.targetSavingThrows?.some(row=>row.targetToken.id===raw.targetId)||Object.keys(raw).some(key=>!['targetId','d20','d20Second','disadvantageNegation'].includes(key))||!Number.isInteger(raw.d20)||raw.d20<1||raw.d20>20||raw.d20Second!==undefined&&(!Number.isInteger(raw.d20Second)||raw.d20Second<1||raw.d20Second>20))throw Error('bountiful-spell-stream:actual-new-target-raw-required')
 const nextBook='hostOriginalSpellSavingThrows'in input.source?input.source.hostOriginalSpellSavingThrows:undefined,oldBook=previous.source.hostOriginalSpellSavingThrows
 if(oldBook!==undefined||nextBook!==undefined){
  if(!Array.isArray(oldBook)||!Array.isArray(nextBook)||nextBook.length!==oldBook.length+1||!same(oldBook,nextBook.slice(0,oldBook.length)))throw Error('bountiful-spell-stream:append-only-target-raw-captures-required')
  const last=nextBook.at(-1)
  if(!last||typeof last!=='object'||last.actorId!==input.actorId||oldBook.some(row=>row?.actorId===input.actorId))throw Error('bountiful-spell-stream:actual-new-target-capture-required')
  const metadata=bountifulOriginalRawForActor(input.source,input.actorId,'saving-throw',raw.d20Second===undefined?[raw.d20]:[raw.d20,raw.d20Second])
  if(metadata.hostOriginalDiceCursor!==input.rollCursor)throw Error('bountiful-spell-stream:actual-new-target-cursor-required')
 }
 const replaySource={...input.source,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source:input.source,receipts:rows})}
 const probe=createDnd5eOriginalD20Session(replaySource,resolvePreparedDnd5eSpellCast,input.actorId,'saving-throw')
 let pending:ReturnType<typeof probe.run>
 try{pending=probe.run(replaySource.prepared.state)}finally{probe.cancel()}
 if(pending.status==='pending-ally-natural-one'){
  if(pending.request.actorId!==input.actorId||pending.request.kind!=='saving-throw'||pending.occurrence!==rows.length)throw Error('bountiful-spell-stream:wrong-actual-checkpoint')
 }else if(pending.status!=='original-d20-ready'||pending.request.actorId!==input.actorId||pending.request.kind!=='saving-throw')throw Error('bountiful-spell-stream:actual-checkpoint-not-reached')
 const continuation={hostMemberId:session.memberId,source:encodeBountifulAfterDiceSource(input.source),rollCursor:input.rollCursor,...(first.continuation?.afterOriginalFalls?{afterOriginalFalls:structuredClone(first.continuation.afterOriginalFalls)}:{})}
 const parents={...combat.bountifulOriginalParents,[key]:{...first,continuation,originalCheckpoint:{actorId:input.actorId,kind:'saving-throw' as const}}}
 if(!validateBountifulOriginalParents(parents))throw Error('bountiful-spell-stream:invalid-persisted-source')
 const current=host();if(current.memberId!==session.memberId||current.roomId!==session.roomId||!input.authorityUnchanged())throw Error('bountiful-spell-stream:stale-host')
 await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:revision(combat),data:{...combat,bountifulOriginalParents:parents}}],{transactionId:'bountiful-spell-raw:'+input.action.id+':'+input.actorId,readRevisions:{...reads,'player-action-requests':revision(queue)}})
}
