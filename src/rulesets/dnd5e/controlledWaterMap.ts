import {normalizeControlledWaterState} from '../../../shared/controlled-water-state.mjs'
import type {MapGeometryObstacle,MapGeometryState} from '../../lib/mapGeometry'
import {mapGeometryVolumeMovementBlocked} from '../../lib/mapGeometry'
import type {BattleMap} from '../../store/maps'
import {changeDnd5eControlledWater,dismissDnd5eWaterAlteration,projectDnd5eControlledWater,type Dnd5eWaterChange} from './controlledWater'
import {partitionDnd5eControlledWaterVolume} from './controlledWaterPartition'
import {selectDnd5eControlledWaterTarget} from './controlledWaterTarget'

/** Pure Host proposal; caller must commit geometry and Activity costs together. */
export function prepareDnd5eWaterAppearanceMapChange(input:{
 map:BattleMap;geometries:readonly MapGeometryState[];actorTokenId:string;casterId:string;actionId:string;worldMinute:number;
 rules?: import('./controlledWater').Dnd5eWaterRules;
 selection:{waterId:string;region:NonNullable<Parameters<typeof selectDnd5eControlledWaterTarget>[0]['selection']>;change:Dnd5eWaterChange}|{dismissEffectId:string}
}):{ok:true;geometries:MapGeometryState[]}|{ok:false;reason:string}{
 const fail=(reason:string)=>({ok:false as const,reason})
 if(!input.casterId||!input.actionId||!Number.isFinite(input.worldMinute)||input.worldMinute<0)return fail('invalid-water-declaration')
 if(input.map.tokens.filter(t=>t.id===input.actorTokenId).length!==1||new Set(input.geometries.map(g=>g.mapId)).size!==input.geometries.length)return fail('invalid-water-scene')
 const geometry=input.geometries.find(g=>g.mapId===input.map.id)
 if(!geometry)return fail('invalid-water-scene')
 const key=(mapId:string,id:string)=>JSON.stringify([mapId,id])
 const collect=(geometries:readonly MapGeometryState[])=>geometries.flatMap(g=>g.obstacles.flatMap(o=>{
  const water=normalizeControlledWaterState(o.controlledWater)
  return water?[{...water,id:key(g.mapId,o.id)}]:[]
 }))
 for(const g of input.geometries){
  if(new Set(g.obstacles.map(o=>o.id)).size!==g.obstacles.length)return fail('invalid-water-scene')
  for(const o of g.obstacles)if(o.controlledWater&&normalizeControlledWaterState(o.controlledWater)?.id!==o.id)return fail('invalid-water-scene')
 }
 const all=collect(input.geometries)
 if('dismissEffectId'in input.selection){
  const result=dismissDnd5eWaterAlteration(all,input.casterId,input.selection.dismissEffectId,input.worldMinute)
  if(!result.ok)return result
  const byId=new Map(result.waters.map(w=>[w.id,w]))
  return {ok:true,geometries:input.geometries.map(g=>({...g,obstacles:g.obstacles.map(o=>{
   const water=byId.get(key(g.mapId,o.id));return water?{...o,controlledWater:{...water,id:o.id}}:o
  })}))}
 }
 const selection=input.selection,chosen=geometry.obstacles.find(o=>o.id===selection.waterId)
 if(!chosen?.controlledWater)return fail('invalid-water-target')
 if(all.some(w=>w.appliedActionIds.includes(input.actionId)))return fail('water-action-already-applied')
 const sourceId=chosen.controlledWater.sourceWaterId??chosen.id
 const selected:MapGeometryObstacle[]=[],replacements=new Map<string,MapGeometryObstacle[]>()
 let visible=false,distanceFeet=Infinity,containsCreatures=false
 for(const [index,body] of geometry.obstacles.entries()){
  if(!body.controlledWater||(body.controlledWater.sourceWaterId??body.id)!==sourceId)continue
  const target=selectDnd5eControlledWaterTarget({map:input.map,geometry,actorTokenId:input.actorTokenId,waterId:body.id,worldMinute:input.worldMinute,selection:selection.region})
  if(!target)continue
  if(projectDnd5eControlledWater(target.water,input.worldMinute).frozen)return fail('water-is-frozen')
  const partition=partitionDnd5eControlledWaterVolume({body,feetPerPixel:(input.map.feetPerCell??5)/input.map.gridSize,
    partitionId:`${input.actionId}:${index}`,center:selection.region.center,dimensionsFeet:selection.region.dimensionsFeet,baseElevationFeet:selection.region.baseElevationFeet})
  if(!partition)return fail('invalid-water-partition')
  selected.push(...partition.selected);replacements.set(body.id,[...partition.remainder,...partition.selected])
  visible ||= target.visible
  if(target.visible)distanceFeet=Math.min(distanceFeet,input.rules?.rangeFromBody?target.bodyDistanceFeet:target.distanceFeet)
  containsCreatures ||= target.containsCreatures
 }
 if(!selected.length)return fail('invalid-water-target')
 const changedGeometry={...geometry,obstacles:geometry.obstacles.flatMap(o=>replacements.get(o.id)??[o])}
 if(new Set(changedGeometry.obstacles.map(o=>o.id)).size!==changedGeometry.obstacles.length)return fail('water-partition-id-conflict')
 const scenes=input.geometries.map(g=>g.mapId===geometry.mapId?changedGeometry:g)
 const selectedIds=new Set(selected.map(o=>o.id))
 if(selection.change.kind==='move'){
  const delta=selection.change.displacementFeet,scale=(input.map.feetPerCell??5)/input.map.gridSize
  if(![delta.x,delta.y,delta.z].every(Number.isFinite)||Math.hypot(delta.x,delta.y,delta.z)>5+1e-7||Math.hypot(delta.x,delta.y,delta.z)<=0)return fail('invalid-water-movement')
  const dx=delta.x/scale,dy=delta.y/scale
  const collisionGeometry={...changedGeometry,obstacles:changedGeometry.obstacles.filter(body=>!selectedIds.has(body.id))}
  for(const body of selected){
   const water=body.controlledWater!,from={x:water.positionFeet.x/scale,y:water.positionFeet.y/scale}
   if(body.points.some(p=>p.x+dx<0||p.y+dy<0||p.x+dx>input.map.width||p.y+dy>input.map.height))return fail('water-destination-outside-map')
   if(mapGeometryVolumeMovementBlocked({geometry:collisionGeometry,map:input.map,from,to:{x:from.x+dx,y:from.y+dy},footprint:body.points,
    fromElevationFeet:body.baseHeightFeet,toElevationFeet:body.baseHeightFeet+delta.z,
    halfSizePixels:Math.max(water.dimensionsFeet.x,water.dimensionsFeet.y)/scale/2,heightFeet:body.heightFeet,worldMinute:input.worldMinute}).blocked)return fail('water-movement-blocked')
  }
  const validation=changeDnd5eControlledWater({waters:collect(scenes),waterId:key(geometry.mapId,selected[0].id),casterId:input.casterId,
   actionId:input.actionId,worldMinute:input.worldMinute,rules:input.rules,distanceFeet,visible,change:selection.change,movementPathClear:true})
  if(!validation.ok)return validation
  return {ok:true,geometries:scenes.map(g=>g.mapId!==geometry.mapId?g:{...g,obstacles:g.obstacles.map(body=>{
   if(!selectedIds.has(body.id))return body
   const water=body.controlledWater!
   return {...body,points:body.points.map(p=>({x:p.x+dx,y:p.y+dy})),baseHeightFeet:body.baseHeightFeet+delta.z,
    controlledWater:{...water,positionFeet:{x:water.positionFeet.x+delta.x,y:water.positionFeet.y+delta.y,z:water.positionFeet.z+delta.z},
     alterations:water.alterations.filter(e=>e.expiresAtWorldMinute>input.worldMinute).map(e=>e.drawingFrameFeet?{...e,drawingFrameFeet:{...e.drawingFrameFeet,x:e.drawingFrameFeet.x+delta.x,y:e.drawingFrameFeet.y+delta.y}}:e),appliedActionIds:[...water.appliedActionIds,input.actionId]}}
  })})}
 }
 const result=changeDnd5eControlledWater({waters:collect(scenes),waterId:key(geometry.mapId,selected[0].id),casterId:input.casterId,
  actionId:input.actionId,worldMinute:input.worldMinute,rules:input.rules,distanceFeet,visible,containsCreatures,change:selection.change})
 if(!result.ok)return result
 const effect=result.waters.find(w=>w.id===key(geometry.mapId,selected[0].id))!.alterations.find(e=>e.id===input.actionId)!
 if(effect.kind==='shape'&&effect.drawing){
  const scale=(input.map.feetPerCell??5)/input.map.gridSize,region=selection.region
  effect.drawingFrameFeet={x:region.center.x*scale-region.dimensionsFeet.x/2,y:region.center.y*scale-region.dimensionsFeet.y/2,width:region.dimensionsFeet.x,height:region.dimensionsFeet.y}
 }
 return {ok:true,geometries:scenes.map(g=>g.mapId!==geometry.mapId?g:{...g,obstacles:g.obstacles.map(o=>!selectedIds.has(o.id)?o:{...o,
  controlledWater:{...o.controlledWater!,alterations:[...o.controlledWater!.alterations.filter(e=>e.expiresAtWorldMinute>input.worldMinute),structuredClone(effect)],
   appliedActionIds:[...o.controlledWater!.appliedActionIds,input.actionId]}})})}
}
