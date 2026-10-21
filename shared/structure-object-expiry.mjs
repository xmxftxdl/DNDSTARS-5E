/** Exact source identity, including map, prevents deleting another fortress's objects. */
export function expireStructureMapObjects(map,expired,dropObjects) {
 const matches=(binding)=>!!binding&&expired.some(source=>
  source.mapId===binding.mapId&&source.structureId===binding.structureId)
 let changed=false
 const tokens=map.tokens.flatMap(token=>{
  if(token.type==='obstacle'&&matches(token.dnd5eObjectState?.structureBinding??token.dnd5eObjectState?.inventoryItem?.instance?.structureBinding)){
   changed=true;return dropObjects(token).filter(dropped=>
    !matches(dropped.dnd5eObjectState?.structureBinding??dropped.dnd5eObjectState?.inventoryItem?.instance?.structureBinding))
  }
  const carried=token.dnd5eCarriedObjects?.filter(item=>!matches(item.objectState.structureBinding??item.objectState.inventoryItem?.instance?.structureBinding))
  if(carried?.length!==token.dnd5eCarriedObjects?.length){changed=true;return [{...token,dnd5eCarriedObjects:carried?.length?carried:undefined}]}
  return [token]
 })
 return changed?{...map,tokens}:map
}
