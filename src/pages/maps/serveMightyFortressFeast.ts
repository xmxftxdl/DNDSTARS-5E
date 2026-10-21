import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {BattleMap} from '../../store/maps'
import type {SharedMapGeometryState} from '../../lib/mapGeometry'
import {prepareDnd5eMightyFortressFeast} from '../../rulesets/dnd5e/mightyFortressServices'

type Versioned={_sync?:{revision?:number}}
/** Host-only request handler. Resolve mealTemplateId from trusted module configuration before calling. */
export async function serveDnd5eMightyFortressFeast(input:{
 gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>;
 mapId:string;structureId:string;actorTokenId:string;requestId:string;expectedWorldDay:number;guests:number;mealTemplateId?:string;
}) {
 const [maps,geometry,clock]=await Promise.all([
  input.gateway.loadResource<Versioned&{maps:BattleMap[]}>('maps'),
  input.gateway.loadResource<Versioned&SharedMapGeometryState>('map-geometry'),
  input.gateway.loadResource<Versioned&{worldMinute:number}>('campaign-time')])
 const map=maps?.maps.find(map=>map.id===input.mapId),scene=geometry?.maps.find(scene=>scene.mapId===input.mapId)
 if(!maps||!geometry||!clock||!map||!scene)return {ok:false as const,reason:'fortress-feast-snapshot-unavailable'}
 const prepared=prepareDnd5eMightyFortressFeast({...input,map,geometry:scene,worldMinute:clock.worldMinute})
 if(!prepared.ok)return prepared
 const revision=(value:Versioned)=>{
  const revision=value._sync?.revision
  if(!Number.isSafeInteger(revision)||revision!<0)throw Error('fortress-feast-revision-missing')
  return revision!
 }
 await input.gateway.saveResourcesAtomically([
  {name:'maps',expectedRevision:revision(maps),data:{...maps,maps:maps.maps.map(candidate=>candidate.id===map.id?prepared.map:candidate)}},
  {name:'map-geometry',expectedRevision:revision(geometry),data:{...geometry,maps:geometry.maps.map(candidate=>candidate.mapId===map.id?prepared.geometry:candidate)}},
 ],{transactionId:`fortress-feast:${input.requestId}`,undoLabel:'堡垒供餐',readRevisions:{'campaign-time':revision(clock)}})
 return {ok:true as const,remainingGuests:prepared.remainingGuests}
}
