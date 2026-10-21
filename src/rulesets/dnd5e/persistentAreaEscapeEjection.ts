import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eActionResult, Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { dnd5ePersistentAreaEffectMatchesOrigin } from './persistentAreaConditionEffects'
import { planDnd5eMapResultApplication } from './mapBridge'
import { mapGeometryRuntimeForMap, mapGeometryTerrainElevationAtPoint, mapGeometryTokenElevation, mapGeometryEntityBodyHeightFeet, mapGeometryVolumeMovementBlocked } from '../../lib/mapGeometry'
import {tokenAnchorCellFromPixel,tokenCenterForAnchorCell,tokenOccupiedCellsAt,mapCellExtent,cellKey} from '../../lib/gridCombat'
import { recordDnd5eStraightMovement } from './straightMovementStreak'
import { resolveDnd5eHeadlessAction, previewDnd5eUnsupportedAirborneFalls, type Dnd5eAction } from './headlessCombatEngine'
import { settleDnd5eEtherealReturns } from './etherealReturnSettlement'

export interface Dnd5eEscapeEjectionRolls { direction: number; distance: readonly number[] }
export interface Dnd5eEscapeEjectionRequest { key: string; targetId: string; count: number; sides: number; feetPerPoint: number }

/** Fixed compass ray: obstacles and map edges stop travel, never choose another direction. */
export function planDnd5eEscapeEjectionMovement(map:BattleMap,token:Token,direction:number,distanceFeet:number) {
 if(!Number.isInteger(direction)||direction<1||direction>8||!Number.isFinite(distanceFeet)||distanceFeet<0||distanceFeet>1000)return undefined
 const geometry=mapGeometryRuntimeForMap(map.id),feet=map.feetPerCell??5
 const angle=(direction-1)*Math.PI/4,dc=Math.round(Math.sin(angle)),dr=-Math.round(Math.cos(angle))
 const origin=tokenAnchorCellFromPixel(token.x,token.y,token,map),extent=mapCellExtent(map)
 const elevation=mapGeometryTokenElevation(geometry,token),height=mapGeometryEntityBodyHeightFeet(token)??5
 const occupied=new Set(map.tokens.filter(other=>{
  if(other.id===token.id||(other.type==='obstacle'&&other.obstacleKind==='marker'))return false
  const bottom=mapGeometryTokenElevation(geometry,other),top=bottom+(mapGeometryEntityBodyHeightFeet(other)??5)
  return elevation<top-1e-7&&elevation+height>bottom+1e-7
 }).flatMap(other=>tokenOccupiedCellsAt(other,map,other)).map(cellKey))
 let position={x:token.x,y:token.y},travelled=0
 for(let step=1;step<=Math.floor(distanceFeet/feet);step++){
  const next=tokenCenterForAnchorCell({col:origin.col+dc*step,row:origin.row+dr*step},token,map)
  if(tokenOccupiedCellsAt(token,map,next).some(cell=>cell.col<0||cell.row<0||cell.col>=extent.cols||cell.row>=extent.rows||occupied.has(cellKey(cell)))||
    mapGeometryVolumeMovementBlocked({map,geometry,from:position,to:next,fromElevationFeet:elevation,toElevationFeet:elevation,
      halfSizePixels:token.size*map.gridSize/2,heightFeet:height}).blocked)break
  position=next;travelled=step*feet
 }
 return {position,distanceFeet:travelled}
}
type Input = { before:Dnd5eHeadlessCombatState; result:Dnd5eActionResult; map:BattleMap;
  characters:readonly Character[]; characterIdByCombatantId:Record<string,string> }

export function resolveDnd5eActionWithEscapeEjection(input:Omit<Input,'result'> & {
 action:Dnd5eAction; rolls?:Readonly<Record<string,Dnd5eEscapeEjectionRolls>>
}) {
 let escapeEjections:Dnd5eEscapeEjectionRequest[]=[]
 const options={beforeAirborneFalls:(result:Dnd5eActionResult)=>{
  const context={...input,result}
  escapeEjections=previewDnd5eEscapeEjections(context)
  return settleDnd5eEtherealReturns({before:input.before,result:settleDnd5eEscapeEjections(context),
    map:input.map,geometry:mapGeometryRuntimeForMap(input.map.id)})
 }}
 const fallPreview=input.action.airborneFallDamageRollsByCombatantId==null
  ? previewDnd5eUnsupportedAirborneFalls(input.before,input.action,{},options):undefined
 const result=resolveDnd5eHeadlessAction(input.before,input.action,{},options)
 return {result,escapeEjections:escapeEjections.length?escapeEjections:undefined,
  airborneFalls:fallPreview?.ok?fallPreview.falls:undefined}
}

function releases(input:Input) {
 const seen=new Set<string>()
 return input.result.events.flatMap(event=>{
  if(!input.result.ok||event.type!=='active-effect-removed'||event.reason!=='escaped')return []
  const effect=input.before.combatants[event.targetId]?.classState.activeEffects?.find(e=>e.id===event.effectId),link=effect?.areaLifetime
  if(!effect||!link||link.mapId!==input.map.id||effect.source.actorId!==link.sourceActorId)return []
  const area=input.map.dnd5ePluginAreas?.find(a=>a.id===link.areaId&&a.sourceTokenId===link.sourceActorId&&
    (a.boundEffectGeneration??0)===(link.generation??0))
  if(!area||!dnd5ePersistentAreaEffectMatchesOrigin(effect,area.id))return []
  const rule=area.triggers?.find(t=>t.condition?.condition===effect.standardCondition&&t.condition?.escapeEjection)?.condition?.escapeEjection
  const key=JSON.stringify([event.targetId,area.id])
  if(!rule||seen.has(key))return []
  seen.add(key)
  return [{area,request:{key,targetId:event.targetId,...rule}}]
 })
}

export function previewDnd5eEscapeEjections(input:Input):Dnd5eEscapeEjectionRequest[] {
 return releases(input).map(r=>r.request)
}

/** Authority hook: run after escape and before automatic falling; no state is published here. */
export function settleDnd5eEscapeEjections(input:Input & {rolls?:Readonly<Record<string,Dnd5eEscapeEjectionRolls>>}):Dnd5eActionResult {
 if(!input.result.ok)return input.result
 const pending=releases(input),keys=new Set(pending.map(r=>r.request.key))
 const fail=():Dnd5eActionResult=>({ok:false,state:structuredClone(input.before),events:[],reason:'invalid-dice'})
 if(Object.keys(input.rolls??{}).some(key=>!keys.has(key)))return fail()
 if(!pending.length)return input.result
 const result=structuredClone(input.result),events=[...result.events]
 for(const {area,request} of pending){
  const rolls=input.rolls?.[request.key]
  if(!rolls||!Number.isInteger(rolls.direction)||rolls.direction<1||rolls.direction>8||
    rolls.distance.length!==request.count||rolls.distance.some(n=>!Number.isInteger(n)||n<1||n>request.sides))return fail()
  const distanceFeet=rolls.distance.reduce((a,b)=>a+b,0)*request.feetPerPoint
  const map=planDnd5eMapResultApplication({...input,state:result.state,events}).map
  const token=map.tokens.find(t=>t.id===request.targetId)
  const move=token?planDnd5eEscapeEjectionMovement(map,token,rolls.direction,distanceFeet):undefined
  const target=result.state.combatants[request.targetId]
  if(!move||!target)return {ok:false,state:structuredClone(input.before),events:[],reason:'invalid-target'}
  const from={...target.position}
  target.position={...move.position}
  target.groundElevationFeet=mapGeometryTerrainElevationAtPoint(mapGeometryRuntimeForMap(map.id),target.position)
  target.airborne=(target.elevationFeet??target.groundElevationFeet)>target.groundElevationFeet+1e-7
  events.push({type:'moved',actorId:target.id,sourceActorId:area.sourceTokenId,from,to:{...target.position},
    fromElevationFeet:target.elevationFeet,toElevationFeet:target.elevationFeet,distance:move.distanceFeet,movementKind:'forced'})
  recordDnd5eStraightMovement(result.state,events.slice(-1))
 }
 return {...result,events}
}

