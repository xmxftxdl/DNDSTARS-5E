import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {BattleMap} from '../../store/maps'
import type {SharedMapGeometryState} from '../../lib/mapGeometry'
import {prepareDnd5eFortressServantCommand} from '../../rulesets/dnd5e/mightyFortressCommands'

type Versioned={_sync?:{revision?:number}}
/** Host rechecks delegates and presence using the same snapshots fenced at commit. */
export async function commandDnd5eMightyFortressServants(input:{
 gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>;
 mapId:string;structureId:string;actorTokenId:string;requestId:string;servantNumbers:readonly number[];instruction:string;
}){
 const [maps,geometry,clock]=await Promise.all([
  input.gateway.loadResource<Versioned&{maps:BattleMap[]}>('maps'),
  input.gateway.loadResource<Versioned&SharedMapGeometryState>('map-geometry'),
  input.gateway.loadResource<Versioned&{worldMinute:number}>('campaign-time')])
 const map=maps?.maps.find(map=>map.id===input.mapId),scene=geometry?.maps.find(scene=>scene.mapId===input.mapId)
 if(!maps||!geometry||!clock||!map||!scene)return {ok:false as const,reason:'fortress-command-snapshot-unavailable'}
 const prepared=prepareDnd5eFortressServantCommand({...input,map,geometry:scene,worldMinute:clock.worldMinute})
 if(!prepared.ok)return prepared
 const revision=(value:Versioned)=>{
  const revision=value._sync?.revision
  if(!Number.isSafeInteger(revision)||revision!<0)throw Error('fortress-command-revision-missing')
  return revision!
 }
 await input.gateway.saveResourcesAtomically([
  {name:'map-geometry',expectedRevision:revision(geometry),data:{...geometry,maps:geometry.maps.map(candidate=>candidate.mapId===map.id?prepared.geometry:candidate)}},
 ],{transactionId:`fortress-command:${input.requestId}`,undoLabel:'堡垒仆役指令',readRevisions:{maps:revision(maps),'campaign-time':revision(clock)}})
 return {ok:true as const}
}
