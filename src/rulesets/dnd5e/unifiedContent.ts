import { validateAutomationCapability } from '../../domain/automation/automationCapability'
import {
  validateContentDefinitionIdentity,
  type ContentDefinitionEnvelope,
  type ContentDefinitionKind,
} from '../../domain/content/contentDefinition'
import { registerContentDefinitionPackage } from '../../domain/content/contentDefinitionRegistry'
import type { DeclarativeClassDefinitionV1 } from './declarativeClass'
import type { DeclarativeSubclassDefinitionV1 } from './declarativeSubclassAbility'
import {
  validateDnd5eCustomRulesPluginDraft,
  type Dnd5eCustomRulesPluginDraft,
} from './customRulesPlugin'
import type { Dnd5eMonsterStatBlock } from './monsters'
import {
  validateDnd5eRulesPluginManifest,
  type Dnd5ePluginAbilityGenerationDefinition,
  type Dnd5ePluginBackgroundDefinition,
  type Dnd5ePluginFeatDefinition,
  type Dnd5ePluginFeatureDefinition,
  type Dnd5ePluginItemDefinition,
  type Dnd5ePluginRaceDefinition,
  type Dnd5ePluginSpellDefinition,
  type Dnd5eRulesPlugin,
  type Dnd5eRulesPluginManifest,
} from './pluginApi'
import {
  DND5E_PLUGIN_IMAGE_ASSETS_MAX_TOTAL_BYTES,
  registerDnd5ePluginImageAsset,
  validateDnd5ePluginImageAsset,
  type Dnd5ePluginImageAssetDefinition,
} from './pluginAssets'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'
import {
  validateDnd5eActivityDefinitionV1,
  validateDnd5eEffectDefinitionV1,
} from './activities/dnd5eActivityValidation'
import {
  validateDnd5eAdvancementDefinitionV1,
  type Dnd5eAdvancementDefinitionV1,
} from './activities/dnd5eAdvancementContracts'
import type { Dnd5eEffectDefinitionV1 } from './activities/dnd5eEffectContracts'

export const DND5E_UNIFIED_CONTENT_FORMAT = 'dndstars5e-unified-content' as const
export const DND5E_UNIFIED_CONTENT_SCHEMA_VERSION = 1 as const
export const DND5E_UNIFIED_CONTENT_MAX_DEFINITIONS = 512
export const DND5E_UNIFIED_CONTENT_MAX_BYTES = 8 * 1024 * 1024
export const DND5E_UNIFIED_CONTENT_KINDS = Object.freeze([
  'spell', 'feature', 'feat', 'class', 'subclass', 'race', 'background', 'item', 'monster',
  'monster-action', 'ability-generation',
] as const satisfies readonly ContentDefinitionKind[])

export interface Dnd5eMonsterActionContentPayloadV1 {
  monsterId: string
  actionId: string
  section: 'action' | 'bonus-action' | 'reaction' | 'legendary-action' | 'lair-action'
}

export type Dnd5eAuthorableFeatureDefinitionV1 = Omit<Dnd5ePluginFeatureDefinition, 'isAvailable'>
export type Dnd5eAuthorableFeatDefinitionV1 = Omit<Dnd5ePluginFeatDefinition, 'isAvailable'>

export interface Dnd5eUnifiedContentPayloadByKindV1 {
  spell: Dnd5ePluginSpellDefinition
  feature: Dnd5eAuthorableFeatureDefinitionV1
  feat: Dnd5eAuthorableFeatDefinitionV1
  class: DeclarativeClassDefinitionV1
  subclass: DeclarativeSubclassDefinitionV1
  race: Dnd5ePluginRaceDefinition
  background: Dnd5ePluginBackgroundDefinition
  item: Dnd5ePluginItemDefinition
  monster: Dnd5eMonsterStatBlock
  'monster-action': Dnd5eMonsterActionContentPayloadV1
  'ability-generation': Dnd5ePluginAbilityGenerationDefinition
}

export type Dnd5eUnifiedContentDefinitionV1<
  Kind extends ContentDefinitionKind = ContentDefinitionKind,
> = Kind extends ContentDefinitionKind
  ? ContentDefinitionEnvelope<
      Kind,
      Dnd5eUnifiedContentPayloadByKindV1[Kind],
      Dnd5eActivityDefinitionV1,
      Dnd5eEffectDefinitionV1,
      Dnd5eAdvancementDefinitionV1
    >
  : never

export interface Dnd5eUnifiedContentBundleV1 {
  format: typeof DND5E_UNIFIED_CONTENT_FORMAT
  schemaVersion: typeof DND5E_UNIFIED_CONTENT_SCHEMA_VERSION
  manifest: Dnd5eRulesPluginManifest
  assets: readonly Dnd5ePluginImageAssetDefinition[]
  definitions: readonly Dnd5eUnifiedContentDefinitionV1[]
}

export interface Dnd5eUnifiedContentSummaryV1 {
  races: number
  backgrounds: number
  features: number
  feats: number
  spells: number
  items: number
  abilityGenerationMethods: number
  headlessActions: number
  subclasses: number
  classes: number
  monsters: number
  imageAssets: number
  imageAssetBytes: number
}

const ROOT_KEYS = new Set(['format', 'schemaVersion', 'manifest', 'assets', 'definitions'])
const DEFINITION_KEYS = new Set([
  'schemaVersion', 'id', 'namespace', 'version', 'kind', 'name', 'description', 'source', 'tags',
  'payload', 'activities', 'effects', 'advancements', 'automation',
])
const CONTENT_KINDS = new Set<ContentDefinitionKind>(DND5E_UNIFIED_CONTENT_KINDS)
const CONTENT_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/
const CONTENT_REFERENCE_ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function unknownKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>, label: string): string[] {
  return Object.keys(value).filter((key) => !allowed.has(key)).map((key) => `${label} contains unknown field: ${key}`)
}

function pureJsonError(value: unknown, label: string, depth = 0): string | undefined {
  if (depth > 40) return `${label} exceeds the maximum nesting depth`
  if (value == null || typeof value === 'string' || typeof value === 'boolean') return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? undefined : `${label} contains a non-finite number`
  if (Array.isArray(value)) {
    if (value.length > 10_000) return `${label} contains an oversized array`
    for (const [index, entry] of value.entries()) {
      const error = pureJsonError(entry, `${label}[${index}]`, depth + 1)
      if (error) return error
    }
    return undefined
  }
  if (!record(value) || Object.getPrototypeOf(value) !== Object.prototype) return `${label} must contain pure JSON data only`
  for (const [key, entry] of Object.entries(value)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') return `${label} contains a forbidden key`
    const error = pureJsonError(entry, `${label}.${key}`, depth + 1)
    if (error) return error
  }
  return undefined
}

function errorFromValidator(run: () => readonly string[], label: string): readonly string[] {
  try {
    return run().map((error) => `${label}: ${error}`)
  } catch {
    return [`${label}: invalid structure`]
  }
}

function legacyFeaturePayload(
  definition: Dnd5eUnifiedContentDefinitionV1<'feature'>,
): Dnd5eAuthorableFeatureDefinitionV1 {
  const payload = structuredClone(definition.payload)
  if (definition.activities?.length && !payload.action && !payload.staticModifiers && payload.automation !== 'manual') {
    payload.automation = 'manual'
    payload.automationReasons = ['可执行机制由统一 Activity 注册表提供。']
  }
  return payload
}

function legacyFeatPayload(
  definition: Dnd5eUnifiedContentDefinitionV1<'feat'>,
): Dnd5eAuthorableFeatDefinitionV1 {
  const payload = structuredClone(definition.payload)
  if (definition.activities?.length && !payload.action && !payload.staticModifiers && payload.automation !== 'manual') {
    payload.automation = 'manual'
    payload.automationReasons = ['可执行机制由统一 Activity 注册表提供。']
  }
  return payload
}

function legacySpellPayload(
  definition: Dnd5eUnifiedContentDefinitionV1<'spell'>,
): Dnd5ePluginSpellDefinition {
  const payload = structuredClone(definition.payload)
  if (definition.activities?.length) payload.automation = { mode: 'reference-only' }
  return payload
}

function legacyDraftFromBundle(bundle: Dnd5eUnifiedContentBundleV1): Dnd5eCustomRulesPluginDraft {
  const byKind = <Kind extends ContentDefinitionKind>(kind: Kind) =>
    bundle.definitions.filter((definition): definition is Dnd5eUnifiedContentDefinitionV1<Kind> => definition.kind === kind)
  return {
    manifest: structuredClone(bundle.manifest),
    races: byKind('race').map((entry) => structuredClone(entry.payload)),
    backgrounds: byKind('background').map((entry) => structuredClone(entry.payload)),
    features: byKind('feature').map(legacyFeaturePayload),
    feats: byKind('feat').map(legacyFeatPayload),
    spells: byKind('spell').map(legacySpellPayload),
    items: byKind('item').map((entry) => structuredClone(entry.payload)),
    abilityGenerationMethods: byKind('ability-generation').map((entry) => structuredClone(entry.payload)),
    classes: byKind('class').map((entry) => structuredClone(entry.payload)),
    subclasses: byKind('subclass').map((entry) => structuredClone(entry.payload)),
    monsters: byKind('monster').map((entry) => structuredClone(entry.payload)),
  }
}

/**
 * Validates the public, data-only authoring contract. It deliberately rejects
 * executable values: authors compose Host-owned activities and effects rather
 * than supplying JavaScript callbacks.
 */
export function validateDnd5eUnifiedContentBundleV1(value: unknown): readonly string[] {
  const errors: string[] = []
  if (!record(value)) return ['Unified content bundle must be an object']
  errors.push(...unknownKeys(value, ROOT_KEYS, 'Unified content bundle'))
  if (value.format !== DND5E_UNIFIED_CONTENT_FORMAT) errors.push('Unsupported unified content format')
  if (value.schemaVersion !== DND5E_UNIFIED_CONTENT_SCHEMA_VERSION) errors.push('Unsupported unified content schema')
  if (!record(value.manifest)) errors.push('Unified content manifest is invalid')
  else {
    try {
      validateDnd5eRulesPluginManifest(value.manifest as unknown as Dnd5eRulesPluginManifest)
      if (value.manifest.apiVersion !== 2) errors.push('Unified content requires plugin API v2')
      if (value.manifest.pluginKind != null && value.manifest.pluginKind !== 'content-package') {
        errors.push('Unified content manifest must declare content-package')
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unified content manifest is invalid')
    }
  }
  if (!Array.isArray(value.assets)) errors.push('Unified content assets must be an array')
  if (!Array.isArray(value.definitions) || value.definitions.length < 1 || value.definitions.length > DND5E_UNIFIED_CONTENT_MAX_DEFINITIONS) {
    errors.push(`Unified content definitions must contain 1-${DND5E_UNIFIED_CONTENT_MAX_DEFINITIONS} entries`)
  }
  const jsonError = pureJsonError(value, 'Unified content bundle')
  if (jsonError) {
    errors.push(jsonError)
    return errors
  }
  try {
    if (JSON.stringify(value).length > DND5E_UNIFIED_CONTENT_MAX_BYTES) errors.push('Unified content bundle is too large')
  } catch {
    errors.push('Unified content bundle is not serializable')
  }
  if (errors.length && (!record(value.manifest) || !Array.isArray(value.definitions))) return errors

  const bundle = value as unknown as Dnd5eUnifiedContentBundleV1
  const definitionKeys = new Set<string>()
  const activityIds = new Set<string>()
  const effectIds = new Set<string>()
  const advancementIds = new Set<string>()
  for (const [index, definition] of bundle.definitions.entries()) {
    const label = `definitions[${index}]`
    if (!record(definition)) {
      errors.push(`${label} is invalid`)
      continue
    }
    errors.push(...unknownKeys(definition, DEFINITION_KEYS, label))
    if (!CONTENT_KINDS.has(definition.kind as ContentDefinitionKind)) {
      errors.push(`${label}.kind is invalid`)
      continue
    }
    errors.push(...errorFromValidator(
      () => validateContentDefinitionIdentity(definition as unknown as Dnd5eUnifiedContentDefinitionV1),
      label,
    ))
    errors.push(...errorFromValidator(
      () => validateAutomationCapability((definition as unknown as Dnd5eUnifiedContentDefinitionV1).automation),
      `${label}.automation`,
    ))
    if (definition.namespace !== bundle.manifest.id || definition.version !== bundle.manifest.version) {
      errors.push(`${label} package identity does not match the manifest`)
    }
    if (!record(definition.payload)) errors.push(`${label}.payload is invalid`)
    else if (definition.kind === 'monster') {
      if (definition.payload.slug !== definition.id) errors.push(`${label}.payload.slug must match definition.id`)
    } else if ('id' in definition.payload && definition.payload.id !== definition.id) {
      errors.push(`${label}.payload.id must match definition.id`)
    }
    const key = `${definition.kind}:${definition.id}`
    if (definitionKeys.has(key)) errors.push(`${label} duplicates ${key}`)
    definitionKeys.add(key)
    for (const [activityIndex, activity] of (definition.activities ?? []).entries()) {
      errors.push(...errorFromValidator(
        () => validateDnd5eActivityDefinitionV1(activity),
        `${label}.activities[${activityIndex}]`,
      ))
      if (activityIds.has(activity.id)) errors.push(`${label}.activities[${activityIndex}].id is duplicated in the package`)
      activityIds.add(activity.id)
    }
    for (const [effectIndex, effect] of (definition.effects ?? []).entries()) {
      errors.push(...errorFromValidator(
        () => validateDnd5eEffectDefinitionV1(effect),
        `${label}.effects[${effectIndex}]`,
      ))
      if (effectIds.has(effect.id)) errors.push(`${label}.effects[${effectIndex}].id is duplicated in the package`)
      effectIds.add(effect.id)
    }
    for (const [advancementIndex, advancement] of (definition.advancements ?? []).entries()) {
      errors.push(...errorFromValidator(
        () => validateDnd5eAdvancementDefinitionV1(advancement),
        `${label}.advancements[${advancementIndex}]`,
      ))
      if (advancementIds.has(advancement.id)) errors.push(`${label}.advancements[${advancementIndex}].id is duplicated in the package`)
      advancementIds.add(advancement.id)
    }
  }

  const assetIds = new Set<string>()
  let assetBytes = 0
  for (const [index, asset] of bundle.assets.entries()) {
    try {
      const validated = validateDnd5ePluginImageAsset(asset)
      assetBytes += validated.byteLength
      if (assetIds.has(asset.id)) errors.push(`assets[${index}].id is duplicated`)
      assetIds.add(asset.id)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `assets[${index}] is invalid`)
    }
  }
  if (assetBytes > DND5E_PLUGIN_IMAGE_ASSETS_MAX_TOTAL_BYTES) errors.push('Unified content image assets exceed the total size limit')

  const legacyDraft = legacyDraftFromBundle(bundle)
  const hasLegacyPayload = bundle.definitions.some((definition) => definition.kind !== 'monster-action')
  if (hasLegacyPayload) errors.push(...validateDnd5eCustomRulesPluginDraft(legacyDraft))
  for (const definition of bundle.definitions.filter((entry) => entry.kind === 'monster-action')) {
    const payload = definition.payload as Dnd5eMonsterActionContentPayloadV1
    if (!record(payload) || !CONTENT_REFERENCE_ID.test(payload.monsterId) || !CONTENT_ID.test(payload.actionId) ||
      !['action', 'bonus-action', 'reaction', 'legendary-action', 'lair-action'].includes(payload.section)) {
      errors.push(`monster-action ${definition.id} payload is invalid`)
    }
    if (!bundle.definitions.some((entry) => entry.kind === 'monster' &&
      (entry.id === payload.monsterId || entry.payload.id === payload.monsterId))) {
      errors.push(`monster-action ${definition.id} must reference a monster in the same bundle`)
    }
  }
  return errors
}

export function parseDnd5eUnifiedContentBundleV1(source: string | ArrayBuffer): Dnd5eUnifiedContentBundleV1 | undefined {
  const text = typeof source === 'string' ? source : new TextDecoder('utf-8', { fatal: true }).decode(source)
  if (!text.trimStart().startsWith('{')) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return undefined
  }
  if (!record(parsed) || parsed.format !== DND5E_UNIFIED_CONTENT_FORMAT) return undefined
  const errors = validateDnd5eUnifiedContentBundleV1(parsed)
  if (errors.length) throw new Error(errors.join('\n'))
  return structuredClone(parsed as unknown as Dnd5eUnifiedContentBundleV1)
}

export function encodeDnd5eUnifiedContentBundleV1(bundle: Dnd5eUnifiedContentBundleV1): ArrayBuffer {
  const errors = validateDnd5eUnifiedContentBundleV1(bundle)
  if (errors.length) throw new Error(errors.join('\n'))
  return new TextEncoder().encode(`${JSON.stringify(bundle, null, 2)}\n`).buffer
}

export function dnd5eUnifiedContentSummaryV1(
  bundle: Dnd5eUnifiedContentBundleV1,
): Dnd5eUnifiedContentSummaryV1 {
  const count = (kind: ContentDefinitionKind) => bundle.definitions.filter((entry) => entry.kind === kind).length
  return {
    races: count('race'),
    backgrounds: count('background'),
    features: count('feature'),
    feats: count('feat'),
    spells: count('spell'),
    items: count('item'),
    abilityGenerationMethods: count('ability-generation'),
    headlessActions: 0,
    subclasses: count('subclass'),
    classes: count('class'),
    monsters: count('monster'),
    imageAssets: bundle.assets.length,
    imageAssetBytes: bundle.assets.reduce((total, asset) => total + validateDnd5ePluginImageAsset(asset).byteLength, 0),
  }
}

/** Adapts the native format to current registries while older V2 packages remain supported. */
export function dnd5eRulesPluginFromUnifiedContentBundleV1(
  bundle: Dnd5eUnifiedContentBundleV1,
): Dnd5eRulesPlugin {
  const errors = validateDnd5eUnifiedContentBundleV1(bundle)
  if (errors.length) throw new Error(errors.join('\n'))
  return {
    manifest: structuredClone(bundle.manifest),
    setup(api) {
      const disposers: Array<() => void> = []
      try {
        const activities = bundle.definitions.flatMap((definition) => definition.activities ?? [])
        disposers.push(registerDnd5eActivityPackage({
          packageId: bundle.manifest.id,
          packageVersion: bundle.manifest.version,
          activities,
        }).dispose)
        disposers.push(registerContentDefinitionPackage({
          packageId: bundle.manifest.id,
          packageVersion: bundle.manifest.version,
          definitions: bundle.definitions,
        }).dispose)
        for (const asset of bundle.assets) disposers.push(registerDnd5ePluginImageAsset(bundle.manifest.id, asset).dispose)
        for (const definition of bundle.definitions) {
          if (definition.kind === 'race') api.registerRace(structuredClone(definition.payload))
          else if (definition.kind === 'background') api.registerBackground(structuredClone(definition.payload))
          else if (definition.kind === 'feature') api.registerFeature(legacyFeaturePayload(definition))
          else if (definition.kind === 'feat') api.registerFeat(legacyFeatPayload(definition))
          else if (definition.kind === 'spell') api.registerSpell(legacySpellPayload(definition))
          else if (definition.kind === 'item') api.registerItem(structuredClone(definition.payload))
          else if (definition.kind === 'ability-generation') api.registerAbilityGenerationMethod(structuredClone(definition.payload))
          else if (definition.kind === 'class') api.registerDeclarativeClass(structuredClone(definition.payload))
          else if (definition.kind === 'subclass') api.registerDeclarativeSubclass(structuredClone(definition.payload))
          else if (definition.kind === 'monster') api.registerMonster(structuredClone(definition.payload))
        }
      } catch (error) {
        for (const dispose of disposers.reverse()) dispose()
        throw error
      }
      return () => {
        for (const dispose of disposers.reverse()) dispose()
      }
    },
  }
}
