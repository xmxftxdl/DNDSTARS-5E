import {gasExclusionSlice} from '../../rulesets/dnd5e/gasExclusion'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import { groveCellVisionSegments } from '../../../shared/grove-volume.mjs'
import { mapGeometryRuntimeForMap, mapGeometryTerrainElevationAtPoint } from '../../lib/mapGeometry'

type ClipContext = Pick<CanvasRenderingContext2D,'beginPath'|'rect'|'moveTo'|'lineTo'|'closePath'|'clip'>

/** Top-down surface projection, with independent terrain/column height per cell. */
export function groveFogVisualClip(area: Dnd5ePluginArea, map: BattleMap, override?: {volume:NonNullable<Dnd5ePluginArea['groveVolume']>;elevationFeet:number}): ((context: ClipContext) => void) | undefined {
  const volume=override?.volume??area.groveVolume
  if (!volume || (!override && !['solid-fog', 'undergrowth', 'additional-spike-growth', 'additional-gusts', 'additional-wind-walls']
    .includes(area.effectGroup?.effectId ?? ''))) return undefined
  const geometry=mapGeometryRuntimeForMap(map.id)
  const contours=area.cells.flatMap(cell=>{
    const x=map.gridOffsetX+cell.col*map.gridSize, y=map.gridOffsetY+cell.row*map.gridSize
    const vertical=area.vertical
    const base=override?.elevationFeet??(vertical?.mode==='volume'
      ? vertical.columns?.find(column=>column.col===cell.col&&column.row===cell.row)?.baseElevationFeet ?? vertical.baseElevationFeet
      : mapGeometryTerrainElevationAtPoint(geometry,{x:x+map.gridSize/2,y:y+map.gridSize/2}))
    const edges=groveCellVisionSegments(volume,{x,y,size:map.gridSize},base,1e-7)
    const key=(p:{x:number;y:number})=>`${p.x.toFixed(6)},${p.y.toFixed(6)}`
    // Boundary segments already represent the union of excluded structures.
    // Trace closed contours so even-odd fill keeps holes, including overlaps.
    const remaining=new Set(edges.map((_,index)=>index))
    const adjacency=new Map<string,number[]>()
    edges.forEach((edge,index)=>{for(const point of [edge.a,edge.b]){
      const k=key(point);adjacency.set(k,[...(adjacency.get(k)??[]),index])
    }})
    const loops:Array<Array<{x:number;y:number}>>=[]
    while(remaining.size){
      const first=remaining.values().next().value!
      remaining.delete(first)
      const start=edges[first].a, points=[start,edges[first].b]
      let end=key(edges[first].b)
      while(end!==key(start)){
        const next=adjacency.get(end)?.find(index=>remaining.has(index))
        if(next==null)break
        remaining.delete(next)
        const edge=edges[next], point=key(edge.a)===end?edge.b:edge.a
        points.push(point);end=key(point)
      }
      if(end===key(start)&&points.length>=4)loops.push(points)
    }
    return loops
  })
  return context=>{
    context.beginPath()
    for(const points of contours){
      points.forEach((point,index)=>index===0?context.moveTo(point.x,point.y):context.lineTo(point.x,point.y))
      context.closePath()
    }
    context.clip('evenodd')
    // Konva applies one final clip after the callback. Preserve the mask above.
    context.beginPath()
    context.rect(0,0,map.width,map.height)
    context.closePath()
  }
}

/** Top-down gas is shown at its lowest occupied ground-level view plane. */
export function persistentGasVisualClip(area:Dnd5ePluginArea,map:BattleMap){
 const point=area.anchorCell?{x:map.gridOffsetX+(area.anchorCell.col+.5)*map.gridSize,y:map.gridOffsetY+(area.anchorCell.row+.5)*map.gridSize}:{x:0,y:0}
 const ground=mapGeometryTerrainElevationAtPoint(mapGeometryRuntimeForMap(map.id),point)
 const elevation=Math.max(ground,area.vertical?.mode==='volume'?area.vertical.baseElevationFeet:ground)+1e-6
 const volume=gasExclusionSlice(map,area,elevation),original=groveFogVisualClip(area,map)
 if(!volume)return original
 const gas=groveFogVisualClip(area,map,{volume,elevationFeet:elevation})!
 return (context:ClipContext)=>{if(original){original(context);context.clip()}gas(context)}
}
