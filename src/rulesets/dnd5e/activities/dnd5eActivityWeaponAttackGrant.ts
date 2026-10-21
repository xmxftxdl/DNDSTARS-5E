export interface Dnd5eProjectileAttackSnapshotV1 {
  attackModifier: number
  damage: { count: number; sides: number; bonus: number; type: import('../damageTypes').Dnd5eDamageType }
}

export const DND5E_ACTIVITY_WEAPON_ATTACK_GRANT_SCHEMA_VERSION = 1 as const

/**
 * A short-lived Host credential created by a unified Activity. It does not
 * perform an attack or spend action economy by itself; the ordinary weapon
 * attack authority consumes it after rebuilding the equipped weapon profile.
 */
export interface Dnd5eActivityWeaponAttackGrantV1 {
  schemaVersion: typeof DND5E_ACTIVITY_WEAPON_ATTACK_GRANT_SCHEMA_VERSION
  grantId: string
  label: string
  sourceActivityId: string
  appliedTurnKey: string
  /** Host clears this only when this actor's next turn actually starts. */
  pendingNextOwnTurn?: true
  /** Separate active and queued copies preserve both windows for one target. */
  activatedGrantId?: string
  requiredTargetId?: string
  /** Follow-up remains part of the triggering Attack action. */
  attackActionFollowUp?: true
  inheritedAttackOrigin?: 'attack-action' | 'bonus-action' | 'reaction' | 'other'
  attackAdvantage?: true
  attackResourceCost?: { resourceId: string; amount: number }
  economy: 'bonus-action' | 'none'
  /** Omitted by legacy snapshots and interpreted as one. */
  remainingAttacks?: number
  projectileAttackSnapshot?: Dnd5eProjectileAttackSnapshotV1
  reusedProjectileWeaponId?: string
  targetRestriction?: { originTargetId: string; maximumFeet: number }
  weaponModes?: readonly ('melee' | 'ranged')[]
  weaponIds?: readonly string[]
  requiredWeaponProperties?: readonly string[]
  forbiddenWeaponProperties?: readonly string[]
  proficient?: boolean
  damageDice?: { count: number; sides: number }
  damageType?: import('../damageTypes').Dnd5eDamageType
  damageBonus?: number
  weaponSlots?: readonly ('main-hand' | 'off-hand')[]
}

export interface Dnd5eActivityWeaponAttackProfileV1 {
  weaponId: string
  baseWeaponId?: string
  mode: 'melee' | 'ranged'
  weaponProperties: readonly string[]
  proficient: boolean
}

/** Shared fail-closed matcher used by map preparation and Headless commit. */
export function dnd5eActivityWeaponAttackGrantMatchesV1(
  grant: Dnd5eActivityWeaponAttackGrantV1 | undefined,
  turnKey: string,
  profile: Dnd5eActivityWeaponAttackProfileV1,
  weaponSlot: 'main-hand' | 'off-hand' = 'main-hand',
): grant is Dnd5eActivityWeaponAttackGrantV1 {
  if (
    !grant || grant.schemaVersion !== DND5E_ACTIVITY_WEAPON_ATTACK_GRANT_SCHEMA_VERSION ||
    grant.pendingNextOwnTurn === true ||
    grant.appliedTurnKey !== turnKey || !['bonus-action', 'none'].includes(grant.economy) ||
    !Number.isInteger(grant.remainingAttacks ?? 1) || (grant.remainingAttacks ?? 1) < 1 ||
    (grant.remainingAttacks ?? 1) > 10
  ) return false
  if (grant.inheritedAttackOrigin != null && (
    !['attack-action', 'bonus-action', 'reaction', 'other'].includes(grant.inheritedAttackOrigin) ||
    grant.economy !== 'none' || grant.pendingNextOwnTurn
  )) return false
  if (grant.reusedProjectileWeaponId != null && (profile.mode !== 'ranged' || profile.weaponId !== grant.reusedProjectileWeaponId)) return false
  if (grant.reusedProjectileWeaponId != null) {
    const original=grant.projectileAttackSnapshot
    if (!original || !Number.isFinite(original.attackModifier) || !Number.isInteger(original.damage.count) ||
      original.damage.count < 1 || !Number.isInteger(original.damage.sides) || original.damage.sides < 2 ||
      !Number.isFinite(original.damage.bonus)) return false
  }
  if (grant.weaponModes?.length && !grant.weaponModes.includes(profile.mode)) return false
  if (
    grant.weaponIds?.length && !grant.weaponIds.includes(profile.weaponId) &&
    (profile.baseWeaponId == null || !grant.weaponIds.includes(profile.baseWeaponId))
  ) return false
  if (grant.proficient != null && grant.proficient !== profile.proficient) return false
  if (grant.weaponSlots?.length && !grant.weaponSlots.includes(weaponSlot)) return false
  if (grant.requiredWeaponProperties?.some((property) => !profile.weaponProperties.includes(property))) return false
  if (grant.forbiddenWeaponProperties?.some((property) => profile.weaponProperties.includes(property))) return false
  return true
}
