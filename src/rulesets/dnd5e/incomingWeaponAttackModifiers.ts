/** Defender-side effects; delivery is the actual attack, not a weapon's inventory category. */
export interface Dnd5eIncomingWeaponAttackModifier {
  mode: 'advantage' | 'disadvantage'
  delivery?: 'melee' | 'ranged'
}

export function normalizeDnd5eIncomingWeaponAttackModifiers(value: unknown): Dnd5eIncomingWeaponAttackModifier[] | undefined {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32) return undefined
  const result: Dnd5eIncomingWeaponAttackModifier[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
      !['advantage', 'disadvantage'].includes(item.mode) ||
      (item.delivery !== undefined && !['melee', 'ranged'].includes(item.delivery))) return undefined
    result.push({ mode: item.mode, ...(item.delivery !== undefined ? { delivery: item.delivery } : {}) })
  }
  return result
}
