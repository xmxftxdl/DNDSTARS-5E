import {normalizeMapGeometry,normalizeMapGeometryEntity,type MapGeometryObstacle,type MapGeometryPoint,type MapGeometryState} from '../../lib/mapGeometry'
import {partitionByConvexPolygon,polygonSignedArea} from '../../lib/convexPolygonPartition'
import {triangulateSimplePolygon} from '../../lib/triangulateSimplePolygon'
import {geometryEntityDestroyed} from '../../../shared/map-geometry-durability.mjs'

/** Stable bounded geometry namespace, not an authorization token. Full action IDs
 * remain on the owning area; fragment collisions are rejected by preparation. */
export function materialTransformationExecutionId(actionId:string):string{
 const digest=[0x811c9dc5,0x9e3779b1,0x85ebca6b].map(seed=>{
  let hash=seed>>>0
  for(let index=0;index<actionId.length;index++){
   hash^=actionId.charCodeAt(index);hash=Math.imul(hash,0x01000193)>>>0;hash^=hash>>>13
  }
  return (hash>>>0).toString(16).padStart(8,'0')
 }).join('')
 return `material:${digest}`
}

/** Host-owned receipt. Callers must never accept original geometry from player payloads. */
export interface MaterialVolumeTransformationReceipt {
 schemaVersion:1
 mapId:string
 executionId:string
 replacements:{original:MapGeometryObstacle;fragments:MapGeometryObstacle[]}[]
}

/** Persistence validation only. This does not authorize a player-supplied receipt. */
export function normalizeMaterialVolumeTransformationReceipt(value:unknown):MaterialVolumeTransformationReceipt|undefined{
 if(!value||typeof value!=='object'||Array.isArray(value))return undefined
 const raw=value as Record<string,unknown>
 if(raw.schemaVersion!==1||typeof raw.mapId!=='string'||!raw.mapId||raw.mapId.length>160||
  typeof raw.executionId!=='string'||!/^[a-z0-9][a-z0-9._:-]{0,63}$/i.test(raw.executionId)||
  !Array.isArray(raw.replacements)||!raw.replacements.length||raw.replacements.length>4096)return undefined
 const ids=new Set<string>(),replacements:MaterialVolumeTransformationReceipt['replacements']=[]
 let total=0
 for(const item of raw.replacements){
  if(!item||typeof item!=='object'||Array.isArray(item)||!Array.isArray(item.fragments)||!item.fragments.length)return undefined
  total+=item.fragments.length+1;if(total>4096)return undefined
  const original=normalizeMapGeometryEntity(item.original)
  if(original?.kind!=='obstacle'||original.heightFeet<=0||original.materialMagic!=='nonmagical'||
   !['stone','mud','quicksand'].includes(original.surfaceMaterial??'')||ids.has(original.id))return undefined
  ids.add(original.id)
  const fragments:MapGeometryObstacle[]=[]
  for(const rawFragment of item.fragments){
   const fragment=normalizeMapGeometryEntity(rawFragment)
   if(fragment?.kind!=='obstacle'||fragment.heightFeet<=0||ids.has(fragment.id)||
    !fragment.id.startsWith(`${raw.executionId}:material:`))return undefined
   ids.add(fragment.id);fragments.push(structuredClone(fragment))
  }
  replacements.push({original:structuredClone(original),fragments})
 }
 return {schemaVersion:1,mapId:raw.mapId,executionId:raw.executionId,replacements}
}

/** Builds a reversible candidate only; casting must also validate sight/range,
 * settle occupants, and commit the receipt with its owning persistent area. */
export function prepareMaterialVolumeTransformation(input:{
 geometry:MapGeometryState;executionId:string;entityIds:readonly string[]
 center:MapGeometryPoint;angleDegrees:number;widthFeet:number;lengthFeet:number;heightFeet:number;bottomFeet:number;pixelsPerFoot:number
 mode:'rock-to-mud'|'mud-to-rock'
}):{geometry:MapGeometryState;receipt:MaterialVolumeTransformationReceipt}|undefined{
 const {geometry}=input
 if(!/^[a-z0-9][a-z0-9._:-]{0,63}$/i.test(input.executionId)||!input.entityIds.length||new Set(input.entityIds).size!==input.entityIds.length||
  ![input.center.x,input.center.y,input.angleDegrees,input.widthFeet,input.lengthFeet,input.heightFeet,input.bottomFeet,input.pixelsPerFoot].every(Number.isFinite)||
  input.pixelsPerFoot<=0||[input.widthFeet,input.lengthFeet,input.heightFeet].some(n=>n<=0||n>40)||
  (input.mode!=='rock-to-mud'&&input.mode!=='mud-to-rock')||(input.mode==='mud-to-rock'&&input.heightFeet>10))return undefined
 const a=input.angleDegrees*Math.PI/180,s=input.pixelsPerFoot
 const clip=[[-input.widthFeet/2,-input.lengthFeet/2],[input.widthFeet/2,-input.lengthFeet/2],[input.widthFeet/2,input.lengthFeet/2],[-input.widthFeet/2,input.lengthFeet/2]]
  .map(([x,y])=>({x:input.center.x+(x*Math.cos(a)-y*Math.sin(a))*s,y:input.center.y+(x*Math.sin(a)+y*Math.cos(a))*s}))
 const allIds=new Set([...geometry.obstacles,...geometry.walls,...geometry.doors,...geometry.windows??[],...geometry.lights??[]].map(e=>e.id))
 const replacements:MaterialVolumeTransformationReceipt['replacements']=[]
 let serial=0
 for(const id of input.entityIds){
  const matches=geometry.obstacles.filter(e=>e.id===id),source=matches[0]
  if(matches.length!==1||!source||geometryEntityDestroyed(source)||source.materialMagic!=='nonmagical'||source.heightFeet<=0||
   source.controlledWater||source.stairPath||geometry.structureLifetimes?.some(r=>r.entityIds.includes(id))||
   !(input.mode==='rock-to-mud'?source.surfaceMaterial==='stone':['mud','quicksand'].includes(source.surfaceMaterial??'')))return undefined
  const lower=Math.max(source.baseHeightFeet,input.bottomFeet),upper=Math.min(source.baseHeightFeet+source.heightFeet,input.bottomFeet+input.heightFeet)
  if(upper-lower<=1e-7)return undefined
  const triangles=triangulateSimplePolygon(source.points)
  if(!triangles)return undefined
  const fragments:MapGeometryObstacle[]=[]
  let convertedVolume=0
  const add=(points:MapGeometryPoint[],bottom:number,top:number,converted:boolean)=>{
   if(top-bottom<=1e-7||Math.abs(polygonSignedArea(points))<=1e-7)return true
   const fragmentId=`${input.executionId}:material:${serial++}`
   if(allIds.has(fragmentId))return false
   allIds.add(fragmentId)
   const fragment:MapGeometryObstacle={...structuredClone(source),id:fragmentId,points:points.map(p=>({...p})),baseHeightFeet:bottom,heightFeet:top-bottom,
    ...(source.terrainElevationFeet===undefined?{}:{terrainElevationFeet:top})}
   if(converted){
    fragment.surfaceMaterial=input.mode==='rock-to-mud'?'mud':'stone'
    fragment.materialMagic='magical'
    fragment.blocksMovement=input.mode==='mud-to-rock'
    fragment.blocksVision=input.mode==='mud-to-rock'
    fragment.blocksLineOfEffect=input.mode==='mud-to-rock'
    fragment.cover=input.mode==='mud-to-rock'?'total':'none'
    // Original durability and travel modifiers belong to the original body.
    delete fragment.dnd5eDurability;delete fragment.terrainCostMultiplier;delete fragment.traversal
    convertedVolume+=Math.abs(polygonSignedArea(points))/(s*s)*(top-bottom)
   }
   fragments.push(fragment);return true
  }
  for(const triangle of triangles){
   const partition=partitionByConvexPolygon(triangle,clip)
   if(!partition)return undefined
   for(const points of partition.outside)if(!add(points,source.baseHeightFeet,source.baseHeightFeet+source.heightFeet,false))return undefined
   if(partition.inside.length&&(!add(partition.inside,source.baseHeightFeet,lower,false)||!add(partition.inside,lower,upper,true)||
    !add(partition.inside,upper,source.baseHeightFeet+source.heightFeet,false)))return undefined
  }
  if(convertedVolume<=1e-7)return undefined
  replacements.push({original:structuredClone(source),fragments})
 }
 const candidates=new Map(replacements.map(r=>[r.original.id,r.fragments]))
 const result=normalizeMapGeometry({...geometry,obstacles:geometry.obstacles.flatMap(e=>candidates.get(e.id)??[e])})
 if(!result)return undefined
 // Record normalized fragments so a JSON round trip does not create false conflicts.
 for(const replacement of replacements)replacement.fragments=replacement.fragments.map(f=>structuredClone(result.obstacles.find(e=>e.id===f.id)!))
 return {geometry:result,receipt:{schemaVersion:1,mapId:geometry.mapId,executionId:input.executionId,replacements}}
}

/** Reject conflicts atomically; never overwrite intervening edits or resurrect
 * a separately destroyed fragment from an untrusted or stale receipt. */
export function restoreMaterialVolumeTransformation(geometry:MapGeometryState,receipt:MaterialVolumeTransformationReceipt):MapGeometryState|undefined{
 if(receipt.schemaVersion!==1||geometry.mapId!==receipt.mapId||!receipt.replacements.length)return undefined
 const ids=new Set<string>(),originals=new Set<string>()
 for(const {original,fragments} of receipt.replacements){
  if(!fragments.length||originals.has(original.id)||geometry.obstacles.some(e=>e.id===original.id))return undefined
  originals.add(original.id)
  for(const fragment of fragments){
   if(ids.has(fragment.id))return undefined
   ids.add(fragment.id)
   const found=geometry.obstacles.filter(e=>e.id===fragment.id)
   if(found.length!==1||JSON.stringify(found[0])!==JSON.stringify(fragment))return undefined
  }
 }
 const first=new Map(receipt.replacements.map(r=>[r.fragments[0].id,r.original]))
 return normalizeMapGeometry({...geometry,obstacles:geometry.obstacles.flatMap(e=>first.has(e.id)?[structuredClone(first.get(e.id)!)]:ids.has(e.id)?[]:[e])})
}
