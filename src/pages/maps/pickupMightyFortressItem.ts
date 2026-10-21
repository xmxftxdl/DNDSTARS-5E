import {transferDroppedObjectSurfaceAreas} from '../../rulesets/dnd5e/surfaceAreaTransfer'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {BattleMap} from '../../store/maps'
import type {Character} from '../../types/character'
import type {SharedMapGeometryState} from '../../lib/mapGeometry'
import type {SharedCombatState} from '../../lib/sharedCombatTypes'
import {prepareDnd5eMapInventoryPickup} from '../../rulesets/dnd5e/mapInventoryPickup'
import {dnd5eConditionIncapacitated} from '../../rulesets/dnd5e/conditions'
import {dnd5eConditionsFromActiveEffects} from '../../rulesets/dnd5e/activeEffects'
import {prepareDnd5eFortressServantDrop} from '../../rulesets/dnd5e/fortressServantDrop'
import {prepareDnd5eFortressServantMove,prepareDnd5eFortressServantApproach,type FortressServantPosition} from '../../rulesets/dnd5e/fortressServantMove'
import {spendDnd5eTurnResource} from '../../rulesets/dnd5e/turnEconomy'
import {prepareDnd5eFortressServantDoor} from '../../rulesets/dnd5e/fortressServantDoor'

type Versioned={_sync?:{revision?:number}}
/** The command owner is authenticated by the caller; all game-state prerequisites are read here. */
type FortressItemCommand={
 gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>;
 mapId:string;commanderTokenId:string;servantTokenId:string;requestId:string;
 movement?:{destination:FortressServantPosition;expectedPosition:FortressServantPosition};
}
export function pickupDnd5eMightyFortressItem(input:FortressItemCommand&{objectTokenId:string;expectedReceiptId:string;expectedQuantity:number;approach?:boolean}){
 return operateFortressItem({...input,operation:'pickup'})
}
export function dropDnd5eMightyFortressItem(input:FortressItemCommand&{carriedObjectId:string;expectedPickupReceipt:string}){
 return operateFortressItem({...input,operation:'drop'})
}
export function moveDnd5eMightyFortressServant(input:FortressItemCommand&{movement:NonNullable<FortressItemCommand['movement']>}){
 return operateFortressItem({...input,operation:'move'})
}
export function operateDnd5eMightyFortressDoor(input:FortressItemCommand&{doorId:string;doorOperation:'open'|'close'}){
 return operateFortressItem({...input,operation:'door'})
}
async function operateFortressItem(input:FortressItemCommand&({operation:'pickup';objectTokenId:string;expectedReceiptId:string;expectedQuantity:number;approach?:boolean}|
 {operation:'drop';carriedObjectId:string;expectedPickupReceipt:string}|{operation:'door';doorId:string;doorOperation:'open'|'close'}|{operation:'move';movement:NonNullable<FortressItemCommand['movement']>})){
 if(input.operation==='move'&&!input.movement)return {ok:false as const,reason:'fortress-move-position-invalid'}
 const [maps,geometry,clock,roster,combat]=await Promise.all([
  input.gateway.loadResource<Versioned&{maps:BattleMap[]}>('maps'),
  input.gateway.loadResource<Versioned&SharedMapGeometryState>('map-geometry'),
  input.gateway.loadResource<Versioned&{worldMinute:number}>('campaign-time'),
  input.gateway.loadResource<Versioned&{characters:Character[]}>('characters'),
  input.gateway.loadResource<SharedCombatState>('combat')])
 const map=maps?.maps.find(map=>map.id===input.mapId),scene=geometry?.maps.find(scene=>scene.mapId===input.mapId)
 if(!maps||!geometry||!clock||!map||!scene)return {ok:false as const,reason:'fortress-pickup-snapshot-unavailable'}
 const commander=map.tokens.find(token=>token.id===input.commanderTokenId)
 const character=commander?.characterId?roster?.characters.find(character=>character.id===commander.characterId):undefined
 if(!commander||(commander.characterId&&!character))return {ok:false as const,reason:'fortress-pickup-commander-unavailable'}
 if((character?.currentHp??commander.hp??1)<=0||dnd5eConditionIncapacitated({conditions:[...(character?.conditions??[]),
  ...dnd5eConditionsFromActiveEffects(character?.dnd5eCombatState?.activeEffects??[]),...dnd5eConditionsFromActiveEffects(commander.dnd5eCombatState?.activeEffects??[])]}))return {ok:false as const,reason:'fortress-pickup-commander-unavailable'}
 if(combat?.active&&(combat.mapId!==map.id||combat.flowPause))return {ok:false as const,reason:'pickup-invalid-turn'}
 const economy=combat?.dnd5eTurnEconomyByToken?.[input.commanderTokenId]
 if(combat?.active&&!economy)return {ok:false as const,reason:'pickup-action-unavailable'}
 const turn=combat?.active&&economy?{currentTokenId:combat.initiativeOrder[combat.initiativeIndex]?.tokenId??'',turnEconomy:economy}:undefined
 let commandMap=map
 if(input.movement){
  const moved=prepareDnd5eFortressServantMove({...input,...input.movement,map,geometry:scene,worldMinute:clock.worldMinute})
  if(!moved.ok)return moved
  commandMap=moved.map
 }
 let moveEconomy=undefined as typeof economy
 if((input.operation==='move'||input.operation==='door')&&combat?.active){
  if(!turn||turn.currentTokenId!==input.commanderTokenId)return {ok:false as const,reason:'fortress-move-invalid-turn'}
  const spent=spendDnd5eTurnResource(turn.turnEconomy,'bonusAction')
  if(!spent.ok)return {ok:false as const,reason:'fortress-move-action-unavailable'}
  moveEconomy=spent.economy
 }
 const doorResult=input.operation==='door'?prepareDnd5eFortressServantDoor({...input,map:commandMap,geometry:scene,worldMinute:clock.worldMinute,combatId:combat?.combatId,round:combat?.round}):undefined
 if(doorResult&&!doorResult.ok)return doorResult
 let prepared=input.operation==='door'?{ok:true as const,map:commandMap,turnEconomy:moveEconomy,message:doorResult?.ok?doorResult.message:''}:input.operation==='move'?{ok:true as const,map:commandMap,turnEconomy:moveEconomy,message:'堡垒仆役已移动。'}:input.operation==='drop'?prepareDnd5eFortressServantDrop({...input,map:commandMap,geometry:scene,worldMinute:clock.worldMinute,
  combatActive:combat?.active===true,combat:turn}):prepareDnd5eMapInventoryPickup({map:commandMap,geometry:scene,characters:roster?.characters??[],actorTokenId:input.servantTokenId,
  objectTokenId:input.objectTokenId,expectedReceiptId:input.expectedReceiptId,expectedQuantity:input.expectedQuantity,
  fortressOrder:{commanderTokenId:input.commanderTokenId,worldMinute:clock.worldMinute},combatActive:combat?.active===true,
  combat:turn})
 if(input.operation==='pickup'&&input.approach===true&&!input.movement&&!prepared.ok&&prepared.reason==='pickup-out-of-reach'){
  const moved=prepareDnd5eFortressServantApproach({...input,map,geometry:scene,worldMinute:clock.worldMinute})
  if(!moved.ok)return moved
  prepared=prepareDnd5eMapInventoryPickup({map:moved.map,geometry:scene,characters:roster?.characters??[],actorTokenId:input.servantTokenId,
   objectTokenId:input.objectTokenId,expectedReceiptId:input.expectedReceiptId,expectedQuantity:input.expectedQuantity,
   fortressOrder:{commanderTokenId:input.commanderTokenId,worldMinute:clock.worldMinute},combatActive:combat?.active===true,combat:turn})
 }
 if(!prepared.ok)return prepared
 const revision=(value:Versioned|null)=>{
  if(value===null)return 0
  const revision=value._sync?.revision
  if(!Number.isSafeInteger(revision)||revision!<0)throw Error('fortress-pickup-revision-missing')
  return revision!
 }
 let nextMaps=maps.maps.map(candidate=>candidate.id===map.id?prepared.map:candidate)
 if(input.operation==='drop')nextMaps=transferDroppedObjectSurfaceAreas(nextMaps,map.id,'carried:'+input.carriedObjectId,clock.worldMinute,scene)
 const writes=[{name:'maps',expectedRevision:revision(maps),data:{...maps,maps:nextMaps}}] as {name:string;expectedRevision:number;data:unknown}[]
 const readRevisions:Record<string,number>={'map-geometry':revision(geometry),'campaign-time':revision(clock),characters:revision(roster)}
 if(doorResult?.ok){
  writes.push({name:'map-geometry',expectedRevision:revision(geometry),data:{...geometry,maps:geometry.maps.map(candidate=>candidate.mapId===map.id?doorResult.geometry:candidate)}})
  delete readRevisions['map-geometry']
 }
 if(combat?.active&&prepared.turnEconomy)writes.push({name:'combat',expectedRevision:revision(combat),data:{...combat,
  dnd5eTurnEconomyByToken:{...combat.dnd5eTurnEconomyByToken,[input.commanderTokenId]:prepared.turnEconomy}}})
 else readRevisions.combat=revision(combat)
 await input.gateway.saveResourcesAtomically(writes,{transactionId:`fortress-${input.operation}:${input.requestId}`,undoLabel:input.operation==='door'?'堡垒仆役开关门':input.operation==='move'?'堡垒仆役移动':input.operation==='drop'?'堡垒仆役放下':'堡垒仆役拾取',readRevisions})
 return {ok:true as const,message:prepared.message}
}
