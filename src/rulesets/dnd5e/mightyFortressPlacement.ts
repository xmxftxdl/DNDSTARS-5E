import type {BattleMap} from '../../store/maps'
import type {MapGeometryState} from '../../lib/mapGeometry'
import {geometryEntityDestroyed} from '../../../shared/map-geometry-durability.mjs'
import {structureSolidBodyBlocked} from '../../../shared/structure-solid-collision.mjs'

/** Host classifications are separate from the player's requested building layout. */
export interface Dnd5eFortressSiteQualifications {
 naturalObstacleIds:readonly string[]
 naturalObjectTokenIds:readonly string[]
}

/** Resolve from authoritative geometry, never from a player-selected structure id. */
export function findDnd5eFortressRenewal(input:{map:BattleMap;geometry:MapGeometryState;origin:{x:number;y:number};rotationDegrees:number;elevationFeet:number;casterId:string}){
 const scale=input.map.gridSize/(input.map.feetPerCell??5),angle=input.rotationDegrees*Math.PI/180
 const footprint=[[0,0],[120,0],[120,120],[0,120]].map(([x,y])=>[
  Math.round((input.origin.x+(x*Math.cos(angle)-y*Math.sin(angle))*scale)*1e6)/1e6,
  Math.round((input.origin.y+(x*Math.sin(angle)+y*Math.cos(angle))*scale)*1e6)/1e6]).sort((a,b)=>a[0]-b[0]||a[1]-b[1])
 const siteKey=JSON.stringify([footprint,input.elevationFeet])
 const matches=input.geometry.mapId===input.map.id?input.geometry.structureLifetimes?.filter(record=>
  record.replacementGroup==='mighty-fortress'&&record.casterId===input.casterId&&record.siteKey===siteKey)??[]:[]
 return matches.length===1?{structureId:matches[0].id,casterId:input.casterId}:undefined
}

export function validateDnd5eMightyFortressSite(input:{
 map:BattleMap;geometry:MapGeometryState;origin:{x:number;y:number};rotationDegrees:number;elevationFeet:number;
 qualifications:Dnd5eFortressSiteQualifications;
 /** Existing same-site ownership must match before its entities can be exempted. */
 renewal?:{structureId:string;casterId:string};
}){
 const {map,geometry,qualifications}=input
 const scale=map.gridSize/(map.feetPerCell??5),angle=input.rotationDegrees*Math.PI/180
 const reject=(reason:string)=>({ok:false as const,reason})
 if(map.id!==geometry.mapId||!Number.isFinite(scale)||scale<=0||
  ![input.origin.x,input.origin.y,input.rotationDegrees,input.elevationFeet].every(Number.isFinite))return reject('fortress-site-invalid')
 const corners=[[0,0],[120,0],[120,120],[0,120]].map(([x,y])=>({x:input.origin.x+(x*Math.cos(angle)-y*Math.sin(angle))*scale,
  y:input.origin.y+(x*Math.sin(angle)+y*Math.cos(angle))*scale}))
 if(corners.some(p=>p.x<0||p.y<0||p.x>map.width||p.y>map.height))return reject('fortress-site-outside-map')
 const unique=(ids:readonly string[])=>new Set(ids).size===ids.length
 if(!qualifications||!Array.isArray(qualifications.naturalObstacleIds)||!Array.isArray(qualifications.naturalObjectTokenIds)||
  !unique(qualifications.naturalObstacleIds)||!unique(qualifications.naturalObjectTokenIds)||
  qualifications.naturalObstacleIds.some(id=>!geometry.obstacles.some(o=>o.id===id))||
  qualifications.naturalObjectTokenIds.some(id=>!map.tokens.some(t=>t.id===id&&t.type==='obstacle')))return reject('fortress-site-qualifications-invalid')
 const local=(point:{x:number;y:number})=>{
  const x=(point.x-input.origin.x)/scale,y=(point.y-input.origin.y)/scale
  return {x:x*Math.cos(angle)+y*Math.sin(angle),y:-x*Math.sin(angle)+y*Math.cos(angle)}
 }
 const overlaps=(points:readonly {x:number;y:number}[])=>{
  const polygon=points.map(local)
  if(polygon.length===2)polygon.push({...polygon[1]})
  return structureSolidBodyBlocked({points:polygon,baseHeightFeet:0,heightFeet:1},{x:60,y:60,elevationFeet:0},{x:60,y:60,elevationFeet:0},60,1)
 }
 const entities=[...geometry.walls,...geometry.doors,...geometry.windows??[],...geometry.obstacles]
 const record=input.renewal?geometry.structureLifetimes?.find(entry=>entry.id===input.renewal!.structureId):undefined
 const footprint=corners.map(p=>[Math.round(p.x*1e6)/1e6,Math.round(p.y*1e6)/1e6]).sort((a,b)=>a[0]-b[0]||a[1]-b[1])
 if(input.renewal&&(!record||record.casterId!==input.renewal.casterId||record.replacementGroup!=='mighty-fortress'||
  record.siteKey!==JSON.stringify([footprint,input.elevationFeet])))return reject('fortress-renewal-entities-invalid')
 const renewal=new Set(record?.entityIds??[])
 for(const entity of entities){
  if(renewal.has(entity.id)||geometryEntityDestroyed(entity))continue
  if(entity.kind==='obstacle'&&(entity.terrainRegion||qualifications.naturalObstacleIds.includes(entity.id)))continue
  if(overlaps(entity.points))return reject('fortress-site-contains-structure')
 }
 for(const token of map.tokens){
  if(token.type!=='obstacle'||qualifications.naturalObjectTokenIds.includes(token.id))continue
  const binding=token.dnd5eObjectState?.structureBinding??token.dnd5eObjectState?.inventoryItem?.instance?.structureBinding
  if(record&&binding?.mapId===map.id&&binding.structureId===record.id)continue
  const half=map.gridSize*token.size/2
  if(overlaps([{x:token.x-half,y:token.y-half},{x:token.x+half,y:token.y-half},
    {x:token.x+half,y:token.y+half},{x:token.x-half,y:token.y+half}]))return reject('fortress-site-contains-structure')
 }
 return {ok:true as const,corners}
}
