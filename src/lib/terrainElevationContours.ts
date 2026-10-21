import { mapGeometryTerrainElevationAtPoint, type MapGeometryPoint, type MapGeometryState } from './mapGeometry'

type Edge = { a: MapGeometryPoint; b: MapGeometryPoint; elevationFeet: number }
/** Visible height discontinuities, independent of the soil's internal partition. */
export function terrainElevationContours(geometry?: MapGeometryState): {edges: Edge[]; anchor: MapGeometryPoint; elevationFeet: number}[] {
  const segments=(geometry?.obstacles??[]).filter(o=>o.terrainElevationFeet!=null).flatMap(o=>
    o.points.map((a,i)=>({a,b:o.points[(i+1)%o.points.length]})))
  const edges:Edge[]=[],seen=new Set<string>()
  const key=(p:MapGeometryPoint)=>`${p.x.toFixed(6)},${p.y.toFixed(6)}`
  for(const {a,b} of segments){
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)
    if(length<1e-7)continue
    const cuts=[0,1]
    for(const other of segments){
      const ex=other.b.x-other.a.x,ey=other.b.y-other.a.y,denominator=dx*ey-dy*ex
      if(Math.abs(denominator)>1e-7){
        const ax=other.a.x-a.x,ay=other.a.y-a.y
        const t=(ax*ey-ay*ex)/denominator,u=(ax*dy-ay*dx)/denominator
        if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t)
      }else for(const p of [other.a,other.b]){
        if(Math.abs(dx*(p.y-a.y)-dy*(p.x-a.x))>1e-7)continue
        const t=((p.x-a.x)*dx+(p.y-a.y)*dy)/(length*length)
        if(t>0&&t<1)cuts.push(t)
      }
    }
    cuts.sort((x,y)=>x-y)
    const point=(t:number)=>({x:a.x+t*dx,y:a.y+t*dy})
    for(let i=1;i<cuts.length;i++){
      if((cuts[i]-cuts[i-1])*length<1e-6)continue
      const start=point(cuts[i-1]),end=point(cuts[i]),middle=point((cuts[i-1]+cuts[i])/2)
      const epsilon=Math.min(1e-4,(cuts[i]-cuts[i-1])*length/100)
      const left=mapGeometryTerrainElevationAtPoint(geometry,{x:middle.x-dy/length*epsilon,y:middle.y+dx/length*epsilon})
      const right=mapGeometryTerrainElevationAtPoint(geometry,{x:middle.x+dy/length*epsilon,y:middle.y-dx/length*epsilon})
      if(Math.abs(left-right)<1e-7)continue
      const id=[key(start),key(end)].sort().join(':')
      if(seen.has(id))continue
      seen.add(id)
      edges.push({a:start,b:end,elevationFeet:Math.abs(left)>=Math.abs(right)?left:right})
    }
  }
  const groups:{edges:Edge[];anchor:MapGeometryPoint;elevationFeet:number}[]=[]
  const pending=new Set(edges)
  while(pending.size){
    const first=pending.values().next().value!,connected=[first],vertices=new Set([key(first.a),key(first.b)])
    pending.delete(first)
    let changed=true
    while(changed){
      changed=false
      for(const edge of pending)if(edge.elevationFeet===first.elevationFeet&&(vertices.has(key(edge.a))||vertices.has(key(edge.b)))){
        connected.push(edge);vertices.add(key(edge.a));vertices.add(key(edge.b));pending.delete(edge);changed=true
      }
    }
    const longest=connected.reduce((a,b)=>Math.hypot(a.b.x-a.a.x,a.b.y-a.a.y)>=Math.hypot(b.b.x-b.a.x,b.b.y-b.a.y)?a:b)
    groups.push({edges:connected,elevationFeet:first.elevationFeet,anchor:{x:(longest.a.x+longest.b.x)/2,y:(longest.a.y+longest.b.y)/2}})
  }
  return groups
}
