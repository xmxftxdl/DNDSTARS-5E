import {normalizeControlledWaterState} from '../../../shared/controlled-water-state.mjs'
import type {MapGeometryObstacle,MapGeometryPoint} from '../../lib/mapGeometry'
import {partitionByConvexPolygon,polygonSignedArea} from '../../lib/convexPolygonPartition'
import {triangulateSimplePolygon} from '../../lib/triangulateSimplePolygon'

/** Disjoint water prisms: only selected pieces may receive a new spell effect. */
export function partitionDnd5eControlledWaterVolume(input:{
  body:MapGeometryObstacle;feetPerPixel:number;partitionId:string;
  center:{x:number;y:number};dimensionsFeet:{x:number;y:number;z:number};baseElevationFeet:number;
}):{selected:MapGeometryObstacle[];remainder:MapGeometryObstacle[]}|undefined {
  const {body,feetPerPixel:scale,dimensionsFeet:size,center}=input
  const water=normalizeControlledWaterState(body.controlledWater)
  if(!water||water.id!==body.id||!input.partitionId||!Number.isFinite(scale)||scale<=0||
    ![center.x,center.y,input.baseElevationFeet,body.baseHeightFeet,body.heightFeet].every(Number.isFinite)||body.heightFeet<=0||
    ![size.x,size.y,size.z].every(n=>Number.isFinite(n)&&n>0&&n<=5))return undefined
  const triangles=triangulateSimplePolygon(body.points)
  if(!triangles)return undefined
  const bottom=Math.max(body.baseHeightFeet,input.baseElevationFeet)
  const top=Math.min(body.baseHeightFeet+body.heightFeet,input.baseElevationFeet+size.z)
  if(top<=bottom)return undefined
  const dx=size.x/scale/2,dy=size.y/scale/2
  const box=[{x:center.x-dx,y:center.y-dy},{x:center.x+dx,y:center.y-dy},{x:center.x+dx,y:center.y+dy},{x:center.x-dx,y:center.y+dy}]
  const selected:MapGeometryObstacle[]=[],remainder:MapGeometryObstacle[]=[]
  let index=0,invalid=false
  const append=(list:MapGeometryObstacle[],points:MapGeometryPoint[],base:number,height:number)=>{
    if(height<=1e-9||Math.abs(polygonSignedArea(points))<=1e-7)return
    const id=`${input.partitionId}:water:${index++}`
    if(id.length>200){invalid=true;return}
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y)
    const left=Math.min(...xs),right=Math.max(...xs),upper=Math.min(...ys),lower=Math.max(...ys)
    list.push({...structuredClone(body),id,points:points.map(p=>({...p})),baseHeightFeet:base,heightFeet:height,
      controlledWater:{...structuredClone(water),id,sourceWaterId:water.sourceWaterId??water.id,
        positionFeet:{x:(left+right)*scale/2,y:(upper+lower)*scale/2,z:base},
        dimensionsFeet:{x:(right-left)*scale,y:(lower-upper)*scale,z:height}}})
  }
  for(const triangle of triangles){
    const cut=partitionByConvexPolygon(triangle,box)
    if(!cut)return undefined
    append(remainder,triangle,body.baseHeightFeet,bottom-body.baseHeightFeet)
    append(remainder,triangle,top,body.baseHeightFeet+body.heightFeet-top)
    for(const points of cut.outside)append(remainder,points,bottom,top-bottom)
    append(selected,cut.inside,bottom,top-bottom)
  }
  if(invalid||!selected.length)return undefined
  return {selected,remainder}
}
