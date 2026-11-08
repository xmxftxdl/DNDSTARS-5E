import {releaseDnd5eRelentlessThrownWeapon} from './relentlessThrownInventory'
import type { Character } from '../../types/character'
import type { Dnd5eCombatEvent } from './headlessCombatEngine'
import { consumeDnd5eWeaponAmmunition, releaseDnd5eTemporaryWeapon } from './items'

/** Pure parent-transaction projection. Call only with successful Headless events. */
export function applyDnd5eCounterattackInventoryCosts(
  character: Character,
  events: readonly Dnd5eCombatEvent[],
  characterIdByCombatantId: Readonly<Record<string, string>>,
): Character {
  let next = character
  const consumed = new Set<string>()
  for (const event of events) {
    if ((event.type !== 'saving-throw-counterattack-resolved' && event.type !== 'relentless-weapon-reaction-resolved') ||
      characterIdByCombatantId[event.actorId] !== character.id) continue
    const key=`${event.type}:${event.index}`
    if (consumed.has(key)) throw new Error('duplicate-counterattack-inventory-cost')
    consumed.add(key)
    if (!event.attackMade) continue
    const ammunition = consumeDnd5eWeaponAmmunition(next, event.weaponId)
    if (!ammunition.ok) throw new Error('counterattack-ammunition-unavailable')
    if(event.thrown&&!event.weaponId)throw Error('counterattack-thrown-weapon-required')
    next = event.thrown && event.weaponId ? event.type==='relentless-weapon-reaction-resolved'?releaseDnd5eRelentlessThrownWeapon(ammunition.character,event.weaponId):releaseDnd5eTemporaryWeapon(ammunition.character,event.weaponId) : ammunition.character
  }
  return next
}
