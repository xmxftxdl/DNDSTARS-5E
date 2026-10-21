import { mapGeometryPointInPolygon, type MapGeometryPoint } from '../../lib/mapGeometry'

type Edge = { a: MapGeometryPoint; b: MapGeometryPoint }
const crossing = (first: Edge, second: Edge): MapGeometryPoint | undefined => {
  const rx=first.b.x-first.a.x,ry=first.b.y-first.a.y
  const sx=second.b.x-second.a.x,sy=second.b.y-second.a.y,den=rx*sy-ry*sx
  if(Math.abs(den)<1e-9)return undefined
  const dx=second.a.x-first.a.x,dy=second.a.y-first.a.y
  const t=(dx*sy-dy*sx)/den,u=(dx*ry-dy*rx)/den
  return t>=0&&t<=1&&u>=0&&u<=1?{x:first.a.x+rx*t,y:first.a.y+ry*t}:undefined
}
const edgesOf=(points:readonly MapGeometryPoint[]):Edge[]=>points.map((a,i)=>({a,b:points[(i+1)%points.length]}))

/** One interior origin per terrain-crossing sequence, rather than a fixed grid.
 * Sequences change at start/end boundaries and at the swept traces of terrain
 * vertices or edge intersections. Partitioning by those traces catches narrow
 * terrain patches between the soil's corners and centre. */
export function looseEarthTravelPartitions(footprint:readonly MapGeometryPoint[],
  terrainPolygons:readonly (readonly MapGeometryPoint[])[],translation:MapGeometryPoint):Array<{origin:MapGeometryPoint;points:MapGeometryPoint[]}>{
  const minX=Math.min(...footprint.map(p=>p.x)),maxX=Math.max(...footprint.map(p=>p.x))
  const minY=Math.min(...footprint.map(p=>p.y)),maxY=Math.max(...footprint.map(p=>p.y))
  const shifted=(p:MapGeometryPoint)=>({x:p.x-translation.x,y:p.y-translation.y})
  const overlaps=(edge:Edge,left:number,right:number,top:number,bottom:number)=>
    Math.max(edge.a.x,edge.b.x)>=left&&Math.min(edge.a.x,edge.b.x)<=right&&
    Math.max(edge.a.y,edge.b.y)>=top&&Math.min(edge.a.y,edge.b.y)<=bottom
  const terrainEdges=terrainPolygons.flatMap(edgesOf).filter(edge=>overlaps(edge,
    minX+Math.min(0,translation.x),maxX+Math.max(0,translation.x),
    minY+Math.min(0,translation.y),maxY+Math.max(0,translation.y)))
  const vertices=terrainEdges.flatMap(edge=>[edge.a,edge.b])
  for(let i=0;i<terrainEdges.length;i++)for(let j=i+1;j<terrainEdges.length;j++){
    const point=crossing(terrainEdges[i],terrainEdges[j]);if(point)vertices.push(point)
  }
  const edges=[...edgesOf(footprint),...terrainEdges,
    ...terrainEdges.map(edge=>({a:shifted(edge.a),b:shifted(edge.b)})),
    ...vertices.map(point=>({a:point,b:shifted(point)}))]
    .filter(edge=>overlaps(edge,minX,maxX,minY,maxY))
  const cuts=new Set([minX,maxX])
  for(const edge of edges){
    for(const point of [edge.a,edge.b])if(point.x>minX&&point.x<maxX)cuts.add(point.x)
    for(const y of [minY,maxY])if(edge.a.y!==edge.b.y){
      const t=(y-edge.a.y)/(edge.b.y-edge.a.y),x=edge.a.x+t*(edge.b.x-edge.a.x)
      if(t>0&&t<1&&x>minX&&x<maxX)cuts.add(x)
    }
  }
  for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
    const point=crossing(edges[i],edges[j]);if(point&&point.x>minX&&point.x<maxX)cuts.add(point.x)
  }
  const xs=[...cuts].sort((a,b)=>a-b),result:Array<{origin:MapGeometryPoint;points:MapGeometryPoint[]}>=[]
  for(let i=1;i<xs.length;i++){
    const x=(xs[i-1]+xs[i])/2,ys=new Map<number,(x:number)=>number>([[minY,()=>minY],[maxY,()=>maxY]])
    for(const {a,b} of edges)if(x>Math.min(a.x,b.x)&&x<Math.max(a.x,b.x)){
      const at=(x:number)=>a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x),y=at(x);if(y>minY&&y<maxY)ys.set(y,at)
    }
    const ordered=[...ys.keys()].sort((a,b)=>a-b)
    for(let j=1;j<ordered.length;j++){
      const point={x,y:(ordered[j-1]+ordered[j])/2}
      if(mapGeometryPointInPolygon(point,footprint)){
        const low=ys.get(ordered[j-1])!,high=ys.get(ordered[j])!,left=xs[i-1],right=xs[i]
        const points=[{x:left,y:low(left)},{x:right,y:low(right)},{x:right,y:high(right)},{x:left,y:high(left)}]
          .filter((p,index,all)=>Math.hypot(p.x-all[(index+all.length-1)%all.length].x,p.y-all[(index+all.length-1)%all.length].y)>1e-7)
        if(points.length>=3)result.push({origin:point,points})
      }
    }
  }
  return result
}

export function looseEarthTravelOrigins(footprint:readonly MapGeometryPoint[],
  terrainPolygons:readonly (readonly MapGeometryPoint[])[],translation:MapGeometryPoint):MapGeometryPoint[]{
  return looseEarthTravelPartitions(footprint,terrainPolygons,translation).map(part=>part.origin)
}
