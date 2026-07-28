import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from './damageTypes'

export type Dnd5eDamageDelivery = 'weapon-attack' | 'spell' | 'other'
export type Dnd5eWeaponMaterial = 'silvered' | 'adamantine'
export type Dnd5eMoralAlignment = 'good' | 'neutral' | 'evil'
export type Dnd5eDamageDefenseKind = 'immune' | 'resistant' | 'vulnerable'

/**
 * Facts about one damage component. Callers should resolve components with
 * different damage types or sources separately.
 */
export interface Dnd5eDamageSourceContext {
  damageType: Dnd5eDamageType
  delivery: Dnd5eDamageDelivery
  magical: boolean
  weaponMaterial?: Dnd5eWeaponMaterial
  sourceMoralAlignment?: Dnd5eMoralAlignment
  spellLevel?: number
}

/**
 * A declarative defense whose optional predicates are conjunctive.
 *
 * `weaponMaterialNot` only matches weapon attacks. An omitted material means
 * an ordinary weapon, so it matches both "not silvered" and "not adamantine".
 */
export interface Dnd5eConditionalDamageDefense {
  outcome: Dnd5eDamageDefenseKind
  damageTypes?: readonly Dnd5eDamageType[]
  delivery?: Dnd5eDamageDelivery
  magical?: boolean
  weaponMaterialNot?: Dnd5eWeaponMaterial
  sourceMoralAlignment?: Dnd5eMoralAlignment
  /** Stable catalog/feature identifier surfaced in resolution diagnostics. */
  reason?: string
}

/** Shorter alias for catalog generators that model each conditional entry as a rule. */
export type Dnd5eDamageDefenseRule = Dnd5eConditionalDamageDefense

const CONDITIONAL_DAMAGE_DEFENSE_KEYS = new Set([
  'outcome',
  'damageTypes',
  'delivery',
  'magical',
  'weaponMaterialNot',
  'sourceMoralAlignment',
  'reason',
])

/** Strict runtime guard used at stat-block and persisted-data boundaries. */
export function isDnd5eConditionalDamageDefense(
  value: unknown,
): value is Dnd5eConditionalDamageDefense {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  if (Object.keys(candidate).some((key) => !CONDITIONAL_DAMAGE_DEFENSE_KEYS.has(key))) return false
  if (!(['immune', 'resistant', 'vulnerable'] as const).includes(
    candidate.outcome as Dnd5eDamageDefenseKind,
  )) return false
  if (candidate.damageTypes != null) {
    if (!Array.isArray(candidate.damageTypes) || candidate.damageTypes.length === 0) return false
    if (candidate.damageTypes.some((type) =>
      !DND5E_DAMAGE_TYPES.includes(type as Dnd5eDamageType)
    )) return false
    if (new Set(candidate.damageTypes).size !== candidate.damageTypes.length) return false
  }
  if (
    candidate.delivery != null &&
    !(['weapon-attack', 'spell', 'other'] as const).includes(
      candidate.delivery as Dnd5eDamageDelivery,
    )
  ) return false
  if (candidate.magical != null && typeof candidate.magical !== 'boolean') return false
  if (
    candidate.weaponMaterialNot != null &&
    !(['silvered', 'adamantine'] as const).includes(
      candidate.weaponMaterialNot as Dnd5eWeaponMaterial,
    )
  ) return false
  if (
    candidate.sourceMoralAlignment != null &&
    !(['good', 'neutral', 'evil'] as const).includes(
      candidate.sourceMoralAlignment as Dnd5eMoralAlignment,
    )
  ) return false
  if (
    candidate.reason != null &&
    (typeof candidate.reason !== 'string' || candidate.reason.trim().length === 0)
  ) return false
  return true
}

export interface Dnd5eDamageDefenses {
  vulnerabilities?: readonly Dnd5eDamageType[]
  resistances?: readonly Dnd5eDamageType[]
  immunities?: readonly Dnd5eDamageType[]
  damageDefenseRules?: readonly Dnd5eConditionalDamageDefense[]
}

export type Dnd5eDamageMultiplier = 0 | 0.5 | 1 | 2

export interface Dnd5eDamageDefenseApplication {
  kind: Dnd5eDamageDefenseKind
  multiplier: Exclude<Dnd5eDamageMultiplier, 1>
  damageBefore: number
  damageAfter: number
  reasons: readonly string[]
}

export interface Dnd5eDamageDefenseResolution {
  /** Non-negative integer damage before defenses. */
  baseDamage: number
  finalDamage: number
  /**
   * Rules multiplier before integer rounding. For example, resistance and
   * vulnerability together report 1 even though odd damage loses one point
   * when resistance is rounded down before vulnerability.
   */
  multiplier: Dnd5eDamageMultiplier
  applied: readonly Dnd5eDamageDefenseApplication[]
}

export interface Dnd5eDamageDefenseResolutionInput {
  damage: number
  source: Dnd5eDamageSourceContext
  defenses?: Dnd5eDamageDefenses
}

function conditionalDefenseMatches(
  defense: Dnd5eConditionalDamageDefense,
  source: Dnd5eDamageSourceContext,
): boolean {
  if (defense.damageTypes != null && !defense.damageTypes.includes(source.damageType)) return false
  if (defense.delivery != null && defense.delivery !== source.delivery) return false
  if (defense.magical != null && defense.magical !== source.magical) return false
  if (defense.weaponMaterialNot != null) {
    if (source.delivery !== 'weapon-attack') return false
    if (source.weaponMaterial === defense.weaponMaterialNot) return false
  }
  if (
    defense.sourceMoralAlignment != null &&
    defense.sourceMoralAlignment !== source.sourceMoralAlignment
  ) return false
  return true
}

function matchingReasons(
  kind: Dnd5eDamageDefenseKind,
  source: Dnd5eDamageSourceContext,
  defenses: Dnd5eDamageDefenses,
): string[] {
  const staticDamageTypes = kind === 'immune'
    ? defenses.immunities
    : kind === 'resistant'
      ? defenses.resistances
      : defenses.vulnerabilities
  const reasons = staticDamageTypes?.includes(source.damageType)
    ? [`static:${kind}:${source.damageType}`]
    : []

  for (const [index, defense] of (defenses.damageDefenseRules ?? []).entries()) {
    if (defense.outcome !== kind || !conditionalDefenseMatches(defense, source)) continue
    const explicitReason = defense.reason?.trim()
    reasons.push(explicitReason || `conditional:${index}:${kind}`)
  }
  return reasons
}

/**
 * Resolves one damage component using the D&D 5e ordering:
 * immunity, then resistance (round down), then vulnerability.
 *
 * Multiple matches of the same kind explain the result but never stack.
 */
export function resolveDnd5eDamageDefenses(
  input: Dnd5eDamageDefenseResolutionInput,
): Dnd5eDamageDefenseResolution {
  if (!Number.isFinite(input.damage) || input.damage < 0) {
    throw new RangeError('damage must be a finite non-negative number')
  }

  const baseDamage = Math.floor(input.damage)
  const defenses = input.defenses ?? {}
  const immunityReasons = matchingReasons('immune', input.source, defenses)
  if (immunityReasons.length > 0) {
    return {
      baseDamage,
      finalDamage: 0,
      multiplier: 0,
      applied: [{
        kind: 'immune',
        multiplier: 0,
        damageBefore: baseDamage,
        damageAfter: 0,
        reasons: immunityReasons,
      }],
    }
  }

  const applied: Dnd5eDamageDefenseApplication[] = []
  let finalDamage = baseDamage
  const resistanceReasons = matchingReasons('resistant', input.source, defenses)
  if (resistanceReasons.length > 0) {
    const damageBefore = finalDamage
    finalDamage = Math.floor(finalDamage / 2)
    applied.push({
      kind: 'resistant',
      multiplier: 0.5,
      damageBefore,
      damageAfter: finalDamage,
      reasons: resistanceReasons,
    })
  }

  const vulnerabilityReasons = matchingReasons('vulnerable', input.source, defenses)
  if (vulnerabilityReasons.length > 0) {
    const damageBefore = finalDamage
    finalDamage *= 2
    applied.push({
      kind: 'vulnerable',
      multiplier: 2,
      damageBefore,
      damageAfter: finalDamage,
      reasons: vulnerabilityReasons,
    })
  }

  const multiplier: Dnd5eDamageMultiplier = resistanceReasons.length > 0
    ? vulnerabilityReasons.length > 0 ? 1 : 0.5
    : vulnerabilityReasons.length > 0 ? 2 : 1
  return { baseDamage, finalDamage, multiplier, applied }
}
