import { geometryEntityDestroyed } from '../../shared/map-geometry-durability.mjs'
import { normalizeStructureStairPath, type StructureStairPath } from '../../shared/structure-stair-path.mjs'
import type { MapGeometryState } from './mapGeometry'
import type { BattleMap } from '../store/maps'

export interface MapStairWalkingEdge {
  entityId: string;
  from: StructureStairPath['points'][number];
  to: StructureStairPath['points'][number];
  distanceFeet: number;
  widthFeet: number;
}

/** Candidate walking edges only; movement must still check occupancy and swept collision. */
export function mapStairWalkingEdges(map: BattleMap, geometry: MapGeometryState | undefined, creatureWidthFeet: number): MapStairWalkingEdge[] {
  const scale=map.gridSize/(map.feetPerCell??5)
  if((geometry && geometry.mapId!==map.id)||!Number.isFinite(scale)||scale<=0||!Number.isFinite(creatureWidthFeet)||creatureWidthFeet<=0)return []
  const edges:MapStairWalkingEdge[]=[]
  for(const obstacle of geometry?.obstacles??[]){
    if(geometryEntityDestroyed(obstacle))continue
    const path=normalizeStructureStairPath(obstacle.stairPath)
    if(!path||path.widthFeet+1e-7<creatureWidthFeet||path.points.some(point=>point.x>map.width||point.y>map.height))continue
    for(let index=1;index<path.points.length;index++){
      const from=path.points[index-1],to=path.points[index]
      // Use this ruleset's equal-cost three-dimensional grid diagonals.
      const distanceFeet=Math.max(Math.abs(to.x-from.x)/scale,Math.abs(to.y-from.y)/scale,Math.abs(to.elevationFeet-from.elevationFeet))
      edges.push({entityId:obstacle.id,from,to,distanceFeet,widthFeet:path.widthFeet},
        {entityId:obstacle.id,from:to,to:from,distanceFeet,widthFeet:path.widthFeet})
    }
  }
  return edges
}

/** Surface beneath the feet on a surviving flight, without lifting a creature below it. */
export function mapStairSupportingElevation(input: {
  map: BattleMap; geometry: MapGeometryState | undefined; position:{x:number;y:number};
  elevationFeet:number; creatureWidthFeet:number;
}): number | undefined {
  const scale=input.map.gridSize/(input.map.feetPerCell??5)
  let support:number|undefined
  for(const edge of mapStairWalkingEdges(input.map,input.geometry,input.creatureWidthFeet)){
    const dx=edge.to.x-edge.from.x,dy=edge.to.y-edge.from.y
    const t=((input.position.x-edge.from.x)*dx+(input.position.y-edge.from.y)*dy)/(dx*dx+dy*dy)
    if(t < -1e-7 || t > 1+1e-7)continue
    const clamped=Math.max(0,Math.min(1,t)),x=edge.from.x+dx*clamped,y=edge.from.y+dy*clamped
    const lateralFeet=Math.hypot(input.position.x-x,input.position.y-y)/scale
    if(lateralFeet+input.creatureWidthFeet/2>edge.widthFeet/2+1e-7)continue
    const height=edge.from.elevationFeet+(edge.to.elevationFeet-edge.from.elevationFeet)*clamped
    if(height<=input.elevationFeet+1e-7) support=Math.max(support??-Infinity,height)
  }
  return support
}
