import type { ClassResourceReset } from '../../lib/classDefinitionTypes'
import type { AbilityKey } from '../../lib/dnd'
import type { Character } from '../../types/character'
import type { RulesetAdapter } from '../contracts'
import {
  registerFighterSubclassDefinition,
  type FighterFeatureDefinition,
  type FighterSubclassChoiceGroup,
  type FighterSubclassDefinition,
} from './fighter'
import type {
  Dnd5eCombatant,
  Dnd5eActionFailure,
  Dnd5eActionResult,
  Dnd5eCombatEvent,
  Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import { DND5E_2014_RACE_OPTIONS } from './characterOptions'
import type { Dnd5eStandardConditionId } from './conditions'
import type { Dnd5eDamageType } from './monsters'
import {
  DND5E_SPELL_IMPORT_FORMAT,
  DND5E_SPELL_IMPORT_SCHEMA_VERSION,
  parseDnd5eSpellImport,
  type Dnd5eImportedSpell,
} from './spellbook'

export const DND5E_RULES_PLUGIN_API_VERSION = 2 as const
export const DND5E_RULES_PLUGIN_SUPPORTED_API_VERSIONS = [1, 2] as const
export const DND5E_RULES_PLUGIN_RULESET_ID = 'dnd5e-2014-srd-5.1' as const

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
export type Dnd5eRulesPluginApiVersion = typeof DND5E_RULES_PLUGIN_SUPPORTED_API_VERSIONS[number]

export interface Dnd5eRulesPluginManifest {
  /** Reverse-domain IDs are recommended, for example com.example.fighter-options. */
  id: string
  name: string
  version: string
  apiVersion: Dnd5eRulesPluginApiVersion
  rulesetId: typeof DND5E_RULES_PLUGIN_RULESET_ID
  publisher: string
  description?: string
  homepage?: string
  /** The plugin publisher, not DNDSTARS, declares the license for plugin-supplied content. */
  license: string
  /**
   * Version of the plugin-owned room state. Version 1 is assumed for legacy
   * API V2 packages. Increasing this value requires a contiguous Worker
   * migration for every intermediate version.
   */
  stateSchemaVersion?: number
}

export interface Dnd5eRulesPluginStateMigration {
  fromVersion: number
  toVersion: number
  migrate(state: JsonValue): JsonValue | Promise<JsonValue>
}

export interface Dnd5ePluginFighterResource {
  id: string
  label: string
  shortLabel?: string
  minLevel?: number
  isAvailable?: (character: Character) => boolean
  max(character: Character): number
  resetOn: ClassResourceReset
}

export interface Dnd5ePluginFighterSubclass {
  id: string
  name: string
  summary: string
  sourceLabel?: string
  features: readonly Omit<FighterFeatureDefinition, 'source'>[]
  choiceGroups?: readonly FighterSubclassChoiceGroup[]
  resources?: readonly Dnd5ePluginFighterResource[]
  fightingStyleSelectionLimit?: (character: Character) => number
}

export interface Dnd5ePluginAction {
  type: 'plugin'
  pluginId: string
  actionId: string
  /** API v2 通用特性必须提供；省略时仅用于兼容 API v1 的直接 Headless Action。 */
  featureId?: string
  actorId: string
  targetId?: string
  /** 由 DM 地图权威层按 Token 占格重新计算，插件不得采用玩家提交的距离。 */
  distanceFeet?: number
  payload?: JsonValue
}

/** 插件声明持续时间的 capability 输入；Host 会转换为 ActiveEffectInstance。 */
export interface Dnd5ePluginEffectDuration {
  expiresAt: 'source-next-turn-start' | 'target-next-turn-start' | 'target-turn-end' | 'target-turn-end-save'
  remainingRounds?: number
  saveAbility?: AbilityKey
  saveDc?: number
}

export interface Dnd5ePluginHeadlessActionContext {
  /** A private clone of the authoritative state; the resolver may mutate and return it. */
  state: Dnd5eHeadlessCombatState
  action: Dnd5ePluginAction
  events: Dnd5eCombatEvent[]
  rules: RulesetAdapter
  actor: Dnd5eCombatant
  target?: Dnd5eCombatant
  /** 赋予临时生命值；同一效果不叠加，保留较高值。返回本次实际增加量。 */
  grantTemporaryHitPoints(targetId: string, amount: number): number
  /** 恢复生命值但不超过生命上限。返回本次实际恢复量。 */
  heal(targetId: string, amount: number): number
  /** 结算已由 DM 骰子事务验证的伤害值；Host 统一处理抗性、易伤与免疫。 */
  dealDamage(targetId: string, amount: number, damageType: Dnd5eDamageType): number
  /** 通过标准状态引擎施加一个有来源、可过期的状态。 */
  applyStandardCondition(
    targetId: string,
    condition: Dnd5eStandardConditionId,
    duration: Dnd5ePluginEffectDuration,
  ): boolean
  fail(reason: Dnd5eActionFailure): Dnd5eActionResult
  succeed(): Dnd5eActionResult
}

export interface Dnd5ePluginHeadlessActionDefinition {
  id: string
  /** Reactions and interrupts must opt in; normal plugin actions are current-turn only. */
  allowOffTurn?: boolean
  /**
   * Installed rules packages execute in an isolated Worker. `trusted` is reserved for
   * built-in/test registrations created by the host itself.
   */
  execution?: 'trusted' | 'worker'
  resolve?(context: Dnd5ePluginHeadlessActionContext): Dnd5eActionResult
}

export type Dnd5ePluginActionEconomy = 'action' | 'bonusAction' | 'reaction' | 'none'
export type Dnd5ePluginAutomationLevel = 'full' | 'partial' | 'manual'
export type Dnd5ePluginTargetRelation = 'any' | 'ally' | 'enemy'

export type Dnd5ePluginTargeting =
  | { kind: 'self' }
  | {
      kind: 'single-creature'
      relation?: Dnd5ePluginTargetRelation
      rangeFeet?: number
      includeSelf?: boolean
    }

export interface Dnd5ePluginFeatureAction {
  /** 与 registerHeadlessAction 的本地 ID 对应，由 Host 自动绑定到当前插件命名空间。 */
  id: string
  label: string
  description?: string
  economy: Dnd5ePluginActionEconomy
  targeting: Dnd5ePluginTargeting
}

export interface Dnd5ePluginFeatureDefinition {
  id: string
  name: string
  summary: string
  description: string
  sourceLabel?: string
  minimumLevel?: number
  automation: Dnd5ePluginAutomationLevel
  /** 返回 false 时人物卡不能选择，Headless 也会拒绝该特性。 */
  isAvailable?: (character: Character) => boolean
  action?: Dnd5ePluginFeatureAction
}

export interface RegisteredDnd5ePluginFeature extends Omit<Dnd5ePluginFeatureDefinition, 'id' | 'action'> {
  id: string
  ownerPluginId: string
  ownerPluginName: string
  ownerPluginLicense: string
  action?: Dnd5ePluginFeatureAction
}

export interface Dnd5ePluginFlexibleAbilityBonus {
  count: number
  amount: number
  exclude?: readonly AbilityKey[]
}

export interface Dnd5ePluginRaceDefinition {
  id: string
  name: string
  description?: string
  speedFeet: number
  abilityBonuses?: Partial<Record<AbilityKey, number>>
  flexibleAbilityBonus?: Dnd5ePluginFlexibleAbilityBonus
}

export interface RegisteredDnd5ePluginRace extends Omit<Dnd5ePluginRaceDefinition, 'id'> {
  id: string
  ownerPluginId: string
  ownerPluginName: string
  ownerPluginLicense: string
}

export type Dnd5ePluginAbilityGenerationDefinition = {
  id: string
  name: string
  summary: string
} & (
  | { kind: 'standard-array'; scores: readonly number[] }
  | { kind: 'point-buy'; budget: number; minimum: number; maximum: number; costs: Readonly<Record<number, number>> }
  | { kind: 'roll'; diceCount: number; dieSides: number; dropLowest: number }
)

type WithPluginOwnership<T> = T extends unknown ? Omit<T, 'id'> & {
  id: string
  ownerPluginId: string
  ownerPluginName: string
  ownerPluginLicense: string
} : never

export type RegisteredDnd5ePluginAbilityGeneration = WithPluginOwnership<Dnd5ePluginAbilityGenerationDefinition>

export type Dnd5ePluginSpellDefinition = Omit<Dnd5eImportedSpell, 'id' | 'source' | 'automation'> & {
  id: string
  automation?:
    | { mode: 'reference-only' }
    | { mode: 'headless-action'; actionId: string }
}

export interface RegisteredDnd5ePluginSpell extends Omit<Dnd5eImportedSpell, 'automation'> {
  ownerPluginId: string
  ownerPluginName: string
  ownerPluginLicense: string
  automation:
    | { mode: 'reference-only' }
    | { mode: 'headless-action'; actionId: string }
}

export interface Dnd5eRulesPluginApi {
  readonly apiVersion: typeof DND5E_RULES_PLUGIN_API_VERSION
  readonly rulesetId: typeof DND5E_RULES_PLUGIN_RULESET_ID
  registerFighterSubclass(definition: Dnd5ePluginFighterSubclass): string
  registerFeature(definition: Dnd5ePluginFeatureDefinition): string
  registerHeadlessAction(definition: Dnd5ePluginHeadlessActionDefinition): string
  registerRace(definition: Dnd5ePluginRaceDefinition): string
  registerAbilityGenerationMethod(definition: Dnd5ePluginAbilityGenerationDefinition): string
  /** 注册可发现的法术数据；自动结算必须显式绑定同一插件的 Worker Headless action。 */
  registerSpell(definition: Dnd5ePluginSpellDefinition): string
}

export interface Dnd5eRulesPlugin {
  manifest: Dnd5eRulesPluginManifest
  /** Pure data migrations; executed only inside the locked Worker realm. */
  migrations?: readonly Dnd5eRulesPluginStateMigration[]
  setup(api: Dnd5eRulesPluginApi): void | (() => void)
}

interface RegisteredPlugin {
  plugin: Dnd5eRulesPlugin
  integrity?: string
  dispose(): void
}

interface OwnedHeadlessAction {
  pluginId: string
  definition: Dnd5ePluginHeadlessActionDefinition
}

const plugins = new Map<string, RegisteredPlugin>()
const headlessActions = new Map<string, OwnedHeadlessAction>()
const pluginFeatures = new Map<string, RegisteredDnd5ePluginFeature>()
const pluginRaces = new Map<string, RegisteredDnd5ePluginRace>()
const pluginAbilityGenerationMethods = new Map<string, RegisteredDnd5ePluginAbilityGeneration>()
const pluginSpells = new Map<string, RegisteredDnd5ePluginSpell>()
const pluginListeners = new Set<() => void>()
let pluginRevision = 0

function validId(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/.test(value)
}

const ABILITY_KEYS: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

function finiteInteger(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
}

function cloneAbilityBonuses(value: Dnd5ePluginRaceDefinition['abilityBonuses']): Partial<Record<AbilityKey, number>> {
  if (value == null) return {}
  const result: Partial<Record<AbilityKey, number>> = {}
  for (const [key, bonus] of Object.entries(value)) {
    if (!ABILITY_KEYS.includes(key as AbilityKey) || !finiteInteger(bonus, -10, 10)) {
      throw new Error(`Invalid plugin racial ability bonus: ${key}`)
    }
    if (bonus !== 0) result[key as AbilityKey] = bonus
  }
  return result
}

function assertManifest(manifest: Dnd5eRulesPluginManifest): void {
  if (!manifest || typeof manifest !== 'object') throw new Error('Invalid D&D 5e rules plugin manifest')
  if (!validId(manifest.id)) throw new Error(`Invalid D&D 5e rules plugin id: ${manifest.id}`)
  if (
    typeof manifest.name !== 'string' || typeof manifest.publisher !== 'string' ||
    typeof manifest.version !== 'string' || typeof manifest.license !== 'string' ||
    !manifest.name.trim() || !manifest.publisher.trim() || !manifest.version.trim() || !manifest.license.trim()
  ) {
    throw new Error(`Incomplete D&D 5e rules plugin manifest: ${manifest.id}`)
  }
  if (
    (manifest.description != null && typeof manifest.description !== 'string') ||
    (manifest.homepage != null && typeof manifest.homepage !== 'string')
  ) throw new Error(`Invalid D&D 5e rules plugin manifest metadata: ${manifest.id}`)
  if (
    manifest.stateSchemaVersion != null &&
    (!Number.isInteger(manifest.stateSchemaVersion) || manifest.stateSchemaVersion < 1 || manifest.stateSchemaVersion > 1_000)
  ) throw new Error(`Invalid plugin state schema version: ${manifest.id}`)
  if (!(DND5E_RULES_PLUGIN_SUPPORTED_API_VERSIONS as readonly number[]).includes(manifest.apiVersion)) {
    throw new Error(`Unsupported rules plugin API version: ${manifest.apiVersion}`)
  }
  if (manifest.rulesetId !== DND5E_RULES_PLUGIN_RULESET_ID) {
    throw new Error(`Unsupported ruleset for plugin ${manifest.id}: ${manifest.rulesetId}`)
  }
}

function publishPluginRegistryChange(): void {
  pluginRevision += 1
  for (const listener of pluginListeners) listener()
}

function namespacedId(pluginId: string, localId: string): string {
  if (!validId(localId)) throw new Error(`Invalid plugin contribution id: ${localId}`)
  return `${pluginId}:${localId}`
}

function toFighterSubclassDefinition(
  manifest: Dnd5eRulesPluginManifest,
  input: Dnd5ePluginFighterSubclass,
): FighterSubclassDefinition {
  const id = namespacedId(manifest.id, input.id)
  const resources = input.resources?.map((resource) => {
    const key = namespacedId(manifest.id, resource.id)
    return {
      key,
      label: resource.label,
      shortLabel: resource.shortLabel,
      isAvailable: (character: Character) =>
        character.dnd5eClassChoices?.fighter?.subclass === id &&
        character.level >= (resource.minLevel ?? 1) &&
        (resource.isAvailable?.(character) ?? true),
      max: resource.max,
      resetOn: resource.resetOn,
    }
  })
  return {
    id,
    name: input.name,
    summary: input.summary,
    rulesTextSource: 'third-party-plugin',
    sourceLabel: `${input.sourceLabel ?? manifest.name} · 第三方插件 · ${manifest.license}`,
    ownerPluginId: manifest.id,
    features: input.features.map((feature) => ({
      ...feature,
      id: `${id}:${feature.id}`,
      source: id,
    })),
    choiceGroups: input.choiceGroups,
    resources,
    fightingStyleSelectionLimit: input.fightingStyleSelectionLimit,
  }
}

export interface Dnd5eRulesPluginRegistrationOptions {
  integrity?: string
}

export interface Dnd5eRulesPluginRequirement {
  id: string
  version: string
  stateSchemaVersion?: number
  integrity?: string
}

export function registerDnd5eRulesPlugin(
  plugin: Dnd5eRulesPlugin,
  options: Dnd5eRulesPluginRegistrationOptions = {},
): () => void {
  assertManifest(plugin.manifest)
  const { id } = plugin.manifest
  if (plugins.has(id)) throw new Error(`D&D 5e rules plugin already registered: ${id}`)

  const disposers: Array<() => void> = []
  let acceptingContributions = true
  const assertAcceptingContributions = () => {
    if (!acceptingContributions) throw new Error(`Plugin contributions must be registered synchronously during setup: ${id}`)
  }
  const api: Dnd5eRulesPluginApi = {
    apiVersion: DND5E_RULES_PLUGIN_API_VERSION,
    rulesetId: DND5E_RULES_PLUGIN_RULESET_ID,
    registerFighterSubclass(definition) {
      assertAcceptingContributions()
      const registered = toFighterSubclassDefinition(plugin.manifest, definition)
      disposers.push(registerFighterSubclassDefinition(registered))
      return registered.id
    },
    registerFeature(definition) {
      assertAcceptingContributions()
      const featureId = namespacedId(id, definition.id)
      if (pluginFeatures.has(featureId)) throw new Error(`Plugin feature already registered: ${featureId}`)
      if (
        definition.minimumLevel != null &&
        (typeof definition.minimumLevel !== 'number' || !Number.isFinite(definition.minimumLevel))
      ) throw new Error(`Invalid plugin feature minimum level: ${featureId}`)
      const minimumLevel = Math.min(20, Math.max(1, Math.floor(definition.minimumLevel ?? 1)))
      if (
        typeof definition.name !== 'string' || typeof definition.summary !== 'string' ||
        typeof definition.description !== 'string' || !definition.name.trim() ||
        !definition.summary.trim() || !definition.description.trim()
      ) {
        throw new Error(`Incomplete plugin feature definition: ${featureId}`)
      }
      if (!['full', 'partial', 'manual'].includes(definition.automation)) {
        throw new Error(`Invalid plugin feature automation level: ${featureId}`)
      }
      if (definition.sourceLabel != null && typeof definition.sourceLabel !== 'string') {
        throw new Error(`Invalid plugin feature source label: ${featureId}`)
      }
      if (definition.action) {
        if (!validId(definition.action.id)) throw new Error(`Invalid plugin feature action id: ${definition.action.id}`)
        if (typeof definition.action.label !== 'string' || !definition.action.label.trim()) {
          throw new Error(`Incomplete plugin feature action: ${featureId}`)
        }
        if (definition.action.description != null && typeof definition.action.description !== 'string') {
          throw new Error(`Invalid plugin feature action description: ${featureId}`)
        }
        if (!['action', 'bonusAction', 'reaction', 'none'].includes(definition.action.economy)) {
          throw new Error(`Invalid plugin feature action economy: ${featureId}`)
        }
        if (!['self', 'single-creature'].includes(definition.action.targeting?.kind)) {
          throw new Error(`Invalid plugin feature targeting: ${featureId}`)
        }
        if (
          definition.action.targeting.kind === 'single-creature' &&
          definition.action.targeting.relation != null &&
          !['any', 'ally', 'enemy'].includes(definition.action.targeting.relation)
        ) throw new Error(`Invalid plugin feature target relation: ${featureId}`)
        if (
          definition.action.targeting.kind === 'single-creature' &&
          definition.action.targeting.rangeFeet != null &&
          (!Number.isFinite(definition.action.targeting.rangeFeet) || definition.action.targeting.rangeFeet < 0)
        ) {
          throw new Error(`Invalid plugin feature range: ${featureId}`)
        }
      }
      const registered: RegisteredDnd5ePluginFeature = {
        ...definition,
        id: featureId,
        minimumLevel,
        action: definition.action ? {
          ...definition.action,
          targeting: { ...definition.action.targeting },
        } : undefined,
        ownerPluginId: id,
        ownerPluginName: plugin.manifest.name,
        ownerPluginLicense: plugin.manifest.license,
      }
      pluginFeatures.set(featureId, registered)
      disposers.push(() => {
        if (pluginFeatures.get(featureId) === registered) pluginFeatures.delete(featureId)
      })
      return featureId
    },
    registerHeadlessAction(definition) {
      assertAcceptingContributions()
      const actionId = namespacedId(id, definition.id)
      if (headlessActions.has(actionId)) throw new Error(`Plugin headless action already registered: ${actionId}`)
      if (definition.execution != null && definition.execution !== 'trusted' && definition.execution !== 'worker') {
        throw new Error(`Invalid plugin Headless execution mode: ${actionId}`)
      }
      if (definition.allowOffTurn != null && typeof definition.allowOffTurn !== 'boolean') {
        throw new Error(`Invalid plugin Headless allowOffTurn value: ${actionId}`)
      }
      if (definition.execution !== 'worker' && typeof definition.resolve !== 'function') {
        throw new Error(`Trusted plugin Headless action is missing its resolver: ${actionId}`)
      }
      const owned = { pluginId: id, definition }
      headlessActions.set(actionId, owned)
      disposers.push(() => {
        if (headlessActions.get(actionId) === owned) headlessActions.delete(actionId)
      })
      return actionId
    },
    registerRace(definition) {
      assertAcceptingContributions()
      const raceId = namespacedId(id, definition.id)
      if (pluginRaces.has(raceId)) throw new Error(`Plugin race already registered: ${raceId}`)
      if (typeof definition.name !== 'string' || !definition.name.trim()) {
        throw new Error(`Incomplete plugin race definition: ${raceId}`)
      }
      const name = definition.name.trim()
      if (
        (DND5E_2014_RACE_OPTIONS as readonly string[]).includes(name) ||
        [...pluginRaces.values()].some((race) => race.name === name)
      ) throw new Error(`Plugin race name must be unique: ${name}`)
      if (!finiteInteger(definition.speedFeet, 0, 500)) {
        throw new Error(`Invalid plugin race speed: ${raceId}`)
      }
      if (definition.description != null && typeof definition.description !== 'string') {
        throw new Error(`Invalid plugin race description: ${raceId}`)
      }
      const flexible = definition.flexibleAbilityBonus
      if (flexible) {
        if (!finiteInteger(flexible.count, 1, 6) || !finiteInteger(flexible.amount, -10, 10) || flexible.amount === 0) {
          throw new Error(`Invalid plugin race flexible ability bonus: ${raceId}`)
        }
        const exclude = [...new Set(flexible.exclude ?? [])]
        if (exclude.some((key) => !ABILITY_KEYS.includes(key)) || flexible.count > ABILITY_KEYS.length - exclude.length) {
          throw new Error(`Invalid plugin race flexible ability choices: ${raceId}`)
        }
      }
      const registered: RegisteredDnd5ePluginRace = {
        id: raceId,
        name,
        speedFeet: definition.speedFeet,
        abilityBonuses: cloneAbilityBonuses(definition.abilityBonuses),
        ...(definition.description?.trim() ? { description: definition.description.trim() } : {}),
        ...(flexible ? { flexibleAbilityBonus: {
          count: flexible.count,
          amount: flexible.amount,
          ...(flexible.exclude?.length ? { exclude: [...new Set(flexible.exclude)] } : {}),
        } } : {}),
        ownerPluginId: id,
        ownerPluginName: plugin.manifest.name,
        ownerPluginLicense: plugin.manifest.license,
      }
      pluginRaces.set(raceId, registered)
      disposers.push(() => {
        if (pluginRaces.get(raceId) === registered) pluginRaces.delete(raceId)
      })
      return raceId
    },
    registerAbilityGenerationMethod(definition) {
      assertAcceptingContributions()
      const methodId = namespacedId(id, definition.id)
      if (pluginAbilityGenerationMethods.has(methodId)) {
        throw new Error(`Plugin ability generation method already registered: ${methodId}`)
      }
      if (
        typeof definition.name !== 'string' || !definition.name.trim() ||
        typeof definition.summary !== 'string' || !definition.summary.trim()
      ) throw new Error(`Incomplete plugin ability generation method: ${methodId}`)
      let registered: RegisteredDnd5ePluginAbilityGeneration
      const ownership = {
        id: methodId,
        ownerPluginId: id,
        ownerPluginName: plugin.manifest.name,
        ownerPluginLicense: plugin.manifest.license,
      }
      if (definition.kind === 'standard-array') {
        if (definition.scores.length !== 6 || definition.scores.some((score) => !finiteInteger(score, 1, 30))) {
          throw new Error(`Invalid plugin standard array: ${methodId}`)
        }
        registered = { ...ownership, kind: 'standard-array', name: definition.name.trim(), summary: definition.summary.trim(), scores: [...definition.scores] }
      } else if (definition.kind === 'point-buy') {
        if (
          !finiteInteger(definition.minimum, 1, 30) || !finiteInteger(definition.maximum, definition.minimum, 30) ||
          !finiteInteger(definition.budget, 0, 1_000)
        ) throw new Error(`Invalid plugin point-buy bounds: ${methodId}`)
        const costs: Record<number, number> = {}
        let previous = -1
        for (let score = definition.minimum; score <= definition.maximum; score += 1) {
          const cost = definition.costs[score]
          if (!finiteInteger(cost, 0, 1_000) || cost < previous) {
            throw new Error(`Invalid plugin point-buy cost for score ${score}: ${methodId}`)
          }
          costs[score] = cost
          previous = cost
        }
        registered = {
          ...ownership,
          kind: 'point-buy',
          name: definition.name.trim(),
          summary: definition.summary.trim(),
          budget: definition.budget,
          minimum: definition.minimum,
          maximum: definition.maximum,
          costs,
        }
      } else if (definition.kind === 'roll') {
        if (
          !finiteInteger(definition.diceCount, 1, 20) || !finiteInteger(definition.dieSides, 2, 1_000) ||
          !finiteInteger(definition.dropLowest, 0, definition.diceCount - 1)
        ) throw new Error(`Invalid plugin dice ability generation method: ${methodId}`)
        registered = {
          ...ownership,
          kind: 'roll',
          name: definition.name.trim(),
          summary: definition.summary.trim(),
          diceCount: definition.diceCount,
          dieSides: definition.dieSides,
          dropLowest: definition.dropLowest,
        }
      } else {
        throw new Error(`Invalid plugin ability generation kind: ${methodId}`)
      }
      pluginAbilityGenerationMethods.set(methodId, registered)
      disposers.push(() => {
        if (pluginAbilityGenerationMethods.get(methodId) === registered) pluginAbilityGenerationMethods.delete(methodId)
      })
      return methodId
    },
    registerSpell(definition) {
      assertAcceptingContributions()
      const spellId = namespacedId(id, definition.id)
      if (pluginSpells.has(spellId)) throw new Error(`Plugin spell already registered: ${spellId}`)
      const automation = definition.automation ?? { mode: 'reference-only' as const }
      if (automation.mode === 'headless-action' && !validId(automation.actionId)) {
        throw new Error(`Invalid plugin spell Headless action: ${spellId}`)
      }
      if (automation.mode !== 'reference-only' && automation.mode !== 'headless-action') {
        throw new Error(`Invalid plugin spell automation mode: ${spellId}`)
      }
      const parsed = parseDnd5eSpellImport({
        format: DND5E_SPELL_IMPORT_FORMAT,
        schemaVersion: DND5E_SPELL_IMPORT_SCHEMA_VERSION,
        spells: [{
          ...definition,
          id: spellId,
          source: {
            title: plugin.manifest.name,
            publisher: plugin.manifest.publisher,
            license: plugin.manifest.license,
          },
          automation: { mode: 'reference-only' },
        }],
      }).spells[0]
      const registered: RegisteredDnd5ePluginSpell = {
        ...parsed,
        automation: automation.mode === 'headless-action'
          ? { mode: 'headless-action', actionId: automation.actionId }
          : { mode: 'reference-only' },
        ownerPluginId: id,
        ownerPluginName: plugin.manifest.name,
        ownerPluginLicense: plugin.manifest.license,
      }
      pluginSpells.set(spellId, registered)
      disposers.push(() => {
        if (pluginSpells.get(spellId) === registered) pluginSpells.delete(spellId)
      })
      return spellId
    },
  }

  try {
    const pluginDispose = plugin.setup(api)
    if (pluginDispose) disposers.push(pluginDispose)
    for (const feature of pluginFeatures.values()) {
      if (
        feature.ownerPluginId === id &&
        feature.automation === 'full' &&
        feature.action &&
        !headlessActions.has(`${id}:${feature.action.id}`)
      ) {
        throw new Error(`Fully automated plugin feature is missing its Headless action: ${feature.id}`)
      }
    }
  } catch (error) {
    for (const dispose of disposers.reverse()) dispose()
    throw error
  } finally {
    acceptingContributions = false
  }

  let active = true
  const registered: RegisteredPlugin = {
    plugin,
    integrity: options.integrity,
    dispose() {
      if (!active) return
      active = false
      for (const dispose of disposers.reverse()) dispose()
      plugins.delete(id)
      publishPluginRegistryChange()
    },
  }
  plugins.set(id, registered)
  publishPluginRegistryChange()
  return registered.dispose
}

export function unregisterDnd5eRulesPlugin(pluginId: string): boolean {
  const registered = plugins.get(pluginId)
  if (!registered) return false
  registered.dispose()
  return true
}

export function registeredDnd5eRulesPlugins(): readonly Dnd5eRulesPluginManifest[] {
  return [...plugins.values()].map(({ plugin }) => ({ ...plugin.manifest }))
}

export function activeDnd5eRulesPluginRequirements(): readonly Dnd5eRulesPluginRequirement[] {
  return [...plugins.values()]
    .map(({ plugin, integrity }) => ({
      id: plugin.manifest.id,
      version: plugin.manifest.version,
      stateSchemaVersion: plugin.manifest.stateSchemaVersion ?? 1,
      ...(integrity ? { integrity } : {}),
    }))
    .sort((left, right) => left.id.localeCompare(right.id))
}

export function missingDnd5eRulesPluginRequirements(
  required: readonly Dnd5eRulesPluginRequirement[],
  active: readonly Dnd5eRulesPluginRequirement[] = activeDnd5eRulesPluginRequirements(),
): Dnd5eRulesPluginRequirement[] {
  const activeById = new Map(active.map((plugin) => [plugin.id, plugin]))
  return required.filter((requirement) => {
    const installed = activeById.get(requirement.id)
    if (
      !installed || installed.version !== requirement.version ||
      (installed.stateSchemaVersion ?? 1) !== (requirement.stateSchemaVersion ?? 1)
    ) return true
    return !!requirement.integrity && installed.integrity !== requirement.integrity
  })
}

export function dnd5ePluginHeadlessActionDefinition(
  pluginId: string,
  actionId: string,
): Dnd5ePluginHeadlessActionDefinition | undefined {
  return headlessActions.get(`${pluginId}:${actionId}`)?.definition
}

export function registeredDnd5ePluginFeatures(): readonly RegisteredDnd5ePluginFeature[] {
  return [...pluginFeatures.values()]
    .map((feature) => ({
      ...feature,
      action: feature.action ? {
        ...feature.action,
        targeting: { ...feature.action.targeting },
      } : undefined,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function registeredDnd5ePluginRaces(): readonly RegisteredDnd5ePluginRace[] {
  return [...pluginRaces.values()]
    .map((race) => ({
      ...race,
      abilityBonuses: { ...race.abilityBonuses },
      flexibleAbilityBonus: race.flexibleAbilityBonus ? {
        ...race.flexibleAbilityBonus,
        ...(race.flexibleAbilityBonus.exclude ? { exclude: [...race.flexibleAbilityBonus.exclude] } : {}),
      } : undefined,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function dnd5ePluginRaceDefinition(idOrName: string): RegisteredDnd5ePluginRace | undefined {
  const race = pluginRaces.get(idOrName) ?? [...pluginRaces.values()].find((candidate) => candidate.name === idOrName)
  return race ? {
    ...race,
    abilityBonuses: { ...race.abilityBonuses },
    flexibleAbilityBonus: race.flexibleAbilityBonus ? {
      ...race.flexibleAbilityBonus,
      ...(race.flexibleAbilityBonus.exclude ? { exclude: [...race.flexibleAbilityBonus.exclude] } : {}),
    } : undefined,
  } : undefined
}

export function registeredDnd5ePluginAbilityGenerationMethods(): readonly RegisteredDnd5ePluginAbilityGeneration[] {
  return [...pluginAbilityGenerationMethods.values()]
    .map((method) => method.kind === 'standard-array'
      ? { ...method, scores: [...method.scores] }
      : method.kind === 'point-buy'
        ? { ...method, costs: { ...method.costs } }
        : { ...method })
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function registeredDnd5ePluginSpells(): readonly RegisteredDnd5ePluginSpell[] {
  return [...pluginSpells.values()]
    .map((spell) => ({
      ...spell,
      classes: [...spell.classes],
      components: { ...spell.components },
      castingTime: { ...spell.castingTime },
      range: { ...spell.range },
      duration: { ...spell.duration },
      tags: spell.tags ? [...spell.tags] : undefined,
      mechanics: spell.mechanics ? structuredClone(spell.mechanics) : undefined,
      source: { ...spell.source },
      automation: { ...spell.automation },
    }))
    .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name, 'zh-CN'))
}

export function dnd5ePluginSpellDefinition(id: string): RegisteredDnd5ePluginSpell | undefined {
  return registeredDnd5ePluginSpells().find((spell) => spell.id === id)
}

export function dnd5ePluginAbilityGenerationMethod(id: string): RegisteredDnd5ePluginAbilityGeneration | undefined {
  const method = pluginAbilityGenerationMethods.get(id)
  if (!method) return undefined
  if (method.kind === 'standard-array') return { ...method, scores: [...method.scores] }
  if (method.kind === 'point-buy') return { ...method, costs: { ...method.costs } }
  return { ...method }
}

export function dnd5ePluginFeatureDefinition(featureId: string): RegisteredDnd5ePluginFeature | undefined {
  const feature = pluginFeatures.get(featureId)
  return feature ? {
    ...feature,
    action: feature.action ? {
      ...feature.action,
      targeting: { ...feature.action.targeting },
    } : undefined,
  } : undefined
}

export function dnd5ePluginFeatureAvailableForCharacter(
  feature: RegisteredDnd5ePluginFeature,
  character: Character,
): boolean {
  return character.level >= (feature.minimumLevel ?? 1) && (feature.isAvailable?.(character) ?? true)
}

export function dnd5ePluginFeaturesAvailableForCharacter(
  character: Character,
): readonly RegisteredDnd5ePluginFeature[] {
  return registeredDnd5ePluginFeatures().filter((feature) =>
    dnd5ePluginFeatureAvailableForCharacter(feature, character),
  )
}

export function dnd5eCharacterHasPluginFeature(character: Character, featureId: string): boolean {
  const feature = dnd5ePluginFeatureDefinition(featureId)
  return !!feature &&
    character.dnd5ePluginFeatureIds?.includes(featureId) === true &&
    dnd5ePluginFeatureAvailableForCharacter(feature, character)
}

export function subscribeDnd5eRulesPluginRegistry(listener: () => void): () => void {
  pluginListeners.add(listener)
  return () => pluginListeners.delete(listener)
}

export function dnd5eRulesPluginRegistrySnapshot(): number {
  return pluginRevision
}
