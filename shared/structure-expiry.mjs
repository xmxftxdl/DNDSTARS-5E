import {normalizeStructureLifetimes} from './structure-lifetime.mjs'
import {structureSupportingElevation} from './structure-support.mjs'

/** Prepare both resources together; callers must commit map and geometry atomically. */
export function prepareStructureExpiry(map,geometry,worldMinute,replacedIds=[],terrainElevationAtPoint){
 if(map.id!==geometry.mapId||!Number.isSafeInteger(worldMinute)||worldMinute<0)throw new Error('structure-expiry-invalid')
 const records=normalizeStructureLifetimes(geometry.structureLifetimes??[])
 if(!records)throw new Error('structure-expiry-invalid')
 if(replacedIds.some(id=>!records.some(record=>record.id===id)))throw new Error('structure-replacement-invalid')
 const expired=records.filter(record=>replacedIds.includes(record.id)||(record.expiresWorldMinute!=null&&record.expiresWorldMinute<=worldMinute))
 return prepareStructureRemoval(map,geometry,expired.map(record=>record.id),terrainElevationAtPoint)
}

/** Removes only explicitly selected structures; does not advance the clock or expire neighbours. */
export function prepareStructureRemoval(map,geometry,structureIds,terrainElevationAtPoint){
 const records=normalizeStructureLifetimes(geometry.structureLifetimes??[])
 if(map.id!==geometry.mapId||!records||!Array.isArray(structureIds)||new Set(structureIds).size!==structureIds.length||
   structureIds.some(id=>!records.some(record=>record.id===id)))throw new Error('structure-removal-invalid')
 const expired=records.filter(record=>structureIds.includes(record.id))
 if(!expired.length)return {changed:false,map,geometry,expiredIds:[]}
 const ids=new Set(expired.flatMap(record=>record.entityIds))
 const supporting={...geometry,obstacles:geometry.obstacles.filter(obstacle=>ids.has(obstacle.id))}
 const remaining={...geometry,obstacles:geometry.obstacles.filter(obstacle=>!ids.has(obstacle.id))}
 const tokens=map.tokens.map(token=>{
   const binding=token.dnd5eObjectState?.structureBinding??token.dnd5eObjectState?.inventoryItem?.instance?.structureBinding
   const disappearingCarrier=binding?.mapId===map.id&&expired.some(record=>record.id===binding.structureId)&&!!token.dnd5eCarriedObjects?.length
   // Bound carriers release ordinary possessions after this plan. Give those releases
   // the same descent as residents instead of leaving them on a deleted floor.
   if(token.type==='obstacle'&&!disappearingCarrier)return token
   const terrain=terrainElevationAtPoint(geometry,token),height=token.elevationFeet??terrain
   const support=structureSupportingElevation({map,geometry:supporting,position:token,elevationFeet:height,
     terrainElevationFeet:-1000,creatureWidthFeet:token.size*(map.feetPerCell??5)})
   // Only occupants actually standing on the disappearing structure descend.
   if(support<=terrain||Math.abs(support-height)>1e-4)return token
   const replacementSupport=structureSupportingElevation({map,geometry:remaining,position:token,elevationFeet:height,
     terrainElevationFeet:terrain,creatureWidthFeet:token.size*(map.feetPerCell??5)})
   if(Math.abs(replacementSupport-height)<=1e-4)return token
   return {...token,elevationFeet:terrain,movementAnimation:undefined}
 })
 return {changed:true,map:{...map,tokens},geometry:{...geometry,
   walls:geometry.walls.filter(entity=>!ids.has(entity.id)),doors:geometry.doors.filter(entity=>!ids.has(entity.id)),
   windows:geometry.windows?.filter(entity=>!ids.has(entity.id)),obstacles:geometry.obstacles.filter(entity=>!ids.has(entity.id)),
   lights:geometry.lights?.filter(entity=>!ids.has(entity.id)),structureLifetimes:records.filter(record=>!expired.includes(record))},
   expiredIds:expired.map(record=>record.id)}
}
