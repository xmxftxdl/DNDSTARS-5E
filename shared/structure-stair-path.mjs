/** Physical, bidirectional walking path. Coordinates use map pixels, elevations and width use feet. */
export function normalizeStructureStairPath(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 1 ||
    Object.keys(value).some(key => !['schemaVersion','widthFeet','widthMapUnits','points','thicknessInches'].includes(key)) ||
    (value.widthMapUnits != null && (!Number.isFinite(value.widthMapUnits) || value.widthMapUnits <= 0 || value.widthMapUnits > 1_000_000)) ||
    (value.thicknessInches != null && value.widthMapUnits == null) ||
    (value.thicknessInches != null && (!Number.isFinite(value.thicknessInches) || value.thicknessInches <= 0 || value.thicknessInches > 120000)) ||
    !Number.isFinite(value.widthFeet) || value.widthFeet <= 0 || value.widthFeet > 100 ||
    !Array.isArray(value.points) || value.points.length < 2 || value.points.length > 64) return undefined
  const points = []
  let direction = 0
  for (const point of value.points) {
    if (!point || typeof point !== 'object' || Array.isArray(point) ||
      Object.keys(point).some(key => !['x','y','elevationFeet'].includes(key)) ||
      ![point.x,point.y,point.elevationFeet].every(Number.isFinite) ||
      point.x < 0 || point.y < 0 || point.x > 1_000_000 || point.y > 1_000_000 ||
      point.elevationFeet < -1000 || point.elevationFeet > 10000) return undefined
    const previous = points.at(-1)
    if (previous) {
      if (Math.hypot(point.x-previous.x,point.y-previous.y) < 1e-7) return undefined
      const rise = point.elevationFeet-previous.elevationFeet
      if (Math.abs(rise) > 1e-7) {
        if (direction && Math.sign(rise) !== direction) return undefined
        direction = Math.sign(rise)
      }
    }
    points.push({x:point.x,y:point.y,elevationFeet:point.elevationFeet})
  }
  if (!direction) return undefined
  return {schemaVersion:1,widthFeet:value.widthFeet,points,...(value.widthMapUnits != null ? {widthMapUnits:value.widthMapUnits} : {}),...(value.thicknessInches != null ? {thicknessInches:value.thicknessInches} : {})}
}

/** Clip a center ray/body column against the actual sloping slabs, not their upright bounding box. */
export function structureStairRayHit(path, scale, from, to, bodyHeightFeet = 0) {
  if (!path?.thicknessInches || !Number.isFinite(scale) || scale <= 0) return undefined
  let nearest
  for (let index = 1; index < path.points.length; index++) {
    const a=path.points[index-1],b=path.points[index],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)
    if(length<1e-7)continue
    const local=p=>{
      const along=((p.x-a.x)*dx+(p.y-a.y)*dy)/length
      return [along, (-(p.x-a.x)*dy+(p.y-a.y)*dx)/length,
        p.elevationFeet-a.elevationFeet-(b.elevationFeet-a.elevationFeet)*along/length]
    }
    const start=local(from),end=local(to),half=path.widthFeet*scale/2
    const bounds=[[0,length],[-half,half],[-path.thicknessInches/12-bodyHeightFeet,0]]
    let enter=0,exit=1,hit=true
    for(let axis=0;axis<3;axis++){
      const [low,high]=bounds[axis],delta=end[axis]-start[axis]
      if(Math.abs(delta)<1e-10){if(axis===2 ? start[axis]<=low+1e-7||start[axis]>=high-1e-7 : start[axis]<low-1e-7||start[axis]>high+1e-7){hit=false;break}}
      else {
        const first=(low-start[axis])/delta,second=(high-start[axis])/delta
        enter=Math.max(enter,Math.min(first,second));exit=Math.min(exit,Math.max(first,second))
        if(exit-enter<=1e-7){hit=false;break}
      }
    }
    if(hit && (nearest==null||enter<nearest))nearest=enter
  }
  return nearest
}

/** Continuous separating-axis test of an upright body against each sloping solid slab. */
export function structureStairBodyHit(path, scale, from, to, halfWidthMapUnits, heightFeet) {
  if(!path?.thicknessInches || !Number.isFinite(scale)||scale<=0)return undefined
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
  const world=[[1,0,0],[0,1,0],[0,0,1]],bodyHalf=[halfWidthMapUnits,halfWidthMapUnits,heightFeet*scale/2]
  const start=[from.x,from.y,(from.elevationFeet+heightFeet/2)*scale],end=[to.x,to.y,(to.elevationFeet+heightFeet/2)*scale]
  let nearest
  for(let index=1;index<path.points.length;index++){
    const a=path.points[index-1],b=path.points[index],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),width=path.widthFeet*scale
    if(length<1e-7)continue
    const onTop=p=>{
      const along=((p.x-a.x)*dx+(p.y-a.y)*dy)/(length*length)
      const lateral=Math.abs(-(p.x-a.x)*dy+(p.y-a.y)*dx)/length
      const supportedAlong=Math.max(0,Math.min(1,along))
      const rise=b.elevationFeet-a.elevationFeet
      return (Math.abs(p.elevationFeet-a.elevationFeet-rise*supportedAlong)<1e-7 ||
        Math.abs(p.elevationFeet-a.elevationFeet-rise*along)<1e-7) && lateral+halfWidthMapUnits<=width/2+1e-7
    }
    // Feet conform to the steps and the level approaches at either end.
    if(onTop(from)&&onTop(to))continue
    const u=[dx,dy,(b.elevationFeet-a.elevationFeet)*scale],v=[-dy/length*width,dx/length*width,0],w=[0,0,-path.thicknessInches/12*scale]
    const origin=[a.x-v[0]/2,a.y-v[1]/2,a.elevationFeet*scale]
    const vertices=[]
    for(const i of [0,1])for(const j of [0,1])for(const k of [0,1])vertices.push(origin.map((value,axis)=>value+i*u[axis]+j*v[axis]+k*w[axis]))
    const axes=[...world,cross(u,v),cross(u,w),cross(v,w),...[u,v,w].flatMap(edge=>world.map(axis=>cross(edge,axis)))]
    let enter=0,exit=1,hit=true
    for(const raw of axes){
      const norm=Math.hypot(...raw)
      if(norm<1e-9)continue
      const axis=raw.map(value=>value/norm),projections=vertices.map(vertex=>dot(vertex,axis))
      const radius=axis.reduce((sum,value,i)=>sum+Math.abs(value)*bodyHalf[i],0)
      const low=Math.min(...projections)-radius,high=Math.max(...projections)+radius,s=dot(start,axis),delta=dot(end,axis)-s
      if(Math.abs(delta)<1e-9){if(s<=low+1e-7||s>=high-1e-7){hit=false;break}}
      else{
        const first=(low-s)/delta,second=(high-s)/delta
        enter=Math.max(enter,Math.min(first,second));exit=Math.min(exit,Math.max(first,second))
        if(exit-enter<=1e-7){hit=false;break}
      }
    }
    if(hit&&(nearest==null||enter<nearest))nearest=enter
  }
  return nearest
}
