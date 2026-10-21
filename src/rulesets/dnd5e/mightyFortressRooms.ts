import {buildDnd5eStructureSections,type Dnd5eStructureWallV1} from './structureSections'

/** Eastern rooms leave the existing central stairs and western hall unobstructed. */
export function buildDnd5eFortressRooms(counts:readonly number[],levels:readonly number[],archways:readonly string[]=[]){
 if(counts.length!==3||counts.some(count=>!Number.isInteger(count)||count<0||count>8))throw Error('fortress-room-count-invalid')
 const walls:Dnd5eStructureWallV1[]=[],doorIds:string[]=[]
 counts.forEach((count,level)=>{
  if(!count)return
  const depth=49/count
  if(depth-0.5<5)throw Error('fortress-room-too-small')
  const add=(id:string,x1:number,y1:number,x2:number,y2:number)=>walls.push({id,from:{x:x1,y:y1},to:{x:x2,y:y2},bottomFeet:levels[level],heightFeet:10,thicknessInches:6})
  for(let room=0;room<count;room++){
   const id=`room-${level+1}-${room+1}`,start=35.5+room*depth,end=start+depth,mid=(start+end)/2
   // Keep a full landing cell east of each existing stair opening.
   add(`${id}-front-a`,72.5,start,72.5,mid-2.5)
   add(`${id}-door`,72.5,mid-2.5,72.5,mid+2.5)
   add(`${id}-front-b`,72.5,mid+2.5,72.5,end)
   doorIds.push(`${id}-door.0.0`)
   if(room<count-1)add(`${id}-divider`,72.5,end,84.5,end)
  }
 })
 if(new Set(archways).size!==archways.length||archways.some(id=>!doorIds.includes(id)))throw Error('fortress-room-archway-invalid')
 return {sections:walls.length?buildDnd5eStructureSections(walls,{widthFeet:10,heightFeet:10,hitPointsPerInch:30,
  combatProfile:{armorClass:15,damageImmunities:['poison','psychic']}}):[],
  openings:doorIds.map(sectionId=>({sectionId,kind:archways.includes(sectionId)?'arch' as const:'door' as const,open:false}))}
}
