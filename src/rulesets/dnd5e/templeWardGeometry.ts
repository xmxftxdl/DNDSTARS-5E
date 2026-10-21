import {mapGeometryPointInPolygon,type MapGeometryState} from '../../lib/mapGeometry'

/** Host geometry, current elevation and campaign time determine protection. */
export function dnd5eTempleWardAt(geometry:MapGeometryState|null|undefined,point:{x:number;y:number},elevationFeet:number,worldMinute?:number):boolean {
 return !!geometry?.structureLifetimes?.some(record=>{
  const volume=record.objectBoundary
  return record.replacementGroup==='temple-of-the-gods'&&!!record.templeWard&&!!volume&&
   !(worldMinute!=null&&(!Number.isFinite(worldMinute)||worldMinute<record.createdWorldMinute))&&
   !(record.expiresWorldMinute!=null&&worldMinute!=null&&worldMinute>=record.expiresWorldMinute)&&
   elevationFeet>=volume.bottomFeet&&elevationFeet<volume.topFeet&&mapGeometryPointInPolygon(point,volume.points)
 })
}

/** Partition a segment at every horizontal/vertical boundary; no grid sampling gaps. */
export function dnd5eTempleWardCrossed(geometry:MapGeometryState|undefined,from:{x:number;y:number;elevationFeet:number},to:{x:number;y:number;elevationFeet:number},worldMinute?:number):boolean {
 const cuts=[0,1],dx=to.x-from.x,dy=to.y-from.y,dz=to.elevationFeet-from.elevationFeet
 for(const record of geometry?.structureLifetimes??[]){
  const volume=record.objectBoundary
  if(!record.templeWard||!volume)continue
  if(dz!==0)for(const height of [volume.bottomFeet,volume.topFeet])cuts.push((height-from.elevationFeet)/dz)
  for(let i=0;i<volume.points.length;i++){
   const a=volume.points[i],b=volume.points[(i+1)%volume.points.length],ex=b.x-a.x,ey=b.y-a.y
   const determinant=dx*ey-dy*ex
   if(Math.abs(determinant)<1e-10)continue
   const ax=a.x-from.x,ay=a.y-from.y,t=(ax*ey-ay*ex)/determinant,u=(ax*dy-ay*dx)/determinant
   if(u>=0&&u<=1)cuts.push(t)
  }
 }
 const times=cuts.filter(t=>t>=0&&t<=1).sort((a,b)=>a-b)
 const probes=[...times,...times.slice(1).map((t,i)=>(t+times[i])/2)]
 return probes.some(t=>dnd5eTempleWardAt(geometry,{x:from.x+dx*t,y:from.y+dy*t},from.elevationFeet+dz*t,worldMinute))
}
