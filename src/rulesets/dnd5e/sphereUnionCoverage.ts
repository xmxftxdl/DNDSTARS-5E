type Vec = [number, number, number]
export type CoverageSphere = {center: Vec; radius: number}
export type CoveragePlane = {n:Vec;d:number}
const dot=(a:Vec,b:Vec)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
const cross=(a:Vec,b:Vec):Vec=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]

/** Exact convex-cell coverage, rather than a sample grid that can miss gaps.
 * Partition the box by minimum sphere power. In each convex partition, the
 * maximum distance to its winning sphere occurs at a vertex.
 */
export function boxCoveredBySpheres(min:Vec,max:Vec,spheres:readonly CoverageSphere[],domain?:CoverageSphere,clipPlanes:readonly CoveragePlane[]=[]):boolean {
 if(domain&&domain.center.reduce((sum,v,i)=>sum+(v-Math.max(min[i],Math.min(max[i],v)))**2,0)>=domain.radius**2-1e-8)return true
 if(!spheres.length)return false
 const power=(p:Vec,s:CoverageSphere)=>p.reduce((sum,v,i)=>sum+(v-s.center[i])**2,0)-s.radius**2
 const corners=Array.from({length:8},(_,i):Vec=>[i&1?max[0]:min[0],i&2?max[1]:min[1],i&4?max[2]:min[2]])
 if(spheres.some(s=>corners.every(p=>power(p,s)<=1e-8)))return true
 if(corners.some(p=>clipPlanes.every(plane=>dot(plane.n,p)<=plane.d+1e-8)&&(!domain||power(p,domain)<=1e-8)&&spheres.every(s=>power(p,s)>1e-8)))return false
 for(const sphere of spheres){
  const planes:Array<{n:Vec;d:number}>=[
   {n:[1,0,0],d:max[0]},{n:[-1,0,0],d:-min[0]},
   {n:[0,1,0],d:max[1]},{n:[0,-1,0],d:-min[1]},
   {n:[0,0,1],d:max[2]},{n:[0,0,-1],d:-min[2]},
   ...clipPlanes,
  ]
  for(const other of spheres){
   if(other===sphere)continue
   planes.push({n:other.center.map((v,i)=>2*(v-sphere.center[i])) as Vec,
    d:dot(other.center,other.center)-other.radius**2-dot(sphere.center,sphere.center)+sphere.radius**2})
  }
  const exposed=(p:Vec)=>planes.every(plane=>dot(plane.n,p)<=plane.d+1e-8)&&
    (!domain||power(p,domain)<=1e-8)&&power(p,sphere)>1e-8
  if(domain){
   // On the gas sphere, squared distance to the covering sphere is linear.
   // Its extrema occur on the free sphere, a plane circle, or a two-plane edge.
   const direction=domain.center.map((v,i)=>v-sphere.center[i]) as Vec
   const norm=Math.hypot(...direction)
   if(norm>1e-10&&exposed(domain.center.map((v,i)=>v+direction[i]*domain.radius/norm) as Vec))return false
   for(let i=0;i<planes.length;i++){
    const a=planes[i],nn=dot(a.n,a.n)
    if(nn<1e-20)continue
    const signed=(a.d-dot(a.n,domain.center))/nn
    const center=domain.center.map((v,j)=>v+signed*a.n[j]) as Vec
    const radiusSquared=domain.radius**2-signed**2*nn
    if(radiusSquared < -1e-8)continue
    const radius=Math.sqrt(Math.max(0,radiusSquared))
    const tangent=direction.map((v,j)=>v-dot(direction,a.n)/nn*a.n[j]) as Vec
    const length=Math.hypot(...tangent)
    if(length>1e-10){
     if(exposed(center.map((v,j)=>v+radius*tangent[j]/length) as Vec))return false
    }else{
     const axis:Vec=Math.abs(a.n[0])<Math.abs(a.n[1])?[1,0,0]:[0,1,0]
     const t=cross(a.n,axis),l=Math.hypot(...t)
     if(l>1e-10&&exposed(center.map((v,j)=>v+radius*t[j]/l) as Vec))return false
    }
    for(let j=i+1;j<planes.length;j++){
     const b=planes[j],ab=dot(a.n,b.n),bb=dot(b.n,b.n),det=nn*bb-ab*ab
     if(Math.abs(det)<1e-10)continue
     const da=a.d-dot(a.n,domain.center),db=b.d-dot(b.n,domain.center)
     const u=(da*bb-db*ab)/det,v=(db*nn-da*ab)/det
     const foot=domain.center.map((c,k)=>c+u*a.n[k]+v*b.n[k]) as Vec
     const r2=domain.radius**2-foot.reduce((sum,c,k)=>sum+(c-domain.center[k])**2,0)
     if(r2 < -1e-8)continue
     const edge=cross(a.n,b.n),factor=Math.sqrt(Math.max(0,r2))/Math.hypot(...edge)
     for(const sign of [-1,1])if(exposed(foot.map((c,k)=>c+sign*factor*edge[k]) as Vec))return false
    }
   }
   // Coincident centers make the objective constant on the spherical boundary.
   if(norm<=1e-10)for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
    const p=[...domain.center] as Vec;p[axis]+=sign*domain.radius
    if(exposed(p))return false
   }
  }
  for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++)for(let k=j+1;k<planes.length;k++){
   const a=planes[i],b=planes[j],c=planes[k],bc=cross(b.n,c.n),ca=cross(c.n,a.n),ab=cross(a.n,b.n)
   const determinant=dot(a.n,bc)
   if(Math.abs(determinant)<1e-10)continue
   const p=bc.map((v,axis)=>(a.d*v+b.d*ca[axis]+c.d*ab[axis])/determinant) as Vec
   if(exposed(p))return false
  }
 }
 return true
}
