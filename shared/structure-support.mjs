import { geometryEntityDestroyed } from './map-geometry-durability.mjs'
import { normalizeStructureStairPath } from './structure-stair-path.mjs'
import { polygonUnionSupportsCircle } from './polygon-union-support.mjs'

function activeStairs(input) {
  const scale=input.map.gridSize/(input.map.feetPerCell??5)
  if(!Number.isFinite(scale)||scale<=0)return []
  return (input.geometry?.obstacles??[]).flatMap(obstacle=>{
    if(geometryEntityDestroyed(obstacle))return []
    const path=normalizeStructureStairPath(obstacle.stairPath)
    if(!path||path.widthFeet+1e-7<input.creatureWidthFeet || path.points.some(p=>p.x>input.map.width||p.y>input.map.height))return []
    return path.points.slice(1).map((to,index)=>({from:path.points[index],to,width:path.widthFeet*scale,scale}))
  })
}
function stairPosition(edge,point,widthFeet) {
  const dx=edge.to.x-edge.from.x,dy=edge.to.y-edge.from.y,length=Math.hypot(dx,dy)
  const t=((point.x-edge.from.x)*dx+(point.y-edge.from.y)*dy)/(length*length)
  const lateral=Math.abs(-(point.x-edge.from.x)*dy+(point.y-edge.from.y)*dx)/length
  if(t < -1e-7 || t > 1+1e-7 || lateral+widthFeet*edge.scale/2>edge.width/2+1e-7)return undefined
  return edge.from.elevationFeet+(edge.to.elevationFeet-edge.from.elevationFeet)*Math.max(0,Math.min(1,t))
}
export function structureStairStepElevation(input) {
  for(const edge of activeStairs(input)){
    const from=stairPosition(edge,input.from,input.creatureWidthFeet),to=stairPosition(edge,input.to,input.creatureWidthFeet)
    if(from!=null&&to!=null&&Math.abs(from-input.fromElevationFeet)<1e-4)return to
  }
  return undefined
}
export function structureSupportingElevation(input) {
  let support=input.terrainElevationFeet
  for(const edge of activeStairs(input)){
    const height=stairPosition(edge,input.position,input.creatureWidthFeet)
    if(height!=null && height<=input.elevationFeet+1e-7)support=Math.max(support,height)
  }
  const levels=new Map()
  // Opaque force supports occupants just as a solid floor does. Keep its material
  // distinct from stone so earth glide and material spells cannot traverse it.
  const templeEntities=new Set((input.geometry?.structureLifetimes??[])
    .filter(record=>record.templeWard&&record.replacementGroup==='temple-of-the-gods')
    .flatMap(record=>record.entityIds))
  for(const obstacle of input.geometry?.obstacles??[]){
    const top=obstacle.baseHeightFeet+obstacle.heightFeet
    if(!obstacle.blocksMovement||geometryEntityDestroyed(obstacle)||(!['stone','earth'].includes(obstacle.surfaceMaterial)&&!templeEntities.has(obstacle.id))||
      obstacle.heightFeet<=0||top<=support||top>input.elevationFeet+1e-4)continue
    const polygons=levels.get(top)??[];polygons.push(obstacle.points);levels.set(top,polygons)
  }
  const scale=input.map.gridSize/(input.map.feetPerCell??5)
  for(const top of [...levels.keys()].sort((a,b)=>b-a)){
    if(polygonUnionSupportsCircle(levels.get(top),input.position,input.creatureWidthFeet*scale/2))return Math.max(support,top)
  }
  return support
}
