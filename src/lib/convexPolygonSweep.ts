import type { MapGeometryPoint } from './mapGeometry'

/** Convex hull of a convex body's initial and translated footprints. */
export function convexPolygonSweep(points: readonly MapGeometryPoint[], translation: MapGeometryPoint): MapGeometryPoint[] {
  const all=[...points,...points.map(p=>({x:p.x+translation.x,y:p.y+translation.y}))]
  if(all.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return []
  const sorted=[...new Map(all.map(p=>[`${p.x},${p.y}`,p])).values()].sort((a,b)=>a.x-b.x||a.y-b.y)
  const cross=(a:MapGeometryPoint,b:MapGeometryPoint,c:MapGeometryPoint)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)
  const side=(list:MapGeometryPoint[])=>{
    const result:MapGeometryPoint[]=[]
    for(const p of list){while(result.length>1&&cross(result[result.length-2],result[result.length-1],p)<=0)result.pop();result.push({...p})}
    return result.slice(0,-1)
  }
  return [...side(sorted),...side([...sorted].reverse())]
}
