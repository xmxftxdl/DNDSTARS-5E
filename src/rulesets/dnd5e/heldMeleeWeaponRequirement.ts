import type { Dnd5eActivityEquipmentSnapshotV1 } from './activities/dnd5eActivityExecutor'

export function validDnd5eHeldWeaponBaseIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 32 &&
    value.every(id => typeof id === 'string' && /^[a-z0-9][a-z0-9:._-]{0,159}$/.test(id)) && new Set(value).size === value.length
}

/** Only held equipment qualifies; a matching inventory item is insufficient. */
export function dnd5eHoldsRequiredMeleeWeapon(equipment: Dnd5eActivityEquipmentSnapshotV1 | undefined, ids: readonly string[]): boolean {
  return [equipment?.mainHand, equipment?.offHand].some(item => item?.roles.includes('weapon') &&
    item.weaponMode === 'melee' && !!item.weaponBaseId && ids.includes(item.weaponBaseId))
}
