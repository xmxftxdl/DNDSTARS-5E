import {prepareStructureRemoval} from './structure-expiry.mjs'

/** A clock-only server cannot invent dice or decline Feather Fall for a player.
 * Detect support loss before publishing any of the clock transaction. */
export function templeExpirySupportLoss(map,geometry,worldMinute,terrainElevationAtPoint){
 const ids=(geometry.structureLifetimes??[]).filter(record=>record.templeWard&&record.replacementGroup==='temple-of-the-gods'&&
  record.expiresWorldMinute!=null&&record.expiresWorldMinute<=worldMinute).map(record=>record.id)
 if(!ids.length)return []
 const plan=prepareStructureRemoval(map,geometry,ids,terrainElevationAtPoint)
 return plan.map.tokens.filter(token=>token.elevationFeet!==map.tokens.find(original=>original.id===token.id)?.elevationFeet)
  .map(token=>token.id)
}
