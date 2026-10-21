import { mapGeometrySegmentsIntersect, type MapGeometryPoint } from './mapGeometry'
import { polygonSignedArea } from './convexPolygonPartition'

/** Ear clipping for a simple polygon, preserving its area and winding.
 * Invalid or self-intersecting input is rejected rather than repaired. */
export function triangulateSimplePolygon(input: readonly MapGeometryPoint[]): MapGeometryPoint[][] | undefined {
  const points = input.filter((p,i) => {
    const previous = input[(i + input.length - 1) % input.length]
    return Math.hypot(p.x-previous.x,p.y-previous.y)>1e-7
  }).map(p=>({...p}))
  if (points.length<3 || points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))) return undefined
  for(let i=0;i<points.length;i++) for(let j=i+1;j<points.length;j++) {
    if(j===i+1 || (i===0&&j===points.length-1)) continue
    if(mapGeometrySegmentsIntersect(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length])) return undefined
  }
  const winding = Math.sign(polygonSignedArea(points))
  if(!winding) return undefined
  const cross=(a:MapGeometryPoint,b:MapGeometryPoint,c:MapGeometryPoint)=>winding*((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))
  const result:MapGeometryPoint[][]=[]
  while(points.length>3) {
    let clipped=false
    for(let i=0;i<points.length;i++) {
      const previous=(i+points.length-1)%points.length,next=(i+1)%points.length
      const a=points[previous],b=points[i],c=points[next]
      if(cross(a,b,c)<=1e-7) continue
      if(points.some((p,j)=>j!==previous&&j!==i&&j!==next&&cross(a,b,p)>=-1e-7&&cross(b,c,p)>=-1e-7&&cross(c,a,p)>=-1e-7)) continue
      result.push([a,b,c]);points.splice(i,1);clipped=true;break
    }
    if(!clipped) return undefined
  }
  if(Math.abs(polygonSignedArea(points))>1e-7) result.push(points)
  return result.length?result:undefined
}
