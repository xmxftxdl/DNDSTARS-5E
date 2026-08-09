import type { Dnd5eHeadlessCombatState, Dnd5eHeadlessObservedAction } from '../headlessCombatEngine'

export const DND5E_TRACKABLE_DEFINITION_SCHEMA_VERSION = 1 as const
export const DND5E_TRACKABLE_ID_PREFIX = 'dnd5e-2014' as const

export type Dnd5eTrackableDefinitionKindV1 =
  | 'spell'
  | 'feature'
  | 'feat'
  | 'item'
  | 'action'
  | 'attack'
  | 'movement'
  | 'monster-action'
  | 'skill'
  | 'saving-throw'
  | 'ability-check'
  | 'rest'
  | 'activity'

export interface Dnd5eTrackableDefinitionIdentityV1 {
  schemaVersion: typeof DND5E_TRACKABLE_DEFINITION_SCHEMA_VERSION
  /** Stable across executions and package patch versions. */
  definitionId: string
  namespace: string
  kind: Dnd5eTrackableDefinitionKindV1
  localId: string
}

export interface Dnd5eActivityExecutionIdentityV1 {
  schemaVersion: typeof DND5E_TRACKABLE_DEFINITION_SCHEMA_VERSION
  definitionId: string
  /** Unique for one authoritative execution. Normally the transaction/receipt id. */
  executionId: string
  parentExecutionId?: string
}

export interface Dnd5eTrackableDefinitionV1 extends Dnd5eTrackableDefinitionIdentityV1 {
  name: string
  legacyIds?: readonly string[]
  source?: 'core' | 'srd-5.1' | 'content-package' | 'runtime'
}

const CANONICAL_PATTERN = /^dnd5e-2014:([a-z0-9][a-z0-9._-]{0,95}):(spell|feature|feat|item|action|attack|movement|monster-action|skill|saving-throw|ability-check|rest|activity):([a-z0-9][a-z0-9._-]{0,127})$/

function fnv1a(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

function safeSegment(value: string, maximumLength: number): string {
  const normalized = value.trim().toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '') || 'unknown'
  if (normalized.length <= maximumLength) return normalized
  const suffix = fnv1a(normalized)
  return `${normalized.slice(0, Math.max(1, maximumLength - suffix.length - 1))}.${suffix}`
}

function legacyNamespaceAndId(localId: string, fallbackNamespace: string): { namespace: string; localId: string } {
  const value = localId.trim()
  if (value.startsWith('srd-5.1:')) {
    return { namespace: 'srd-5.1', localId: value.slice('srd-5.1:'.length) }
  }
  return { namespace: fallbackNamespace, localId: value }
}

export function dnd5eTrackableDefinitionIdV1(input: {
  namespace: string
  kind: Dnd5eTrackableDefinitionKindV1
  localId: string
}): string {
  const parsed = parseDnd5eTrackableDefinitionIdV1(input.localId)
  if (parsed) return parsed.definitionId
  const inferred = legacyNamespaceAndId(input.localId, input.namespace)
  return `${DND5E_TRACKABLE_ID_PREFIX}:${safeSegment(inferred.namespace, 96)}:${input.kind}:${safeSegment(inferred.localId, 128)}`
}

export function dnd5eTrackableDefinitionIdForContentV1(
  kind: Dnd5eTrackableDefinitionKindV1,
  localId: string,
  fallbackNamespace = 'runtime',
): string {
  return dnd5eTrackableDefinitionIdV1({
    namespace: localId.startsWith('srd-5.1:') ? 'srd-5.1' : fallbackNamespace,
    kind,
    localId,
  })
}

export function parseDnd5eTrackableDefinitionIdV1(value: string): Dnd5eTrackableDefinitionIdentityV1 | undefined {
  const match = CANONICAL_PATTERN.exec(value.trim().toLowerCase())
  if (!match) return undefined
  return {
    schemaVersion: DND5E_TRACKABLE_DEFINITION_SCHEMA_VERSION,
    definitionId: value.trim().toLowerCase(),
    namespace: match[1]!,
    kind: match[2]! as Dnd5eTrackableDefinitionKindV1,
    localId: match[3]!,
  }
}

export function isDnd5eTrackableDefinitionIdV1(value: unknown): value is string {
  return typeof value === 'string' && parseDnd5eTrackableDefinitionIdV1(value) != null
}

export function dnd5eActivityExecutionIdentityV1(
  definitionId: string,
  executionId: string,
  parentExecutionId?: string,
): Dnd5eActivityExecutionIdentityV1 {
  if (!isDnd5eTrackableDefinitionIdV1(definitionId)) throw new Error('invalid-dnd5e-trackable-definition-id')
  const normalizedExecutionId = executionId.trim()
  if (!normalizedExecutionId || normalizedExecutionId.length > 300) throw new Error('invalid-dnd5e-activity-execution-id')
  if (parentExecutionId != null && (!parentExecutionId.trim() || parentExecutionId.length > 300)) {
    throw new Error('invalid-dnd5e-parent-execution-id')
  }
  return {
    schemaVersion: DND5E_TRACKABLE_DEFINITION_SCHEMA_VERSION,
    definitionId,
    executionId: normalizedExecutionId,
    ...(parentExecutionId ? { parentExecutionId: parentExecutionId.trim() } : {}),
  }
}

const FEATURE_ACTION_PREFIXES = [
  'barbarian-', 'bard-', 'bardic-', 'cleric-', 'druid-', 'fighter-', 'monk-',
  'paladin-', 'ranger-', 'rogue-', 'sorcerer-', 'warlock-', 'wizard-', 'feature-',
] as const

const FEATURE_CLASS_PREFIX: Readonly<Record<string, string>> = {
  barbarian: 'barbarian', bard: 'bard', bardic: 'bard', cleric: 'cleric', druid: 'druid',
  fighter: 'fighter', monk: 'monk', paladin: 'paladin', ranger: 'ranger', rogue: 'rogue',
  sorcerer: 'sorcerer', warlock: 'warlock', wizard: 'wizard',
}

function canonicalFeatureLocalId(type: string, explicitFeatureId?: string): string {
  if (explicitFeatureId) return explicitFeatureId
  const separator = type.indexOf('-')
  if (separator <= 0) return type
  const prefix = type.slice(0, separator)
  const classId = FEATURE_CLASS_PREFIX[prefix]
  return classId ? `${classId}.${type.slice(separator + 1)}` : type
}

function actionLocalId(action: Dnd5eHeadlessObservedAction): {
  namespace: string
  kind: Dnd5eTrackableDefinitionKindV1
  localId: string
} {
  const record = action as unknown as Record<string, unknown>
  const type = String(record.type ?? 'unknown')
  const spellId = typeof record.spellId === 'string'
    ? record.spellId
    : type === 'hellish-rebuke' ? 'hellish-rebuke' : undefined
  if (spellId) return { namespace: 'srd-5.1', kind: 'spell', localId: spellId }
  if (type === 'plugin' && typeof record.pluginId === 'string' && typeof record.actionId === 'string') {
    return { namespace: record.pluginId, kind: record.featureId ? 'feature' : 'activity', localId: String(record.featureId ?? record.actionId) }
  }
  if (type === 'move' || type === 'move-persistent-area') {
    return { namespace: 'core', kind: 'movement', localId: type }
  }
  if (type === 'attack' || type === 'opportunity-attack' || type === 'monk-unarmed-bonus') {
    return { namespace: 'core', kind: 'attack', localId: type }
  }
  if (FEATURE_ACTION_PREFIXES.some((prefix) => type.startsWith(prefix)) || type === 'class-resource-use') {
    return {
      namespace: typeof record.pluginId === 'string' ? record.pluginId : 'srd-5.1',
      kind: 'feature',
      localId: canonicalFeatureLocalId(
        type,
        typeof record.featureId === 'string' ? record.featureId : undefined,
      ),
    }
  }
  return { namespace: 'core', kind: 'action', localId: type }
}

/**
 * Converts every executable Headless action into one stable definition id.
 * The Host calls this at the transaction boundary, so clients cannot spoof the
 * id used by statistics or declarative trigger matching.
 */
export function dnd5eTrackableDefinitionIdForActionV1(
  state: Pick<Dnd5eHeadlessCombatState, 'combatants'>,
  action: Dnd5eHeadlessObservedAction,
): string {
  const record = action as unknown as Record<string, unknown>
  const actorId = typeof record.actorId === 'string' ? record.actorId : undefined
  const actor = actorId ? state.combatants[actorId] : undefined
  const type = String(record.type ?? 'unknown')
  if (type.startsWith('monster-') && typeof record.actionId === 'string') {
    return dnd5eTrackableDefinitionIdV1({
      namespace: actor?.statBlockId?.startsWith('srd-5.1:') ? 'srd-5.1' : 'runtime',
      kind: 'monster-action',
      localId: `${actor?.statBlockId ?? actorId ?? 'custom'}.${record.actionId}`,
    })
  }
  const identity = actionLocalId(action)
  if (identity.kind === 'attack' && type === 'attack') {
    const classDamageContext = record.classDamageContext && typeof record.classDamageContext === 'object'
      ? record.classDamageContext as Record<string, unknown>
      : undefined
    const weaponId = typeof classDamageContext?.weaponId === 'string'
      ? classDamageContext.weaponId
      : actor?.mainWeaponId
    if (weaponId) return dnd5eTrackableDefinitionIdV1({ namespace: 'srd-5.1', kind: 'attack', localId: weaponId })
  }
  return dnd5eTrackableDefinitionIdV1(identity)
}
