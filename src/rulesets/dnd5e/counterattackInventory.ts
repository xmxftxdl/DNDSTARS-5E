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
  const consumed = new Set<number>()
  for (const event of events) {
    if (event.type !== 'saving-throw-counterattack-resolved' ||
      characterIdByCombatantId[event.actorId] !== character.id) continue
    if (consumed.has(event.index)) throw new Error('duplicate-counterattack-inventory-cost')
    consumed.add(event.index)
    if (!event.attackMade) continue
    const ammunition = consumeDnd5eWeaponAmmunition(next, event.weaponId)
    if (!ammunition.ok) throw new Error('counterattack-ammunition-unavailable')
    next = event.thrown ? releaseDnd5eTemporaryWeapon(ammunition.character, event.weaponId) : ammunition.character
  }
  return next
}
