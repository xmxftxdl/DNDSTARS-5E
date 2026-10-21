import {buildDnd5eStructureSections,type Dnd5eStructureWallV1} from './structureSections'
import type {Dnd5eStructureStairFlight} from './structureStairs'

/** Local feet, with x/y describing the outside north-west corner. */
export interface Dnd5eFortressRoomBlueprint {
 id:string;level:1|2|3;x:number;y:number;widthFeet:number;depthFeet:number;
 entrance:{side:'north'|'south'|'east'|'west';offsetFeet:number;kind:'door'|'arch'};
}

/** Reject walls crossing access surfaces; rooms may surround a staircase. */
export function assertDnd5eFortressRoomAccess(blueprint:ReturnType<typeof buildDnd5eFortressRoomBlueprint>,stairs:readonly Dnd5eStructureStairFlight[],
 holes:readonly {level:2|3;column:number;row:number}[],levels:readonly number[]){
 type Point={x:number;y:number}
 const overlaps=(a:Point[],b:Point[])=>[a,b].every(poly=>poly.every((p,i)=>{
  const q=poly[(i+1)%poly.length],nx=q.y-p.y,ny=p.x-q.x
  const first=a.map(v=>v.x*nx+v.y*ny),second=b.map(v=>v.x*nx+v.y*ny)
  return Math.min(...first)<Math.max(...second)-1e-8&&Math.min(...second)<Math.max(...first)-1e-8
 }))
 for(const section of blueprint.sections){
  const {from:a,to:b}=section,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),half=section.thicknessInches/24
  const ox=-dy/length*half,oy=dx/length*half
  const wall=[{x:a.x+ox,y:a.y+oy},{x:b.x+ox,y:b.y+oy},{x:b.x-ox,y:b.y-oy},{x:a.x-ox,y:a.y-oy}]
  for(const stair of stairs){
   const low=Math.min(stair.from.elevationFeet,stair.to.elevationFeet),high=Math.max(stair.from.elevationFeet,stair.to.elevationFeet)
   if(section.bottomFeet>high||section.bottomFeet+section.heightFeet<=low)continue
   const sx=stair.to.x-stair.from.x,sy=stair.to.y-stair.from.y,run=Math.hypot(sx,sy)
   const x=-sy/run*stair.widthFeet/2,y=sx/run*stair.widthFeet/2
   if(overlaps(wall,[{x:stair.from.x+x,y:stair.from.y+y},{x:stair.to.x+x,y:stair.to.y+y},
    {x:stair.to.x-x,y:stair.to.y-y},{x:stair.from.x-x,y:stair.from.y-y}]))throw Error('fortress-room-stair-conflict')
  }
  for(const hole of holes){
   if(section.bottomFeet!==levels[hole.level-1])continue
   const x=35+hole.column*10,y=35+hole.row*10
   if(overlaps(wall,[{x,y},{x:x+10,y},{x:x+10,y:y+10},{x,y:y+10}]))throw Error('fortress-room-opening-conflict')
  }
 }
}

export function buildDnd5eFortressRoomBlueprint(rooms:readonly Dnd5eFortressRoomBlueprint[],levels:readonly number[]){
 if(!Array.isArray(rooms)||rooms.length>192||levels.length!==3||levels.some(value=>!Number.isFinite(value)))throw Error('fortress-room-blueprint-invalid')
 const ids=new Set<string>(),walls:Dnd5eStructureWallV1[]=[],openings:{sectionId:string;kind:'door'|'arch';open:boolean}[]=[]
 for(const room of rooms){
  if(!room||typeof room.id!=='string'||!/^[a-z0-9][a-z0-9_-]{0,48}$/.test(room.id)||ids.has(room.id)||
   ![1,2,3].includes(room.level)||![room.x,room.y,room.widthFeet,room.depthFeet].every(Number.isFinite)||
   room.widthFeet<6||room.depthFeet<6||room.x<35.5||room.y<35.5||room.x+room.widthFeet>84.5||room.y+room.depthFeet>84.5||
   !room.entrance||!['north','south','east','west'].includes(room.entrance.side)||!['door','arch'].includes(room.entrance.kind)||!Number.isFinite(room.entrance.offsetFeet))throw Error('fortress-room-blueprint-invalid')
  ids.add(room.id)
 }
 for(let i=0;i<rooms.length;i++)for(let j=i+1;j<rooms.length;j++){
  const a=rooms[i],b=rooms[j]
  if(a.level===b.level&&a.x<b.x+b.widthFeet&&a.x+a.widthFeet>b.x&&a.y<b.y+b.depthFeet&&a.y+a.depthFeet>b.y)throw Error('fortress-room-overlap')
 }
 for(const room of rooms){
  const x=room.x+0.25,y=room.y+0.25,right=room.x+room.widthFeet-0.25,bottom=room.y+room.depthFeet-0.25
  const sides={north:[x,y,right,y],south:[x,bottom,right,bottom],west:[x,y,x,bottom],east:[right,y,right,bottom]}
  const add=(suffix:string,x1:number,y1:number,x2:number,y2:number)=>{
   if(Math.hypot(x2-x1,y2-y1)<1e-9)return
   walls.push({id:`custom-room-${room.id}-${suffix}`,from:{x:x1,y:y1},to:{x:x2,y:y2},bottomFeet:levels[room.level-1],heightFeet:10,thicknessInches:6})
  }
  for(const [side,[x1,y1,x2,y2]]of Object.entries(sides)){
   if(side!==room.entrance.side){add(side,x1,y1,x2,y2);continue}
   const length=Math.hypot(x2-x1,y2-y1),start=room.entrance.offsetFeet-0.25,end=start+5
   // Five clear feet for the entrance, leaving the perpendicular walls intact.
   if(start<0.25||end>length-0.25)throw Error('fortress-room-entrance-invalid')
   const point=(distance:number)=>({x:x1+(x2-x1)*distance/length,y:y1+(y2-y1)*distance/length})
   const a=point(start),b=point(end)
   add(`${side}-a`,x1,y1,a.x,a.y);add(`${side}-entrance`,a.x,a.y,b.x,b.y);add(`${side}-b`,b.x,b.y,x2,y2)
   openings.push({sectionId:`custom-room-${room.id}-${side}-entrance.0.0`,kind:room.entrance.kind,open:false})
  }
 }
 return {sections:walls.length?buildDnd5eStructureSections(walls,{widthFeet:10,heightFeet:10,hitPointsPerInch:30,
  combatProfile:{armorClass:15,damageImmunities:['poison','psychic']}}):[],openings}
}
