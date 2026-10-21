// Sweep an upright token box against a polygon prism. Testing each boundary
// edge separately preserves concave recesses instead of convexifying the slab.
export function structureSolidBodyBlocked(obstacle, from, to, halfWidth, bodyHeight) {
  return structureSolidBodyHit(obstacle,from,to,halfWidth,bodyHeight)!=null
}
export function structureSolidBodyHit(obstacle, from, to, halfWidth, bodyHeight) {
  const points=obstacle.points
  if(!Array.isArray(points)||points.length<3||!(obstacle.heightFeet>0))return undefined
  const epsilon=1e-7, dz=to.elevationFeet-from.elevationFeet
  let lo=0,hi=1
  function clip(start,delta,min,max) {
    if(Math.abs(delta)<1e-12)return start>=min&&start<=max
    let a=(min-start)/delta,b=(max-start)/delta
    if(a>b)[a,b]=[b,a]
    lo=Math.max(lo,a);hi=Math.min(hi,b)
    return lo<=hi
  }
  if(!clip(from.elevationFeet,dz,obstacle.baseHeightFeet-bodyHeight+epsilon,
    obstacle.baseHeightFeet+obstacle.heightFeet-epsilon))return undefined
  const verticalLo=lo,verticalHi=hi,dx=to.x-from.x,dy=to.y-from.y
  const x=from.x+dx*lo,y=from.y+dy*lo
  let inside=false
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],b=points[j]
    if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside
  }
  if(inside)return lo
  let nearest
  const radius=Math.max(0,halfWidth-epsilon)
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length]
    lo=verticalLo;hi=verticalHi
    const axes=[{x:1,y:0},{x:0,y:1},{x:-(b.y-a.y),y:b.x-a.x}]
    if(axes.every(axis=>{
      const p=a.x*axis.x+a.y*axis.y,q=b.x*axis.x+b.y*axis.y
      const extent=radius*(Math.abs(axis.x)+Math.abs(axis.y))
      return clip(from.x*axis.x+from.y*axis.y,dx*axis.x+dy*axis.y,Math.min(p,q)-extent,Math.max(p,q)+extent)
    }))nearest=nearest==null?lo:Math.min(nearest,lo)
  }
  return nearest
}
