import {getRoomSession} from '../../lib/roomSession'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {SharedCombatState} from '../../lib/sharedCombatTypes'
import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import {resolvePreparedDnd5eMonsterAttack,readDnd5eMonsterNativeExecution} from './monsterAttackAction'
import {readBountifulNativePreparedReplay} from './bountifulNativePreparedRecovery'
import {decisionFromBountifulOriginalDieReceipt,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {cloneDnd5eHostTransactionInput,registerDnd5eHostReceipt} from './hostTransactionClone'
import {createDnd5eTurnEconomyCounts,projectDnd5eHeadlessTurnEconomy} from './turnEconomy'
import {encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {DND5E_CORE_INSPIRATION_RESOURCE_KEY} from '../../lib/d20InterruptPolicy'

type Source=Parameters<typeof resolvePreparedDnd5eMonsterAttack>[0]
type Resolved=ReturnType<typeof resolvePreparedDnd5eMonsterAttack>
type Synced<T>=T&{_sync?:{revision?:number}}
type Combat=SharedCombatState&{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
export interface BountifulNativeMapPublication{readonly version:1}
interface Binding{parentId:string;roomId:string;memberId:string;source:Source;rows:BountifulOriginalDieReceipt[];kernel:NonNullable<ReturnType<typeof readDnd5eMonsterNativeExecution>>;resolved:Resolved;authorityUnchanged:()=>boolean}
const bindings=new WeakMap<BountifulNativeMapPublication,Binding>()
const rowsFor=(combat:Combat,parentId:string)=>Object.values(combat.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
const revision=(value:Synced<object>|null)=>{const n=value?._sync?.revision;if(!Number.isSafeInteger(n)||n!<0)throw Error('bountiful-native-map:revision-required');return n!}
const host=()=>{const session=getRoomSession();if(!session||session.role!=='dm')throw Error('bountiful-native-map:host-required');return session}

/** Runs the Maps facade wrapper over the protected concrete source. Success
 * alone cannot mint publication authority: the actual monster facade must have
 * recorded a new successful execution for this exact private capability. */
export async function resolveBountifulHostMonsterForMap(parentId:string,input:{authorityUnchanged:()=>boolean;resolveActual:(resolve:typeof resolvePreparedDnd5eMonsterAttack,source:Source)=>Promise<Resolved>},gateway:Gateway){
 const session=host(),source=await readBountifulNativePreparedReplay(parentId,gateway),before=readDnd5eMonsterNativeExecution(source)
 if(!input.authorityUnchanged())throw Error('bountiful-native-map:stale-caller')
 const resolved=await input.resolveActual(resolvePreparedDnd5eMonsterAttack,source),kernel=readDnd5eMonsterNativeExecution(source)
 if(!kernel||kernel.generation<=(before?.generation??0)||!kernel.result.ok||!resolved.result.ok||!resolved.application)throw Error('bountiful-native-map:actual-facade-execution-required')
 const current=host(),combat=await gateway.loadResource<Synced<Combat>>('combat'),rows=combat&&rowsFor(combat,parentId)
 if(!combat||!rows?.length||rows.some(row=>row.consumed)||session.roomId!==current.roomId||session.memberId!==current.memberId||!input.authorityUnchanged())throw Error('bountiful-native-map:stale-result')
 const publication=Object.freeze(registerDnd5eHostReceipt({version:1 as const}))
 bindings.set(publication,{parentId,roomId:session.roomId,memberId:session.memberId,source,rows:cloneDnd5eHostTransactionInput(rows),kernel,resolved,authorityUnchanged:input.authorityUnchanged})
 return {resolved,publication}
}

/** Uses the ordinary Maps final snapshots after its existing concentration,
 * retaliation, inventory and movement work. Nothing publishes preliminary HP
 * or costs. The protected original group is consumed in this same final CAS. */
export async function publishBountifulHostMonsterMapResult(publication:BountifulNativeMapPublication,snapshots:{characters:{characters:Character[];selectedId?:string|null;updatedAt?:number};maps:{maps:BattleMap[];selectedId?:string|null;updatedAt?:number};combat:SharedCombatState;mapGeometry?:unknown},gateway:Gateway){
 const binding=bindings.get(publication),session=host()
 if(!binding||binding.roomId!==session.roomId||binding.memberId!==session.memberId)throw Error('bountiful-native-map:issued-execution-required')
 const [combat,characters,maps,geometry]=await Promise.all([gateway.loadResource<Synced<Combat>>('combat'),gateway.loadResource<Synced<object>>('characters'),gateway.loadResource<Synced<object>>('maps'),gateway.loadResource<Synced<object>>('map-geometry')])
 const first=binding.rows[0],identity=first.identity,current=combat&&rowsFor(combat,binding.parentId)
 if(combat&&current?.length===binding.rows.length&&current.every(row=>row.consumed?.transactionId===binding.parentId))return {status:'already-committed' as const}
 if(!combat||!characters||!maps||!current||!same(current,binding.rows)||!binding.authorityUnchanged()||combat.active!==true||combat.mapId!==identity.mapId||combat.combatId!==identity.combatId||combat.round!==identity.round||combat.initiativeIndex!==identity.initiativeIndex||JSON.stringify(combat.dnd5eTurnEconomyByToken??{})!==identity.reactionEconomySignature||revision(characters)!==identity.revisions.characters||revision(maps)!==identity.revisions.maps||(geometry?revision(geometry):0)!==identity.revisions['map-geometry'])throw Error('bountiful-native-map:stale-original')
 const boundary=snapshots.combat
 if(boundary.active!==true||boundary.mapId!==identity.mapId||boundary.combatId!==identity.combatId||boundary.round!==identity.round||boundary.initiativeIndex!==identity.initiativeIndex)throw Error('bountiful-native-map:changed-final-boundary')
 const finalMap=snapshots.maps.maps.find(map=>map.id===identity.mapId),kernel=binding.kernel.result
 if(!finalMap||!kernel.ok||!binding.resolved.application)throw Error('bountiful-native-map:real-final-materials-required')
 const economies={...boundary.dnd5eTurnEconomyByToken}
 for(const actor of Object.values(kernel.state.combatants)){
  const active=binding.source.prepared.state.initiativeOrder[identity.initiativeIndex]===actor.id,slot=active?(binding.source.prepared.state.initiativeSlotIds?.[identity.initiativeIndex]??actor.id):actor.id
  const base=economies[actor.id]??combat.dnd5eTurnEconomyByToken?.[actor.id]??createDnd5eTurnEconomyCounts(identity.combatId+':'+identity.round+':'+slot,actor.speed),projected=projectDnd5eHeadlessTurnEconomy(base,actor.turn,actor.speed)
  economies[actor.id]={...projected,action:{...projected.action,current:Math.min(base.action.current,projected.action.current)},bonusAction:{...projected.bonusAction,current:Math.min(base.bonusAction.current,projected.bonusAction.current)},reaction:{...projected.reaction,current:Math.min(base.reaction.current,projected.reaction.current)},movement:{...projected.movement,current:Math.min(base.movement.current,projected.movement.current)}}
 }
 for(const row of binding.rows){
  const choice=decisionFromBountifulOriginalDieReceipt(row,row.request)
  if(!choice||row.request.nativeLucky)continue
  const owner=kernel.state.combatants[choice.ownerId],characterId=binding.source.prepared.characterIdByCombatantId[choice.ownerId],character=snapshots.characters.characters.find(item=>item.id===characterId)
  const event=kernel.events.some(event=>event.type==='ally-natural-one-rerolled'&&event.actorId===choice.ownerId&&event.targetId===row.request.actorId&&event.featureId===choice.featureId&&event.dieIndex===row.request.dieIndex&&event.replacement===choice.replacement&&same(event.originalValues,row.request.originalRolls))
  const effect=character?.dnd5eCombatState?.activeEffects?.some(effect=>effect.source.actorId===choice.ownerId&&effect.source.rulesId===choice.featureId&&effect.definitionId===choice.featureId+':lucky-suppressed'&&effect.tags?.includes('bountiful-luck:racial-lucky-suppressed')&&(identity.effectTimestamp===undefined||effect.appliedAt===identity.effectTimestamp))
  if(!owner||owner.turn.reactionAvailable||!event||!effect||economies[choice.ownerId]?.reaction.current!==0)throw Error('bountiful-native-map:real-cost-not-in-final-materials')
 }
 for(const fact of first.postOriginalD20??[]){
  const actor=kernel.state.combatants[fact.actorId],character=snapshots.characters.characters.find(row=>row.id===fact.characterId)
  if(!actor||!character||binding.source.prepared.characterIdByCombatantId[fact.actorId]!==fact.characterId)throw Error('bountiful-native-map:deferred-cost-not-in-final-materials')
  for(const cost of fact.resourceCosts){
   if(cost.resourceKey===DND5E_CORE_INSPIRATION_RESOURCE_KEY){
    if(!Number.isSafeInteger(actor.inspiration)||character.inspiration!==actor.inspiration)throw Error('bountiful-native-map:deferred-cost-not-in-final-materials')
   }else{
    const expected=actor.classResources[cost.resourceKey],actual=character.classResources?.[cost.resourceKey]
    if(!expected||!actual||actual.current!==expected.current||actual.max!==expected.max)throw Error('bountiful-native-map:deferred-cost-not-in-final-materials')
   }
  }
 }
 const result=encodeSecondChanceParentWire({result:kernel,application:{...binding.resolved.application,map:finalMap,characters:snapshots.characters.characters}}),next={...combat,...boundary,dnd5eTurnEconomyByToken:economies,bountifulOriginalParents:{...combat.bountifulOriginalParents,...Object.fromEntries(binding.rows.map(row=>[JSON.stringify(['bountiful-original-parent',binding.parentId,row.identity.occurrence]),{...row,consumed:{transactionId:binding.parentId,result}}]))}}
 const currentHost=host();if(currentHost.roomId!==session.roomId||currentHost.memberId!==session.memberId||!binding.authorityUnchanged())throw Error('bountiful-native-map:host-changed')
 const commit=await gateway.saveResourcesAtomically([{name:'characters',expectedRevision:revision(characters),data:{...characters,...snapshots.characters}},{name:'maps',expectedRevision:revision(maps),data:{...maps,...snapshots.maps}},{name:'combat',expectedRevision:revision(combat),data:next},...(snapshots.mapGeometry===undefined?[]:[{name:'map-geometry',expectedRevision:geometry?revision(geometry):0,data:snapshots.mapGeometry}])],{transactionId:'bountiful-host-parent:'+binding.parentId,...(snapshots.mapGeometry===undefined?{readRevisions:{'map-geometry':identity.revisions['map-geometry']}}:{})})
 return {status:'committed' as const,commit}
}
