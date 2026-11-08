import {markBountifulOriginalSceneReactions} from './bountifulOriginalSceneScope'
import {cloneDnd5eHostTransactionInput} from './hostTransactionClone'
import {validateBountifulReadyParents} from '../../../shared/bountiful-ready-parents.mjs'
import {readBountifulReadyGenericReplay} from './bountifulReadyGenericReplay'
import {readBountifulSpellOriginalReadyFrame,inspectBountifulSpellOriginalReadyFrame,type BountifulReadyParentData} from './bountifulOriginalReadyFrame'
import {resolvePreparedDnd5eSpellCast} from './spellAction'
import {resolveDnd5ePreparedWithMaterialDamageReactions,type Dnd5eDamageReactionFlowOptions} from './damageReactionFlow'
import {publishPlayerActionAckWithSnapshots,type PublishPlayerActionAckInput} from '../../lib/playerActionAckPublish'
import {getRoomSession} from '../../lib/roomSession'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {SharedCombatState,SharedPlayerActionState,SharedPlayerActionAckState} from '../../lib/sharedCombatTypes'
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'>
type Snapshot<T>=T&{_sync?:{revision?:number}}
type Combat=SharedCombatState&{bountifulReadyParents?:Record<string,BountifulReadyParentData>}
type Resolved=ReturnType<typeof resolvePreparedDnd5eSpellCast>
const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right)
const host=()=>{const value=getRoomSession();if(!value||value.role!=='dm')throw Error('bountiful-ready-ack:host-required');return value}
const revision=(value:Snapshot<object>|null)=>value?._sync?.revision??0
const bindings=new WeakMap<SharedPlayerActionState,{frameId:string;record:BountifulReadyParentData;records:readonly BountifulReadyParentData[];versions:Record<string,number>;resolved:Resolved;authorityUnchanged:()=>boolean}>()

/** Ready-only native results use their own concrete issuer. No original-one
 * receipt or public payload flag can stand in for this exact action binding. */
export async function prepareBountifulReadySceneAck(action:SharedPlayerActionState,gateway:Gateway){
 const binding=bindings.get(action)
 if(!binding||!binding.record.sceneScope)return undefined
 const session=host(),combat=await gateway.loadResource<Snapshot<Combat>>('combat'),saved=combat?.bountifulReadyParents?.[binding.frameId]
 if(!combat||!saved||!validateBountifulReadyParents(combat.bountifulReadyParents)||!same(saved,binding.record)||saved.consumed||!same(saved.originalRoomAction,action)||
  !same(Object.values(combat.bountifulReadyParents??{}).filter(row=>row.parentId===action.id).sort((a,b)=>(a.request.ordinal??-1)-(b.request.ordinal??-1)),binding.records)||
  saved.roomId!==session.roomId||saved.hostMemberId!==session.memberId||!binding.resolved.result.ok||!binding.resolved.application||!binding.authorityUnchanged())throw Error('bountiful-ready-scene-ack:issued-native-result-required')
 const frame=await readBountifulSpellOriginalReadyFrame({mapId:action.mapId,id:binding.frameId},gateway),facts=await inspectBountifulSpellOriginalReadyFrame(frame,gateway)
 if(!same(facts.parent,action)||!facts.sceneScope||!same(facts.sceneScope,saved.sceneScope))throw Error('bountiful-ready-scene-ack:changed-original-source')
 const current=host()
 if(current.roomId!==session.roomId||current.memberId!==session.memberId||!binding.authorityUnchanged())throw Error('bountiful-ready-scene-ack:stale-host')
 return {expectedRevisions:{...facts.versions,combat:revision(combat)},ordinarySceneCombat:structuredClone(combat),roomId:session.roomId}
}
/** Generic-only native spell proof. The actual concrete facade executes from
 * the saved original. No caller provides a resolver, success, or replacement
 * prepared state. A later BL/SC pause is not signed as a completed result. */
export async function resolveBountifulReadyForNormalAck(input:{action:SharedPlayerActionState;frameId:string;options:Dnd5eDamageReactionFlowOptions},gateway:Gateway){
 host()
 const frame=await readBountifulSpellOriginalReadyFrame({mapId:input.action.mapId,id:input.frameId},gateway),facts=await inspectBountifulSpellOriginalReadyFrame(frame,gateway)
 if(!same(facts.parent,input.action)||!input.options.authorityUnchanged())throw Error('bountiful-ready-ack:actual-original-action-required')
 const original=await readBountifulReadyGenericReplay({mapId:input.action.mapId,frameId:input.frameId},gateway)
 const source={...original.source,hostOriginalD20Replay:original.binding}
 const resolved=await resolveDnd5ePreparedWithMaterialDamageReactions(input.options,source,resolvePreparedDnd5eSpellCast)
 if(!resolved.result.ok||!resolved.application)throw Error('bountiful-ready-ack:native-parent-not-resolved')
 const combat=await gateway.loadResource<Snapshot<Combat>>('combat'),saved=combat?.bountifulReadyParents?.[input.frameId]
 if(!saved||!validateBountifulReadyParents(combat?.bountifulReadyParents)||saved.consumed)throw Error('bountiful-ready-ack:private-record-required')
 await inspectBountifulSpellOriginalReadyFrame(frame,gateway)
 markBountifulOriginalSceneReactions({sceneScope:saved.sceneScope,roomId:saved.roomId,parentId:input.action.id,characterIdByCombatantId:source.prepared.characterIdByCombatantId,result:resolved.result,application:resolved.application})
 bindings.set(input.action,{frameId:input.frameId,record:structuredClone(saved),records:structuredClone(Object.values(combat?.bountifulReadyParents??{}).filter(row=>row.parentId===input.action.id).sort((a,b)=>(a.request.ordinal??-1)-(b.request.ordinal??-1))),versions:facts.versions,resolved:cloneDnd5eHostTransactionInput(resolved),authorityUnchanged:input.options.authorityUnchanged})
 return resolved
}
/** One normal ACK transaction includes native HP, generic fees, original action
 * economy, processed marker, ACK, and consumed ready-frame metadata. This proof
 * intentionally accepts the exact native character/map plan only; broader Maps
 * inventory/postprocessing and BL+SC joint publication remain separate work. */
export async function publishBountifulReadyThroughNormalAck(action:SharedPlayerActionState,input:PublishPlayerActionAckInput,gateway:Gateway){
 const session=host(),binding=bindings.get(action)
 const [combat,ack]=await Promise.all([gateway.loadResource<Snapshot<Combat>>('combat'),gateway.loadResource<SharedPlayerActionAckState>('player-action-ack')])
 if(!binding){
  const saved=Object.values(combat?.bountifulReadyParents??{}).find(row=>row.parentId===action.id)
  if(saved?.consumed?.transactionId===action.id&&saved.roomId===session.roomId&&saved.hostMemberId===session.memberId&&same(saved.originalRoomAction,action)&&validateBountifulReadyParents(combat?.bountifulReadyParents)&&ack?.status==='accepted'&&ack.actionId===action.id&&ack.mapId===action.mapId&&ack.combatId===action.combatId){try{await input.publishAck(ack)}catch{}return}
  throw Error('bountiful-ready-ack:issued-native-result-required')
 }
 const saved=combat?.bountifulReadyParents?.[binding.frameId]
 if(!combat||!saved||!validateBountifulReadyParents(combat.bountifulReadyParents)||!same(saved,binding.record)||!same(Object.values(combat.bountifulReadyParents??{}).filter(row=>row.parentId===action.id).sort((a,b)=>(a.request.ordinal??-1)-(b.request.ordinal??-1)),binding.records)||saved.consumed||!binding.authorityUnchanged())throw Error('bountiful-ready-ack:changed-native-parent')
 const frame=await readBountifulSpellOriginalReadyFrame({mapId:action.mapId,id:binding.frameId},gateway)
 await inspectBountifulSpellOriginalReadyFrame(frame,gateway)
 const snapshots=input.snapshots
 if(!snapshots?.combat)throw Error('bountiful-ready-ack:native-snapshots-required')
 const result=binding.resolved,application=result.application
 if(!application||!same(snapshots.characters,application.characters)||!same(snapshots.maps.find(map=>map.id===action.mapId),application.map)||input.ack.status!=='accepted'||input.ack.actionId!==action.id||input.ack.mapId!==action.mapId||input.ack.combatId!==action.combatId||snapshots.combat.mapId!==combat.mapId||snapshots.combat.combatId!==combat.combatId||snapshots.combat.round!==combat.round||snapshots.combat.initiativeIndex!==combat.initiativeIndex)throw Error('bountiful-ready-ack:changed-native-final-plan')
 const parents={...combat.bountifulReadyParents};for(const record of binding.records)parents[record.id]={...record,consumed:{transactionId:action.id}}
 if(!validateBountifulReadyParents(parents))throw Error('bountiful-ready-ack:invalid-consumed-frame')
 const current=host();if(current.roomId!==session.roomId||current.memberId!==session.memberId||!binding.authorityUnchanged())throw Error('bountiful-ready-ack:host-changed')
 const finalCombat:Combat={...combat,...snapshots.combat,bountifulReadyParents:parents}
 await publishPlayerActionAckWithSnapshots({...input,snapshots:{...snapshots,combat:finalCombat},expectedRevisions:{...input.expectedRevisions,...binding.versions,combat:revision(combat)}})
 bindings.delete(action)
}
