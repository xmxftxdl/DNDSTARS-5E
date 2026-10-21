import type { BattleMap, Token } from '../../store/maps'
import { pixelToCell, cellToPixel } from '../../lib/gridCombat'
import { mapGeometryLineOfEffectBlocked, mapGeometryOrdinaryProjectileBlocked,
  mapGeometryTerrainElevationAtPoint, type MapGeometryState } from '../../lib/mapGeometry'
import type { MapPathResult } from '../../lib/mapPathfinding'

type Node = { col: number; row: number; z: number; cost: number; score: number; previous?: Node; targetAnchor?: boolean }
export type HomingVolumeResult = { status: 'reached'; path: MapPathResult } | { status: 'blocked' | 'incomplete' }

/** Grid flight uses horizontal grid steps plus vertical travel, matching ordinary map flight cost. */
export function findHomingProjectileVolumePath(input: {
  map: BattleMap; geometry?: MapGeometryState; origin: Token; target: Token; maximumFeet: number
  maximumVisitedNodes?: number
}): HomingVolumeResult {
  const { map, geometry, origin, target, maximumFeet } = input
  if (![origin.x, origin.y, target.x, target.y, origin.elevationFeet ?? 0, target.elevationFeet ?? 0,
    maximumFeet, map.gridSize].every(Number.isFinite) || maximumFeet <= 0 || map.gridSize <= 0) return { status: 'incomplete' }
  const feet = Math.max(1, map.feetPerCell ?? 5)
  const start = pixelToCell(origin.x, origin.y, map), end = pixelToCell(target.x, target.y, map)
  const startZ = origin.elevationFeet ?? 0, endZ = target.elevationFeet ?? 0
  if (start.col === end.col && start.row === end.row && Math.abs(endZ-startZ) <= maximumFeet &&
    !mapGeometryLineOfEffectBlocked({map,geometry,from:origin,to:target,fromElevationFeet:startZ,toElevationFeet:endZ}) &&
    !mapGeometryOrdinaryProjectileBlocked({map,geometry,from:origin,to:target,fromHeightFeet:5,toHeightFeet:5})) {
    const distanceFeet = Math.abs(endZ-startZ)
    return {status:'reached',path:{points:[{x:origin.x,y:origin.y},{x:target.x,y:target.y}],cells:[start,end],
      elevationsFeet:[startZ,endZ],distanceFeet,movementCostFeet:distanceFeet,doorsToOpen:[]}}
  }
  // Keep both endpoints as distinct graph vertices when they share a cell.
  const sharedCell = start.col === end.col && start.row === end.row
  const heuristic = (col: number, row: number, z: number) =>
    Math.max(Math.abs(col-end.col), Math.abs(row-end.row))*feet + Math.abs(z-endZ)
  if (heuristic(start.col, start.row, startZ) > maximumFeet) return { status: 'blocked' }
  const key = (node: Pick<Node, 'col' | 'row' | 'z' | 'targetAnchor'>) => `${node.col}:${node.row}:${node.z}:${node.targetAnchor ? 1 : 0}`
  const point = (node: Pick<Node, 'col' | 'row' | 'targetAnchor'>) => node.targetAnchor ? { x: target.x, y: target.y } : node.col === start.col && node.row === start.row
    ? { x: origin.x, y: origin.y } : node.col === end.col && node.row === end.row
      ? { x: target.x, y: target.y } : cellToPixel(node, map)
  const heap: Node[] = []
  const push = (node: Node) => {
    heap.push(node)
    let index=heap.length-1
    while(index>0) { const parent=(index-1)>>1; if(heap[parent].score<=node.score)break; heap[index]=heap[parent];index=parent }
    heap[index]=node
  }
  const pop = (): Node => {
    const first=heap[0], last=heap.pop()!
    if(heap.length) { let index=0; while(index*2+1<heap.length) {
      let child=index*2+1; if(child+1<heap.length&&heap[child+1].score<heap[child].score)child++
      if(heap[child].score>=last.score)break;heap[index]=heap[child];index=child
    } heap[index]=last }
    return first
  }
  const initial: Node = { ...start, z: startZ, cost: 0, score: heuristic(start.col,start.row,startZ) }
  push(initial)
  const best = new Map([[key(initial),0]])
  let visited=0
  while(heap.length) {
    const current=pop()
    if(current.cost!==best.get(key(current)))continue
    if(++visited>(input.maximumVisitedNodes ?? 50_000))return {status:'incomplete'}
    if((!sharedCell || current.targetAnchor)&&current.col===end.col&&current.row===end.row&&Math.abs(current.z-endZ)<1e-7) {
      const nodes:Node[]=[];for(let cursor:Node|undefined=current;cursor;cursor=cursor.previous)nodes.push(cursor)
      nodes.reverse()
      return {status:'reached',path:{points:nodes.map(point),cells:nodes.map(({col,row})=>({col,row})),
        elevationsFeet:nodes.map(node=>node.z),distanceFeet:current.cost,movementCostFeet:current.cost,doorsToOpen:[]}}
    }
    const neighbors: Array<{col:number;row:number;z:number;step:number;targetAnchor?:boolean}> = []
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)if(dx||dy)neighbors.push({col:current.col+dx,row:current.row+dy,z:current.z,step:feet})
    for(const z of new Set([current.z-feet,current.z+feet,endZ]))if(z!==current.z)neighbors.push({col:current.col,row:current.row,z,step:Math.abs(z-current.z),targetAnchor:current.targetAnchor})
    if(sharedCell) {
      // A second endpoint column permits flight over a wall and descent on its far side.
      for(const neighbor of [...neighbors]) if((current.col!==end.col || current.row!==end.row) && neighbor.col===end.col && neighbor.row===end.row && !neighbor.targetAnchor)
        neighbors.push({...neighbor,targetAnchor:true})
      if(current.col===end.col && current.row===end.row)
        neighbors.push({col:end.col,row:end.row,z:current.z,step:origin.x===target.x&&origin.y===target.y?0:feet,targetAnchor:!current.targetAnchor})
    }
    for(const next of neighbors) {
      const cost=current.cost+next.step, score=cost+heuristic(next.col,next.row,next.z)
      if(score>maximumFeet+1e-7||cost>=(best.get(key(next))??Infinity))continue
      const from=point(current),to=point(next)
      if(to.x<0||to.y<0||to.x>map.width||to.y>map.height||next.z<mapGeometryTerrainElevationAtPoint(geometry,to)-1e-7)continue
      if(mapGeometryLineOfEffectBlocked({map,geometry,from,to,fromElevationFeet:current.z,toElevationFeet:next.z,
        fromEyeHeightFeet:2.5,toEyeHeightFeet:2.5}) || mapGeometryOrdinaryProjectileBlocked({map,geometry,
          from:{...origin,...from,size:1,elevationFeet:current.z},to:{...target,...to,size:1,elevationFeet:next.z},
          fromHeightFeet:5,toHeightFeet:5}))continue
      const node:Node={col:next.col,row:next.row,z:next.z,cost,score,previous:current,targetAnchor:next.targetAnchor}
      best.set(key(node),cost);push(node)
    }
  }
  return {status:'blocked'}
}
