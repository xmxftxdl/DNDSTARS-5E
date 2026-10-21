import type { MapGeometryPoint } from './mapGeometry'

export function polygonSignedArea(points: readonly MapGeometryPoint[]): number {
  return points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y},0)/2
}

/** Disjoint positive-area pieces of subject inside/outside a convex clip. */
export function partitionByConvexPolygon(subject: readonly MapGeometryPoint[], clip: readonly MapGeometryPoint[]): {
  inside: MapGeometryPoint[]; outside: MapGeometryPoint[][]
} | undefined {
  if(subject.length<3||clip.length<3||[...subject,...clip].some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return undefined
  const orientation=Math.sign(polygonSignedArea(clip))
  if(!orientation)return undefined
  const side=(p:MapGeometryPoint,a:MapGeometryPoint,b:MapGeometryPoint)=>orientation*((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x))
  if(clip.some((a,i)=>clip.some(p=>side(p,a,clip[(i+1)%clip.length]) < -1e-7)))return undefined
  const halfPlane=(points:readonly MapGeometryPoint[],a:MapGeometryPoint,b:MapGeometryPoint,sign:number)=>{
    const result:MapGeometryPoint[]=[]
    for(let i=0;i<points.length;i++){
      const p=points[i],q=points[(i+1)%points.length],dp=side(p,a,b)*sign,dq=side(q,a,b)*sign
      if(dp>=0)result.push({...p})
      if((dp<0&&dq>0)||(dp>0&&dq<0)){
        const t=dp/(dp-dq);result.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t})
      }
    }
    return result.filter((p,i)=>{const q=result[(i+result.length-1)%result.length];return !q||Math.hypot(p.x-q.x,p.y-q.y)>1e-7})
  }
  let inside=subject.map(p=>({...p}));const outside:MapGeometryPoint[][]=[]
  for(let i=0;i<clip.length&&inside.length;i++){
    const a=clip[i],b=clip[(i+1)%clip.length]
    if(Math.hypot(a.x-b.x,a.y-b.y)<1e-7)continue
    const piece=halfPlane(inside,a,b,-1)
    if(Math.abs(polygonSignedArea(piece))>1e-7)outside.push(piece)
    inside=halfPlane(inside,a,b,1)
  }
  if(Math.abs(polygonSignedArea(inside))<=1e-7)inside=[]
  return {inside,outside}
}
