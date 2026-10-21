/** A replacement consumes one attack from the same action budget as a weapon attack. */
export function dnd5eAttackActionSlot(input: {
  attacksPerAction: number
  actionCount: number
  attacksUsed: number
  /** Additional slots in each Attack action which cannot be replaced by an Activity. */
  extraWeaponAttacksPerAction?: number
  attackKind?: 'weapon' | 'replacement'
}): { attackNumber: number; attacksAllowed: number; spendsAction: boolean; weaponOnly?: true } | undefined {
  const extraWeaponAttacks = input.extraWeaponAttacksPerAction ?? 0
  if (!Number.isSafeInteger(input.attacksPerAction) || input.attacksPerAction < 1 ||
    !Number.isSafeInteger(input.actionCount) || input.actionCount < 1 ||
    !Number.isSafeInteger(input.attacksUsed) || input.attacksUsed < 0 ||
    !Number.isSafeInteger(extraWeaponAttacks) || extraWeaponAttacks < 0) return undefined
  const slotsPerAction = input.attacksPerAction + extraWeaponAttacks
  const attacksAllowed = slotsPerAction * input.actionCount
  if (!Number.isSafeInteger(attacksAllowed) || input.attacksUsed >= attacksAllowed) return undefined
  const offset = input.attacksUsed % slotsPerAction
  const weaponOnly = offset >= input.attacksPerAction
  // Missing classification must never authorize a weapon-only slot.
  if (weaponOnly && input.attackKind !== 'weapon') return undefined
  return { attackNumber: input.attacksUsed + 1, attacksAllowed,
    spendsAction: offset === 0, ...(weaponOnly ? { weaponOnly: true as const } : {}) }
}
