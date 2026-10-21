export type TempleSide='north'|'south'|'west'|'east'
export interface TempleOpening {side:TempleSide;offsetFeet:number;widthFeet:number;bottomFeet:number;heightFeet:number}
export interface TempleLayout {door:Omit<TempleOpening,'bottomFeet'>;windows:TempleOpening[]}
/** Coordinates run west to east on north/south, north to south on west/east. */
export function validTempleLayout(layout:TempleLayout,width:number,depth:number,height:number):boolean{
 if(!layout||!layout.door||!Array.isArray(layout.windows)||layout.windows.length>256)return false
 const openings:TempleOpening[]=[{...layout.door,bottomFeet:0},...layout.windows]
 for(const opening of openings){
  if(!opening||!['north','south','west','east'].includes(opening.side)||
   ![opening.offsetFeet,opening.widthFeet,opening.bottomFeet,opening.heightFeet].every(Number.isFinite)||
   opening.offsetFeet<0||opening.bottomFeet<0||opening.widthFeet<=0||opening.heightFeet<=0||
   opening.offsetFeet+opening.widthFeet>(['north','south'].includes(opening.side)?width:depth)||
   opening.bottomFeet+opening.heightFeet>height)return false
 }
 for(let i=0;i<openings.length;i++)for(let j=i+1;j<openings.length;j++){
  const a=openings[i],b=openings[j]
  if(a.side===b.side&&a.offsetFeet<b.offsetFeet+b.widthFeet&&b.offsetFeet<a.offsetFeet+a.widthFeet&&
   a.bottomFeet<b.bottomFeet+b.heightFeet&&b.bottomFeet<a.bottomFeet+a.heightFeet)return false
 }
 return true
}

/** Partition the wall exactly around the selected openings, including sills and lintels. */
export function templeLayoutWallParts(layout:TempleLayout,width:number,depth:number,height:number){
 const parts:Array<{side:TempleSide;offset:number;width:number;bottom:number;height:number}>=[]
 for(const side of ['north','south','west','east'] as const){
  const openings=[{...layout.door,bottomFeet:0},...layout.windows].filter(opening=>opening.side===side)
  const length=side==='north'||side==='south'?width:depth
  const xs=[...new Set([0,length,...openings.flatMap(o=>[o.offsetFeet,o.offsetFeet+o.widthFeet])])].sort((a,b)=>a-b)
  const zs=[...new Set([0,height,...openings.flatMap(o=>[o.bottomFeet,o.bottomFeet+o.heightFeet])])].sort((a,b)=>a-b)
  for(let x=1;x<xs.length;x++)for(let z=1;z<zs.length;z++){
   const cx=(xs[x-1]+xs[x])/2,cz=(zs[z-1]+zs[z])/2
   if(openings.some(o=>cx>o.offsetFeet&&cx<o.offsetFeet+o.widthFeet&&cz>o.bottomFeet&&cz<o.bottomFeet+o.heightFeet))continue
   parts.push({side,offset:xs[x-1],width:xs[x]-xs[x-1],bottom:zs[z-1],height:zs[z]-zs[z-1]})
  }
 }
 return parts
}
