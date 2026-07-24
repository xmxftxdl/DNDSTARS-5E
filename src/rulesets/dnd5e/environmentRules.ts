export type Dnd5eMapEnvironment = 'normal' | 'underwater'

const UNDERWATER_MELEE_EXCEPTIONS = new Set([
  'dnd5e-dagger', 'dnd5e-javelin', 'dnd5e-shortsword', 'dnd5e-spear', 'dnd5e-trident',
])

const UNDERWATER_RANGED_EXCEPTIONS = new Set([
  'dnd5e-light-crossbow', 'dnd5e-hand-crossbow', 'dnd5e-heavy-crossbow', 'dnd5e-net',
  'dnd5e-javelin', 'dnd5e-spear', 'dnd5e-trident', 'dnd5e-dart',
])

const MONSTER_WEAPON_ALIASES: Readonly<Record<string, string>> = {
  dagger: 'dnd5e-dagger',
  dart: 'dnd5e-dart',
  'hand-crossbow': 'dnd5e-hand-crossbow',
  'heavy-crossbow': 'dnd5e-heavy-crossbow',
  javelin: 'dnd5e-javelin',
  'light-crossbow': 'dnd5e-light-crossbow',
  net: 'dnd5e-net',
  shortsword: 'dnd5e-shortsword',
  spear: 'dnd5e-spear',
  trident: 'dnd5e-trident',
}

/**
 * Monster stat blocks identify attacks by action id/name instead of inventory
 * template ids. Convert the SRD weapon names that matter underwater into the
 * same authoritative ids used by player equipment attacks.
 */
export function dnd5eMonsterWeaponIdForUnderwater(
  actionId: string,
  actionName: string,
): string {
  const normalized = `${actionId} ${actionName}`
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
  const alias = Object.entries(MONSTER_WEAPON_ALIASES)
    .find(([key]) => normalized.includes(key))
  return alias?.[1] ?? `dnd5e-monster-${actionId}`
}

/** SRD 5.1 水下武器攻击修正；范围外自动失手会在掷骰前被权威端拒绝。 */
export function dnd5eUnderwaterWeaponAttack(input: {
  environment?: Dnd5eMapEnvironment
  weaponId: string
  mode: 'melee' | 'ranged'
  distanceFeet: number
  normalRangeFeet?: number
  hasSwimmingSpeed?: boolean
}): { automaticMiss: boolean; disadvantage: boolean } {
  if (input.environment !== 'underwater') return { automaticMiss: false, disadvantage: false }
  const weaponId = input.weaponId.replace(/-offhand$/, '')
  if (input.mode === 'melee') {
    return {
      automaticMiss: false,
      disadvantage: input.hasSwimmingSpeed !== true && !UNDERWATER_MELEE_EXCEPTIONS.has(weaponId),
    }
  }
  if (input.distanceFeet > Math.max(0, input.normalRangeFeet ?? 0)) {
    return { automaticMiss: true, disadvantage: false }
  }
  return { automaticMiss: false, disadvantage: !UNDERWATER_RANGED_EXCEPTIONS.has(weaponId) }
}
