import {getRoomSession} from '../../lib/roomSession'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {Dnd5eTurnEconomyByToken} from '../../lib/sharedCombatTypes'
import {bountifulIssuedHostOperation} from './bountifulHostOperation'
import {recoverBountifulHostOperation} from './bountifulHostOperationPersistent'
import {decisionFromBountifulOriginalDieReceipt,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {originalD20ReplaySourceKey} from './allyNaturalOneCheckpoint'
import {resolvePreparedDnd5eMonsterAttack} from './monsterAttackAction'
import {resolveDnd5ePreparedWithMaterialDamageReactions,type Dnd5eDamageReactionFlowOptions} from './damageReactionFlow'
import {createDnd5eTurnEconomyCounts,projectDnd5eHeadlessTurnEconomy} from './turnEconomy'
import {encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {captureSecondChancePreparedHostFacts} from '../../pages/maps/secondChancePreparedHostFacts'
import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'

type Synced<T>=T&{_sync:{revision:number}}
interface Combat{mapId?:string;combatId?:string;active?:boolean;round?:number;initiativeIndex?:number;dnd5eTurnEconomyByToken?:Dnd5eTurnEconomyByToken;bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)

/** Resolve the concrete native facade ourselves. There is no result, prepared
 * state, principal, cost or final snapshot argument for callers to fabricate. */
export async function publishBountifulHostMonsterOperation(parentId:string,options:Dnd5eDamageReactionFlowOptions,gateway:Gateway){
 const host=getRoomSession(),combat=await gateway.loadResource<Synced<Combat>>('combat'),id=JSON.stringify(['bountiful-original-parent',parentId,0]),row=combat?.bountifulOriginalParents?.[id]
 if(!host||host.role!=='dm'||!row||row.identity.roomId!==host.roomId||row.identity.hostMemberId!==host.memberId)throw Error('bountiful-native-publish:actual-host-parent-required')
 if(row.consumed)return {status:'already-committed' as const,result:row.consumed.result}
 const capability=await recoverBountifulHostOperation(parentId,gateway,{includeDamage:true}),facts=bountifulIssuedHostOperation(capability),source=facts.source
 const rows=Object.values(combat.bountifulOriginalParents??{}).filter(item=>item.identity.parentId===parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence),decisions=rows.map(item=>({receipt:item,decision:decisionFromBountifulOriginalDieReceipt(item,item.request)})),effectTimestamp=row.identity.effectTimestamp
 const replay={parentId,sourceKey:originalD20ReplaySourceKey(parentId,source.prepared.state,facts.operation,effectTimestamp),facts:decisions.map(({receipt,decision})=>({occurrence:receipt.identity.occurrence,request:receipt.request,decision})),...(effectTimestamp===undefined?{}:{effectTimestamp})}
 if(!options.authorityUnchanged())throw Error('bountiful-native-publish:stale-caller')
 const resolved=await resolveDnd5ePreparedWithMaterialDamageReactions({...options,chooseAllyNaturalOne:async()=>{throw Error('bountiful-native-publish:next-original-checkpoint-required')}},{...source,hostOriginalD20Replay:replay},resolvePreparedDnd5eMonsterAttack)
 if(!resolved.result.ok||!resolved.application)throw Error('bountiful-native-publish:actual-native-result-required')
 const [current,characters,maps,geometry]=await Promise.all([gateway.loadResource<Synced<Combat>>('combat'),gateway.loadResource<Synced<{characters:Character[]}>>('characters'),gateway.loadResource<Synced<{maps:BattleMap[]}>>('maps'),gateway.loadResource<Synced<object>>('map-geometry')])
 if(!current||!characters||!maps||!same(current,combat)||!options.authorityUnchanged()||row.identity.revisions.characters!==characters._sync.revision||row.identity.revisions.maps!==maps._sync.revision||row.identity.revisions['map-geometry']!==(geometry?._sync.revision??0))throw Error('bountiful-native-publish:stale-final-source')
 const economies={...current.dnd5eTurnEconomyByToken}
 for(const actor of Object.values(resolved.result.state.combatants)){
  const active=source.prepared.state.initiativeOrder[source.prepared.state.initiativeIndex]===actor.id,slot=active?(source.prepared.state.initiativeSlotIds?.[source.prepared.state.initiativeIndex]??actor.id):actor.id
  economies[actor.id]=projectDnd5eHeadlessTurnEconomy(economies[actor.id]??createDnd5eTurnEconomyCounts(facts.operation.combatId+':'+source.prepared.state.round+':'+slot,actor.speed),actor.turn,actor.speed)
 }
 for(const {receipt,decision} of decisions)if(decision&&!receipt.request.nativeLucky){
  const actor=resolved.result.state.combatants[decision.ownerId],character=resolved.application.characters.find(item=>item.id===source.prepared.characterIdByCombatantId[decision.ownerId])
  if(!actor||actor.turn.reactionAvailable||!character?.dnd5eCombatState?.activeEffects?.some(effect=>effect.definitionId===decision.featureId+':lucky-suppressed')||!resolved.result.events.some(event=>event.type==='ally-natural-one-rerolled'&&event.actorId===decision.ownerId&&event.targetId===receipt.request.actorId&&event.replacement===decision.replacement))throw Error('bountiful-native-publish:real-cost-not-projected')
 }
 const result=encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(resolved)),next={...current,dnd5eTurnEconomyByToken:economies,bountifulOriginalParents:{...current.bountifulOriginalParents,...Object.fromEntries(rows.map(item=>[JSON.stringify(['bountiful-original-parent',parentId,item.identity.occurrence]),{...item,consumed:{transactionId:parentId,result}}]))}}
 const latestHost=getRoomSession()
 if(!latestHost||latestHost.role!=='dm'||latestHost.roomId!==host.roomId||latestHost.memberId!==host.memberId)throw Error('bountiful-native-publish:host-changed')
 const committed=await gateway.saveResourcesAtomically([{name:'characters',expectedRevision:characters._sync.revision,data:{...characters,characters:resolved.application.characters}},{name:'maps',expectedRevision:maps._sync.revision,data:{...maps,maps:maps.maps.map(map=>map.id===facts.operation.mapId?resolved.application!.map:map)}},{name:'combat',expectedRevision:current._sync.revision,data:next}],{transactionId:'bountiful-host-parent:'+parentId,readRevisions:{'map-geometry':geometry?._sync.revision??0}})
 return {status:'committed' as const,result,commit:committed}
}
