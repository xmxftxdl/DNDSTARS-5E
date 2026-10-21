import type {Character} from '../../types/character'
import type {Dnd5eAmmunitionKind, Dnd5eInventoryEntry} from '../../types/inventory'
const kinds:Readonly<Record<string,Dnd5eAmmunitionKind>>={'dnd5e-longbow':'arrow','dnd5e-shortbow':'arrow','dnd5e-light-crossbow':'crossbow-bolt','dnd5e-hand-crossbow':'crossbow-bolt','dnd5e-heavy-crossbow':'crossbow-bolt','dnd5e-sling':'sling-bullet','dnd5e-blowgun':'blowgun-needle'}
export function ammunitionKindForWeaponId(id:string|undefined):Dnd5eAmmunitionKind|undefined{return id?kinds[id]??kinds[id.split(':').at(-1)!]:undefined}
export interface Dnd5eAmmunitionContainerSnapshot {instanceId:string;weaponIds:readonly string[]}
/** Ammunition must remain physically available through its entire container chain. */
export function dnd5eAmmunitionEntryAccessible(entry:Dnd5eInventoryEntry,entries:readonly Dnd5eInventoryEntry[]):boolean {
 const visited=new Set<string>()
 let current:Dnd5eInventoryEntry|undefined=entry
 while(current){
  if(visited.has(current.instanceId)||current.quantity<=0||current.planarState==='ethereal'||current.releasedByCharacterId)return false
  visited.add(current.instanceId)
  if(!current.containerInstanceId)return true
  const containerId:string=current.containerInstanceId
  current=entries.find(candidate=>candidate.instanceId===containerId && candidate.item.category==='container')
 }
 return false
}
export function ammunitionContainerSnapshots(character:Character):Dnd5eAmmunitionContainerSnapshot[]{
 const entries=character.dnd5eInventory?.entries??[]
 return entries.filter(entry=>entry.item.category==='container' && dnd5eAmmunitionEntryAccessible(entry,entries)).flatMap(container=>{
  const ammunitionKinds=new Set(entries.filter(entry=>entry.containerInstanceId===container.instanceId && dnd5eAmmunitionEntryAccessible(entry,entries) && ['arrow','crossbow-bolt'].includes(entry.item.ammunitionKind??'')).map(entry=>entry.item.ammunitionKind))
  if(!ammunitionKinds.size)return []
  const weapons=[...entries.flatMap(entry=>entry.item.equipment?[entry.item.equipment]:[]),...Object.values(character.equipment??{}).filter(entry=>entry!=null)]
  return [{instanceId:container.instanceId,weaponIds:[...new Set(weapons.filter(weapon=>ammunitionKinds.has(ammunitionKindForWeaponId(weapon.baseEquipmentId??weapon.id))).map(weapon=>weapon.id))]}]
 })
}
