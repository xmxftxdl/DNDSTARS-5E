import type {MapGeometryPoint} from './mapGeometry'
import {polygonSignedArea} from './convexPolygonPartition'

/** Elevation in feet = xSlope*x + ySlope*y + offset, with x/y in map units. */
export interface HeightPlane {xSlope:number;ySlope:number;offset:number}
export const planeHeight=(plane:HeightPlane,point:MapGeometryPoint)=>plane.xSlope*point.x+plane.ySlope*point.y+plane.offset
export function normalizeHeightPlane(value:unknown):HeightPlane|undefined{
 if(!value||typeof value!=='object'||Array.isArray(value))return undefined
 const p=value as Record<string,unknown>
 if(Object.keys(p).some(k=>!['xSlope','ySlope','offset'].includes(k))||![p.xSlope,p.ySlope,p.offset].every(n=>typeof n==='number'&&Number.isFinite(n)))return undefined
 return {xSlope:p.xSlope as number,ySlope:p.ySlope as number,offset:p.offset as number}
}

/** Portion on which a>=b. Also works with a convex footprint crossing two slopes. */
export function clipAbovePlane(points:readonly MapGeometryPoint[],a:HeightPlane,b:HeightPlane):MapGeometryPoint[]{
 const value=(p:MapGeometryPoint)=>planeHeight(a,p)-planeHeight(b,p),result:MapGeometryPoint[]=[]
 for(let i=0;i<points.length;i++){
  const p=points[i],q=points[(i+1)%points.length],vp=value(p),vq=value(q)
  if(vp>=0)result.push({...p})
  if((vp<0&&vq>0)||(vp>0&&vq<0)){const t=vp/(vp-vq);result.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t})}
 }
 const cleaned=result.filter((p,i)=>{const q=result[(i+result.length-1)%result.length];return !q||Math.hypot(p.x-q.x,p.y-q.y)>1e-7})
 return Math.abs(polygonSignedArea(cleaned))>1e-7?cleaned:[]
}
