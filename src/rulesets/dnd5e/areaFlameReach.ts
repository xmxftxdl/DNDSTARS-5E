import { mapGeometryLineOfEffectBlocked, mapGeometryTerrainElevationAtPoint, type MapGeometryState } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'
import { normalizeDnd5ePersistentRectGeometry, type Dnd5ePersistentRectGeometry } from './persistentAreaRectGeometry'

/** Exact rectangular volume and bounded ground-following spread around scene barriers. */
export function prepareDnd5eAreaFlameReach(input: {
  map: BattleMap; geometry: MapGeometryState; rect: Dnd5ePersistentRectGeometry
  center: { x: number; y: number }; baseElevationFeet: number; heightFeet: number; groundSpreadFeet: number
}) {
  const rect = normalizeDnd5ePersistentRectGeometry(input.rect)
  if (!rect || ![input.center.x,input.center.y,input.baseElevationFeet,input.heightFeet,input.groundSpreadFeet].every(Number.isFinite) ||
    input.heightFeet <= 0 || input.groundSpreadFeet < 0 || input.groundSpreadFeet > 1000 || input.geometry.mapId !== input.map.id) return undefined
  const pixelsPerFoot = input.map.gridSize / (input.map.feetPerCell ?? 5)
  if (!Number.isFinite(pixelsPerFoot) || pixelsPerFoot <= 0) return undefined
  const direction = rect.direction, perpendicular = { dc: -direction.dr, dr: direction.dc }
  type Point = { x: number; y: number }
  const nearest = (point:Point) => {
    const dx=(point.x-input.center.x)/pixelsPerFoot,dy=(point.y-input.center.y)/pixelsPerFoot
    const along=dx*direction.dc+dy*direction.dr,across=dx*perpendicular.dc+dy*perpendicular.dr
    const a=Math.max(-rect.lengthFeet/2,Math.min(rect.lengthFeet/2,along))
    const b=Math.max(-rect.widthFeet/2,Math.min(rect.widthFeet/2,across))
    return {point:{x:input.center.x+(a*direction.dc+b*perpendicular.dc)*pixelsPerFoot,
      y:input.center.y+(a*direction.dr+b*perpendicular.dr)*pixelsPerFoot},distance:Math.hypot(along-a,across-b)}
  }
  let corners:Point[]|undefined
  const groundAt=(point:Point)=>mapGeometryTerrainElevationAtPoint(input.geometry,point)
  const clearGroundPath=(from:Point,to:Point)=>{
    const dx=to.x-from.x,dy=to.y-from.y
    const at=(t:number)=>({x:from.x+dx*t,y:from.y+dy*t})
    const cuts=new Set([0,1])
    // Split at terrain boundaries, including very narrow painted strips. An
    // endpoint-only ray would miss a barrier on an intermediate raised surface.
    for(const region of input.geometry.obstacles){
      if(region.terrainElevationFeet==null)continue
      for(let i=0;i<region.points.length;i++){
        const a=region.points[i],b=region.points[(i+1)%region.points.length]
        const sx=b.x-a.x,sy=b.y-a.y,den=dx*sy-dy*sx
        if(Math.abs(den)<1e-9)continue
        const ax=a.x-from.x,ay=a.y-from.y
        const t=(ax*sy-ay*sx)/den,u=(ax*dy-ay*dx)/den
        if(t>0&&t<1&&u>=0&&u<=1)cuts.add(t)
      }
    }
    const ordered=[...cuts].sort((a,b)=>a-b)
    const blocked=(a:Point,b:Point,low:number,high:number)=>mapGeometryLineOfEffectBlocked({
      geometry:input.geometry,map:input.map,from:a,to:b,fromElevationFeet:low,toElevationFeet:high,
      fromEyeHeightFeet:0.001,toEyeHeightFeet:0.001})
    let previous=groundAt(from)
    for(let i=1;i<ordered.length;i++){
      const a=at(ordered[i-1]),b=at(ordered[i]),height=groundAt(at((ordered[i-1]+ordered[i])/2))
      if(blocked(a,a,previous,height)||blocked(a,b,height,height))return false
      previous=height
    }
    return !blocked(to,to,previous,groundAt(to))
  }
  const runoff = (target:Point) => {
    const clear=clearGroundPath
    const sourceCost=(point:Point)=>{
      const projection=nearest(point)
      const ground=groundAt(projection.point)
      if(projection.distance>input.groundSpreadFeet+1e-6 ||
        ground<input.baseElevationFeet-1e-6 || ground>=input.baseElevationFeet+input.heightFeet ||
        mapGeometryLineOfEffectBlocked({geometry:input.geometry,map:input.map,from:input.center,to:projection.point,
          fromElevationFeet:input.baseElevationFeet,toElevationFeet:ground}) || !clear(projection.point,point))return Infinity
      return projection.distance
    }
    if(sourceCost(target)<=input.groundSpreadFeet+1e-6)return true
    // Only inspect nearby corners when direct runoff is obstructed. Offsetting
    // both sides lets a point-sized flow pass an open wall end without crossing it.
    if(!corners){
      const unique=new Map<string,Point>(),offset=0.001*pixelsPerFoot
      for(const entity of [...input.geometry.walls,...input.geometry.doors,...input.geometry.obstacles])for(const point of entity.points){
        for(const dx of [-offset,offset])for(const dy of [-offset,offset]){
          const candidate={x:point.x+dx,y:point.y+dy}
          if(candidate.x<0||candidate.y<0||candidate.x>input.map.width||candidate.y>input.map.height||nearest(candidate).distance>input.groundSpreadFeet+1e-6)continue
          unique.set(`${candidate.x}:${candidate.y}`,candidate)
        }
      }
      corners=[...unique.values()]
    }
    const nodes=[target,...corners]
    // Range is measured from the spell's area, not accumulated travel around
    // obstacles. All nodes lie in the convex rectangle-plus-radius footprint,
    // so connecting them cannot leave that footprint.
    const queue=nodes.flatMap((point,index)=>Number.isFinite(sourceCost(point))?[index]:[])
    const visited=new Set(queue)
    for(let cursor=0;cursor<queue.length;cursor++){
      const next=queue[cursor]
      if(next===0)return true
      for(let i=0;i<nodes.length;i++){
        if(visited.has(i)||!clear(nodes[next],nodes[i]))continue
        visited.add(i)
        queue.push(i)
      }
    }
    return false
  }
  return (point: { x: number; y: number }, elevationFeet: number) => {
    if (![point.x,point.y,elevationFeet].every(Number.isFinite)) return false
    const dx = (point.x-input.center.x)/pixelsPerFoot, dy = (point.y-input.center.y)/pixelsPerFoot
    const along = dx*direction.dc+dy*direction.dr, across = dx*perpendicular.dc+dy*perpendicular.dr
    const inside = Math.abs(along) <= rect.lengthFeet/2+1e-6 && Math.abs(across) <= rect.widthFeet/2+1e-6
    if (inside && elevationFeet >= input.baseElevationFeet-1e-6 && elevationFeet < input.baseElevationFeet+input.heightFeet) {
      if (!mapGeometryLineOfEffectBlocked({geometry:input.geometry,map:input.map,from:input.center,to:point,
        fromElevationFeet:input.baseElevationFeet,toElevationFeet:elevationFeet})) return true
    }
    if (input.groundSpreadFeet === 0) return false
    const a = Math.max(-rect.lengthFeet/2, Math.min(rect.lengthFeet/2,along))
    const b = Math.max(-rect.widthFeet/2, Math.min(rect.widthFeet/2,across))
    if (Math.hypot(along-a,across-b) > input.groundSpreadFeet+1e-6) return false
    if (Math.abs(elevationFeet-groundAt(point))>1e-6) return false
    return runoff(point)
  }
}
