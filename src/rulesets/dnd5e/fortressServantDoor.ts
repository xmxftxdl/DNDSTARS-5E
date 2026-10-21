import type {BattleMap} from '../../store/maps'
import type {MapGeometryState} from '../../lib/mapGeometry'
import {mapGeometryTokenElevation,mapGeometryDoorLeafPoints,mapGeometryLineOfEffectBlocked,mapGeometryPlacementBlocked} from '../../lib/mapGeometry'
import {resolveDnd5eFortressServantControl} from './fortressServantControl'
import {prepareDnd5eMapInteraction} from './mapInteraction'

export function prepareDnd5eFortressServantDoor(input:{map:BattleMap;geometry:MapGeometryState;commanderTokenId:string;
 servantTokenId:string;worldMinute:number;doorId:string;doorOperation:'open'|'close';combatId?:string;round?:number}){
 const fail=(reason:string)=>({ok:false as const,reason})
 const control=resolveDnd5eFortressServantControl(input)
 if(!control)return fail('fortress-door-unauthorized')
 if(input.doorOperation!=='open'&&input.doorOperation!=='close')return fail('fortress-door-operation-invalid')
 const door=input.geometry.doors.find(candidate=>candidate.id===input.doorId)
 if(!door)return fail('door-not-found')
 const height=mapGeometryTokenElevation(input.geometry,control.servant)
 if(height>door.baseHeightFeet+door.heightFeet+5||height+5<door.baseHeightFeet)return fail('door-out-of-reach')
 const result=prepareDnd5eMapInteraction({map:input.map,geometry:input.geometry,actor:control.servant,
  payload:{doorId:door.id,operation:input.doorOperation,method:'interact'},worldMinute:input.worldMinute,combatId:input.combatId,round:input.round})
 if(!result.ok)return result
 if(!result.prepared.automaticSuccess||!result.prepared.nextDoorState)return fail('fortress-door-check-required')
 const reachable=[door.points,mapGeometryDoorLeafPoints(door)].some(([a,b])=>{
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy
  const t=length?Math.max(0,Math.min(1,((control.servant.x-a.x)*dx+(control.servant.y-a.y)*dy)/length)):0
  const point={x:a.x+dx*t,y:a.y+dy*t}
  const distance=Math.hypot(point.x-control.servant.x,point.y-control.servant.y)
  if(distance>(5/(input.map.feetPerCell??5)+Math.max(1,control.servant.size)/2)*input.map.gridSize)return false
  // Stop just before the door surface, preserving its authored wall opening and every intervening barrier.
  const ratio=distance>0?Math.max(0,1-0.001/distance):0
  const to={x:control.servant.x+(point.x-control.servant.x)*ratio,y:control.servant.y+(point.y-control.servant.y)*ratio}
  return !mapGeometryLineOfEffectBlocked({map:input.map,geometry:input.geometry,from:control.servant,to,
   fromElevationFeet:height,toElevationFeet:Math.max(door.baseHeightFeet,Math.min(height,door.baseHeightFeet+door.heightFeet-2.5))})
 })
 if(!reachable)return fail('fortress-door-obstructed')
 const next=result.prepared.nextDoorState
 const geometry={...input.geometry,doors:input.geometry.doors.map(candidate=>candidate.id===door.id?
  {...candidate,state:next,openState:next}:candidate)}
 if(next==='closed'&&input.map.tokens.some(token=>!token.dnd5eSpellEffect&&mapGeometryPlacementBlocked({map:input.map,
  geometry:{...geometry,walls:[],windows:[],obstacles:[],doors:geometry.doors.filter(candidate=>candidate.id===door.id)},
  token,at:token,elevationFeet:mapGeometryTokenElevation(input.geometry,token)}).entityId===door.id))return fail('fortress-door-occupied')
 return {ok:true as const,geometry,message:`${control.servant.label} ${next==='open'?'打开':'关闭'}${door.label}。`}
}
