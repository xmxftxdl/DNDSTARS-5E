/** Rectangle axes in feet: yaw comes from direction, then pitch and local roll.
 * The pivot is the original volume center, not its ground projection. */
export function rectangularPrism(map, area) {
  const r = area.rectGeometry, a = area.anchorCell, v = area.vertical
  if (!r || r.gridAligned || !a || v?.mode !== 'volume' || v.shape === 'sphere') return undefined
  const scale = (map.feetPerCell ?? 5) / Math.max(1, map.gridSize)
  const p = (r.pitchDegrees ?? 0) * Math.PI / 180, t = (r.rollDegrees ?? 0) * Math.PI / 180
  const {dc, dr} = r.direction, cp = Math.cos(p), sp = Math.sin(p), ct = Math.cos(t), st = Math.sin(t)
  const length = [dc * cp, dr * cp, sp]
  const across = [-dr, dc, 0], up = [-dc * sp, -dr * sp, cp]
  const axes = [length, across.map((n,i) => n*ct + up[i]*st), up.map((n,i) => n*ct - across[i]*st)]
  const half = [r.lengthFeet/2, r.widthFeet/2, v.heightFeet/2]
  const center = {x:(map.gridOffsetX??0)+(a.col+.5)*map.gridSize,
    y:(map.gridOffsetY??0)+(a.row+.5)*map.gridSize, elevationFeet:v.baseElevationFeet+v.heightFeet/2}
  const local = point => {
    const d=[(point.x-center.x)*scale,(point.y-center.y)*scale,point.elevationFeet-center.elevationFeet]
    return axes.map(axis => axis.reduce((sum,n,i)=>sum+n*d[i],0))
  }
  const world = values => {
    const d=[0,1,2].map(i=>axes.reduce((sum,axis,j)=>sum+axis[i]*values[j],0))
    return {x:center.x+d[0]/scale,y:center.y+d[1]/scale,elevationFeet:center.elevationFeet+d[2]}
  }
  return {axes,half,center,local,world}
}

/** Exact closest point; also valid for interior points and fully vertical long axes. */
export function rectangularPrismNearestPoint(map, area, point) {
  const prism=rectangularPrism(map,area)
  if(!prism)return undefined
  return prism.world(prism.local(point).map((n,i)=>Math.max(-prism.half[i],Math.min(prism.half[i],n))))
}

/** Exact slab intersection in the same local frame used by lighting. */
export function rectangularPrismRayInterval(map,area,from,to) {
  const prism=rectangularPrism(map,area)
  if(!prism)return undefined
  const a=prism.local(from),b=prism.local(to)
  let enter=0,exit=1
  for(let i=0;i<3;i++){
    const delta=b[i]-a[i],half=prism.half[i]
    if(Math.abs(delta)<1e-12){if(a[i]<-half||a[i]>half)return undefined;continue}
    const first=(-half-a[i])/delta,last=(half-a[i])/delta
    enter=Math.max(enter,Math.min(first,last));exit=Math.min(exit,Math.max(first,last))
    if(exit-enter<=1e-9)return undefined
  }
  return [enter,exit]
}

/** OBB versus axis-aligned creature/cell box, using all 15 separating axes. */
export function rectangularPrismDistanceToBox(map,area,minimum,maximum) {
  const prism=rectangularPrism(map,area)
  if(!prism)return Infinity
  const scale=(map.feetPerCell??5)/Math.max(1,map.gridSize)
  const half=[(maximum.x-minimum.x)*scale/2,(maximum.y-minimum.y)*scale/2,
    (maximum.elevationFeet-minimum.elevationFeet)/2]
  const delta=[((minimum.x+maximum.x)/2-prism.center.x)*scale,
    ((minimum.y+maximum.y)/2-prism.center.y)*scale,
    (minimum.elevationFeet+maximum.elevationFeet)/2-prism.center.elevationFeet]
  const world=[[1,0,0],[0,1,0],[0,0,1]],dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0)
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
  const axes=[...world,...prism.axes,...world.flatMap(a=>prism.axes.map(b=>cross(a,b)))]
  return Math.max(0,...axes.map(axis=>{
    if(dot(axis,axis)<1e-18)return 0
    const radius=half.reduce((sum,n,i)=>sum+n*Math.abs(axis[i]),0)+
      prism.half.reduce((sum,n,i)=>sum+n*Math.abs(dot(axis,prism.axes[i])),0)
    // Expanding the target by d feet in each world axis increases its
    // projection by d * ||axis||_1: exact square-grid (Chebyshev) distance.
    return (Math.abs(dot(delta,axis))-radius)/axis.reduce((sum,n)=>sum+Math.abs(n),0)
  }))
}

export function rectangularPrismOverlapsBox(map,area,minimum,maximum) {
  return rectangularPrismDistanceToBox(map,area,minimum,maximum)<=1e-9
}

/** Host footprint of the rotated solid, clipped to the map, without planar-width assumptions. */
export function rectangularPrismCells(map,area) {
  const prism=rectangularPrism(map,area)
  if(!prism)return undefined
  const corners=[-1,1].flatMap(a=>[-1,1].flatMap(b=>[-1,1].map(c=>prism.world(
    [a*prism.half[0],b*prism.half[1],c*prism.half[2]]))))
  const lo={x:Math.min(...corners.map(p=>p.x)),y:Math.min(...corners.map(p=>p.y)),elevationFeet:Math.min(...corners.map(p=>p.elevationFeet))}
  const hi={x:Math.max(...corners.map(p=>p.x)),y:Math.max(...corners.map(p=>p.y)),elevationFeet:Math.max(...corners.map(p=>p.elevationFeet))}
  const grid=Math.max(1,map.gridSize),ox=map.gridOffsetX??0,oy=map.gridOffsetY??0
  const firstCol=Math.max(0,Math.floor((lo.x-ox)/grid)),lastCol=Math.min(Math.ceil((map.width-ox)/grid)-1,Math.ceil((hi.x-ox)/grid)-1)
  const firstRow=Math.max(0,Math.floor((lo.y-oy)/grid)),lastRow=Math.min(Math.ceil((map.height-oy)/grid)-1,Math.ceil((hi.y-oy)/grid)-1)
  if((lastCol-firstCol+1)*(lastRow-firstRow+1)>100000)return undefined
  const cells=[]
  for(let col=firstCol;col<=lastCol;col++)for(let row=firstRow;row<=lastRow;row++){
    if(rectangularPrismOverlapsBox(map,area,{x:ox+col*grid,y:oy+row*grid,elevationFeet:lo.elevationFeet},
      {x:ox+(col+1)*grid,y:oy+(row+1)*grid,elevationFeet:hi.elevationFeet}))cells.push({col,row})
  }
  return cells
}

/** Convex plan-view outline of all eight corners, retaining the actual tilted footprint. */
export function rectangularPrismOutline(map,area) {
  const prism=rectangularPrism(map,area)
  if(!prism)return undefined
  const points=[-1,1].flatMap(a=>[-1,1].flatMap(b=>[-1,1].map(c=>prism.world([a*prism.half[0],b*prism.half[1],c*prism.half[2]]))))
    .sort((a,b)=>a.x-b.x||a.y-b.y)
  const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x)
  const half=points=>{const result=[];for(const p of points){while(result.length>=2&&cross(result.at(-2),result.at(-1),p)<=1e-9)result.pop();result.push(p)}return result.slice(0,-1)}
  return [...half(points),...half([...points].reverse())].flatMap(p=>[p.x,p.y])
}
