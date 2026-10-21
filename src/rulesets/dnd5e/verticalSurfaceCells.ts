import { cellKey, mapCellExtent, pixelToCell, type GridCell } from '../../lib/gridCombat'
import type { BattleMap } from '../../store/maps'
import type { VerticalMaterialSurface } from './verticalMaterialSurface'

/** Cells on the exposed side of the face; split at grid crossings, not at sampled intervals. */
export function verticalSurfaceCells(surface: VerticalMaterialSurface, map: BattleMap): GridCell[] {
  if(surface.fragments){
    const cells=new Map<string,GridCell>()
    for(const part of surface.fragments)for(const cell of verticalSurfaceCells(part.surface,map))cells.set(cellKey(cell),cell)
    return [...cells.values()]
  }
  const start = {x:surface.a.x + surface.outward.x * 0.001,y:surface.a.y + surface.outward.y * 0.001}
  const end = {x:surface.b.x + surface.outward.x * 0.001,y:surface.b.y + surface.outward.y * 0.001}
  if (![start.x,start.y,end.x,end.y,map.gridSize,map.gridOffsetX,map.gridOffsetY].every(Number.isFinite) || map.gridSize<=0) return []
  const {cols,rows}=mapCellExtent(map)
  if ([start,end].some(p=>p.x<map.gridOffsetX||p.y<map.gridOffsetY||
    p.x>map.gridOffsetX+cols*map.gridSize||p.y>map.gridOffsetY+rows*map.gridSize))return []
  const cuts=[0,1]
  for (const [axis,offset] of [['x',map.gridOffsetX],['y',map.gridOffsetY]] as const) {
    const delta=end[axis]-start[axis]
    if(Math.abs(delta)<1e-9)continue
    const low=Math.min(start[axis],end[axis]),high=Math.max(start[axis],end[axis])
    for(let boundary=Math.ceil((low-offset)/map.gridSize)*map.gridSize+offset;boundary<high;boundary+=map.gridSize){
      const t=(boundary-start[axis])/delta
      if(t>0&&t<1)cuts.push(t)
    }
  }
  cuts.sort((a,b)=>a-b)
  const cells=new Map<string,GridCell>()
  for(let i=1;i<cuts.length;i++){
    if(cuts[i]-cuts[i-1]<1e-10)continue
    const t=(cuts[i-1]+cuts[i])/2
    const cell=pixelToCell(start.x+(end.x-start.x)*t,start.y+(end.y-start.y)*t,map)
    if(cell.col<0||cell.row<0||cell.col>=cols||cell.row>=rows)return []
    cells.set(cellKey(cell),cell)
  }
  return [...cells.values()]
}
