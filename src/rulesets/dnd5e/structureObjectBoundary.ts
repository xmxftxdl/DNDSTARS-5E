import {mapGeometryTokenElevation,type SharedMapGeometryState} from '../../lib/mapGeometry'
import type {BattleMap} from '../../store/maps'
import type {Character} from '../../types/character'
import {normalizeDnd5eInventory,expireDnd5eStructureInventoryItems} from './items'
import {droppedDnd5eCompanionObjects} from './companionCarriedObjects'
import {normalizeStructureLifetimes} from '../../../shared/structure-lifetime.mjs'
import type {Dnd5eStructureObjectBinding} from './structureObjectBinding'
import {structureObjectOutsideBoundary as dnd5eStructureObjectOutsideBoundary} from '../../../shared/structure-object-boundary.mjs'
export {structureObjectOutsideBoundary as dnd5eStructureObjectOutsideBoundary} from '../../../shared/structure-object-boundary.mjs'

/** Prepare against final authoritative positions, including map-to-map travel and item transfers. */
export function prepareDnd5eStructureObjectBoundaryCleanup(input:{maps:readonly BattleMap[];characters:readonly Character[];geometry:SharedMapGeometryState}) {
 const outside=(binding:Dnd5eStructureObjectBinding|undefined,map:BattleMap,token:BattleMap['tokens'][number])=>!!binding&&
  dnd5eStructureObjectOutsideBoundary({binding,geometry:input.geometry,mapId:map.id,position:{x:token.x,y:token.y,
   elevationFeet:mapGeometryTokenElevation(input.geometry.maps.find(scene=>scene.mapId===map.id),token)}})
 const maps=input.maps.map(map=>{
  let changed=false
  const servantIds=new Set(normalizeStructureLifetimes(input.geometry.maps.find(scene=>scene.mapId===map.id)?.structureLifetimes)
   ?.filter(record=>record.replacementGroup==='mighty-fortress').flatMap(record=>
    record.fortressServices?.servants?.flatMap(member=>member.tokenId?[member.tokenId]:[])??[])??[])
  const tokens=map.tokens.flatMap(token=>{
   const object=token.dnd5eObjectState
   const defeatedServant=servantIds.has(token.id)&&token.hp!=null&&token.hp<=0
   if(token.type==='obstacle'&&(defeatedServant||outside(object?.structureBinding??object?.inventoryItem?.instance?.structureBinding,map,token))){
    changed=true;return droppedDnd5eCompanionObjects(token).filter(dropped=>
     !outside(dropped.dnd5eObjectState?.structureBinding??dropped.dnd5eObjectState?.inventoryItem?.instance?.structureBinding,map,dropped))
   }
   const carried=token.dnd5eCarriedObjects?.filter(item=>!outside(item.objectState.structureBinding??item.objectState.inventoryItem?.instance?.structureBinding,map,token))
   if(carried?.length!==token.dnd5eCarriedObjects?.length){changed=true;return [{...token,dnd5eCarriedObjects:carried?.length?carried:undefined}]}
   return [token]
  })
  return changed?{...map,tokens}:map
 })
 const characters=input.characters.map(character=>{
  const inventory=normalizeDnd5eInventory(character)
  const bindings=[...inventory.entries,...inventory.releasedObjects??[],...inventory.spellMaterialEscrows?.flatMap(record=>record.entries)??[]]
   .flatMap(entry=>entry.structureBinding?[entry.structureBinding]:[])
  if(!bindings.length)return character
  const positions=input.maps.flatMap(map=>map.tokens.filter(token=>token.characterId===character.id).map(token=>({map,token})))
  // An unplaced sheet has no known world position. Never infer that it moved outside.
  if(!positions.length)return character
  if(positions.length!==1)throw Error('structure-object-owner-position-ambiguous')
  const {map,token}=positions[0]
  return expireDnd5eStructureInventoryItems(character,bindings.filter(binding=>outside(binding,map,token)))
 })
 return {maps,characters,changed:maps.some((map,index)=>map!==input.maps[index])||characters.some((character,index)=>character!==input.characters[index])}
}
