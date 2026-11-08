import {saveBountifulPhase} from './bountifulPhaseCommit'
import {createDnd5eTurnEconomyCounts} from './turnEconomy'
import type {Dnd5eTurnEconomyCounts} from '../../lib/sharedCombatTypes'
import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {Dnd5eActionResult} from './headlessCombatEngine'
import type {Dnd5eMapResultPlan} from './mapBridge'
import {resolveDnd5ePreparedWithMaterialDamageReactions,type Dnd5eDamageReactionFlowOptions} from './damageReactionFlow'
import {encodeSecondChanceParentWire,decodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {captureSecondChancePreparedHostFacts} from '../../pages/maps/secondChancePreparedHostFacts'
import {getRoomSession} from '../../lib/roomSession'
import {bountifulPreparedReplayFacts,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {bountifulOriginalParentReceiptId,actualBountifulResolvers} from './bountifulLuckPersistentHost'
import {readBountifulOriginalSource} from './bountifulLuckPersistentRoomDriver'
import {validateBountifulOriginalParents} from '../../../shared/bountiful-luck-state.mjs'

type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
type Revisioned<T>=T&{_sync?:{revision?:number}}
interface Combat{mapId?:string;combatId?:string;round?:number;initiativeIndex?:number;dnd5eTurnEconomyByToken?:Record<string,Dnd5eTurnEconomyCounts>;bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}
interface ParentResult{result:Dnd5eActionResult;application?:Dnd5eMapResultPlan}
const revision=(value:Revisioned<object>|null)=>value?._sync?.revision??0
const host=()=>{const session=getRoomSession();if(!session||session.role!=='dm')throw Error('bountiful-publish:host-required');return session}
export async function readConsumedBountifulParent(input:{mapId:string;parentId:string},gateway:Pick<Gateway,'loadResource'>):Promise<ParentResult|undefined>{
 const combat=await gateway.loadResource<Combat>('combat'),receipt=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.parentId,0)]
 if(!receipt?.consumed?.result)return undefined
 const session=host();if(receipt.identity.roomId!==session.roomId||receipt.identity.hostMemberId!==session.memberId||receipt.identity.mapId!==input.mapId||receipt.consumed.transactionId!==input.parentId||!validateBountifulOriginalParents(combat!.bountifulOriginalParents))throw Error('bountiful-publish:wrong-consumed-parent')
 const result=decodeSecondChanceParentWire(receipt.consumed.result) as ParentResult
 if(!result?.result?.ok||result.result.state.combatId!==receipt.identity.combatId||!result.application)throw Error('bountiful-publish:invalid-consumed-result')
 return result
}
/** Publishes the real prepared result and every original-die cost in one CAS.
 * The normal Maps ACK must then reload this exact consumed parent and skip a
 * second stale snapshot save. No state is published from the raw preview. */
export async function publishBountifulOriginalParent<Input extends {prepared:{state:import('./headlessCombatEngine').Dnd5eHeadlessCombatState;map:BattleMap;characters:readonly Character[];action:{id:string}}},Result extends ParentResult>(input:{mapId:string;parentId:string;source:Input;resolve:(input:Input)=>Result;options:Dnd5eDamageReactionFlowOptions},gateway:Gateway):Promise<ParentResult>{
 const session=host(),prior=await readConsumedBountifulParent(input,gateway);if(prior)return prior
 const [combat,characters,maps,geometry,queue]=await Promise.all([gateway.loadResource<Revisioned<Combat>>('combat'),gateway.loadResource<Revisioned<{characters:Character[]}>>('characters'),gateway.loadResource<Revisioned<{maps:BattleMap[]}>>('maps'),gateway.loadResource<Revisioned<object>>('map-geometry'),gateway.loadResource<Revisioned<{requests:unknown[]}>>('player-action-requests')])
 const first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.parentId,0)]
 if(!combat||!characters||!maps||!queue||!first||!validateBountifulOriginalParents(combat.bountifulOriginalParents)||first.identity.mapId!==input.mapId||first.identity.roomId!==session.roomId||first.identity.hostMemberId!==session.memberId||combat.combatId!==first.identity.combatId||combat.mapId!==input.mapId||combat.round!==first.identity.round||combat.initiativeIndex!==first.identity.initiativeIndex||JSON.stringify(combat.dnd5eTurnEconomyByToken??{})!==first.identity.reactionEconomySignature||!queue.requests.some(row=>JSON.stringify(row)===JSON.stringify(first.originalRoomAction)))throw Error('bountiful-publish:stale-original-parent')
 const reads:Record<string,number>={characters:revision(characters),maps:revision(maps),'map-geometry':revision(geometry)}
 if(Object.entries(first.identity.revisions).some(([name,value])=>reads[name]!==value))throw Error('bountiful-publish:stale-original-resources')
 const resolverIdentity:unknown=input.resolve
 if(!Object.values(actualBountifulResolvers).some(resolve=>resolve===resolverIdentity))throw Error('bountiful-publish:actual-facade-required')
 const original=await readBountifulOriginalSource(first)
 if(JSON.stringify(input.source.prepared)!==JSON.stringify(original.source.prepared)||Object.entries(original.source).some(([key,value])=>key!=='prepared'&&JSON.stringify(input.source[key as keyof Input])!==JSON.stringify(value)))throw Error('bountiful-publish:changed-original-input')
 const receipts=Object.values(combat.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===input.parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
 const facts=bountifulPreparedReplayFacts({parentId:input.parentId,source:input.source,receipts})
 const source={...input.source,hostOriginalD20Replay:facts}
 const fallback=input.options.chooseAllyNaturalOne
 const result=await resolveDnd5ePreparedWithMaterialDamageReactions({...input.options,chooseAllyNaturalOne:async request=>{
  if(fallback)return fallback(request)
  throw Error('bountiful-publish:new-original-decision-required')
 }},source,input.resolve)
 // Bound facts may be consumed directly inside the actual session, so their
 // unchanged core requests are validated there even if no callback is needed.
 if(!result.result.ok||!result.application)throw Error('bountiful-publish:real-parent-not-resolved')
 const application=result.application,economies={...combat.dnd5eTurnEconomyByToken}
 const economyFor=(actorId:string)=>{
  const actor=result.result.state.combatants[actorId],state=input.source.prepared.state,active=state.initiativeOrder[state.initiativeIndex]===actorId,slot=active?(state.initiativeSlotIds?.[state.initiativeIndex]??actorId):actorId
  return economies[actorId]??createDnd5eTurnEconomyCounts(state.combatId+':'+state.round+':'+slot,actor?.speed??30)
 }
 for(const tokenId of application.spentReactions?.tokenIds??[]){const economy=economyFor(tokenId);if(economy.reaction.current<1)throw Error('bountiful-publish:reaction-unavailable');economies[tokenId]={...economy,reaction:{...economy.reaction,current:economy.reaction.current-1}}}
 for(const [id,actor]of Object.entries(result.result.state.combatants)){
  const before=input.source.prepared.state.combatants[id];if(!before)continue
  if(before.turn.actionAvailable===actor.turn.actionAvailable&&before.turn.bonusActionAvailable===actor.turn.bonusActionAvailable&&before.turn.movementRemaining===actor.turn.movementRemaining)continue
  const economy=economyFor(id),delta=actor.turn.movementRemaining-before.turn.movementRemaining
  economies[id]={...economy,action:{...economy.action,current:before.turn.actionAvailable&&!actor.turn.actionAvailable?0:economy.action.current},bonusAction:{...economy.bonusAction,current:before.turn.bonusActionAvailable&&!actor.turn.bonusActionAvailable?0:economy.bonusAction.current},movement:{...economy.movement,current:Math.max(0,economy.movement.current+delta),spent:Math.max(0,(economy.movement.spent??0)-delta)}}
 }
 const resultWire=encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(result))
 const parents={...combat.bountifulOriginalParents}
 for(const receipt of receipts)parents[bountifulOriginalParentReceiptId(input.parentId,receipt.identity.occurrence)]={...receipt,consumed:{transactionId:input.parentId,...(receipt.identity.occurrence===0?{result:resultWire}:{})}}
 if(!validateBountifulOriginalParents(parents))throw Error('bountiful-publish:invalid-consumed-receipts')
 const current=host();if(current.roomId!==session.roomId||current.memberId!==session.memberId||!input.options.authorityUnchanged())throw Error('bountiful-publish:stale-host')
 await saveBountifulPhase(gateway,[{name:'characters',expectedRevision:revision(characters),data:{...characters,characters:application.characters}},{name:'maps',expectedRevision:revision(maps),data:{...maps,maps:maps.maps.map(map=>map.id===input.mapId?application.map:map)}},{name:'combat',expectedRevision:revision(combat),data:{...combat,dnd5eTurnEconomyByToken:economies,bountifulOriginalParents:parents}}],{transactionId:'bountiful-parent-final:'+input.parentId,readRevisions:{'map-geometry':revision(geometry),'player-action-requests':revision(queue)},undoLabel:'慷慨吉运与原掷骰一起结算'})
 return result
}
