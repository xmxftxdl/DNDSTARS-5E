import type { Dnd5eMonsterWeaponAttack } from './monsters'
/** Legacy SRD body-part attacks; custom content must declare naturalWeapon explicitly. */
const naturalActionIds = new Set(['bite', 'bites', 'beaks', 'blood-drain', 'fist', 'stomp', 'slam', 'claw', 'claws', 'talons', 'gore', 'hooves', 'hoof', 'sting', 'tentacle', 'tentacles', 'pincer', 'pincers', 'tail', 'ram', 'tusk', 'tusks', 'beak', 'constrict'])
export function dnd5eMonsterAttackIsNaturalWeapon(statBlockId: string | undefined, actionId: string, attack: Dnd5eMonsterWeaponAttack | undefined): boolean {
  if (!attack) return false
  if (attack.naturalWeapon != null) return attack.naturalWeapon === true
  return statBlockId?.startsWith('srd-5.1:') === true && naturalActionIds.has(actionId)
}
