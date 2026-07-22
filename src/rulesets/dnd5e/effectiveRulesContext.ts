export const DND5E_EFFECTIVE_RULES_SCHEMA_VERSION = 1 as const

export interface Dnd5eHouseRulesV1 {
  /** Multiplies final declarative ability damage after feature scaling, before target resistance. */
  declarativeAbilityDamageMultiplier?: number
  criticalHitMode?: 'double-dice' | 'maximum-extra-die'
  advantageMode?: 'standard' | 'stacking-cancel'
  shortRestMinutes?: number
  longRestHours?: number
}

export interface Dnd5eEffectiveRulesContextV1 {
  schemaVersion: typeof DND5E_EFFECTIVE_RULES_SCHEMA_VERSION
  revision: number
  hash: string
  sourceOrder: readonly ['srd', 'house-rules', 'character-options', 'temporary-effects', 'final-settlement']
  houseRules: Required<Dnd5eHouseRulesV1>
}

const DEFAULT_HOUSE_RULES: Required<Dnd5eHouseRulesV1> = {
  declarativeAbilityDamageMultiplier: 1,
  criticalHitMode: 'double-dice',
  advantageMode: 'standard',
  shortRestMinutes: 60,
  longRestHours: 8,
}

const combatContexts = new Map<string, Dnd5eEffectiveRulesContextV1>()

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(',')}}`
}

function localHash(value: unknown): string {
  const source = stableStringify(value)
  let hash = 0x811c9dc5
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function normalizeDnd5eHouseRulesV1(value: unknown): Required<Dnd5eHouseRulesV1> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_HOUSE_RULES }
  const rules = value as Dnd5eHouseRulesV1
  const multiplier = Number(rules.declarativeAbilityDamageMultiplier)
  const shortRestMinutes = Number(rules.shortRestMinutes)
  const longRestHours = Number(rules.longRestHours)
  return {
    declarativeAbilityDamageMultiplier: Number.isFinite(multiplier) && multiplier >= 0 && multiplier <= 10
      ? multiplier
      : DEFAULT_HOUSE_RULES.declarativeAbilityDamageMultiplier,
    criticalHitMode: rules.criticalHitMode === 'maximum-extra-die' ? rules.criticalHitMode : 'double-dice',
    advantageMode: rules.advantageMode === 'stacking-cancel' ? rules.advantageMode : 'standard',
    shortRestMinutes: Number.isInteger(shortRestMinutes) && shortRestMinutes >= 1 && shortRestMinutes <= 1_440
      ? shortRestMinutes
      : DEFAULT_HOUSE_RULES.shortRestMinutes,
    longRestHours: Number.isInteger(longRestHours) && longRestHours >= 1 && longRestHours <= 24
      ? longRestHours
      : DEFAULT_HOUSE_RULES.longRestHours,
  }
}

export function createDnd5eEffectiveRulesContextV1(input: {
  revision?: number
  hash?: string
  houseRules?: Dnd5eHouseRulesV1
} = {}): Dnd5eEffectiveRulesContextV1 {
  const revision = Number.isInteger(input.revision) && (input.revision ?? 0) > 0 ? input.revision! : 1
  const houseRules = normalizeDnd5eHouseRulesV1(input.houseRules)
  return {
    schemaVersion: 1,
    revision,
    hash: input.hash?.trim() || localHash({ schemaVersion: 1, revision, houseRules }),
    sourceOrder: ['srd', 'house-rules', 'character-options', 'temporary-effects', 'final-settlement'],
    houseRules,
  }
}

/** A combat pins the first room-rule snapshot it sees; later edits apply to the next combat id. */
export function dnd5eEffectiveRulesContextForCombat(
  combatId: string,
  roomRules?: { revision: number; hash: string; houseRules: Dnd5eHouseRulesV1 } | null,
): Dnd5eEffectiveRulesContextV1 {
  const existing = combatContexts.get(combatId)
  if (existing) return existing
  const context = createDnd5eEffectiveRulesContextV1({
    revision: roomRules?.revision,
    hash: roomRules?.hash,
    houseRules: roomRules?.houseRules,
  })
  combatContexts.set(combatId, context)
  if (combatContexts.size > 64) combatContexts.delete(combatContexts.keys().next().value!)
  return context
}

export function clearDnd5eEffectiveRulesContextsForTest(): void {
  combatContexts.clear()
}
