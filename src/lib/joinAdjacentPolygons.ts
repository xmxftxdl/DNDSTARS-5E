import type { MapGeometryPoint } from './mapGeometry'
import { partitionByConvexPolygon, polygonSignedArea } from './convexPolygonPartition'
import { triangulateSimplePolygon } from './triangulateSimplePolygon'

/** Exact shared-edge union. Reject overlap, disconnected pieces and holes. */
export function joinAdjacentPolygons(a: readonly MapGeometryPoint[], b: readonly MapGeometryPoint[]): MapGeometryPoint[] | undefined {
  const trianglesA = triangulateSimplePolygon(a), trianglesB = triangulateSimplePolygon(b)
  if (!trianglesA || !trianglesB) return undefined
  for (const first of trianglesA) for (const second of trianglesB) {
    if (Math.abs(polygonSignedArea(partitionByConvexPolygon(first, second)?.inside ?? [])) > 1e-7) return undefined
  }
  const vertices: MapGeometryPoint[] = []
  const index = (point: MapGeometryPoint) => {
    const found = vertices.findIndex(p => Math.hypot(p.x-point.x,p.y-point.y) < 1e-7)
    if (found >= 0) return found
    vertices.push({...point}); return vertices.length-1
  }
  const polygons = [a,b].map(points => {
    const oriented = polygonSignedArea(points) < 0 ? [...points].reverse() : points
    return oriented.map(index)
  })
  const edges = new Map<string, [number, number]>()
  let shared = false
  for (const polygon of polygons) for (let i=0;i<polygon.length;i++) {
    const start = vertices[polygon[i]], end = vertices[polygon[(i+1)%polygon.length]]
    const dx=end.x-start.x, dy=end.y-start.y, lengthSquared=dx*dx+dy*dy
    const splits = vertices.map((p,id) => ({id,t:((p.x-start.x)*dx+(p.y-start.y)*dy)/lengthSquared,
      cross:dx*(p.y-start.y)-dy*(p.x-start.x)}))
      .filter(p => Math.abs(p.cross)<1e-7 && p.t>=0 && p.t<=1).sort((x,y)=>x.t-y.t)
    for (let j=1;j<splits.length;j++) {
      const from=splits[j-1].id, to=splits[j].id, key=`${from}:${to}`, reverse=`${to}:${from}`
      if (edges.has(reverse)) { edges.delete(reverse); shared=true }
      else { if(edges.has(key)) return undefined; edges.set(key,[from,to]) }
    }
  }
  if (!shared || edges.size<3) return undefined
  const next = new Map<number,number>(), incoming = new Set<number>()
  for (const [from,to] of edges.values()) {
    if(next.has(from)||incoming.has(to)) return undefined
    next.set(from,to); incoming.add(to)
  }
  const first=next.keys().next().value!
  const result:MapGeometryPoint[]=[], visited=new Set<number>()
  let current=first
  while(!visited.has(current)) {
    visited.add(current); result.push(vertices[current])
    const following=next.get(current)
    if(following===undefined)return undefined
    current=following
  }
  if(current!==first||visited.size!==edges.size)return undefined
  // Remove shared-edge endpoints that are now redundant collinear vertices.
  const simplified=result.filter((p,i)=>{
    const previous=result[(i+result.length-1)%result.length],following=result[(i+1)%result.length]
    return Math.abs((p.x-previous.x)*(following.y-p.y)-(p.y-previous.y)*(following.x-p.x))>1e-7
  })
  if(!triangulateSimplePolygon(simplified) || Math.abs(Math.abs(polygonSignedArea(simplified))-
    Math.abs(polygonSignedArea(a))-Math.abs(polygonSignedArea(b)))>1e-7)return undefined
  return simplified
}
