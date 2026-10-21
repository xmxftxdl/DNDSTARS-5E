import { SKILLS } from '../../lib/dnd'
import { validDnd5eInherentFeatureLight } from './inherentFeatureLightContract'
import { getDnd5eSrdSpellCatalogEntry } from './spellCatalog'
import type { Dnd5eBuildGrantV1 } from './activities/dnd5eAdvancementContracts'
import { DND5E_BUILD_FIGHTING_STYLES } from './fightingStyleGrants'
import { dnd5eConditionalSpellMaterialProblems } from './conditionalSpellMaterials'
import { ROOM_SPELL_TEXT_KEYS, ROOM_SPELL_TEXT_MAX_LENGTH, roomSpellTextObjects } from '../../../shared/room-spell-text.mjs'
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
import { dnd5eContentDefinitionsFromPackageV2 } from './activities/dnd5eContentDefinitionProjection'
import { registerDnd5eUnifiedContentPackageV1 } from './activities/dnd5eUnifiedContentRegistry'
import { getRegisteredDnd5eActivity } from './activities/dnd5eActivityRegistry'
import { dnd5eActivityAutomationAnalysisV1 } from './plugins/pluginMechanicsRegistry'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { dnd5ePluginFeatureActionFromActivityV1 } from './activities/dnd5eActivityFeatureActionAdapter'
import {
  compileDnd5eActivityHeadlessAction,
  dnd5eActivityManualAdjudicationOperationsV1,
  dnd5eActivityHeadlessCompatibility,
} from './activities/dnd5eActivityHeadlessCompiler'

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
  /** First-class recipes for timing/cost/target/check/effect composition. */
  activities?: readonly Dnd5eActivityDefinitionV1[]
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
      activities: structuredClone(draft.activities ?? []),
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
  'abilityGenerationMethods', 'headlessActions', 'activities', 'subclasses', 'classes', 'monsters',
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
  activities: 1024,
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
    sourceKind: 'feature' | 'feat' | 'spell' | 'item' | 'subclass-ability',
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
    const analyses = activities.map(dnd5eActivityAutomationAnalysisV1)
    const levels = analyses.map((analysis) => analysis.capability.level)
    const reasons = [
      ...projectedEntries.flatMap((entry) => entry.issues),
      ...analyses.flatMap((analysis) => analysis.capability.limitations),
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
  for (const background of value.content.backgrounds) {
    add('background', background.id, 'partial', [
      '技能熟练可在建卡时应用；工具、语言选择与叙事背景特性仍需人物卡或 DM 流程确认',
    ])
  }
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
      const compatibility = compatibilityByFeatureId.get(`${definition.id}:${feature.id}`)
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
      const sourceId = `${subclass.id}:${ability.id}`
      // Explicit Activities replace the legacy recipe for this exact ability.
      // Unbound summaries and passive mechanics retain their compatibility result.
      const hasExplicitActivity = value.content.activities?.some(activity =>
        activity.legacySource?.kind === 'subclass-ability' && activity.legacySource.id === sourceId)
      const projected = hasExplicitActivity ? projectedAutomation('subclass-ability', sourceId) : undefined
      // A passive summary may be implemented by its same-id, same-level build entry.
      // Arbitrary tags, spell/feature references and active recipes are not evidence of execution.
      const build = subclass.advancements?.find(entry => entry.id === ability.id && entry.level === ability.level)
      const supportedGrant = (grant: Dnd5eBuildGrantV1): boolean =>
        grant.kind === 'proficiency' && ['armor', 'weapon', 'tool'].includes(grant.category) ||
        grant.kind === 'tag' && (
          grant.key === 'fighting-style' && DND5E_BUILD_FIGHTING_STYLES.some(style => style === grant.value) ||
          grant.key === 'proficient-melee-weapon-focus' && grant.value === subclass.classId ||
          ['language', 'creature-communication'].includes(grant.key) && grant.value.trim().length > 0
        )
      const buildImplemented = ability.trigger.kind === 'passive' && ability.targeting.kind === 'self' &&
        !ability.mechanic && !ability.cost && !ability.rolls?.length && ability.effects.length === 0 &&
        !(subclass.combatHooks ?? []).some(hook => hook.abilityId === ability.id) && !!build && (
          build.kind === 'build-grant' && build.grants.length > 0 && build.grants.every(supportedGrant) ||
          build.kind === 'select' && build.options.length >= build.count && build.count > 0 &&
          build.options.every(option => option.grants.length > 0 && option.grants.every(supportedGrant))
        )
      const passiveReferences = ability.passiveImplementationReferences
      const passiveGrantImplemented = (grant: Dnd5eBuildGrantV1): boolean => supportedGrant(grant) ||
        grant.kind === 'proficiency' && grant.category === 'saving-throw' && ['str','dex','con','int','wis','cha'].includes(grant.id) ||
        grant.kind === 'proficiency' && grant.category === 'skill' && SKILLS.some(skill => skill.key === grant.id) ||
        grant.kind === 'spell' && grant.mode === 'cantrip' && (
          getDnd5eSrdSpellCatalogEntry(grant.spellId)?.level === 0 ||
          value.content.spells.some(spell => spell.id === grant.spellId && spell.level === 0))
      const passiveReferencesImplemented = !!passiveReferences?.length &&
        ability.trigger.kind === 'passive' && ability.targeting.kind === 'self' &&
        !ability.mechanic && !ability.cost && !ability.rolls?.length && !ability.predicates &&
        !ability.requirements?.length && !ability.choices?.length && !ability.limits && !ability.duration &&
        ability.effects.length === 0 && !ability.activityEffects?.length && !hasExplicitActivity &&
        !(subclass.combatHooks ?? []).some(hook => hook.abilityId === ability.id) &&
        passiveReferences.every(ref => {
          if (ref.kind === 'bound-source-bonus') {
            const activity = value.content.activities?.find(entry => entry.id === ref.id)
            const source = activity?.legacySource
            const sibling = source?.kind === 'subclass-ability' && subclass.abilities.find(entry =>
              source.id === `${subclass.id}:${entry.id}` && entry.id !== ability.id && entry.level <= ability.level)
            if (!activity || !sibling || activity.automation.level !== 'full' ||
              activity.target.kind !== 'creature' || activity.target.count !== 1 ||
              !contentActivityHasExecutableAutomation(activity) ||
              dnd5eActivityAutomationAnalysisV1(activity).capability.level !== 'full') return false
            return activity.effects?.some(effect => effect.modifiers?.some(modifier =>
              modifier.kind === 'on-hit-bonus-damage' && modifier.bindToSelectedTarget === true) && effect.modifiers?.some(modifier =>
              modifier.kind === 'optional-bonus-die' &&
              modifier.boundTargetSource?.classId === subclass.classId &&
              modifier.boundTargetSource.minimumLevel === ability.level) &&
              activity.outcomes.some(outcome => outcome.when.kind === 'always' && outcome.operations.some(operation =>
                operation.kind === 'apply-effect' && operation.effectId === effect.id &&
                operation.target === 'actor'))) === true
          }
          if (ref.kind === 'advancement') {
            const advancement = subclass.advancements?.find(entry => entry.id === ref.id && entry.level === ability.level)
            return !!advancement && (
              advancement.kind === 'build-grant' && advancement.grants.length > 0 && advancement.grants.every(passiveGrantImplemented) ||
              advancement.kind === 'select' && advancement.count > 0 && advancement.options.length >= advancement.count &&
                advancement.options.every(option => option.grants.length > 0 && option.grants.every(passiveGrantImplemented)))
          }
          if (ref.kind === 'choice-group') {
            const group = subclass.choiceGroups?.find(entry => entry.id === ref.id && entry.level === ability.level)
            return !!group && group.options.length >= group.maxSelections && group.options.every(option =>
              subclass.abilities.some(sibling => sibling.id !== ability.id &&
                sibling.predicates?.subclassChoices?.some(choice => choice.groupId === group.id && choice.optionId === option.id) &&
                projectedAutomation('subclass-ability', `${subclass.id}:${sibling.id}`)?.status === 'full'))
          }
          if (ref.kind === 'feature') {
            const feature = value.content.features.find(entry => entry.id === ref.id)
            const modifiers = feature?.staticModifiers
            // The summary delegates to an owned feature, never merely to its claimed full label.
            const owned = !!feature && feature.grantedBySubclass === true &&
              feature.sourceClassId === subclass.classId &&
              feature.sourceSubclassId === `${value.manifest.id}:${subclass.id}` &&
              feature.minimumLevel === ability.level && feature.automation === 'full' &&
              !feature.declarativeAbility
            if (!owned) return false
            const supportedModifiers = !!modifiers && Object.keys(modifiers).length > 0 &&
              Object.keys(modifiers).every(key => key === 'inherentLight'
                ? validDnd5eInherentFeatureLight(modifiers.inherentLight)
                : key === 'skillCheckAbilityBonuses'
                ? !!modifiers.skillCheckAbilityBonuses?.length
                : key === 'standFromProneMovementCostFeet' &&
                  Number.isFinite(modifiers.standFromProneMovementCostFeet) &&
                  modifiers.standFromProneMovementCostFeet! >= 0 && modifiers.standFromProneMovementCostFeet! <= 500)
            const explicitActivities = value.content.activities?.filter(activity =>
              activity.legacySource?.kind === 'feature' && activity.legacySource.id === feature.id) ?? []
            if (explicitActivities.length) return (!modifiers || supportedModifiers) &&
              projectedAutomation('feature', feature.id)?.status === 'full' &&
              explicitActivities.every(contentActivityHasExecutableAutomation)
            return supportedModifiers
          }
          const resource = subclass.resources?.find(entry => entry.id === ref.id)
          if (!resource) return false
          if (ref.kind === 'resource') return (resource.minimumLevel ?? 1) === ability.level
          const recovery = resource.combatStartRecovery
          return !!recovery && recovery.minimumClassLevel?.classId === subclass.classId &&
            recovery.minimumClassLevel.level === ability.level
        })
      const outcomeReferences = ability.activityOutcomeReferences
      const referencedOutcomesImplemented = !!outcomeReferences?.length &&
        ability.trigger.kind === 'passive' && ability.targeting.kind === 'self' &&
        !ability.mechanic && !ability.cost && !ability.rolls?.length && !ability.predicates &&
        !ability.requirements?.length && !ability.choices?.length && !ability.limits && !ability.duration &&
        ability.effects.length === 0 && !ability.activityEffects?.length &&
        !(subclass.combatHooks ?? []).some(hook => hook.abilityId === ability.id) &&
        outcomeReferences.every(ref => {
          const activity = value.content.activities?.find(entry => entry.id === ref.activityId)
          const outcome = activity?.outcomes.find(entry => entry.id === ref.outcomeId)
          const source = activity?.legacySource
          const sibling = source?.kind === 'subclass-ability' && subclass.abilities.find(entry =>
            source.id === `${subclass.id}:${entry.id}` && entry.id !== ability.id && entry.level <= ability.level)
          if (!activity || !outcome?.operations.length || !sibling) return false
          // A link cannot turn an unrelated or earlier-level action into proof of this upgrade.
          const gate = outcome.when.kind === 'predicate' ? outcome.when.predicate : undefined
          return gate?.kind === 'class-level' && gate.classId === subclass.classId &&
            gate.minimum === ability.level && gate.maximum == null &&
            dnd5eActivityAutomationAnalysisV1(activity).capability.level === 'full'
        })
      add(
        'subclass-ability',
        sourceId,
        passiveReferences ? (passiveReferencesImplemented ? 'full' : 'manual') : outcomeReferences ? (referencedOutcomesImplemented ? 'full' : 'manual') : projected?.status ?? (buildImplemented ? 'full' : compatibility.effective),
        passiveReferences ? [passiveReferencesImplemented ? '由关联的构筑选择、资源及先攻恢复规则执行；不创建重复动作' : '被动实现关联缺失、等级不匹配或机制未完整支持'] : outcomeReferences ? [referencedOutcomesImplemented
          ? '由同子职关联 Activity 的同等级条件分支执行；不创建额外动作'
          : '关联 Activity 分支缺失、等级不匹配或尚未完整支持']
          : projected?.reasons ?? (projected ? undefined : buildImplemented ? ['由同标识、同等级的构筑授予执行；无需额外战斗动作'] : compatibility.reasons),
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
    ...value.content.subclasses.flatMap((subclass) =>
      subclass.abilities.flatMap((ability) => ability.iconAssetId ? [ability.iconAssetId] : [])),
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
    activities: contentArray(parsed.content, 'activities') as unknown as Dnd5eActivityDefinitionV1[],
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
    activities: [...(content.activities ?? [])],
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
  'notes',
  'reason',
  'automationReasons',
  'reasons',
])

export function replaceRoomRuntimeProse(value: unknown, spellText = new WeakSet<object>()): void {
  if (Array.isArray(value)) {
    for (const entry of value) replaceRoomRuntimeProse(entry, spellText)
    return
  }
  if (!record(value)) return
  for (const [key, entry] of Object.entries(value)) {
    if (spellText.has(value) && ROOM_SPELL_TEXT_KEYS.has(key) && typeof entry === 'string') {
      if (entry.length > ROOM_SPELL_TEXT_MAX_LENGTH) throw new Error('内容说明超过房间文本长度限制')
      continue
    }
    if (ROOM_RUNTIME_PROSE_KEYS.has(key) && typeof entry === 'string') {
      value[key] = DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER
    } else if (ROOM_RUNTIME_PROSE_KEYS.has(key) && Array.isArray(entry)) {
      value[key] = entry.map((item) =>
        typeof item === 'string' ? DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER : item)
    } else {
      replaceRoomRuntimeProse(entry, spellText)
    }
  }
}

/**
 * Builds the only package form that may use `room-ephemeral`.
 * Names, structured mechanics, stable IDs, and caller-owned images remain usable;
 * source prose and local provenance are reduced unless spell display text is explicitly shared.
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
  replaceRoomRuntimeProse(projected.content, roomSpellTextObjects(projected))
  const bytes = new TextEncoder().encode(`${JSON.stringify(projected)}\n`)
  const validated = parseDnd5eContentPackageV2(bytes.buffer)
  if (!validated) throw new Error('Failed to build the room runtime content package')
  return validated
}

export function encodeDnd5eContentPackageV2(value: Dnd5eContentPackageV2): ArrayBuffer {
  return new TextEncoder().encode(`${JSON.stringify(value)}\n`).buffer
}

function contentActivityHasExecutableAutomation(activity: Dnd5eActivityDefinitionV1): boolean {
  const level = dnd5eActivityAutomationAnalysisV1(activity).capability.level
  return level === 'full' || (level === 'assisted' &&
    dnd5eActivityManualAdjudicationOperationsV1(activity).length > 0)
}

function activeContentActivity(
  value: Dnd5eContentPackageV2,
  kind: 'feature' | 'feat' | 'spell',
  id: string,
): Dnd5eActivityDefinitionV1 | undefined {
  return activeContentActivities(value, kind, id)[0]
}

function activeContentActivities(
  value: Dnd5eContentPackageV2,
  kind: 'feature' | 'feat' | 'spell' | 'subclass-ability',
  id: string,
): readonly Dnd5eActivityDefinitionV1[] {
  const areaGrantedIds = new Set(value.content.activities?.flatMap(source => source.outcomes.flatMap(outcome =>
    outcome.operations.flatMap(operation => operation.kind === 'create-persistent-area'
      ? (operation.grantedActivities ?? []).map(grant => grant.activityId) : []))) ?? [])
  return value.content.activities?.filter((activity) =>
    activity.legacySource?.kind === kind && activity.legacySource.id === id &&
    (kind !== 'spell' || (!activity.requiresEffectGrant && !areaGrantedIds.has(activity.id))) &&
    (activity.invocation == null || activity.invocation.kind === 'active' ||
      (kind !== 'spell' && activity.invocation.kind === 'triggered' &&
        ['long-rest-complete', 'short-rest-complete', 'long-rest-started', 'short-rest-started'].includes(activity.invocation.event))) &&
    contentActivityHasExecutableAutomation(activity) && !activity.authorityBinding) ?? []
}

function areaGrantedContentActivities(
  value: Dnd5eContentPackageV2,
): readonly Dnd5eActivityDefinitionV1[] {
  const activityIds = new Set(value.content.activities?.flatMap((source) =>
    source.outcomes.flatMap((outcome) => outcome.operations.flatMap((operation) =>
      operation.kind === 'create-persistent-area'
        ? (operation.grantedActivities ?? []).map((grant) => grant.activityId)
        : [],
    ))) ?? [])
  return [...activityIds].map((activityId) => {
    const activity = value.content.activities?.find((candidate) => candidate.id === activityId)
    if (
      !activity || (activity.invocation != null && activity.invocation.kind !== 'active') ||
      !contentActivityHasExecutableAutomation(activity) || activity.authorityBinding
    ) throw new Error(`Persistent area grants unavailable Activity: ${activityId}`)
    return activity
  })
}

function effectGrantedContentActivities(value: Dnd5eContentPackageV2): readonly Dnd5eActivityDefinitionV1[] {
  const ids = new Set(value.content.activities?.flatMap(activity => [
    // Continuations grant an effect-backed control at runtime, just like an
    // authored Effect grant. Both next steps and finishers need native actions.
    ...(activity.continuation ? [...(activity.continuation.nextActivityId ? [activity.continuation.nextActivityId] : []),
      ...(activity.continuation.finishActivityId ? [activity.continuation.finishActivityId] : [])] : []),
    ...(activity.effects ?? []).flatMap(effect => [...effect.grants ?? [], ...effect.completionGrant?.activityIds ?? []]),
    ...activity.outcomes.flatMap(outcome => outcome.operations.flatMap(operation =>
      operation.kind === 'summon' && operation.persistent && operation.bondKey
        ? [...operation.bondActivityIds ?? [], ...operation.bondDismissActivityId ? [operation.bondDismissActivityId] : []]
        : [])),
  ]) ?? [])
  return [...ids].flatMap(id => {
    const activity = value.content.activities?.find(candidate => candidate.id === id)
    if (!activity || activity.authorityBinding) {
      throw new Error(`Effect grants unavailable Activity: ${id}`)
    }
    const singleUseCompletion = value.content.activities?.some(root => root.effects?.some(effect =>
      effect.completionGrant?.singleUse && effect.completionGrant.activityIds.includes(id)))
    if (singleUseCompletion && !activity.requiresEffectGrant) throw new Error(`Single-use completion Activity requiresEffectGrant: ${id}`)
    // Granted event listeners are registered in the Activity package and
    // executed by the trigger pipeline, not the active feature adapter.
    // Rest controls use the feature adapter, which requires a current Host
    // rest receipt. Other event listeners remain trigger-pipeline-only.
    if (activity.invocation?.kind === 'triggered' &&
      !['long-rest-complete', 'short-rest-complete', 'long-rest-started', 'short-rest-started'].includes(activity.invocation.event)) return []
    return activity
  })
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

/** Runtime-only reference resolution; serialized archives retain their original signed projection. */
export function resolveDnd5eContentPackageItemReferences(value: Dnd5eContentPackageV2): Dnd5eContentPackageV2 {
  const content = structuredClone(value.content)
  // Resolve only items declared by this package; external qualified IDs stay intact.
  const localItemIds = new Set(content.items.map(item => item.id))
  const itemReference = (id: string) => !id.includes(':') && localItemIds.has(id)
    ? `${value.manifest.id}:${id}` : id
  content.activities = (content.activities ?? []).map(activity => ({
    ...activity,
    outcomes: activity.outcomes.map(outcome => ({
      ...outcome,
      operations: outcome.operations.map(operation => operation.kind === 'exchange-inventory-items'
        ? {...operation,templateId:itemReference(operation.templateId),
          ...(operation.templateOptions ? {templateOptions:operation.templateOptions.map(itemReference)} : {})}
        : operation.kind === 'grant-inventory-item'
        ? { ...operation, templateId: itemReference(operation.templateId),
          ...(operation.templateVariants ? { templateVariants: operation.templateVariants.map(variant => ({
            ...variant, templateId: itemReference(variant.templateId),
          })) } : {}) }
        : operation.kind === 'alter-inventory-item' || operation.kind === 'convert-map-inventory-item'
          ? { ...operation, templateId: itemReference(operation.templateId), originalTemplateIds: operation.originalTemplateIds.map(itemReference) }
          : operation.kind === 'create-persistent-area' && operation.structureServices
            ? {...operation,structureServices:{...operation.structureServices,mealTemplateId:itemReference(operation.structureServices.mealTemplateId),...(operation.structureServices.furnishings?{furnishings:operation.structureServices.furnishings.map(entry=>({...entry,templateId:itemReference(entry.templateId)}))}:{})}}
            : operation),
    })),
  }))

  return { ...value, content }
}

export function dnd5eRulesPluginFromContentPackageV2(
  value: Dnd5eContentPackageV2,
): Dnd5eRulesPlugin {
  value = resolveDnd5eContentPackageItemReferences(value)
  return {
    manifest: structuredClone(value.manifest),
    setup(api) {
      const assetDisposers: Array<() => void> = []
      let contentDefinitionDisposer: (() => void) | undefined
      try {
        contentDefinitionDisposer = registerDnd5eUnifiedContentPackageV1({
          packageId: value.manifest.id,
          packageVersion: value.manifest.version,
          definitions: dnd5eContentDefinitionsFromPackageV2(value).map(definition => {
            // Runtime provenance must not alter the archived content projection.
            const explicit = definition.kind === 'feature' && definition.activities?.some(candidate => {
              const source = (candidate as Dnd5eActivityDefinitionV1).legacySource
              return source?.kind === 'subclass-ability' && value.content.activities?.some(activity =>
                activity.legacySource?.kind === source.kind && activity.legacySource.id === source.id)
            })
            return explicit ? { ...definition, payload: {
              ...(definition.payload as Record<string, unknown>), explicitActivityImplementation: true,
            } } : definition
          }),
        }).dispose
        for (const asset of value.assets) {
          assetDisposers.push(registerDnd5ePluginImageAsset(value.manifest.id, asset).dispose)
        }
        for (const action of value.content.headlessActions) {
          api.registerHeadlessAction(dnd5eHeadlessActionFromDeclarativeDraft(action))
        }
        const nativeActiveActivities = [
          ...value.content.subclasses.flatMap(subclass => subclass.abilities.flatMap(ability =>
            activeContentActivities(value, 'subclass-ability', `${subclass.id}:${ability.id}`)
              .filter(activity => dnd5ePluginFeatureActionFromActivityV1(activity))
              .map(activity => ({ activity, outerSpellTransaction: false })))),
          ...effectGrantedContentActivities(value).map(activity => ({ activity, outerSpellTransaction: false })),
          ...value.content.features.flatMap((feature) => {
            return activeContentActivities(value, 'feature', feature.id)
              .filter(activity => (activity.id !== feature.action?.id || !value.content.headlessActions.some(action => action.id === activity.id)) && dnd5ePluginFeatureActionFromActivityV1(activity))
              .map(activity => ({ activity, outerSpellTransaction: false }))
          }),
          ...value.content.feats.flatMap((feat) => {
            return activeContentActivities(value, 'feat', feat.id)
              .filter(activity => (activity.id !== feat.action?.id || !value.content.headlessActions.some(action => action.id === activity.id)) && dnd5ePluginFeatureActionFromActivityV1(activity))
              .map(activity => ({ activity, outerSpellTransaction: false }))
          }),
          ...value.content.spells.flatMap((spell) => {
            const activity = activeContentActivity(value, 'spell', spell.id)
            return activity ? [{ activity, outerSpellTransaction: true }] : []
          }),
          ...areaGrantedContentActivities(value).map((activity) => ({
            activity,
            outerSpellTransaction: false,
          })),
        ]
        const uniqueNativeActiveActivities = [...new Map(nativeActiveActivities.map((entry) => [
          entry.activity.id,
          entry,
        ])).values()]
        for (const { activity: sourceActivity, outerSpellTransaction } of uniqueNativeActiveActivities) {
          // Compile the registered definition so local resource references have
          // the same package qualification as direct Activity execution.
          const activity = getRegisteredDnd5eActivity(value.manifest.id, sourceActivity.id) ?? sourceActivity
          const compatibility = dnd5eActivityHeadlessCompatibility(activity, { outerSpellTransaction })
          if (!compatibility.supported) {
            throw new Error(`Activity ${activity.id} cannot become an active Headless action: ${compatibility.reasons.join('; ')}`)
          }
          api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity, { outerSpellTransaction }))
        }
        for (const race of value.content.races) api.registerRace(structuredClone(race))
        for (const background of value.content.backgrounds) api.registerBackground(structuredClone(background))
        for (const feature of value.content.features.filter(feature => !feature.grantedBySubclass)) {
          const activity = feature.action ? undefined : activeContentActivity(value, 'feature', feature.id)
          api.registerFeature(structuredClone({
            ...feature,
            action: feature.action ?? (activity ? dnd5ePluginFeatureActionFromActivityV1(activity) : undefined),
          }))
        }
        for (const feat of value.content.feats) {
          const activity = feat.action ? undefined : activeContentActivity(value, 'feat', feat.id)
          api.registerFeat(structuredClone({
            ...feat,
            action: feat.action ?? (activity ? dnd5ePluginFeatureActionFromActivityV1(activity) : undefined),
          }))
        }
        for (const activity of areaGrantedContentActivities(value)) {
          const action = dnd5ePluginFeatureActionFromActivityV1(activity)
          if (!action) throw new Error(`Persistent area Activity cannot become an active control: ${activity.id}`)
          api.registerFeature({
            id: `area-control.${activity.id}`,
            name: activity.name,
            summary: activity.description ?? activity.name,
            description: activity.description ?? activity.name,
            sourceLabel: '持续区域授予',
            automation: dnd5eActivityAutomationAnalysisV1(activity).capability.level === 'full' ? 'full' : 'partial',
            action,
          })
        }
        for (const spell of value.content.spells) {
          const activity = activeContentActivity(value, 'spell', spell.id)
          const materialProblems = dnd5eConditionalSpellMaterialProblems(spell.components, activity, spell.duration)
          if (materialProblems.length) throw new Error(`${spell.id}: ${materialProblems.join(' ')}`)
          api.registerSpell(structuredClone({
            ...spell,
            // Runtime handlers establish executability, not completion of the
            // author's declared unresolved rules or end-to-end acceptance.
            tags: activity && activity.automation.level !== 'full'
              ? [...new Set([...(spell.tags ?? []), 'headless-target:partial'])] : spell.tags,
            automation: activity
              ? { mode: 'headless-action' as const, actionId: activity.id }
              : spell.automation?.mode === 'headless-action'
                ? spell.automation
                : { mode: 'reference-only' as const },
          }))
        }
        for (const item of value.content.items) api.registerItem(structuredClone(item))
        for (const method of value.content.abilityGenerationMethods) {
          api.registerAbilityGenerationMethod(structuredClone(method))
        }
        for (const definition of value.content.classes ?? []) api.registerDeclarativeClass(structuredClone(definition))
        for (const subclass of value.content.subclasses) api.registerDeclarativeSubclass(structuredClone(subclass))
        // A separately authored passive may belong to a declarative subclass.
        // Its source must exist before registerFeature validates that ownership.
        for (const feature of value.content.features.filter(feature => feature.grantedBySubclass)) {
          const activity = feature.action ? undefined : activeContentActivity(value, 'feature', feature.id)
          api.registerFeature(structuredClone({
            ...feature,
            action: feature.action ?? (activity ? dnd5ePluginFeatureActionFromActivityV1(activity) : undefined),
          }))
        }
        for (const monster of value.content.monsters) api.registerMonster(structuredClone(monster))
      } catch (error) {
        contentDefinitionDisposer?.()
        for (const dispose of assetDisposers.reverse()) dispose()
        throw error
      }
      return () => {
        contentDefinitionDisposer?.()
        for (const dispose of assetDisposers.reverse()) dispose()
      }
    },
  }
}

