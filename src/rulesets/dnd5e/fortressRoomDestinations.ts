import type {MapGeometryState} from '../../lib/mapGeometry'

/** Derive exact destinations from this fortress's generated room fronts, including archways. */
export function dnd5eFortressRoomDestinations(geometry:MapGeometryState,structureId:string){
 const record=geometry.structureLifetimes?.find(record=>record.id===structureId),boundary=record?.objectBoundary
 if(!record||!boundary)return []
 const [a,b,,d]=boundary.points,ux=b.x-a.x,uy=b.y-a.y,vx=d.x-a.x,vy=d.y-a.y
 const u2=ux*ux+uy*uy,v2=vx*vx+vy*vy
 if(!(u2>0&&v2>0))return []
 const owned=new Set(record.entityIds),rooms=new Map<string,{level:number;number:number;x:number;y:number;elevationFeet:number}>()
 for(const wall of geometry.obstacles){
  if(!owned.has(wall.id)||!wall.id.startsWith(`${structureId}:`))continue
  const match=/^room-([1-3])-([1-8])-front-a\.0\.\d+$/.exec(wall.id.slice(structureId.length+1))
  if(!match)continue
  const local=wall.points.map(point=>({x:((point.x-a.x)*ux+(point.y-a.y)*uy)/u2*120,y:((point.x-a.x)*vx+(point.y-a.y)*vy)/v2*120}))
  const id=`room-${match[1]}-${match[2]}`,prior=rooms.get(id)
  const y=Math.max(...local.map(point=>point.y))+2.5
  if(!prior||y>prior.y)rooms.set(id,{level:Number(match[1]),number:Number(match[2]),x:local.reduce((sum,point)=>sum+point.x,0)/local.length,y,elevationFeet:wall.baseHeightFeet})
 }
 const result=[...rooms.entries()].sort(([,a],[,b])=>a.level-b.level||a.number-b.number).map(([id,room])=>{
  const at=(x:number)=>({x:a.x+ux*x/120+vx*room.y/120,y:a.y+uy*x/120+vy*room.y/120,elevationFeet:room.elevationFeet})
  return {id,label:`第 ${room.level} 层 · 东侧第 ${room.number} 间`,inside:at(room.x+5),outside:at(room.x-5),threshold:at(room.x)}
 })
 const custom=new Map<string,{points:{x:number;y:number}[];elevationFeet:number;entrance?:{side:string;end:number;axis:number}}>()
 for(const wall of geometry.obstacles){
  if(!owned.has(wall.id)||!wall.id.startsWith(`${structureId}:`))continue
  const match=/^custom-room-(.+)-(north|south|east|west)(?:-(a|b|entrance))?\.0\.\d+$/.exec(wall.id.slice(structureId.length+1))
  if(!match)continue
  const local=wall.points.map(point=>({x:((point.x-a.x)*ux+(point.y-a.y)*uy)/u2*120,y:((point.x-a.x)*vx+(point.y-a.y)*vy)/v2*120}))
  const room:NonNullable<ReturnType<typeof custom.get>>=custom.get(match[1])??{points:[],elevationFeet:wall.baseHeightFeet}
  room.points.push(...local)
  if(match[3]==='a'){
   const horizontal=match[2]==='north'||match[2]==='south'
   const end=Math.max(...local.map(point=>horizontal?point.x:point.y))
   if(!room.entrance||end>room.entrance.end)room.entrance={side:match[2],end,axis:local.reduce((sum,point)=>sum+(horizontal?point.y:point.x),0)/local.length}
  }
  custom.set(match[1],room)
 }
 for(const [index,[id,room]]of [...custom.entries()].sort(([a],[b])=>a.localeCompare(b)).entries()){
  if(!room.entrance)continue
  const {side,end,axis}=room.entrance,horizontal=side==='north'||side==='south'
  const center={x:(Math.min(...room.points.map(p=>p.x))+Math.max(...room.points.map(p=>p.x)))/2,
   y:(Math.min(...room.points.map(p=>p.y))+Math.max(...room.points.map(p=>p.y)))/2}
  const outside={x:horizontal?end+2.5:axis+(side==='west'?-5:5),y:horizontal?axis+(side==='north'?-5:5):end+2.5}
  const at=(point:{x:number;y:number})=>({x:a.x+ux*point.x/120+vx*point.y/120,y:a.y+uy*point.x/120+vy*point.y/120,elevationFeet:room.elevationFeet})
  result.push({id:`custom-room-${id}`,label:`自定义房间 ${index+1}（高度 ${room.elevationFeet} 尺）`,inside:at(center),outside:at(outside),
   threshold:at({x:horizontal?end+2.5:axis,y:horizontal?axis:end+2.5})})
 }
 return result
}
