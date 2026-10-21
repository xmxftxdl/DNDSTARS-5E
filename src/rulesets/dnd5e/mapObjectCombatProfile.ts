import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from './damageTypes'

/** Host-authored physical object data. HP stays on the existing obstacle token. */
export interface Dnd5eMapObjectCombatProfile {
  armorClass: number
  damageThreshold?: number
  damageImmunities?: readonly Dnd5eDamageType[]
  damageResistances?: readonly Dnd5eDamageType[]
  damageVulnerabilities?: readonly Dnd5eDamageType[]
}

export function normalizeDnd5eMapObjectCombatProfile(value: unknown): Dnd5eMapObjectCombatProfile | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (Object.keys(raw).some(key => !['armorClass','damageThreshold','damageImmunities','damageResistances','damageVulnerabilities'].includes(key)) ||
      !Number.isSafeInteger(raw.armorClass) || Number(raw.armorClass) < 1 || Number(raw.armorClass) > 40 ||
      raw.damageThreshold != null && (!Number.isSafeInteger(raw.damageThreshold) || Number(raw.damageThreshold) < 0 || Number(raw.damageThreshold) > 1_000_000)) return undefined
  const result: Dnd5eMapObjectCombatProfile = { armorClass: Number(raw.armorClass) }
  if (raw.damageThreshold != null) result.damageThreshold = Number(raw.damageThreshold)
  for (const key of ['damageImmunities','damageResistances','damageVulnerabilities'] as const) {
    const types = raw[key]
    if (types == null) continue
    if (!Array.isArray(types) || types.length > DND5E_DAMAGE_TYPES.length || new Set(types).size !== types.length ||
        types.some(type => !DND5E_DAMAGE_TYPES.includes(type))) return undefined
    result[key] = [...types]
  }
  return result
}

/** Unknown HP/profile cannot become a creature with inferred defaults. */
export function dnd5eDestroyedMapObject(token: {
  type: string; hp?: number; maxHp?: number; dnd5eObjectState?: { combatProfile?: unknown }
}): boolean {
  return token.type === 'obstacle' && token.hp === 0 && Number.isSafeInteger(token.maxHp) &&
    Number(token.maxHp) > 0 && Number(token.maxHp) <= 1_000_000 &&
    normalizeDnd5eMapObjectCombatProfile(token.dnd5eObjectState?.combatProfile) != null
}

export function dnd5eAttackableMapObject(token: {
  type: string; hp?: number; maxHp?: number; dnd5eObjectState?: { combatProfile?: unknown }
}) {
  if (token.type !== 'obstacle' || !Number.isSafeInteger(token.hp) || !Number.isSafeInteger(token.maxHp) ||
      Number(token.hp) < 1 || Number(token.maxHp) < Number(token.hp) || Number(token.maxHp) > 1_000_000) return undefined
  const profile = normalizeDnd5eMapObjectCombatProfile(token.dnd5eObjectState?.combatProfile)
  return profile ? { ...profile, currentHp: token.hp!, maxHp: token.maxHp! } : undefined
}
