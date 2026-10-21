import {mapGeometrySegments,type MapGeometrySegment,type MapGeometryState} from '../../lib/mapGeometry'
import {openingIntervalOnWallSegment,interpolatePoint} from '../../../shared/map-geometry-kernel.mjs'
import {geometryEntityDestroyed} from '../../../shared/map-geometry-durability.mjs'

/** Use effective door/window state, retaining wall above and below an opening. */
export function looseEarthBarrierSegments(geometry:MapGeometryState):MapGeometrySegment[]{
 const segments=mapGeometrySegments(geometry).filter(segment=>segment.entityKind!=='obstacle')
 for(const wall of geometry.walls){
  if(geometryEntityDestroyed(wall))continue
  for(let i=0;i<wall.points.length-1;i++)for(const opening of [...geometry.doors,...(geometry.windows??[])]){
   const interval=openingIntervalOnWallSegment(opening,wall,i)
   if(!interval)continue
   const a=interpolatePoint(wall.points[i],wall.points[i+1],interval[0]),b=interpolatePoint(wall.points[i],wall.points[i+1],interval[1])
   const low=wall.baseHeightFeet,high=low+wall.heightFeet
   for(const [base,top] of [[low,Math.min(high,opening.baseHeightFeet)],[Math.max(low,opening.baseHeightFeet+opening.heightFeet),high]]){
    if(top<=base)continue
    segments.push({entityId:wall.id,entityKind:'wall',a,b,baseHeightFeet:base,heightFeet:top-base,
     blocksMovement:wall.blocksMovement,blocksVision:wall.blocksVision,blocksLineOfEffect:wall.blocksLineOfEffect})
   }
  }
 }
 return segments
}
