/** Pure removal for Host/browser and server. Preserve unrelated inventory metadata verbatim. */
export function expireStructureInventoryItems(character, expired) {
 const inventory=character?.dnd5eInventory
 if(!inventory)return character
 const matches=entry=>entry?.structureBinding&&expired.some(source=>source.mapId===entry.structureBinding.mapId&&source.structureId===entry.structureBinding.structureId)
 const removed=(inventory.entries??[]).filter(matches),ids=new Set(removed.map(entry=>entry.instanceId))
 const released=(inventory.releasedObjects??[]).filter(entry=>!matches(entry))
 const escrows=inventory.spellMaterialEscrows?.map(record=>({...record,entries:record.entries.filter(entry=>!matches(entry))}))
 if(!removed.length&&released.length===(inventory.releasedObjects??[]).length&&
  !escrows?.some((record,index)=>record.entries.length!==inventory.spellMaterialEscrows[index].entries.length))return character
 const equipment={...character.equipment}
 for(const entry of removed)if(entry.equippedSlot&&equipment[entry.equippedSlot]?.id===entry.item?.equipment?.id)delete equipment[entry.equippedSlot]
 const mainRemoved=removed.some(entry=>entry.equippedSlot==='mainWeapon')
 const effects=character.dnd5eCombatState?.activeEffects
 const activeEffects=effects?.filter(effect=>!ids.has(effect.modifiers?.weaponEnchantment?.inventoryInstanceId??effect.modifiers?.armorEnchantment?.inventoryInstanceId)&&
  !(mainRemoved&&effect.definitionId==='srd-5.1:spell:shillelagh'&&effect.source?.rulesId==='shillelagh'))
 return {...character,equipment,dnd5eInventory:{...inventory,revision:(inventory.revision??0)+1,
  entries:(inventory.entries??[]).filter(entry=>!matches(entry)).map(entry=>ids.has(entry.containerInstanceId)?{...entry,containerInstanceId:undefined}:entry),
  ...(inventory.releasedObjects?{releasedObjects:released}:{}),...(escrows?{spellMaterialEscrows:escrows}:{})},
  ...(effects&&activeEffects.length!==effects.length?{dnd5eCombatState:{...character.dnd5eCombatState,activeEffects}}:{})}
}
