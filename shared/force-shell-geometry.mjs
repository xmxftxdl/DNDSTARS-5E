/** Surface overlap with an upright cylindrical body; the hollow interior stays traversable. */
export function forceShellOverlapsBody(area, map, at, elevationFeet, radiusFeet, heightFeet) {
  if (!area.forceShell || !area.anchorCell) return false
  const {shape,radiusFeet:r}=area.forceShell
  const scale=(map.feetPerCell??5)/Math.max(1,map.gridSize)
  const cx=(map.gridOffsetX??0)+(area.anchorCell.col+.5)*map.gridSize
  const cy=(map.gridOffsetY??0)+(area.anchorCell.row+.5)*map.gridSize
  const base=area.vertical?.mode==='volume'?area.vertical.baseElevationFeet:0
  const cz=base+(shape==='sphere'?r:0)
  const low=shape==='hemisphere'?Math.max(base,elevationFeet):elevationFeet, high=elevationFeet+heightFeet
  if(high<low || shape==='hemisphere' && high<=base) return false
  const horizontal=Math.hypot(at.x-cx,at.y-cy)*scale
  const nearZ=cz<low?low-cz:cz>high?cz-high:0,farZ=Math.max(Math.abs(low-cz),Math.abs(high-cz))
  const near=Math.hypot(Math.max(0,horizontal-radiusFeet),nearZ),far=Math.hypot(horizontal+radiusFeet,farZ)
  return near<r-1e-7 && far>r+1e-7
}

/** Continuous translating box versus a hollow shell, including contact between endpoints. */
export function forceShellSweptBoxOverlaps(area,map,from,to,fromZ,toZ,halfPixels,heightFeet) {
  if(!area.forceShell || !area.anchorCell)return false
  const {shape,radiusFeet:r}=area.forceShell,scale=(map.feetPerCell??5)/Math.max(1,map.gridSize)
  const base=area.vertical?.mode==='volume'?area.vertical.baseElevationFeet:0
  const center=[(map.gridOffsetX??0)+(area.anchorCell.col+.5)*map.gridSize,(map.gridOffsetY??0)+(area.anchorCell.row+.5)*map.gridSize,base+(shape==='sphere'?r:0)]
  const lo=[(from.x-center[0])*scale-halfPixels*scale,(from.y-center[1])*scale-halfPixels*scale,fromZ-center[2]]
  const hi=[lo[0]+2*halfPixels*scale,lo[1]+2*halfPixels*scale,lo[2]+heightFeet]
  const speed=[(to.x-from.x)*scale,(to.y-from.y)*scale,toZ-fromZ]
  let start=0,end=1
  if(shape==='hemisphere'){
    if(Math.abs(speed[2])<1e-12){if(hi[2]<=0)return false}
    else if(speed[2]>0)start=Math.max(0,-hi[2]/speed[2])
    else end=Math.min(1,-hi[2]/speed[2])
    if(start>=end)return false
  }
  const cuts=new Set([start,end])
  for(let axis=0;axis<3;axis++)if(Math.abs(speed[axis])>1e-12)for(const bound of [lo[axis],hi[axis]]){
    const t=-bound/speed[axis];if(t>start&&t<end)cuts.add(t)
  }
  const nearSquared=t=>lo.reduce((sum,value,axis)=>{
    const low=value+speed[axis]*t,high=hi[axis]+speed[axis]*t
    const nearest=low>0?low:high<0?high:0
    return sum+nearest*nearest
  },0)
  const farSquared=t=>lo.reduce((sum,value,axis)=>{
    const low=shape==='hemisphere'&&axis===2?Math.max(0,value+speed[axis]*t):value+speed[axis]*t
    const high=hi[axis]+speed[axis]*t
    return sum+Math.max(low*low,high*high)
  },0)
  // On each interval, each nearest coordinate is either zero or one affine box face.
  const ordered=[...cuts].sort((a,b)=>a-b)
  let minimum=Math.min(...ordered.map(nearSquared))
  for(let i=1;i<ordered.length;i++){
    const left=ordered[i-1],right=ordered[i],mid=(left+right)/2
    let aa=0,ab=0
    for(let axis=0;axis<3;axis++){
      const intercept=lo[axis]+speed[axis]*mid>0?lo[axis]:hi[axis]+speed[axis]*mid<0?hi[axis]:undefined
      if(intercept==null)continue
      aa+=speed[axis]*speed[axis];ab+=speed[axis]*intercept
    }
    if(aa>0)minimum=Math.min(minimum,nearSquared(Math.max(left,Math.min(right,-ab/aa))))
  }
  const maximum=Math.max(farSquared(start),farSquared(end))
  return minimum<(r-1e-7)**2 && maximum>(r+1e-7)**2
}

/** Exact spherical/hemispherical surface intersection shared by Host and browser. */
export function forceShellCrosses(area, map, from, to, fromZ, toZ) {
  if (!area.forceShell || !area.anchorCell) return false
  const { shape, radiusFeet: r } = area.forceShell
  const scale = (map.feetPerCell ?? 5) / Math.max(1, map.gridSize)
  const cx = (map.gridOffsetX ?? 0) + (area.anchorCell.col + 0.5) * map.gridSize
  const cy = (map.gridOffsetY ?? 0) + (area.anchorCell.row + 0.5) * map.gridSize
  const base = area.vertical?.mode === 'volume' ? area.vertical.baseElevationFeet : 0
  const cz = base + (shape === 'sphere' ? r : 0)
  const a = [(from.x - cx) * scale, (from.y - cy) * scale, fromZ - cz]
  const d = [(to.x - from.x) * scale, (to.y - from.y) * scale, toZ - fromZ]
  const aa = d.reduce((sum, v) => sum + v * v, 0)
  if (aa < 1e-10) return false
  const bb = 2 * a.reduce((sum, v, i) => sum + v * d[i], 0)
  const cc = a.reduce((sum, v) => sum + v * v, 0) - r * r
  const disc = bb * bb - 4 * aa * cc
  if (disc < 0) return false
  return [(-bb - Math.sqrt(disc)) / (2 * aa), (-bb + Math.sqrt(disc)) / (2 * aa)]
    .some(t => t > 1e-6 && t <= 1 + 1e-6 && (shape === 'sphere' || a[2] + d[2] * t >= -1e-6))
}
