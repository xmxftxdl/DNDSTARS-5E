export const DND5E_EFFECTIVE_RULES_SCHEMA_VERSION = 1 as const

export interface Dnd5eHouseRulesV1 {
  /** Multiplies final declarative ability damage after feature scaling, before target resistance. */
  declarativeAbilityDamageMultiplier?: number
  criticalHitMode?: 'double-dice' | 'maximum-extra-die'
  advantageMode?: 'standard' | 'stacking-cancel'
  shortRestMinutes?: number
  longRestHours?: number
  /** Shows turn, attack, spell, and kill-streak banners on the battle map. */
  combatBannersEnabled?: boolean
  /** Plays synchronized spell projectiles, manifestations, and area effects. */
  spellAnimationsEnabled?: boolean
  /** Enforces casting prerequisites such as components, Wild Shape, and armor proficiency. */
  spellcastingPrerequisitesEnabled?: boolean
  /** Calculates and presents inventory and currency encumbrance. */
  encumbranceEnabled?: boolean
}

export interface Dnd5eEffectivePluginRequirementV1 {
  id: string
  version: string
  integrity?: string
  stateSchemaVersion?: number
}

export interface Dnd5eEffectiveRulesContextV1 {
  schemaVersion: typeof DND5E_EFFECTIVE_RULES_SCHEMA_VERSION
  revision: number
  hash: string
  sourceOrder: readonly ['srd', 'house-rules', 'character-options', 'temporary-effects', 'final-settlement']
  houseRules: Required<Dnd5eHouseRulesV1>
  /** Exact room package set pinned when combat starts. */
  requiredPlugins: readonly Dnd5eEffectivePluginRequirementV1[]
}

const DEFAULT_HOUSE_RULES: Required<Dnd5eHouseRulesV1> = {
  declarativeAbilityDamageMultiplier: 1,
  criticalHitMode: 'double-dice',
  advantageMode: 'standard',
  shortRestMinutes: 60,
  longRestHours: 8,
  combatBannersEnabled: true,
  spellAnimationsEnabled: true,
  spellcastingPrerequisitesEnabled: true,
  encumbranceEnabled: true,
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
    combatBannersEnabled: rules.combatBannersEnabled !== false,
    spellAnimationsEnabled: rules.spellAnimationsEnabled !== false,
    spellcastingPrerequisitesEnabled: rules.spellcastingPrerequisitesEnabled !== false,
    encumbranceEnabled: rules.encumbranceEnabled !== false,
  }
}

export function createDnd5eEffectiveRulesContextV1(input: {
  revision?: number
  hash?: string
  houseRules?: Dnd5eHouseRulesV1
  requiredPlugins?: readonly Dnd5eEffectivePluginRequirementV1[]
} = {}): Dnd5eEffectiveRulesContextV1 {
  const revision = Number.isInteger(input.revision) && (input.revision ?? 0) > 0 ? input.revision! : 1
  const houseRules = normalizeDnd5eHouseRulesV1(input.houseRules)
  const requiredPlugins = (input.requiredPlugins ?? []).map((plugin) => ({ ...plugin }))
  return {
    schemaVersion: 1,
    revision,
    hash: input.hash?.trim() || localHash({ schemaVersion: 1, revision, houseRules, requiredPlugins }),
    sourceOrder: ['srd', 'house-rules', 'character-options', 'temporary-effects', 'final-settlement'],
    houseRules,
    requiredPlugins,
  }
}

export function isDnd5eEffectiveRulesContextV1(value: unknown): value is Dnd5eEffectiveRulesContextV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const context = value as Partial<Dnd5eEffectiveRulesContextV1>
  return context.schemaVersion === 1 && Number.isInteger(context.revision) && (context.revision ?? 0) > 0 &&
    typeof context.hash === 'string' && context.hash.length > 0 &&
    Array.isArray(context.sourceOrder) && Array.isArray(context.requiredPlugins) &&
    context.requiredPlugins.every((plugin) => !!plugin && typeof plugin.id === 'string' && !!plugin.id &&
      typeof plugin.version === 'string' && !!plugin.version &&
      (plugin.integrity == null || typeof plugin.integrity === 'string') &&
      (plugin.stateSchemaVersion == null || Number.isInteger(plugin.stateSchemaVersion))) &&
    !!context.houseRules && typeof context.houseRules === 'object'
}

/** A combat pins the first room-rule snapshot it sees; later edits apply to the next combat id. */
export function dnd5eEffectiveRulesContextForCombat(
  combatId: string,
  roomRules?: {
    revision: number
    hash: string
    houseRules: Dnd5eHouseRulesV1
    requiredPlugins?: readonly Dnd5eEffectivePluginRequirementV1[]
  } | null,
): Dnd5eEffectiveRulesContextV1 {
  const existing = combatContexts.get(combatId)
  if (existing) return existing
  const context = createDnd5eEffectiveRulesContextV1({
    revision: roomRules?.revision,
    hash: roomRules?.hash,
    houseRules: roomRules?.houseRules,
    requiredPlugins: roomRules?.requiredPlugins,
  })
  combatContexts.set(combatId, context)
  if (combatContexts.size > 64) combatContexts.delete(combatContexts.keys().next().value!)
  return context
}

/** Restores the exact shared snapshot before any new action is prepared. */
export function restoreDnd5eEffectiveRulesContextForCombat(
  combatId: string,
  context: unknown,
): Dnd5eEffectiveRulesContextV1 | null {
  if (!combatId || !isDnd5eEffectiveRulesContextV1(context)) return null
  const restored: Dnd5eEffectiveRulesContextV1 = {
    ...context,
    sourceOrder: [...context.sourceOrder],
    houseRules: normalizeDnd5eHouseRulesV1(context.houseRules),
    requiredPlugins: context.requiredPlugins.map((plugin) => ({ ...plugin })),
  }
  combatContexts.set(combatId, restored)
  if (combatContexts.size > 64) combatContexts.delete(combatContexts.keys().next().value!)
  return restored
}

export function clearDnd5eEffectiveRulesContextsForTest(): void {
  combatContexts.clear()
}
