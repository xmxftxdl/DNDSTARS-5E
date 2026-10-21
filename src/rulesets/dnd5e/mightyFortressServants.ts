import type {BattleMap,Token} from '../../store/maps'
import {mapGeometryPlacementBlocked,type MapGeometryState} from '../../lib/mapGeometry'
import {normalizeStructureLifetimes} from '../../../shared/structure-lifetime.mjs'

/** Materialize the existing hundred-member roster once, in free courtyard positions. */
export function placeDnd5eMightyFortressServants(input:{map:BattleMap;geometry:MapGeometryState;structureId:string}){
 const {map,geometry}=input
 const records=normalizeStructureLifetimes(geometry.structureLifetimes)
 const record=records?.find(record=>record.id===input.structureId),services=record?.fortressServices,boundary=record?.objectBoundary
 if(map.id!==geometry.mapId||!records||!record||record.replacementGroup!=='mighty-fortress'||!services?.servants||!boundary||
  services.servants.some(servant=>servant.tokenId))throw Error('fortress-servants-roster-invalid')
 const roster=services.servants
 const feet=map.feetPerCell??5,scale=map.gridSize/feet
 if(!Number.isFinite(scale)||scale<=0)throw Error('fortress-servants-map-invalid')
 const [a,b,,d]=boundary.points
 const positions:{x:number;y:number}[]=[]
 for(let y=7.5;y<=112.5;y+=5)for(let x=7.5;x<=112.5;x+=5){
  // Keep and towers are closed stone shells until the selected doors connect them.
  if((x>=32.5&&x<=87.5&&y>=32.5&&y<=87.5)||((x<=22.5||x>=97.5)&&(y<=22.5||y>=97.5)))continue
  positions.push({x:a.x+(b.x-a.x)*x/120+(d.x-a.x)*y/120,y:a.y+(b.y-a.y)*x/120+(d.y-a.y)*y/120})
 }
 const tokens:Token[]=[],ids=new Set(map.tokens.map(token=>token.id))
 for(const servant of roster){
  const id=`${record.id}:servant:${servant.number}`
  if(id.length>160||ids.has(id))throw Error('fortress-servants-token-conflict')
  const token:Token={id,label:`堡垒仆役 ${servant.number}`,type:'obstacle',obstacleKind:'marker',size:5/feet,
   color:'#94a3b8',emoji:'',x:0,y:0,elevationFeet:boundary.bottomFeet,hp:1,maxHp:1,
   dnd5eCombatState:{conditions:['invisible']},
   dnd5eObjectState:{schemaVersion:1,magical:true,combatProfile:{armorClass:10},structureBinding:{schemaVersion:1,mapId:map.id,structureId:record.id}}}
  const index=positions.findIndex(position=>position.x>=2.5*scale&&position.y>=2.5*scale&&position.x<=map.width-2.5*scale&&position.y<=map.height-2.5*scale&&
   ![...map.tokens,...tokens].some(other=>Math.hypot(other.x-position.x,other.y-position.y)<(other.size*map.gridSize+5*scale)/2)&&
   !mapGeometryPlacementBlocked({map,geometry,token,at:position}).blocked)
  if(index<0)throw Error('fortress-servants-no-space')
  tokens.push({...token,...positions.splice(index,1)[0]});ids.add(id)
 }
 return {map:{...map,tokens:[...map.tokens,...tokens]},geometry:{...geometry,structureLifetimes:records.map(candidate=>candidate.id===record.id?
  {...candidate,fortressServices:{...services,servants:roster.map((servant,index)=>({...servant,tokenId:tokens[index].id}))}}:candidate)},tokenIds:tokens.map(token=>token.id)}
}
