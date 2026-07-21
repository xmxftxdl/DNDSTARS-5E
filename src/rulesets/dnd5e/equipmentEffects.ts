import type { Character } from '../../types/character'
import type { Dnd5eEquipmentEffects } from '../../types/equipment'

export type Dnd5eEquipmentEffectKey = keyof Dnd5eEquipmentEffects

/** 只汇总当前已装备物品，库存中的未装备快照永远不参与规则结算。 */
export function dnd5eEquippedEffectTotal(
  character: Pick<Character, 'equipment' | 'dnd5eInventory'>,
  key: Dnd5eEquipmentEffectKey,
): number {
  return Object.entries(character.equipment ?? {}).reduce((total, [slot, item]) => {
    const entry = character.dnd5eInventory?.entries.find((candidate) => candidate.equippedSlot === slot)
    if (entry?.item.magicItem?.attunement === 'required' && !entry.attuned) return total
    const value = item?.effects?.[key]
    return total + (typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0)
  }, 0)
}

/** 武器自身的命中/伤害加值不会错误地叠加到另一只手的武器上。 */
export function dnd5eWeaponEffectTotal(
  character: Pick<Character, 'equipment' | 'dnd5eInventory'>,
  slot: 'mainWeapon' | 'offHand',
  key: 'weaponAttackBonus' | 'weaponDamageBonus',
): number {
  return Object.entries(character.equipment ?? {}).reduce((total, [equippedSlot, item]) => {
    if (!item || (item.dnd5e?.kind === 'weapon' && equippedSlot !== slot)) return total
    const entry = character.dnd5eInventory?.entries.find((candidate) => candidate.equippedSlot === equippedSlot)
    if (entry?.item.magicItem?.attunement === 'required' && !entry.attuned) return total
    const value = item.effects?.[key]
    return total + (typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0)
  }, 0)
}
