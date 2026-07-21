export type Dnd5eMapEnvironment = 'normal' | 'underwater'

const UNDERWATER_MELEE_EXCEPTIONS = new Set([
  'dnd5e-dagger', 'dnd5e-javelin', 'dnd5e-shortsword', 'dnd5e-spear', 'dnd5e-trident',
])

const UNDERWATER_RANGED_EXCEPTIONS = new Set([
  'dnd5e-light-crossbow', 'dnd5e-hand-crossbow', 'dnd5e-heavy-crossbow', 'dnd5e-net',
  'dnd5e-javelin', 'dnd5e-spear', 'dnd5e-trident', 'dnd5e-dart',
])

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

