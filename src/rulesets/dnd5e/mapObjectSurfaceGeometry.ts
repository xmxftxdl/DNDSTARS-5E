import {createEmptyMapGeometry,mapGeometryTokenElevation,mapGeometryEntityBodyHeightFeet,type MapGeometryState,type MapGeometryObstacle} from '../../lib/mapGeometry'
import type {BattleMap} from '../../store/maps'
import {normalizeDnd5eMapObjectSurface} from './mapObjectSurface'
import type {Character} from '../../types/character'
import type {Token} from '../../store/maps'

/** Query-only objects at the carrier's display height. Hidden inventory entries
 * are deliberately absent; the inventory instance remains the physical owner. */
export function exposedInventorySurfaceTokens(map:BattleMap,geometry:MapGeometryState|undefined,characters:readonly Character[]):Token[]{
  const result:Token[]=[]
  const represented=new Set(map.tokens.flatMap(token=>token.dnd5eObjectState?.surfaceProfile?.surfaceId?[token.dnd5eObjectState.surfaceProfile.surfaceId]:[]))
  for(const carrier of map.tokens){
    if(!carrier.characterId||!['player','enemy'].includes(carrier.type))continue
    const character=characters.find(character=>character.id===carrier.characterId)
    const entries=[...(character?.dnd5eInventory?.entries??[]),...(character?.dnd5eExposedSurfaces??[]).map(profile=>({
      instanceId:profile.surfaceId??'',quantity:1,surfaceExposed:true,surfaceProfile:profile,containerInstanceId:undefined,condition:undefined,
    }))]
    for(const entry of entries){
      const profile=normalizeDnd5eMapObjectSurface(entry.surfaceProfile)
      if(entry.surfaceExposed!==true||entry.quantity!==1||entry.containerInstanceId||entry.condition?.destroyed||!profile)continue
      const surfaceId=profile.surfaceId??`inventory:${entry.instanceId}`
      if(represented.has(surfaceId))continue
      represented.add(surfaceId)
      result.push({id:`exposed:${carrier.id}:${entry.instanceId}`,type:'obstacle',label:'展示的物件',
        x:carrier.x,y:carrier.y,elevationFeet:mapGeometryTokenElevation(geometry,carrier)+(mapGeometryEntityBodyHeightFeet(carrier)??5)/2,
        size:1,color:'',emoji:'',dnd5eObjectState:{schemaVersion:1,wornOrCarried:true,surfaceProfile:{...profile,surfaceId}}})
    }
  }
  return result
}

/** Query-only physical surfaces. Never installs inferred walls in the map editor. */
export function mapGeometryWithObjectSurfaces(map:BattleMap,geometry:MapGeometryState|undefined,characters:readonly Character[]=[]):MapGeometryState {
  const base=geometry??createEmptyMapGeometry(map.id,0)
  const scale=map.gridSize/(map.feetPerCell??5)
  if(base.mapId!==map.id||!Number.isFinite(scale)||scale<=0)return base
  const surfaces:MapGeometryObstacle[]=[...map.tokens,...exposedInventorySurfaceTokens(map,base,characters)].flatMap(token=>{
    const profile=normalizeDnd5eMapObjectSurface(token.dnd5eObjectState?.surfaceProfile)
    if(token.type!=='obstacle'||!profile||
      (token.hp!=null&&token.hp<=0)||![token.x,token.y].every(Number.isFinite))return []
    const angle=profile.rotationDegrees*Math.PI/180,ux=Math.cos(angle),uy=Math.sin(angle)
    const hw=profile.widthFeet*scale/2,hl=profile.lengthFeet*scale/2
    const points=[[-hw,-hl],[hw,-hl],[hw,hl],[-hw,hl]].map(([x,y])=>({x:token.x+x*ux-y*uy,y:token.y+x*uy+y*ux}))
    return [{id:`surface-object:${profile.surfaceId ?? token.id}`,kind:'obstacle' as const,label:token.label,points,cover:'total' as const,
      surfaceMaterial:profile.material,baseHeightFeet:mapGeometryTokenElevation(base,token),heightFeet:profile.heightFeet,
      blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:0}]
  })
  return surfaces.length?{...base,obstacles:[...base.obstacles,...surfaces]}:base
}
