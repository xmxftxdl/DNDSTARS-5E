import type {Character} from '../../types/character'
import {normalizeDnd5eInventory,releaseDnd5eTemporaryWeapon} from './items'
/** Preserve an ordinary physical thrown weapon outside usable inventory, matching altered-projectile release semantics. */
export function releaseDnd5eRelentlessThrownWeapon(character:Character,weaponId:string):Character {
 const temporary=releaseDnd5eTemporaryWeapon(character,weaponId)
 if(temporary!==character)return temporary
 const inventory=normalizeDnd5eInventory(character)
 const entry=inventory.entries.find(candidate=>candidate.item.equipment?.id===weaponId)
 if(!entry)return character // A quantity-consuming projectile was already settled by the normal ammunition path.
 if(entry.sourceEffectTag)throw Error('relentless-source-bound-thrown-release-unavailable')
 const releasedId=`released:${entry.instanceId}:${inventory.revision??0}`
 if(inventory.entries.some(candidate=>candidate.instanceId===releasedId)||inventory.releasedObjects?.some(candidate=>candidate.instanceId===releasedId))throw Error('released-instance-conflict')
 const released={...structuredClone(entry),instanceId:releasedId,quantity:1,containerInstanceId:undefined,equippedSlot:undefined}
 const equipment=entry.quantity===1&&entry.equippedSlot?Object.fromEntries(Object.entries(character.equipment??{}).filter(([slot])=>slot!==entry.equippedSlot)):character.equipment
 return {...character,equipment,dnd5eInventory:{...inventory,revision:(inventory.revision??0)+1,
  entries:inventory.entries.flatMap(candidate=>candidate.instanceId!==entry.instanceId?[candidate]:candidate.quantity>1?[{...candidate,quantity:candidate.quantity-1}]:[]),
  releasedObjects:[...(inventory.releasedObjects??[]),released]}}
}
