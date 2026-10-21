import {normalizeControlledWaterState} from '../../../shared/controlled-water-state.mjs'
import {mapGeometryCanSeePoint,mapGeometryEntityBodyHeightFeet,mapGeometryTokenElevation,type MapGeometryState} from '../../lib/mapGeometry'
import {partitionByConvexPolygon,polygonSignedArea} from '../../lib/convexPolygonPartition'
import type {BattleMap} from '../../store/maps'

/** Resolves an authored water body. Client IDs cannot supply range or empty-water facts. */
export function selectDnd5eControlledWaterTarget(input:{map:BattleMap;geometry:MapGeometryState;actorTokenId:string;waterId:string;worldMinute:number;
  selection?:{center:{x:number;y:number};dimensionsFeet:{x:number;y:number;z:number};baseElevationFeet:number}}){
  const {map,geometry}=input,scale=(map.feetPerCell??5)/map.gridSize
  if(geometry.mapId!==map.id||!Number.isFinite(scale)||scale<=0||!Number.isFinite(input.worldMinute)||input.worldMinute<0)return undefined
  const actors=map.tokens.filter(t=>t.id===input.actorTokenId)
  const bodies=geometry.obstacles.filter(o=>o.id===input.waterId)
  if(actors.length!==1||bodies.length!==1)return undefined
  const actor=actors[0],body=bodies[0],water=normalizeControlledWaterState(body.controlledWater)
  if(!water||water.id!==body.id||body.points.length<3)return undefined
  let footprint=body.points,baseElevationFeet=body.baseHeightFeet,heightFeet=body.heightFeet
  if(input.selection){
    const {center,dimensionsFeet:dimensions,baseElevationFeet:base}=input.selection
    if(![center.x,center.y,base].every(Number.isFinite)||!['x','y','z'].every(k=>{
      const n=dimensions[k as keyof typeof dimensions];return Number.isFinite(n)&&n>0&&n<=5
    }))return undefined
    const halfX=dimensions.x/scale/2,halfY=dimensions.y/scale/2
    const box=[{x:center.x-halfX,y:center.y-halfY},{x:center.x+halfX,y:center.y-halfY},
      {x:center.x+halfX,y:center.y+halfY},{x:center.x-halfX,y:center.y+halfY}]
    const cut=partitionByConvexPolygon(body.points,box)
    if(!cut||Math.abs(polygonSignedArea(cut.inside))<=1e-7)return undefined
    footprint=cut.inside
    baseElevationFeet=Math.max(base,body.baseHeightFeet)
    heightFeet=Math.min(base+dimensions.z,body.baseHeightFeet+body.heightFeet)-baseElevationFeet
  }
  const xs=footprint.map(p=>p.x),ys=footprint.map(p=>p.y)
  if(![...xs,...ys,body.baseHeightFeet,body.heightFeet,actor.x,actor.y].every(Number.isFinite))return undefined
  const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys)
  const dimensionsFeet={x:(right-left)*scale,y:(bottom-top)*scale,z:heightFeet}
  if(!Object.values(dimensionsFeet).every(n=>n>0&&n<=5))return undefined
  // Live geometry takes precedence over stale duplicated coordinates in a save.
  const positionFeet={x:(left+right)*scale/2,y:(top+bottom)*scale/2,z:baseElevationFeet}
  const actorElevation=mapGeometryTokenElevation(geometry,actor)
  const surface={x:(left+right)/2,y:(top+bottom)/2,elevationFeet:baseElevationFeet+heightFeet}
  const distanceFeet=Math.hypot((surface.x-actor.x)*scale,(surface.y-actor.y)*scale,surface.elevationFeet-actorElevation)
  const half=actor.size*map.gridSize/2
  const actorFootprint=[{x:actor.x-half,y:actor.y-half},{x:actor.x+half,y:actor.y-half},{x:actor.x+half,y:actor.y+half},{x:actor.x-half,y:actor.y+half}]
  const overlap=partitionByConvexPolygon(footprint,actorFootprint)
  const pointSegment=(p:{x:number;y:number},a:{x:number;y:number},b:{x:number;y:number})=>{
    const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy
    const t=length===0?0:Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length))
    return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)
  }
  const horizontal=overlap&&Math.abs(polygonSignedArea(overlap.inside))>1e-7?0:Math.min(
    ...actorFootprint.flatMap(p=>footprint.map((a,i)=>pointSegment(p,a,footprint[(i+1)%footprint.length]))),
    ...footprint.flatMap(p=>actorFootprint.map((a,i)=>pointSegment(p,a,actorFootprint[(i+1)%actorFootprint.length]))))*scale
  const actorTop=actorElevation+(mapGeometryEntityBodyHeightFeet(actor)??5)
  const vertical=Math.max(0,baseElevationFeet-actorTop,actorElevation-baseElevationFeet-heightFeet)
  const bodyDistanceFeet=Math.hypot(horizontal,vertical)
  const visible=mapGeometryCanSeePoint({map,geometry,viewer:actor,point:surface,worldMinute:input.worldMinute})
  const containsCreatures=map.tokens.some(token=>{
    if(token.type==='obstacle')return false
    const base=mapGeometryTokenElevation(geometry,token),height=mapGeometryEntityBodyHeightFeet(token)??5
    if(base>=baseElevationFeet+heightFeet||base+height<=baseElevationFeet)return false
    const half=token.size*map.gridSize/2
    const square=[{x:token.x-half,y:token.y-half},{x:token.x+half,y:token.y-half},{x:token.x+half,y:token.y+half},{x:token.x-half,y:token.y+half}]
    const intersection=partitionByConvexPolygon(footprint,square)
    return !!intersection&&Math.abs(polygonSignedArea(intersection.inside))>1e-7
  })
  return {water:{...water,positionFeet,dimensionsFeet},footprint:footprint.map(p=>({...p})),distanceFeet,bodyDistanceFeet,visible,containsCreatures}
}
