import {
  validateDnd5eCustomRulesPluginDraft,
  type Dnd5eCustomHeadlessActionDraft,
  type Dnd5eCustomRulesPluginDraft,
} from './customRulesPlugin'
import {
  dnd5eHeadlessActionFromDeclarativeDraft,
} from './declarativePluginPackage'
import {
  declarativeSubclassCompatibilityReportV1,
  type DeclarativeSubclassDefinitionV1,
} from './declarativeSubclassAbility'
import {
  declarativeClassCompatibilityReportV1,
  type DeclarativeClassDefinitionV1,
} from './declarativeClass'
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
  DND5E_ROOM_EPHEMERAL_IMAGE_ASSETS_MAX_TOTAL_BYTES,
  registerDnd5ePluginImageAsset,
  validateDnd5ePluginImageAsset,
  type Dnd5ePluginImageAssetDefinition,
} from './pluginAssets'
import type { Dnd5eMonsterStatBlock } from './monsters'
import {
  automationCapabilityFromLegacyStatus,
  type AutomationCapability,
} from '../../domain/automation/automationCapability'
import { resolveDnd5ePluginKind } from '../../domain/plugins/pluginKind'
import { dnd5eContentPackageActivityProjectionV1 } from './activities/dnd5eContentPackageActivityProjection'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'
import { dnd5eContentDefinitionsFromPackageV2 } from './activities/dnd5eContentDefinitionProjection'
import { registerContentDefinitionPackage } from '../../domain/content/contentDefinitionRegistry'

export const DND5E_CONTENT_PACKAGE_FORMAT = 'dndstars5e-content' as const
export const DND5E_CONTENT_PACKAGE_SCHEMA_VERSION = 2 as const
export const DND5E_ROOM_RUNTIME_PROJECTION = 'room-runtime-mechanics' as const
export const DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER = '房间临时机械数据；原始规则正文未传输。' as const
export const DND5E_ROOM_EPHEMERAL_PACKAGE_MAX_BYTES = 40 * 1024 * 1024

export interface Dnd5eContentPackageProvenanceV2 {
  edition: '2014'
  contentMode: 'incremental'
  sourceTitle: string
  /** Optional publisher/exporter fingerprint. It is not a substitute for a license declaration. */
  sourceFingerprint?: string
  /** Present only on the mechanically sufficient, prose-reduced package sent to a live room. */
  projection?: typeof DND5E_ROOM_RUNTIME_PROJECTION
}

export interface Dnd5eContentPackageContributionsV2 {
  races: readonly Dnd5ePluginRaceDefinition[]
  backgrounds: readonly Dnd5ePluginBackgroundDefinition[]
  features: readonly Dnd5ePluginFeatureDefinition[]
  feats: readonly Dnd5ePluginFeatDefinition[]
  spells: readonly Dnd5ePluginSpellDefinition[]
  items: readonly Dnd5ePluginItemDefinition[]
  abilityGenerationMethods: readonly Dnd5ePluginAbilityGenerationDefinition[]
  headlessActions: readonly Dnd5eCustomHeadlessActionDraft[]
  subclasses: readonly DeclarativeSubclassDefinitionV1[]
  /** Optional for backward compatibility with V2 packages created before class authoring was exposed. */
  classes?: readonly DeclarativeClassDefinitionV1[]
  monsters: readonly Dnd5eMonsterStatBlock[]
}

export interface Dnd5eContentPackageV2 {
  format: typeof DND5E_CONTENT_PACKAGE_FORMAT
  schemaVersion: typeof DND5E_CONTENT_PACKAGE_SCHEMA_VERSION
  manifest: Dnd5eRulesPluginManifest
  provenance: Dnd5eContentPackageProvenanceV2
  assets: readonly Dnd5ePluginImageAssetDefinition[]
  content: Dnd5eContentPackageContributionsV2
}

/**
 * Builds the workshop's pure-data V2 package. Keeping this at the package
 * boundary means uploaded image assets receive the same validation and
 * runtime registration path as directory imports and AI-created packages.
 */
export function buildDnd5eCustomRulesContentPackageV2(
  draft: Dnd5eCustomRulesPluginDraft,
  assets: readonly Dnd5ePluginImageAssetDefinition[] = [],
): string {
  const errors = validateDnd5eCustomRulesPluginDraft(draft)
  if (errors.length > 0) throw new Error(errors.join('\n'))
  const value: Dnd5eContentPackageV2 = {
    format: DND5E_CONTENT_PACKAGE_FORMAT,
    schemaVersion: DND5E_CONTENT_PACKAGE_SCHEMA_VERSION,
    manifest: {
      ...structuredClone(draft.manifest),
      apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1',
      pluginKind: 'content-package',
    },
    provenance: {
      edition: '2014',
      contentMode: 'incremental',
      sourceTitle: draft.manifest.name.trim(),
    },
    assets: structuredClone(assets as Dnd5ePluginImageAssetDefinition[]),
    content: {
      races: structuredClone(draft.races),
      backgrounds: structuredClone(draft.backgrounds),
      features: structuredClone(draft.features),
      feats: structuredClone(draft.feats ?? []),
      spells: structuredClone(draft.spells),
      items: structuredClone(draft.items),
      abilityGenerationMethods: structuredClone(draft.abilityGenerationMethods),
      headlessActions: structuredClone(draft.headlessActions ?? []),
      subclasses: structuredClone(draft.subclasses ?? []),
      classes: structuredClone(draft.classes ?? []),
      monsters: structuredClone(draft.monsters ?? []),
    },
  }
  const encoded = new TextEncoder().encode(`${JSON.stringify(value)}\n`)
  const validated = parseDnd5eContentPackageV2(encoded.buffer)
  if (!validated) throw new Error('无法生成 D&D 5E V2 内容包。')
  return `${JSON.stringify(validated, null, 2)}\n`
}

export interface Dnd5eContentPackageSummaryV2 {
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

export type Dnd5eContentAutomationStatusV2 = 'full' | 'partial' | 'manual' | 'reference-only'

export type Dnd5eContentAutomationCategoryV2 =
  | 'race'
  | 'background'
  | 'feature'
  | 'feat'
  | 'spell'
  | 'item'
  | 'ability-generation'
  | 'class-feature'
  | 'subclass-ability'
  | 'monster-mechanic'

export interface Dnd5eContentAutomationCoverageEntryV2 {
  /** Stable package-local identifier only; source names and rules text are deliberately omitted. */
  id: string
  category: Dnd5eContentAutomationCategoryV2
  status: Dnd5eContentAutomationStatusV2
  /** Machine-readable execution boundary used by UI, diagnostics and release checks. */
  capability: AutomationCapability
  /** Host-authored compatibility notes only. Never copied from source content. */
  reasons?: readonly string[]
}

export interface Dnd5eContentAutomationCoverageCountsV2 {
  total: number
  full: number
  partial: number
  manual: number
  referenceOnly: number
}

export interface Dnd5eContentAutomationCoverageReportV2 {
  schemaVersion: 1
  package: {
    id: string
    version: string
    distributionPolicy: Dnd5eRulesPluginManifest['distributionPolicy']
    integrity?: string
  }
  privacy: {
    scope: 'device-local-preview'
    includesSourceText: false
    includesImageData: false
    includesHumanReadableContentNames: false
  }
  totals: Dnd5eContentAutomationCoverageCountsV2
  categories: Partial<Record<Dnd5eContentAutomationCategoryV2, Dnd5eContentAutomationCoverageCountsV2>>
  entries: readonly Dnd5eContentAutomationCoverageEntryV2[]
  bindings: {
    declaredHeadlessActions: number
    referencedHeadlessActions: number
    unreferencedHeadlessActions: number
  }
  activityMigration: {
    total: number
    adapted: number
    legacyFallback: number
    dmAdjudication: number
    displayOnly: number
  }
  visuals: {
    declaredImageAssets: number
    referencedImageAssets: number
    missingImageAssetReferences: number
    unusedImageAssets: number
    embeddedMonsterImages: number
  }
}

const ROOT_KEYS = new Set(['format', 'schemaVersion', 'manifest', 'provenance', 'assets', 'content'])
const CONTENT_KEYS = new Set([
  'races', 'backgrounds', 'features', 'feats', 'spells', 'items',
  'abilityGenerationMethods', 'headlessActions', 'subclasses', 'classes', 'monsters',
])
const CONTENT_LIMITS: Record<keyof Dnd5eContentPackageContributionsV2, number> = {
  races: 128,
  backgrounds: 128,
  features: 512,
  feats: 256,
  spells: 500,
  items: 500,
  abilityGenerationMethods: 32,
  headlessActions: 512,
  subclasses: 64,
  classes: 32,
  monsters: 128,
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
}

function assertKnownKeys(value: Record<string, unknown>, allowed: Set<string>, label: string): void {
  const unknown = Object.keys(value).find((key) => !allowed.has(key))
  if (unknown) throw new Error(`${label} contains unsupported field: ${unknown}`)
}

function contentArray(
  content: Record<string, unknown>,
  key: keyof Dnd5eContentPackageContributionsV2,
): unknown[] {
  const value = content[key] ?? []
  if (!Array.isArray(value) || value.length > CONTENT_LIMITS[key]) {
    throw new Error(`Invalid content package collection: ${key}`)
  }
  if (value.some((entry) => !record(entry))) throw new Error(`Invalid content package entry: ${key}`)
  return value
}

export function dnd5eContentPackageSummaryV2(
  value: Dnd5eContentPackageV2,
): Dnd5eContentPackageSummaryV2 {
  const imageAssetBytes = value.assets.reduce(
    (total, asset) => total + validateDnd5ePluginImageAsset(asset).byteLength,
    0,
  )
  return {
    races: value.content.races.length,
    backgrounds: value.content.backgrounds.length,
    features: value.content.features.length,
    feats: value.content.feats.length,
    spells: value.content.spells.length,
    items: value.content.items.length,
    abilityGenerationMethods: value.content.abilityGenerationMethods.length,
    headlessActions: value.content.headlessActions.length,
    subclasses: value.content.subclasses.length,
    classes: value.content.classes?.length ?? 0,
    monsters: value.content.monsters.length,
    imageAssets: value.assets.length,
    imageAssetBytes,
  }
}

function automationCounts(
  entries: readonly Dnd5eContentAutomationCoverageEntryV2[],
): Dnd5eContentAutomationCoverageCountsV2 {
  return {
    total: entries.length,
    full: entries.filter((entry) => entry.status === 'full').length,
    partial: entries.filter((entry) => entry.status === 'partial').length,
    manual: entries.filter((entry) => entry.status === 'manual').length,
    referenceOnly: entries.filter((entry) => entry.status === 'reference-only').length,
  }
}

/**
 * Produces a privacy-safe automation inventory for a validated V2 package.
 * It contains counts, local IDs, and Host-authored compatibility notes only.
 * Source prose, human-readable content names, and image bytes are never copied.
 */
export function dnd5eContentPackageAutomationCoverageV2(
  value: Dnd5eContentPackageV2,
  integrity?: string,
): Dnd5eContentAutomationCoverageReportV2 {
  const entries: Dnd5eContentAutomationCoverageEntryV2[] = []
  const activityProjection = dnd5eContentPackageActivityProjectionV1(value)
  const projectedActivityById = new Map(activityProjection.activities.map((activity) => [activity.id, activity]))
  const projectedAutomation = (
    sourceKind: 'feature' | 'feat' | 'spell' | 'item',
    sourceId: string,
  ): { status: Dnd5eContentAutomationStatusV2; reasons?: readonly string[] } | undefined => {
    const projectedEntries = activityProjection.entries.filter((entry) =>
      entry.sourceKind === sourceKind && entry.sourceId === sourceId)
    if (!projectedEntries.length) return undefined
    const activities = projectedEntries.flatMap((entry) => {
      const activity = projectedActivityById.get(entry.activityId)
      return activity ? [activity] : []
    })
    if (!activities.length) return undefined
    const levels = activities.map((activity) => activity.automation.level)
    const reasons = [
      ...projectedEntries.flatMap((entry) => entry.issues),
      ...activities.flatMap((activity) => activity.automation.limitations),
    ].filter((reason, index, all) => reason && all.indexOf(reason) === index)
    const status: Dnd5eContentAutomationStatusV2 = levels.every((level) => level === 'full')
      ? 'full'
      : levels.every((level) => level === 'display-only')
        ? 'reference-only'
        : levels.every((level) => level === 'dm-adjudication' || level === 'unsupported')
          ? 'manual'
          : 'partial'
    return { status, ...(reasons.length ? { reasons } : {}) }
  }
  const add = (
    category: Dnd5eContentAutomationCategoryV2,
    id: string,
    status: Dnd5eContentAutomationStatusV2,
    reasons?: readonly string[],
  ) => entries.push({
    category,
    id,
    status,
    capability: automationCapabilityFromLegacyStatus(status, reasons),
    ...(reasons?.length ? { reasons: [...reasons] } : {}),
  })

  for (const race of value.content.races) {
    add('race', race.id, race.automation ?? 'full', race.automationReasons)
  }
  for (const background of value.content.backgrounds) add('background', background.id, 'full')
  for (const feature of value.content.features) {
    const projected = projectedAutomation('feature', feature.id)
    add('feature', feature.id, projected?.status ?? feature.automation, projected?.reasons)
  }
  for (const feat of value.content.feats) {
    const projected = projectedAutomation('feat', feat.id)
    add('feat', feat.id, projected?.status ?? feat.automation, projected?.reasons)
  }
  for (const spell of value.content.spells) {
    const projected = projectedAutomation('spell', spell.id)
    add('spell', spell.id, projected?.status ?? (spell.automation?.mode === 'headless-action' ? 'full' : 'reference-only'), projected?.reasons)
  }
  for (const item of value.content.items) {
    const status: Dnd5eContentAutomationStatusV2 = item.magicItem?.automation === 'dm-adjudication'
      ? 'manual'
      : item.magicItem?.automation === 'headless' || item.use || item.headlessEffects?.length || item.equipment
        ? 'full'
        : 'reference-only'
    const projected = projectedAutomation('item', item.id)
    add('item', item.id, projected?.status ?? status, projected?.reasons)
  }
  for (const method of value.content.abilityGenerationMethods) add('ability-generation', method.id, 'full')
  for (const definition of value.content.classes ?? []) {
    const compatibilityByFeatureId = new Map(
      declarativeClassCompatibilityReportV1([definition]).features.map((entry) => [entry.featureId, entry]),
    )
    for (const feature of definition.features) {
      const compatibility = compatibilityByFeatureId.get(feature.id)
      if (!compatibility) continue
      add(
        'class-feature',
        `${definition.id}:${feature.id}`,
        compatibility.effective,
        compatibility.reasons,
      )
    }
  }
  for (const subclass of value.content.subclasses) {
    const compatibilityByAbilityId = new Map(
      declarativeSubclassCompatibilityReportV1([subclass]).abilities.map((entry) => [entry.abilityId, entry]),
    )
    for (const ability of subclass.abilities) {
      const compatibility = compatibilityByAbilityId.get(ability.id)
      if (!compatibility) continue
      add(
        'subclass-ability',
        `${subclass.id}:${ability.id}`,
        compatibility.effective,
        compatibility.reasons,
      )
    }
  }
  for (const monster of value.content.monsters) {
    const declaredMonsterMechanics = monster.headlessMechanics ?? []
    const mechanicStatus = (automation: (typeof declaredMonsterMechanics)[number]['automation']) =>
      automation === 'headless' ? 'full' as const : automation
    const mechanicByTraitName = new Map(declaredMonsterMechanics.map((mechanic) => [
      mechanic.name.trim().toLocaleLowerCase('en-US'),
      mechanic,
    ]))
    const mechanicsRepresentedByTraits = new Set<string>()
    const monsterMechanics = [
      ...monster.traits.map((trait, index) => {
        const linkedMechanic = mechanicByTraitName.get(trait.name.trim().toLocaleLowerCase('en-US'))
        if (linkedMechanic) mechanicsRepresentedByTraits.add(linkedMechanic.id)
        return {
          id: `${monster.id}:trait:${index}`,
          status: trait.automation === 'headless'
            ? 'full' as const
            : linkedMechanic ? mechanicStatus(linkedMechanic.automation) : 'manual' as const,
        }
      }),
      ...[
        ...monster.actions,
        ...(monster.bonusActions ?? []),
        ...(monster.reactions ?? []),
        ...(monster.legendaryActions ?? []),
        ...(monster.lairActions ?? []),
      ].map((action) => ({
        id: `${monster.id}:action:${action.id}`,
        status: action.automation === 'headless' ? 'full' as const : 'manual' as const,
      })),
      ...(monster.spellcasting
        ? [{
            id: `${monster.id}:spellcasting`,
            status: monster.spellcasting.automation === 'headless' ? 'full' as const : 'manual' as const,
          }]
        : []),
      ...declaredMonsterMechanics
        .filter((mechanic) => !mechanicsRepresentedByTraits.has(mechanic.id))
        .map((mechanic) => ({
          id: `${monster.id}:mechanic:${mechanic.id}`,
          status: mechanicStatus(mechanic.automation),
        })),
    ]
    if (monsterMechanics.length === 0) add('monster-mechanic', monster.id, 'reference-only')
    for (const mechanic of monsterMechanics) add('monster-mechanic', mechanic.id, mechanic.status)
  }

  const categoryNames = [...new Set(entries.map((entry) => entry.category))]
  const categories = Object.fromEntries(categoryNames.map((category) => [
    category,
    automationCounts(entries.filter((entry) => entry.category === category)),
  ])) as Dnd5eContentAutomationCoverageReportV2['categories']

  const declaredHeadlessActionIds = new Set(value.content.headlessActions.map((action) => action.id))
  const referencedHeadlessActionIds = new Set([
    ...value.content.features.flatMap((feature) => feature.action ? [feature.action.id] : []),
    ...value.content.feats.flatMap((feat) => feat.action ? [feat.action.id] : []),
    ...value.content.spells.flatMap((spell) =>
      spell.automation?.mode === 'headless-action' ? [spell.automation.actionId] : []),
  ])
  const declaredImageAssetIds = new Set(value.assets.map((asset) => asset.id))
  const referencedImageAssetIds = new Set([
    ...value.content.races.flatMap((race) => race.iconAssetId ? [race.iconAssetId] : []),
    ...value.content.features.flatMap((feature) => feature.iconAssetId ? [feature.iconAssetId] : []),
    ...value.content.feats.flatMap((feat) => feat.iconAssetId ? [feat.iconAssetId] : []),
    ...value.content.spells.flatMap((spell) => spell.iconAssetId ? [spell.iconAssetId] : []),
    ...value.content.items.flatMap((item) => item.iconAssetId ? [item.iconAssetId] : []),
  ])
  const activityMigration = activityProjection.counts

  return {
    schemaVersion: 1,
    package: {
      id: value.manifest.id,
      version: value.manifest.version,
      distributionPolicy: value.manifest.distributionPolicy ?? 'room-distributable',
      ...(integrity ? { integrity } : {}),
    },
    privacy: {
      scope: 'device-local-preview',
      includesSourceText: false,
      includesImageData: false,
      includesHumanReadableContentNames: false,
    },
    totals: automationCounts(entries),
    categories,
    entries,
    bindings: {
      declaredHeadlessActions: declaredHeadlessActionIds.size,
      referencedHeadlessActions: referencedHeadlessActionIds.size,
      unreferencedHeadlessActions: [...declaredHeadlessActionIds]
        .filter((actionId) => !referencedHeadlessActionIds.has(actionId)).length,
    },
    activityMigration,
    visuals: {
      declaredImageAssets: declaredImageAssetIds.size,
      referencedImageAssets: referencedImageAssetIds.size,
      missingImageAssetReferences: [...referencedImageAssetIds]
        .filter((assetId) => !declaredImageAssetIds.has(assetId)).length,
      unusedImageAssets: [...declaredImageAssetIds]
        .filter((assetId) => !referencedImageAssetIds.has(assetId)).length,
      embeddedMonsterImages: value.content.monsters.reduce(
        (total, monster) => total + Number(!!monster.tokenPortrait) + Number(!!monster.initiativePortrait),
        0,
      ),
    },
  }
}

export function parseDnd5eContentPackageV2(bytes: ArrayBuffer): Dnd5eContentPackageV2 | undefined {
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  if (!source.trimStart().startsWith('{')) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch {
    return undefined
  }
  if (!record(parsed) || parsed.format !== DND5E_CONTENT_PACKAGE_FORMAT) return undefined
  assertKnownKeys(parsed, ROOT_KEYS, 'Content package')
  if (parsed.schemaVersion !== DND5E_CONTENT_PACKAGE_SCHEMA_VERSION) {
    throw new Error(`Unsupported D&D 5e content package schema: ${String(parsed.schemaVersion)}`)
  }
  if (!record(parsed.manifest)) throw new Error('Invalid D&D 5e content package manifest')
  validateDnd5eRulesPluginManifest(parsed.manifest as unknown as Dnd5eRulesPluginManifest)
  if (parsed.manifest.apiVersion !== 2) throw new Error('D&D 5e content packages require plugin API v2')
  resolveDnd5ePluginKind(
    parsed.manifest.pluginKind as Dnd5eRulesPluginManifest['pluginKind'],
    'content-v2',
  )

  if (!record(parsed.provenance)) throw new Error('Invalid D&D 5e content package provenance')
  assertKnownKeys(
    parsed.provenance,
    new Set(['edition', 'contentMode', 'sourceTitle', 'sourceFingerprint', 'projection']),
    'Provenance',
  )
  if (
    parsed.provenance.edition !== '2014' ||
    parsed.provenance.contentMode !== 'incremental' ||
    typeof parsed.provenance.sourceTitle !== 'string' ||
    !parsed.provenance.sourceTitle.trim() ||
    parsed.provenance.sourceTitle.length > 240 ||
    (parsed.provenance.sourceFingerprint != null && (
      typeof parsed.provenance.sourceFingerprint !== 'string' ||
      parsed.provenance.sourceFingerprint.length > 240
    )) ||
    (parsed.provenance.projection != null &&
      parsed.provenance.projection !== DND5E_ROOM_RUNTIME_PROJECTION)
  ) throw new Error('Invalid D&D 5e content package provenance')

  const assets = parsed.assets ?? []
  const roomEphemeral = parsed.manifest.distributionPolicy === 'room-ephemeral'
  const maximumAssetCount = roomEphemeral ? 1024 : 128
  const maximumAssetBytes = roomEphemeral
    ? DND5E_ROOM_EPHEMERAL_IMAGE_ASSETS_MAX_TOTAL_BYTES
    : DND5E_PLUGIN_IMAGE_ASSETS_MAX_TOTAL_BYTES
  if (!Array.isArray(assets) || assets.length > maximumAssetCount || assets.some((asset) => !record(asset))) {
    throw new Error('Invalid D&D 5e content package assets')
  }
  const assetIds = new Set<string>()
  let imageAssetBytes = 0
  for (const asset of assets as unknown as Dnd5ePluginImageAssetDefinition[]) {
    if (assetIds.has(asset.id)) throw new Error(`Duplicate plugin image asset: ${asset.id}`)
    assetIds.add(asset.id)
    imageAssetBytes += validateDnd5ePluginImageAsset(asset).byteLength
  }
  if (imageAssetBytes > maximumAssetBytes) {
    throw new Error('Plugin image assets exceed the package limit')
  }

  if (!record(parsed.content)) throw new Error('Invalid D&D 5e content package contributions')
  assertKnownKeys(parsed.content, CONTENT_KEYS, 'Content package contributions')
  const content = {
    races: contentArray(parsed.content, 'races') as unknown as Dnd5ePluginRaceDefinition[],
    backgrounds: contentArray(parsed.content, 'backgrounds') as unknown as Dnd5ePluginBackgroundDefinition[],
    features: contentArray(parsed.content, 'features') as unknown as Dnd5ePluginFeatureDefinition[],
    feats: contentArray(parsed.content, 'feats') as unknown as Dnd5ePluginFeatDefinition[],
    spells: contentArray(parsed.content, 'spells') as unknown as Dnd5ePluginSpellDefinition[],
    items: contentArray(parsed.content, 'items') as unknown as Dnd5ePluginItemDefinition[],
    abilityGenerationMethods: contentArray(parsed.content, 'abilityGenerationMethods') as unknown as Dnd5ePluginAbilityGenerationDefinition[],
    headlessActions: contentArray(parsed.content, 'headlessActions') as unknown as Dnd5eCustomHeadlessActionDraft[],
    subclasses: contentArray(parsed.content, 'subclasses') as unknown as DeclarativeSubclassDefinitionV1[],
    classes: contentArray(parsed.content, 'classes') as unknown as DeclarativeClassDefinitionV1[],
    monsters: contentArray(parsed.content, 'monsters') as unknown as Dnd5eMonsterStatBlock[],
  } satisfies Dnd5eContentPackageContributionsV2

  const draft: Dnd5eCustomRulesPluginDraft = {
    manifest: parsed.manifest as unknown as Dnd5eRulesPluginManifest,
    races: [...content.races],
    backgrounds: [...content.backgrounds],
    features: [...content.features],
    feats: [...content.feats],
    spells: [...content.spells],
    items: [...content.items],
    abilityGenerationMethods: [...content.abilityGenerationMethods],
    headlessActions: [...content.headlessActions],
    subclasses: [...content.subclasses],
    classes: [...content.classes],
    monsters: [...content.monsters],
  }
  let errors: string[]
  try {
    errors = validateDnd5eCustomRulesPluginDraft(draft)
  } catch (error) {
    throw new Error(
      `Invalid D&D 5e content package: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
  if (errors.length > 0) throw new Error(errors.join('\n'))

  return {
    format: DND5E_CONTENT_PACKAGE_FORMAT,
    schemaVersion: DND5E_CONTENT_PACKAGE_SCHEMA_VERSION,
    manifest: { ...structuredClone(draft.manifest), pluginKind: 'content-package' },
    provenance: {
      edition: '2014',
      contentMode: 'incremental',
      sourceTitle: parsed.provenance.sourceTitle.trim(),
      ...(parsed.provenance.sourceFingerprint
        ? { sourceFingerprint: parsed.provenance.sourceFingerprint }
        : {}),
      ...(parsed.provenance.projection === DND5E_ROOM_RUNTIME_PROJECTION
        ? { projection: DND5E_ROOM_RUNTIME_PROJECTION }
        : {}),
    },
    assets: structuredClone(assets as unknown as Dnd5ePluginImageAssetDefinition[]),
    content: structuredClone(content),
  }
}

const ROOM_RUNTIME_PROSE_KEYS = new Set([
  'description',
  'summary',
  'sourceLabel',
  'rulesText',
  'higherLevels',
  'materialText',
  'reactionTrigger',
  'text',
  'prompt',
  'adjudication',
  'note',
  'automationReasons',
  'reasons',
])

function replaceRoomRuntimeProse(value: unknown): void {
  if (Array.isArray(value)) {
    for (const entry of value) replaceRoomRuntimeProse(entry)
    return
  }
  if (!record(value)) return
  for (const [key, entry] of Object.entries(value)) {
    if (ROOM_RUNTIME_PROSE_KEYS.has(key) && typeof entry === 'string') {
      value[key] = DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER
    } else if (ROOM_RUNTIME_PROSE_KEYS.has(key) && Array.isArray(entry)) {
      value[key] = entry.map((item) =>
        typeof item === 'string' ? DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER : item)
    } else {
      replaceRoomRuntimeProse(entry)
    }
  }
}

/**
 * Builds the only package form that may use `room-ephemeral`.
 * Names, structured mechanics, stable IDs, and caller-owned images remain usable;
 * source prose and local provenance are not sent to the room service.
 */
export function dnd5eRoomRuntimeProjectionV2(
  value: Dnd5eContentPackageV2,
): Dnd5eContentPackageV2 {
  if (value.manifest.distributionPolicy !== 'room-ephemeral') {
    throw new Error('Only room-ephemeral content packages can be projected for a room')
  }
  const projected = structuredClone(value)
  projected.manifest.description = DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER
  projected.provenance = {
    edition: '2014',
    contentMode: 'incremental',
    sourceTitle: DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER,
    projection: DND5E_ROOM_RUNTIME_PROJECTION,
  }
  replaceRoomRuntimeProse(projected.content)
  const bytes = new TextEncoder().encode(`${JSON.stringify(projected)}\n`)
  const validated = parseDnd5eContentPackageV2(bytes.buffer)
  if (!validated) throw new Error('Failed to build the room runtime content package')
  return validated
}

export function encodeDnd5eContentPackageV2(value: Dnd5eContentPackageV2): ArrayBuffer {
  return new TextEncoder().encode(`${JSON.stringify(value)}\n`).buffer
}

export function dnd5eRoomRuntimeProjectionBytesV2(bytes: ArrayBuffer): ArrayBuffer {
  const parsed = parseDnd5eContentPackageV2(bytes)
  if (!parsed) throw new Error('The selected file is not a V2 content package')
  const projected = encodeDnd5eContentPackageV2(dnd5eRoomRuntimeProjectionV2(parsed))
  if (projected.byteLength > DND5E_ROOM_EPHEMERAL_PACKAGE_MAX_BYTES) {
    throw new Error('房间临时运行包超过 40 MiB；请减少图片数量或将图片压缩为 WebP')
  }
  return projected
}

export function dnd5eRulesPluginFromContentPackageV2(
  value: Dnd5eContentPackageV2,
): Dnd5eRulesPlugin {
  return {
    manifest: structuredClone(value.manifest),
    setup(api) {
      const assetDisposers: Array<() => void> = []
      let activityDisposer: (() => void) | undefined
      let contentDefinitionDisposer: (() => void) | undefined
      try {
        const activityProjection = dnd5eContentPackageActivityProjectionV1(value)
        activityDisposer = registerDnd5eActivityPackage({
          packageId: activityProjection.packageId,
          packageVersion: activityProjection.packageVersion,
          activities: activityProjection.activities,
        }).dispose
        contentDefinitionDisposer = registerContentDefinitionPackage({
          packageId: value.manifest.id,
          packageVersion: value.manifest.version,
          definitions: dnd5eContentDefinitionsFromPackageV2(value),
        }).dispose
        for (const asset of value.assets) {
          assetDisposers.push(registerDnd5ePluginImageAsset(value.manifest.id, asset).dispose)
        }
        for (const action of value.content.headlessActions) {
          api.registerHeadlessAction(dnd5eHeadlessActionFromDeclarativeDraft(action))
        }
        for (const race of value.content.races) api.registerRace(structuredClone(race))
        for (const background of value.content.backgrounds) api.registerBackground(structuredClone(background))
        for (const feature of value.content.features) api.registerFeature(structuredClone(feature))
        for (const feat of value.content.feats) api.registerFeat(structuredClone(feat))
        for (const spell of value.content.spells) api.registerSpell(structuredClone(spell))
        for (const item of value.content.items) api.registerItem(structuredClone(item))
        for (const method of value.content.abilityGenerationMethods) {
          api.registerAbilityGenerationMethod(structuredClone(method))
        }
        for (const definition of value.content.classes ?? []) api.registerDeclarativeClass(structuredClone(definition))
        for (const subclass of value.content.subclasses) api.registerDeclarativeSubclass(structuredClone(subclass))
        for (const monster of value.content.monsters) api.registerMonster(structuredClone(monster))
      } catch (error) {
        contentDefinitionDisposer?.()
        activityDisposer?.()
        for (const dispose of assetDisposers.reverse()) dispose()
        throw error
      }
      return () => {
        contentDefinitionDisposer?.()
        activityDisposer?.()
        for (const dispose of assetDisposers.reverse()) dispose()
      }
    },
  }
}
