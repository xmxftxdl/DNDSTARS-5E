import type { AbilityKey } from '../../lib/dnd'
import type { GridCell } from '../../lib/gridCombat'
import { DND5E_STANDARD_CONDITION_IDS, type Dnd5eStandardConditionId } from './conditions'
import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from './damageTypes'
import {
  validateDnd5eWorkshopDamageFormulaV1,
  type Dnd5eWorkshopDamageFormulaV1,
} from './workshopDamageFormula'

export const DND5E_DECLARATIVE_LABEL_MAX_LENGTH = 120
export const DND5E_DECLARATIVE_DURATION_MAX_ROUNDS = 14_400
/** Long-lived spell areas may persist for as much as one in-world year. */
export const DND5E_PERSISTENT_AREA_DURATION_MAX_ROUNDS = 5_256_000

export const DND5E_PERSISTENT_AREA_VISUAL_PRESETS = [
  'arcane',
  'dancing-lights',
  'toxic-cloud',
  'daylight',
  'darkness',
  'moonbeam',
  'call-lightning',
  'spirit-guardians',
  'spike-growth',
  'flaming-sphere',
  'spiritual-weapon',
  'grease',
  'entangle',
  'black-tentacles',
  'wall-of-fire',
  'mage-hand',
  'insect-plague',
  'blade-barrier',
  'cloudkill',
  'ice-storm-ground',
  'fog-cloud',
  'web',
  'silence',
  'sleet-storm',
  'stinking-cloud',
  'wind-wall',
  'wall-of-force',
  'wall-of-stone',
  'wall-of-ice',
  'wall-of-thorns',
  'silent-image',
  'major-image',
  'unseen-servant',
  'mislead',
  'project-image',
] as const

export type Dnd5ePersistentAreaVisualPreset = typeof DND5E_PERSISTENT_AREA_VISUAL_PRESETS[number]
export type Dnd5ePersistentAreaVisualIntensity = 'subtle' | 'normal' | 'strong'

/**
 * A bounded presentation hint. The Host synchronizes this declaration, while each
 * client renders the animation locally; no animation frame enters authoritative state.
 */
export interface Dnd5ePersistentAreaVisual {
  preset: Dnd5ePersistentAreaVisualPreset
  intensity?: Dnd5ePersistentAreaVisualIntensity
}

/**
 * 地图光照只接受 Host 白名单声明。法术区域不能携带渲染回调；画布和
 * 权威视线判定会读取同一份半径、环级与压制规则。
 */
export type Dnd5ePersistentAreaLighting =
  | {
      kind: 'light'
      brightRadiusFeet: number
      dimRadiusFeet: number
      color: string
      spellLevel: number
      suppressesMagicalDarknessThroughLevel?: number
    }
  | {
      kind: 'magical-darkness'
      radiusFeet: number
      spellLevel: number
      suppressesMagicalLightThroughLevel?: number
    }

export const DND5E_HALLOW_ADDITIONAL_EFFECTS = [
  'courage',
  'darkness',
  'daylight',
  'energy-protection',
  'energy-vulnerability',
  'everlasting-rest',
  'extradimensional-interference',
  'fear',
  'silence',
  'tongues',
] as const

export type Dnd5eHallowAdditionalEffect = typeof DND5E_HALLOW_ADDITIONAL_EFFECTS[number]

/** Closed, cast-time choices retained by the permanent Hallow area. */
export interface Dnd5eHallowAreaState {
  additionalEffect: Dnd5eHallowAdditionalEffect
  damageType?: Dnd5eDamageType
  effectScope: 'all' | 'allies' | 'enemies' | 'creature-type'
  affectedCreatureType?: string
  wardedCreatureTypes: readonly ('celestial' | 'elemental' | 'fey' | 'fiend' | 'undead')[]
}

export const DND5E_HALLUCINATORY_TERRAIN_APPEARANCES = [
  'swamp',
  'hill',
  'crevasse',
  'meadow',
  'gentle-slope',
  'road',
  'other-natural-terrain',
] as const

export type Dnd5eHallucinatoryTerrainAppearance =
  typeof DND5E_HALLUCINATORY_TERRAIN_APPEARANCES[number]

/** Closed appearance declaration retained by a Hallucinatory Terrain area. */
export interface Dnd5eHallucinatoryTerrainAreaState {
  appearance: Dnd5eHallucinatoryTerrainAppearance
}

export const DND5E_PROGRAMMED_ILLUSION_FORMS = [
  'object',
  'creature',
  'visible-phenomenon',
] as const

export type Dnd5eProgrammedIllusionForm = typeof DND5E_PROGRAMMED_ILLUSION_FORMS[number]

export const DND5E_PROGRAMMED_ILLUSION_TRIGGER_SENSES = [
  'visual',
  'auditory',
  'visual-or-auditory',
] as const

export type Dnd5eProgrammedIllusionTriggerSense =
  typeof DND5E_PROGRAMMED_ILLUSION_TRIGGER_SENSES[number]

/** Closed parts of Programmed Illusion's declaration retained by its map area. */
export interface Dnd5eProgrammedIllusionAreaState {
  form: Dnd5eProgrammedIllusionForm
  triggerSense: Dnd5eProgrammedIllusionTriggerSense
}

export interface Dnd5ePluginEffectDuration {
  expiresAt: 'source-next-turn-start' | 'source-turn-end' | 'target-next-turn-start' | 'target-turn-end' | 'target-turn-end-save' | 'permanent'
  remainingRounds?: number
  saveAbility?: AbilityKey
  saveDc?: number
}

export type Dnd5ePersistentAreaTriggerTiming =
  | 'on-create'
  | 'on-enter'
  | 'on-move-distance'
  | 'on-area-move-impact'
  | 'turn-start'
  | 'turn-end'
  /** Resolves against all eligible occupants when the area's source starts a turn. */
  | 'source-turn-start'
  /** Resolves against all eligible occupants when an entitled Activity detonates the area. */
  | 'on-detonate'

export type Dnd5ePersistentAreaSourceKind = 'plugin-feature' | 'core-spell'
export type Dnd5ePersistentAreaAnchorMode = 'fixed' | 'source-token' | 'target-token' | 'effect-token'

export interface Dnd5ePersistentAreaObscuration {
  kind: 'light' | 'heavy'
  /** Some monster-created clouds explicitly exempt their source from obscuration. */
  sourceCanSeeThrough?: boolean
}

/** Host-owned environmental rules projected onto creatures occupying an area. */
export interface Dnd5ePersistentAreaOccupantModifiers {
  /** `fully-contained` is used by effects such as Silence; the default is any overlap. */
  containment?: 'intersects' | 'fully-contained'
  preventsVerbalComponents?: boolean
  /** Suppresses spellcasting and magical ActiveEffects while the creature occupies the area. */
  suppressesMagic?: boolean
  /** Blocks spells at or below this base spell level when cast across the area's boundary. */
  suppressesSpellsThroughLevel?: number
  damageImmunities?: readonly Dnd5eDamageType[]
  damageResistances?: readonly Dnd5eDamageType[]
  damageVulnerabilities?: readonly Dnd5eDamageType[]
  conditionImmunities?: readonly Dnd5eStandardConditionId[]
  /** Incoming attacks from these Host-canonical creature types have disadvantage. */
  attacksAgainstOccupantDisadvantageCreatureTypes?: readonly string[]
  /** Source-qualified condition immunity projected only while occupying the area. */
  conditionImmunitiesBySourceCreatureType?: readonly {
    conditions: readonly string[]
    sourceCreatureTypes: readonly string[]
  }[]
  /** Source-qualified save advantage. `any` matches saves without a condition payload. */
  savingThrowAdvantagesBySourceCreatureType?: readonly {
    conditions: readonly string[]
    sourceCreatureTypes: readonly string[]
  }[]
  /** Advantage on saving throws against spells while occupying the area. */
  spellSavingThrowAdvantage?: boolean
  /** Host-enforced immunity to being selected by spells from these schools. */
  spellTargetingImmunitySchools?: readonly import('./spellbook').Dnd5eSpellbookSchoolId[]
  /** Evasion-style suppression of half damage after a successful spell save. */
  successfulSpellSaveNegatesDamage?: boolean
  hitPointMaximumReductionImmunity?: boolean
  /** Keeps unsupported occupants airborne until they leave or the area ends. */
  magicallyHeldAloft?: boolean
  /** Severe environmental wind makes ranged weapon attacks impossible. */
  preventsRangedWeaponAttacks?: boolean
  /** Environmental distraction imposes disadvantage on damage-triggered concentration saves. */
  concentrationSavingThrowDisadvantage?: boolean
  /** Bounded language projection used by environmental effects such as Hallow. */
  languageCapabilities?: {
    understandSpoken?: 'all'
    speechUnderstoodBy?: 'any-creature-knowing-a-language'
  }
}

/** Bounded physical geometry supplied by a persistent-area entity. */
export interface Dnd5ePersistentAreaBlocking {
  /** Treat mapped walls/doors/obstacles covered by this volume as an open passage. */
  suppressesMappedBarriers?: true
  movement?: boolean
  /**
   * `occupancy` preserves wall-like blocking. Directional modes block only
   * crossing the area's boundary and therefore support reusable wards such as
   * "cannot enter" without trapping a creature that already starts inside.
   */
  movementMode?: 'occupancy' | 'enter' | 'exit' | 'boundary'
  includedCreatureTypes?: readonly string[]
  excludedCreatureTypes?: readonly string[]
  excludeSourceToken?: boolean
  /**
   * Only Token ids captured by the Host when the area is created may cross an
   * entry boundary. Content requests the policy; the map handoff owns the ids.
   */
  entryPermission?: 'occupants-at-creation'
  authorizedTokenIds?: readonly string[]
  /** Prevents teleportation crossing into or out of this area boundary. */
  blocksTeleportationEntry?: boolean
  blocksTeleportationExit?: boolean
  /** Optional saving throw that allows teleportation across an exit ward. */
  teleportationExitSavingThrow?: { ability: AbilityKey; dc: number }
  /** `boundary` permits effects within either side but never across the edge. */
  lineOfEffectMode?: 'occupancy' | 'boundary'
  /** Outside viewers cannot see through the area; inside viewers can see out. */
  visionMode?: 'occupancy' | 'outside-in'
  vision?: boolean
  lineOfEffect?: boolean
}

export type Dnd5ePersistentAreaVerticalSnapshot =
  | { mode: 'ground' }
  | {
      mode: 'volume'
      baseElevationFeet: number
      heightFeet: number
      anchorOffsetFeet?: number
    }

export interface Dnd5ePersistentAreaMovementDeclaration {
  /** `none` is used by rule-mandated movement chosen at a turn boundary. */
  economy: 'action' | 'bonus-action' | 'none'
  maximumFeet: number
  /** A moving effect may clear mapped barriers whose top is no higher than this above its path. */
  maximumBarrierHeightFeet?: number
  /** A moving effect may cross, but may not finish inside, a terrain gap no wider than this. */
  maximumGapWidthFeet?: number
  /** Optional tether to the source token, checked again after every move. */
  maximumDistanceFromSourceFeet?: number
  /** The effect ends after the command instead of rejecting an over-tether destination. */
  endWhenExceedingSourceDistance?: boolean
}

/** Host-owned follower rules for an independent area/effect token. */
export interface Dnd5ePersistentAreaSourceFollower {
  stationaryWithinFeet: number
  maximumSeparationFeet: number
  maximumStepHeightFeet?: number
  carryingCapacityPounds?: number
}

/**
 * Closed turn-boundary evolution for an authoritative map area. This is used
 * by moving hazards such as a wave, but remains content-neutral so Workshop
 * rules can reuse the same Host-owned translation and scaling transaction.
 */
export interface Dnd5ePersistentAreaTurnLifecycle {
  timing: 'source-turn-start' | 'source-turn-end'
  /** Some effects, such as Delayed Blast Fireball, advance at the end of the turn that created them. */
  advanceOnCreationRound?: boolean
  /** Stop mutating the area after this many completed lifecycle advances. */
  maximumAdvances?: number
  /** Move the complete occupied-cell snapshot directly away from its source. */
  translateAwayFromSourceFeet?: number
  /** Reduce the authoritative vertical volume after each translation. */
  heightReductionFeet?: number
  /** Apply this delta to the named trigger damage dice after each advance. */
  damageDiceCountDelta?: number
  damageTriggerIds?: readonly string[]
  minimumDamageDiceCount?: number
  /** Declarative property transitions keyed by completed source-turn advances. */
  stages?: readonly {
    atAdvance: number
    movementCostMultiplier?: number
    obscuration?: Dnd5ePersistentAreaObscuration
    occupantModifiers?: Dnd5ePersistentAreaOccupantModifiers
    /** Strong wind at this stage removes overlapping fog, mist, and similar core spell areas. */
    dispersesFogAndMist?: boolean
  }[]
}

export interface Dnd5ePersistentAreaDamageDeclaration {
  count: number
  sides: number
  modifier?: number
  modifierFormula?: import('./workshopDamageFormula').Dnd5eWorkshopDamageFormulaV1
  type: Dnd5eDamageType
}

/**
 * A data-only rider projected from the current occupants of a persistent area.
 * It is intentionally narrower than an arbitrary on-hit callback: the Host
 * owns target membership, attack eligibility, dice, critical doubling and
 * damage defenses on every weapon hit.
 */
export interface Dnd5ePersistentAreaWeaponHitBonusDamage {
  count: number
  sides: number
  bonus?: number
  type: Dnd5eDamageType
  magical?: boolean
}

/**
 * An active Activity made available only while the owning map area exists.
 * The area is an entitlement token, not an executable callback: the Host still
 * reloads the registered Activity, validates ownership/economy/targets and rolls.
 */
export interface Dnd5ePersistentAreaGrantedActivity {
  activityId: string
  /** Optional map-facing label; the Activity name remains the rules identity. */
  label?: string
  /** Prompt the same target workflow after the area is first committed. */
  activateOnCreate?: boolean
}

export interface Dnd5ePersistentAreaSaveDeclaration {
  ability: AbilityKey
  dc: number | 'source-save-dc'
  onSuccess: 'none' | 'half'
  /** The saving throw is against a magical effect, so Magic Resistance applies. */
  magical?: boolean
  /** 核心规则扩展：变形生物进行此豁免时具有劣势。 */
  shapechangerDisadvantage?: boolean
  /** 核心规则扩展：变形生物豁免失败时恢复原形。 */
  revertShapechangerOnFailure?: boolean
  /** Creatures with an authoritative swim speed roll this save with advantage. */
  advantageIfTargetHasSwimSpeed?: boolean
  /** Damage immunity may make the environmental saving throw automatically succeed. */
  automaticSuccessForDamageImmunity?: Dnd5eDamageType
}

export interface Dnd5ePersistentAreaConditionDeclaration {
  condition: Dnd5eStandardConditionId
  duration: Dnd5ePluginEffectDuration
  /** Extra bounded mechanics carried by the same authoritative condition instance. */
  modifiers?: Pick<
    import('./activeEffects').Dnd5eActiveEffectModifiers,
    'actionOrBonusActionOnly' | 'preventReactions'
  >
  escapeCheck?: {
    ability: AbilityKey
    alternativeAbility?: AbilityKey
    dc: number
    economy: 'action'
  }
}

/**
 * Declarative only: plugins cannot execute callbacks when an area is triggered.
 * The Host owns dice, saves, damage adjustment, ActiveEffect creation and receipts.
 */
export interface Dnd5ePersistentAreaTriggerDeclaration {
  id: string
  /** 不同触发时机可共享同一频率组，实现“首次进入或回合开始，每回合仅一次”。 */
  frequencyGroupId?: string
  label: string
  timing: Dnd5ePersistentAreaTriggerTiming
  /** Inclusive lifecycle stage bounds. Cast-time is 0; first source-turn advance is 1. */
  minimumLifecycleAdvances?: number
  maximumLifecycleAdvances?: number
  oncePerRound?: boolean
  /** 同一目标在每个生物回合内最多触发一次；用于“每回合首次进入/开始”语义。 */
  oncePerTurn?: boolean
  /** 同一目标在区域完整生命周期内最多触发一次。 */
  oncePerTarget?: boolean
  /** Host-captured cast-time exemptions; clients cannot mutate this list after area creation. */
  excludedTokenIds?: readonly string[]
  /** Total number of successful trigger transactions allowed for the area. */
  maximumTotalUses?: number
  /**
   * The area source must explicitly choose which eligible occupants receive
   * this trigger. The Host captures the choices before settling any target so
   * a bounded multi-target wave cannot silently use map/token iteration order.
   */
  sourceChoosesTargets?: boolean
  /** Eligible creature targets. Durable map objects are never spell-automated. */
  targetKinds?: readonly ('creature' | 'object')[]
  /** Remove the owning area after this frequency group has actually dealt this much damage. */
  maximumTotalDamage?: number
  /** `on-move-distance` 每累计多少尺触发一次；由 Host 根据完整移动路径计数。 */
  movementIntervalFeet?: number
  savingThrow?: Dnd5ePersistentAreaSaveDeclaration
  /**
   * 目标已带有同一来源的指定状态时跳过本次豁免。
   * 用于黑触手这类“已被本法术束缚者在回合开始自动受伤”的规则。
   */
  skipSaveWhenSourceConditionActive?: Dnd5eStandardConditionId
  damage?: Dnd5ePersistentAreaDamageDeclaration
  healing?: { amount: number; onlyIfAtZero?: boolean }
  condition?: Dnd5ePersistentAreaConditionDeclaration
  /**
   * Data-only alert emitted by the Host when this trigger resolves. Mental
   * notifications are addressed to the area source; audible notifications
   * carry a bounded hearing radius for presentation/audibility consumers.
   */
  notification?:
    | { delivery: 'mental-to-source'; message?: string }
    | { delivery: 'audible'; audibleRadiusFeet: number; message?: string }
  /** On a failed save, consume the target's action for the current turn. */
  consumeActionOnFailedSave?: boolean
  /** On a failed Constitution save, end any spell or feature the target is concentrating on. */
  endTargetConcentrationOnFailedSave?: boolean
  /** Host moves the affected token after the trigger's save is settled. */
  forcedMovement?: {
    mode: 'push-from-source'
    distanceFeet: number
    appliesOn: 'failed-save' | 'successful-save' | 'always'
  }
  /** Pause before commit so the DM may adjust the proposed save, damage or condition. */
  dmAdjustable?: boolean
}

export interface Dnd5ePersistentAreaTriggerSnapshot extends Omit<Dnd5ePersistentAreaTriggerDeclaration, 'savingThrow'> {
  savingThrow?: Omit<Dnd5ePersistentAreaSaveDeclaration, 'dc'> & { dc: number }
  /** 核心法术可为单个触发器限定权威触发格；缺省使用区域本体格。 */
  cells?: readonly GridCell[]
}

export interface Dnd5ePersistentAreaTriggerReceipt {
  triggerId: string
  targetTokenId: string
  round: number
  /** `${round}:${activeTokenId}`；旧存档可缺省并按 once-per-round 兼容。 */
  turnKey?: string
  transactionId: string
  /** Authoritative HP damage committed by this trigger transaction. */
  damage?: number
  /** Save gate retained by Hallow until this target leaves the area. */
  savingThrowSucceeded?: boolean
}

const ABILITIES: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const TIMINGS: readonly Dnd5ePersistentAreaTriggerTiming[] = [
  'on-create', 'on-enter', 'on-move-distance', 'on-area-move-impact', 'turn-start', 'turn-end', 'source-turn-start', 'on-detonate',
]
const EXPIRATIONS: readonly Dnd5ePluginEffectDuration['expiresAt'][] = [
  'source-next-turn-start', 'source-turn-end', 'target-next-turn-start', 'target-turn-end', 'target-turn-end-save', 'permanent',
]

export function normalizeDnd5ePersistentAreaTurnLifecycle(
  value: unknown,
): Dnd5ePersistentAreaTurnLifecycle | undefined {
  const lifecycle = record(value)
  if (!lifecycle || (lifecycle.timing !== 'source-turn-start' && lifecycle.timing !== 'source-turn-end')) return undefined
  const allowed = new Set([
    'timing', 'translateAwayFromSourceFeet', 'heightReductionFeet',
    'advanceOnCreationRound', 'maximumAdvances',
    'damageDiceCountDelta', 'damageTriggerIds', 'minimumDamageDiceCount', 'stages',
  ])
  if (Object.keys(lifecycle).some((key) => !allowed.has(key))) return undefined
  if (
    lifecycle.advanceOnCreationRound != null &&
    typeof lifecycle.advanceOnCreationRound !== 'boolean'
  ) return undefined
  if (lifecycle.maximumAdvances != null && !integer(lifecycle.maximumAdvances, 1, 14_400)) {
    return undefined
  }
  if (
    lifecycle.translateAwayFromSourceFeet != null &&
    !integer(lifecycle.translateAwayFromSourceFeet, 1, 10_000)
  ) return undefined
  if (lifecycle.heightReductionFeet != null && !integer(lifecycle.heightReductionFeet, 1, 10_000)) {
    return undefined
  }
  if (
    lifecycle.damageDiceCountDelta != null &&
    (!Number.isInteger(lifecycle.damageDiceCountDelta) || Number(lifecycle.damageDiceCountDelta) < -40 || Number(lifecycle.damageDiceCountDelta) > 40 || Number(lifecycle.damageDiceCountDelta) === 0)
  ) return undefined
  const damageTriggerIds = lifecycle.damageTriggerIds == null
    ? undefined
    : Array.isArray(lifecycle.damageTriggerIds) && lifecycle.damageTriggerIds.length > 0 &&
      lifecycle.damageTriggerIds.length <= 32 && lifecycle.damageTriggerIds.every((id) =>
        typeof id === 'string' && /^[a-z0-9][a-z0-9._-]*$/.test(id)) &&
      new Set(lifecycle.damageTriggerIds).size === lifecycle.damageTriggerIds.length
      ? [...lifecycle.damageTriggerIds] as string[]
      : null
  if (damageTriggerIds === null) return undefined
  if (
    lifecycle.minimumDamageDiceCount != null &&
    !integer(lifecycle.minimumDamageDiceCount, 0, 40)
  ) return undefined
  if (
    lifecycle.translateAwayFromSourceFeet == null &&
    lifecycle.heightReductionFeet == null &&
    lifecycle.damageDiceCountDelta == null &&
    lifecycle.stages == null
  ) return undefined
  if (lifecycle.damageDiceCountDelta != null && !damageTriggerIds?.length) return undefined
  const stages = lifecycle.stages == null
    ? undefined
    : Array.isArray(lifecycle.stages) && lifecycle.stages.length > 0 && lifecycle.stages.length <= 32
      ? lifecycle.stages.flatMap((value) => {
          const stage = record(value)
          if (!stage || Object.keys(stage).some((key) => ![
            'atAdvance', 'movementCostMultiplier', 'obscuration', 'occupantModifiers', 'dispersesFogAndMist',
          ].includes(key))) return []
          if (!integer(stage.atAdvance, 1, 14_400)) return []
          if (stage.movementCostMultiplier != null && (
            typeof stage.movementCostMultiplier !== 'number' || !Number.isFinite(stage.movementCostMultiplier) ||
            Number(stage.movementCostMultiplier) < 1 || Number(stage.movementCostMultiplier) > 100
          )) return []
          const rawObscuration = record(stage.obscuration)
          const obscuration = rawObscuration &&
            Object.keys(rawObscuration).every((key) => key === 'kind' || key === 'sourceCanSeeThrough') &&
            (rawObscuration.kind === 'light' || rawObscuration.kind === 'heavy') &&
            (rawObscuration.sourceCanSeeThrough == null || typeof rawObscuration.sourceCanSeeThrough === 'boolean')
            ? {
                kind: rawObscuration.kind as 'light' | 'heavy',
                sourceCanSeeThrough: rawObscuration.sourceCanSeeThrough === true ? true : undefined,
              }
            : undefined
          if (stage.obscuration != null && !obscuration) return []
          const occupantModifiers = stage.occupantModifiers == null
            ? undefined
            : normalizeDnd5ePersistentAreaOccupantModifiers(stage.occupantModifiers)
          if (stage.occupantModifiers != null && !occupantModifiers) return []
          const dispersesFogAndMist = stage.dispersesFogAndMist === true
          if (stage.dispersesFogAndMist != null && typeof stage.dispersesFogAndMist !== 'boolean') return []
          if (stage.movementCostMultiplier == null && !obscuration && !occupantModifiers && !dispersesFogAndMist) return []
          return [{
            atAdvance: Number(stage.atAdvance),
            movementCostMultiplier: stage.movementCostMultiplier as number | undefined,
            obscuration,
            occupantModifiers,
            dispersesFogAndMist: dispersesFogAndMist ? true : undefined,
          }]
        })
      : []
  if (lifecycle.stages != null && (
    !Array.isArray(lifecycle.stages) || stages?.length !== lifecycle.stages.length ||
    new Set(stages.map((stage) => stage.atAdvance)).size !== stages.length
  )) return undefined
  return {
    timing: lifecycle.timing,
    advanceOnCreationRound: lifecycle.advanceOnCreationRound === true ? true : undefined,
    maximumAdvances: lifecycle.maximumAdvances as number | undefined,
    translateAwayFromSourceFeet: lifecycle.translateAwayFromSourceFeet as number | undefined,
    heightReductionFeet: lifecycle.heightReductionFeet as number | undefined,
    damageDiceCountDelta: lifecycle.damageDiceCountDelta as number | undefined,
    damageTriggerIds,
    minimumDamageDiceCount: lifecycle.minimumDamageDiceCount as number | undefined,
    stages,
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function integer(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max
}

export function normalizeDnd5ePersistentAreaWeaponHitBonusDamage(
  value: unknown,
): Dnd5ePersistentAreaWeaponHitBonusDamage | undefined {
  const damage = record(value)
  if (
    !damage ||
    Object.keys(damage).some((key) => !['count', 'sides', 'bonus', 'type', 'magical'].includes(key)) ||
    !integer(damage.count, 1, 40) ||
    !integer(damage.sides, 2, 100) ||
    !integer(damage.bonus ?? 0, -1_000, 1_000) ||
    !(DND5E_DAMAGE_TYPES as readonly unknown[]).includes(damage.type) ||
    (damage.magical != null && typeof damage.magical !== 'boolean')
  ) return undefined
  return {
    count: Number(damage.count),
    sides: Number(damage.sides),
    bonus: Number(damage.bonus ?? 0),
    type: damage.type as Dnd5eDamageType,
    magical: damage.magical === true,
  }
}

export function normalizeDnd5ePersistentAreaOccupantModifiers(
  value: unknown,
): Dnd5ePersistentAreaOccupantModifiers | undefined {
  const modifiers = record(value)
  if (!modifiers || Object.keys(modifiers).some((key) => ![
    'containment', 'preventsVerbalComponents', 'suppressesMagic', 'suppressesSpellsThroughLevel', 'damageImmunities', 'damageResistances',
    'damageVulnerabilities',
    'conditionImmunities', 'attacksAgainstOccupantDisadvantageCreatureTypes',
    'conditionImmunitiesBySourceCreatureType', 'savingThrowAdvantagesBySourceCreatureType',
    'spellSavingThrowAdvantage', 'spellTargetingImmunitySchools',
    'successfulSpellSaveNegatesDamage', 'hitPointMaximumReductionImmunity', 'magicallyHeldAloft',
    'preventsRangedWeaponAttacks', 'concentrationSavingThrowDisadvantage', 'languageCapabilities',
  ].includes(key))) return undefined
  const containment = modifiers.containment ?? 'intersects'
  if (containment !== 'intersects' && containment !== 'fully-contained') return undefined
  if (modifiers.preventsVerbalComponents != null && typeof modifiers.preventsVerbalComponents !== 'boolean') {
    return undefined
  }
  if (modifiers.suppressesMagic != null && typeof modifiers.suppressesMagic !== 'boolean') return undefined
  if (
    modifiers.suppressesSpellsThroughLevel != null &&
    (!Number.isInteger(modifiers.suppressesSpellsThroughLevel) ||
      Number(modifiers.suppressesSpellsThroughLevel) < 0 ||
      Number(modifiers.suppressesSpellsThroughLevel) > 9)
  ) return undefined
  const damageImmunities = modifiers.damageImmunities == null
    ? []
    : Array.isArray(modifiers.damageImmunities)
      ? [...new Set(modifiers.damageImmunities)]
      : []
  if (
    modifiers.damageImmunities != null &&
    (!Array.isArray(modifiers.damageImmunities) ||
      damageImmunities.some((entry) => !(DND5E_DAMAGE_TYPES as readonly unknown[]).includes(entry)))
  ) return undefined
  const damageResistances = modifiers.damageResistances == null
    ? []
    : Array.isArray(modifiers.damageResistances)
      ? [...new Set(modifiers.damageResistances)]
      : []
  if (modifiers.damageResistances != null && (
    !Array.isArray(modifiers.damageResistances) ||
    damageResistances.some((entry) => !(DND5E_DAMAGE_TYPES as readonly unknown[]).includes(entry))
  )) return undefined
  const damageVulnerabilities = modifiers.damageVulnerabilities == null
    ? []
    : Array.isArray(modifiers.damageVulnerabilities)
      ? [...new Set(modifiers.damageVulnerabilities)]
      : []
  if (modifiers.damageVulnerabilities != null && (
    !Array.isArray(modifiers.damageVulnerabilities) ||
    damageVulnerabilities.some((entry) => !(DND5E_DAMAGE_TYPES as readonly unknown[]).includes(entry))
  )) return undefined
  const conditionImmunities = modifiers.conditionImmunities == null
    ? []
    : Array.isArray(modifiers.conditionImmunities)
      ? [...new Set(modifiers.conditionImmunities)]
      : []
  if (modifiers.conditionImmunities != null && (
    !Array.isArray(modifiers.conditionImmunities) ||
    conditionImmunities.some((entry) => !(DND5E_STANDARD_CONDITION_IDS as readonly unknown[]).includes(entry))
  )) return undefined
  const identifierList = (value: unknown): string[] | undefined =>
    Array.isArray(value) && value.length > 0 && value.length <= 32 && value.every((entry) =>
      typeof entry === 'string' && /^[a-z0-9][a-z0-9._:-]{0,79}$/.test(entry))
      ? [...new Set(value)] as string[]
      : undefined
  const attacksAgainstOccupantDisadvantageCreatureTypes = modifiers.attacksAgainstOccupantDisadvantageCreatureTypes == null
    ? []
    : identifierList(modifiers.attacksAgainstOccupantDisadvantageCreatureTypes)
  if (attacksAgainstOccupantDisadvantageCreatureTypes == null) return undefined
  const sourceQualifiedRules = (value: unknown) => value == null
    ? []
    : Array.isArray(value) && value.length > 0 && value.length <= 32 && value.every((rule) => {
        const candidate = record(rule)
        return !!candidate && Object.keys(candidate).every((key) =>
          key === 'conditions' || key === 'sourceCreatureTypes') &&
          identifierList(candidate.conditions) != null && identifierList(candidate.sourceCreatureTypes) != null
      })
      ? value.map((rule) => {
          const candidate = record(rule)!
          return {
            conditions: identifierList(candidate.conditions)!,
            sourceCreatureTypes: identifierList(candidate.sourceCreatureTypes)!,
          }
        })
      : undefined
  const conditionImmunitiesBySourceCreatureType = sourceQualifiedRules(
    modifiers.conditionImmunitiesBySourceCreatureType,
  )
  const savingThrowAdvantagesBySourceCreatureType = sourceQualifiedRules(
    modifiers.savingThrowAdvantagesBySourceCreatureType,
  )
  if (conditionImmunitiesBySourceCreatureType == null || savingThrowAdvantagesBySourceCreatureType == null) {
    return undefined
  }
  const spellTargetingImmunitySchools = modifiers.spellTargetingImmunitySchools == null
    ? []
    : Array.isArray(modifiers.spellTargetingImmunitySchools)
      ? [...new Set(modifiers.spellTargetingImmunitySchools)]
      : []
  if (
    modifiers.spellTargetingImmunitySchools != null &&
    (!Array.isArray(modifiers.spellTargetingImmunitySchools) ||
      spellTargetingImmunitySchools.length === 0 ||
      spellTargetingImmunitySchools.some((entry) => ![
        'abjuration', 'conjuration', 'divination', 'enchantment',
        'evocation', 'illusion', 'necromancy', 'transmutation',
      ].includes(String(entry))))
  ) return undefined
  for (const key of [
    'spellSavingThrowAdvantage', 'successfulSpellSaveNegatesDamage',
    'hitPointMaximumReductionImmunity', 'magicallyHeldAloft',
    'preventsRangedWeaponAttacks', 'concentrationSavingThrowDisadvantage',
  ] as const) {
    if (modifiers[key] != null && typeof modifiers[key] !== 'boolean') return undefined
  }
  const languageCapabilities = modifiers.languageCapabilities == null
    ? undefined
    : record(modifiers.languageCapabilities)
  if (modifiers.languageCapabilities != null && (
    !languageCapabilities ||
    Object.keys(languageCapabilities).some((key) =>
      key !== 'understandSpoken' && key !== 'speechUnderstoodBy') ||
    (languageCapabilities.understandSpoken != null && languageCapabilities.understandSpoken !== 'all') ||
    (languageCapabilities.speechUnderstoodBy != null &&
      languageCapabilities.speechUnderstoodBy !== 'any-creature-knowing-a-language') ||
    languageCapabilities.understandSpoken == null && languageCapabilities.speechUnderstoodBy == null
  )) return undefined
  if (
    modifiers.preventsVerbalComponents !== true && modifiers.suppressesMagic !== true &&
    modifiers.suppressesSpellsThroughLevel == null && damageImmunities.length === 0 &&
    damageResistances.length === 0 && damageVulnerabilities.length === 0 && conditionImmunities.length === 0 &&
    attacksAgainstOccupantDisadvantageCreatureTypes.length === 0 &&
    conditionImmunitiesBySourceCreatureType.length === 0 &&
    savingThrowAdvantagesBySourceCreatureType.length === 0 &&
    modifiers.spellSavingThrowAdvantage !== true &&
    spellTargetingImmunitySchools.length === 0 &&
    modifiers.successfulSpellSaveNegatesDamage !== true &&
    modifiers.hitPointMaximumReductionImmunity !== true &&
    modifiers.magicallyHeldAloft !== true &&
    modifiers.preventsRangedWeaponAttacks !== true &&
    modifiers.concentrationSavingThrowDisadvantage !== true && !languageCapabilities
  ) return undefined
  return {
    containment,
    preventsVerbalComponents: modifiers.preventsVerbalComponents === true,
    suppressesMagic: modifiers.suppressesMagic === true,
    suppressesSpellsThroughLevel: modifiers.suppressesSpellsThroughLevel == null
      ? undefined
      : Number(modifiers.suppressesSpellsThroughLevel),
    damageImmunities: damageImmunities as Dnd5eDamageType[],
    damageResistances: damageResistances as Dnd5eDamageType[],
    damageVulnerabilities: damageVulnerabilities as Dnd5eDamageType[],
    conditionImmunities: conditionImmunities as Dnd5eStandardConditionId[],
    attacksAgainstOccupantDisadvantageCreatureTypes,
    conditionImmunitiesBySourceCreatureType,
    savingThrowAdvantagesBySourceCreatureType,
    spellSavingThrowAdvantage: modifiers.spellSavingThrowAdvantage === true,
    spellTargetingImmunitySchools:
      spellTargetingImmunitySchools as import('./spellbook').Dnd5eSpellbookSchoolId[],
    successfulSpellSaveNegatesDamage: modifiers.successfulSpellSaveNegatesDamage === true,
    hitPointMaximumReductionImmunity: modifiers.hitPointMaximumReductionImmunity === true,
    magicallyHeldAloft: modifiers.magicallyHeldAloft === true,
    preventsRangedWeaponAttacks: modifiers.preventsRangedWeaponAttacks === true,
    concentrationSavingThrowDisadvantage: modifiers.concentrationSavingThrowDisadvantage === true,
    languageCapabilities: languageCapabilities
      ? {
          understandSpoken: languageCapabilities.understandSpoken as 'all' | undefined,
          speechUnderstoodBy: languageCapabilities.speechUnderstoodBy as
            'any-creature-knowing-a-language' | undefined,
        }
      : undefined,
  }
}

export function normalizeDnd5ePersistentAreaBlocking(
  value: unknown,
): Dnd5ePersistentAreaBlocking | undefined {
  const blocking = record(value)
  if (!blocking || Object.keys(blocking).some((key) => ![
    'suppressesMappedBarriers',
    'movement', 'movementMode', 'includedCreatureTypes', 'excludedCreatureTypes',
    'excludeSourceToken', 'entryPermission', 'authorizedTokenIds',
    'blocksTeleportationEntry', 'blocksTeleportationExit', 'teleportationExitSavingThrow',
    'vision', 'visionMode', 'lineOfEffect', 'lineOfEffectMode',
  ].includes(key))) return undefined
  if (blocking.suppressesMappedBarriers != null && blocking.suppressesMappedBarriers !== true) return undefined
  if (['movement', 'blocksTeleportationEntry', 'blocksTeleportationExit', 'vision', 'lineOfEffect'].some((key) =>
    blocking[key] != null && typeof blocking[key] !== 'boolean')) return undefined
  if (blocking.excludeSourceToken != null && typeof blocking.excludeSourceToken !== 'boolean') return undefined
  if (blocking.entryPermission != null && blocking.entryPermission !== 'occupants-at-creation') return undefined
  const teleportationExitSavingThrow = blocking.teleportationExitSavingThrow == null
    ? undefined
    : record(blocking.teleportationExitSavingThrow)
  if (teleportationExitSavingThrow && (
    Object.keys(teleportationExitSavingThrow).some((key) => !['ability', 'dc'].includes(key)) ||
    !ABILITIES.includes(teleportationExitSavingThrow.ability as AbilityKey) ||
    !integer(teleportationExitSavingThrow.dc, 1, 40)
  )) return undefined
  if (blocking.teleportationExitSavingThrow != null && !teleportationExitSavingThrow) return undefined
  if (teleportationExitSavingThrow && blocking.blocksTeleportationExit !== true) return undefined
  const authorizedTokenIds = blocking.authorizedTokenIds == null
    ? undefined
    : Array.isArray(blocking.authorizedTokenIds) && blocking.authorizedTokenIds.length <= 128 &&
      blocking.authorizedTokenIds.every((id) => typeof id === 'string' && !!id && id.length <= 160) &&
      new Set(blocking.authorizedTokenIds).size === blocking.authorizedTokenIds.length
      ? [...blocking.authorizedTokenIds] as string[]
      : undefined
  if (blocking.authorizedTokenIds != null && !authorizedTokenIds) return undefined
  if (blocking.authorizedTokenIds != null && blocking.entryPermission !== 'occupants-at-creation') return undefined
  if (blocking.movementMode != null && ![
    'occupancy', 'enter', 'exit', 'boundary',
  ].includes(String(blocking.movementMode))) return undefined
  if (blocking.lineOfEffectMode != null && !['occupancy', 'boundary'].includes(String(blocking.lineOfEffectMode))) return undefined
  if (blocking.visionMode != null && !['occupancy', 'outside-in'].includes(String(blocking.visionMode))) return undefined
  const normalizeCreatureTypes = (input: unknown): string[] | undefined => {
    if (input == null) return undefined
    if (!Array.isArray(input) || input.length < 1 || input.length > 32) return undefined
    const values = input.map((entry) => typeof entry === 'string' ? entry.trim().toLowerCase() : '')
    if (values.some((entry) => !entry || entry.length > 80) || new Set(values).size !== values.length) return undefined
    return values
  }
  const includedCreatureTypes = normalizeCreatureTypes(blocking.includedCreatureTypes)
  const excludedCreatureTypes = normalizeCreatureTypes(blocking.excludedCreatureTypes)
  if (blocking.includedCreatureTypes != null && !includedCreatureTypes) return undefined
  if (blocking.excludedCreatureTypes != null && !excludedCreatureTypes) return undefined
  if (
    blocking.suppressesMappedBarriers !== true && blocking.movement !== true && blocking.blocksTeleportationEntry !== true &&
    blocking.blocksTeleportationExit !== true && blocking.vision !== true && blocking.lineOfEffect !== true
  ) return undefined
  return {
    suppressesMappedBarriers: blocking.suppressesMappedBarriers === true ? true : undefined,
    movement: blocking.movement === true,
    movementMode: blocking.movement === true
      ? (blocking.movementMode as Dnd5ePersistentAreaBlocking['movementMode'] ?? 'occupancy')
      : undefined,
    includedCreatureTypes,
    excludedCreatureTypes,
    excludeSourceToken: blocking.excludeSourceToken === true,
    entryPermission: blocking.entryPermission === 'occupants-at-creation'
      ? 'occupants-at-creation'
      : undefined,
    authorizedTokenIds,
    blocksTeleportationEntry: blocking.blocksTeleportationEntry === true,
    blocksTeleportationExit: blocking.blocksTeleportationExit === true,
    teleportationExitSavingThrow: teleportationExitSavingThrow
      ? {
          ability: teleportationExitSavingThrow.ability as AbilityKey,
          dc: Number(teleportationExitSavingThrow.dc),
        }
      : undefined,
    vision: blocking.vision === true,
    visionMode: blocking.vision === true
      ? (blocking.visionMode as Dnd5ePersistentAreaBlocking['visionMode'] ?? 'occupancy')
      : undefined,
    lineOfEffect: blocking.lineOfEffect === true,
    lineOfEffectMode: blocking.lineOfEffect === true
      ? (blocking.lineOfEffectMode as Dnd5ePersistentAreaBlocking['lineOfEffectMode'] ?? 'occupancy')
      : undefined,
  }
}

export function normalizeDnd5ePersistentAreaGrantedActivity(
  value: unknown,
): Dnd5ePersistentAreaGrantedActivity | undefined {
  const grant = record(value)
  if (
    !grant ||
    Object.keys(grant).some((key) => !['activityId', 'label', 'activateOnCreate'].includes(key)) ||
    typeof grant.activityId !== 'string' ||
    !/^[a-z0-9][a-z0-9._:-]{0,159}$/.test(grant.activityId) ||
    (grant.label != null && (
      typeof grant.label !== 'string' || !grant.label.trim() || grant.label.length > 120
    )) ||
    (grant.activateOnCreate != null && typeof grant.activateOnCreate !== 'boolean')
  ) return undefined
  return {
    activityId: grant.activityId,
    label: typeof grant.label === 'string' ? grant.label.trim() : undefined,
    activateOnCreate: grant.activateOnCreate === true,
  }
}

/** Runtime boundary for the authoritative vertical extent of a persistent area. */
export function normalizeDnd5ePersistentAreaVerticalSnapshot(
  value: unknown,
): Dnd5ePersistentAreaVerticalSnapshot | undefined {
  const vertical = record(value)
  if (!vertical) return undefined
  if (vertical.mode === 'ground') {
    return Object.keys(vertical).length === 1 ? { mode: 'ground' } : undefined
  }
  const allowed = new Set(['mode', 'baseElevationFeet', 'heightFeet', 'anchorOffsetFeet'])
  if (
    vertical.mode !== 'volume' ||
    Object.keys(vertical).some((key) => !allowed.has(key)) ||
    !integer(vertical.baseElevationFeet, -1_000, 10_000) ||
    !integer(vertical.heightFeet, 1, 10_000) ||
    (Object.prototype.hasOwnProperty.call(vertical, 'anchorOffsetFeet') &&
      !integer(vertical.anchorOffsetFeet, -1_000, 10_000))
  ) return undefined
  return {
    mode: 'volume',
    baseElevationFeet: Number(vertical.baseElevationFeet),
    heightFeet: Number(vertical.heightFeet),
    ...(vertical.anchorOffsetFeet == null
      ? {}
      : { anchorOffsetFeet: Number(vertical.anchorOffsetFeet) }),
  }
}

export function normalizeDnd5ePersistentAreaVisual(
  value: unknown,
): Dnd5ePersistentAreaVisual | undefined {
  const visual = record(value)
  if (!visual || !(DND5E_PERSISTENT_AREA_VISUAL_PRESETS as readonly unknown[]).includes(visual.preset)) {
    return undefined
  }
  if (visual.intensity != null && !['subtle', 'normal', 'strong'].includes(String(visual.intensity))) {
    return undefined
  }
  return {
    preset: visual.preset as Dnd5ePersistentAreaVisualPreset,
    intensity: (visual.intensity as Dnd5ePersistentAreaVisualIntensity | undefined) ?? 'normal',
  }
}

export function normalizeDnd5eHallowAreaState(
  value: unknown,
): Dnd5eHallowAreaState | undefined {
  const hallow = record(value)
  if (
    !hallow ||
    Object.keys(hallow).some((key) => ![
      'additionalEffect', 'damageType', 'effectScope', 'affectedCreatureType',
      'wardedCreatureTypes',
    ].includes(key)) ||
    !(DND5E_HALLOW_ADDITIONAL_EFFECTS as readonly unknown[]).includes(hallow.additionalEffect) ||
    !['all', 'allies', 'enemies', 'creature-type'].includes(String(hallow.effectScope)) ||
    !Array.isArray(hallow.wardedCreatureTypes) ||
    hallow.wardedCreatureTypes.some((entry) =>
      !['celestial', 'elemental', 'fey', 'fiend', 'undead'].includes(String(entry))) ||
    new Set(hallow.wardedCreatureTypes).size !== hallow.wardedCreatureTypes.length ||
    (hallow.damageType != null &&
      !(DND5E_DAMAGE_TYPES as readonly unknown[]).includes(hallow.damageType)) ||
    (hallow.affectedCreatureType != null && (
      typeof hallow.affectedCreatureType !== 'string' ||
      !/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(hallow.affectedCreatureType)
    )) ||
    (hallow.effectScope === 'creature-type') !== (hallow.affectedCreatureType != null) ||
    (hallow.additionalEffect === 'energy-protection' ||
      hallow.additionalEffect === 'energy-vulnerability') !== (hallow.damageType != null)
  ) return undefined
  return {
    additionalEffect: hallow.additionalEffect as Dnd5eHallowAdditionalEffect,
    damageType: hallow.damageType as Dnd5eDamageType | undefined,
    effectScope: hallow.effectScope as Dnd5eHallowAreaState['effectScope'],
    affectedCreatureType: hallow.affectedCreatureType as string | undefined,
    wardedCreatureTypes: [...hallow.wardedCreatureTypes] as Dnd5eHallowAreaState['wardedCreatureTypes'],
  }
}

export function normalizeDnd5eHallucinatoryTerrainAreaState(
  value: unknown,
): Dnd5eHallucinatoryTerrainAreaState | undefined {
  const terrain = record(value)
  if (
    !terrain ||
    Object.keys(terrain).some((key) => key !== 'appearance') ||
    !(DND5E_HALLUCINATORY_TERRAIN_APPEARANCES as readonly unknown[]).includes(terrain.appearance)
  ) return undefined
  return { appearance: terrain.appearance as Dnd5eHallucinatoryTerrainAppearance }
}

export function normalizeDnd5eProgrammedIllusionAreaState(
  value: unknown,
): Dnd5eProgrammedIllusionAreaState | undefined {
  const illusion = record(value)
  if (
    !illusion ||
    Object.keys(illusion).some((key) => !['form', 'triggerSense'].includes(key)) ||
    !(DND5E_PROGRAMMED_ILLUSION_FORMS as readonly unknown[]).includes(illusion.form) ||
    !(DND5E_PROGRAMMED_ILLUSION_TRIGGER_SENSES as readonly unknown[]).includes(illusion.triggerSense)
  ) return undefined
  return {
    form: illusion.form as Dnd5eProgrammedIllusionForm,
    triggerSense: illusion.triggerSense as Dnd5eProgrammedIllusionTriggerSense,
  }
}

export function normalizeDnd5ePersistentAreaLighting(
  value: unknown,
): Dnd5ePersistentAreaLighting | undefined {
  const lighting = record(value)
  if (!lighting || !integer(lighting.spellLevel, 0, 9)) return undefined
  if (lighting.kind === 'light') {
    const allowed = new Set([
      'kind', 'brightRadiusFeet', 'dimRadiusFeet', 'color', 'spellLevel',
      'suppressesMagicalDarknessThroughLevel',
    ])
    if (
      Object.keys(lighting).some((key) => !allowed.has(key)) ||
      !integer(lighting.brightRadiusFeet, 0, 1_000) ||
      !integer(lighting.dimRadiusFeet, 0, 1_000) ||
      Number(lighting.brightRadiusFeet) + Number(lighting.dimRadiusFeet) < 1 ||
      typeof lighting.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(lighting.color) ||
      (lighting.suppressesMagicalDarknessThroughLevel != null &&
        !integer(lighting.suppressesMagicalDarknessThroughLevel, 0, 9))
    ) return undefined
    return {
      kind: 'light',
      brightRadiusFeet: Number(lighting.brightRadiusFeet),
      dimRadiusFeet: Number(lighting.dimRadiusFeet),
      color: lighting.color,
      spellLevel: Number(lighting.spellLevel),
      suppressesMagicalDarknessThroughLevel:
        lighting.suppressesMagicalDarknessThroughLevel as number | undefined,
    }
  }
  const allowed = new Set(['kind', 'radiusFeet', 'spellLevel', 'suppressesMagicalLightThroughLevel'])
  if (Object.keys(lighting).some((key) => !allowed.has(key)) ||
    lighting.kind !== 'magical-darkness' || !integer(lighting.radiusFeet, 1, 1_000) ||
    (lighting.suppressesMagicalLightThroughLevel != null &&
      !integer(lighting.suppressesMagicalLightThroughLevel, 0, 9))) return undefined
  return {
    kind: 'magical-darkness',
    radiusFeet: Number(lighting.radiusFeet),
    spellLevel: Number(lighting.spellLevel),
    suppressesMagicalLightThroughLevel:
      lighting.suppressesMagicalLightThroughLevel as number | undefined,
  }
}

/** Runtime boundary used by map migration and shared-state validation. */
export function normalizeDnd5ePersistentAreaTriggerSnapshot(
  value: unknown,
): Dnd5ePersistentAreaTriggerSnapshot | undefined {
  const trigger = record(value)
  if (!trigger) return undefined
  const id = trigger.id
  const frequencyGroupId = trigger.frequencyGroupId
  const label = trigger.label
  const timing = trigger.timing as Dnd5ePersistentAreaTriggerTiming
  if (
    typeof id !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/.test(id) ||
    (frequencyGroupId != null && (
      typeof frequencyGroupId !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/.test(frequencyGroupId)
    )) ||
    typeof label !== 'string' || !label.trim() || label.length > DND5E_DECLARATIVE_LABEL_MAX_LENGTH ||
    !TIMINGS.includes(timing)
  ) return undefined

  const rawDamage = record(trigger.damage)
  const modifierFormula = rawDamage?.modifierFormula as Dnd5eWorkshopDamageFormulaV1 | undefined
  // count=0 plus a positive modifier is the generic fixed-damage form used by
  // effects such as Guardian of Faith. It produces no client dice request.
  const damage = rawDamage && integer(rawDamage.count, 0, 40) && integer(rawDamage.sides, 2, 100) &&
    integer(rawDamage.modifier ?? 0, -1_000, 1_000) &&
    (!modifierFormula || validateDnd5eWorkshopDamageFormulaV1(modifierFormula).length === 0) &&
    (DND5E_DAMAGE_TYPES as readonly unknown[]).includes(rawDamage.type)
    ? {
        count: rawDamage.count,
        sides: rawDamage.sides,
        modifier: Number(rawDamage.modifier ?? 0),
        ...(modifierFormula ? { modifierFormula: structuredClone(modifierFormula) } : {}),
        type: rawDamage.type as Dnd5eDamageType,
      }
    : undefined

  const rawHealing = record(trigger.healing)
  const healing = rawHealing && integer(rawHealing.amount, 1, 1_000_000) &&
    (rawHealing.onlyIfAtZero == null || typeof rawHealing.onlyIfAtZero === 'boolean')
    ? { amount: Number(rawHealing.amount), onlyIfAtZero: rawHealing.onlyIfAtZero === true }
    : undefined

  const rawNotification = record(trigger.notification)
  const notificationMessage = typeof rawNotification?.message === 'string' &&
    rawNotification.message.trim() && rawNotification.message.length <= 250
    ? rawNotification.message.normalize('NFKC').trim().replace(/\s+/g, ' ')
    : undefined
  const notification = rawNotification &&
    Object.keys(rawNotification).every((key) => key === 'delivery' || key === 'audibleRadiusFeet' || key === 'message') &&
    (rawNotification.message == null || notificationMessage != null) &&
    (
      (rawNotification.delivery === 'mental-to-source' && rawNotification.audibleRadiusFeet == null) ||
      (rawNotification.delivery === 'audible' && integer(rawNotification.audibleRadiusFeet, 1, 10_000))
    )
    ? rawNotification.delivery === 'mental-to-source'
      ? { delivery: 'mental-to-source' as const, message: notificationMessage }
      : { delivery: 'audible' as const, audibleRadiusFeet: Number(rawNotification.audibleRadiusFeet), message: notificationMessage }
    : undefined

  const rawSave = record(trigger.savingThrow)
  const savingThrow = rawSave && ABILITIES.includes(rawSave.ability as AbilityKey) &&
    integer(rawSave.dc, 1, 40) &&
    (rawSave.magical == null || typeof rawSave.magical === 'boolean') &&
    (rawSave.advantageIfTargetHasSwimSpeed == null || typeof rawSave.advantageIfTargetHasSwimSpeed === 'boolean') &&
    (rawSave.onSuccess === 'none' || rawSave.onSuccess === 'half')
    ? {
        ability: rawSave.ability as AbilityKey,
        dc: rawSave.dc,
        onSuccess: rawSave.onSuccess as 'none' | 'half',
        magical: rawSave.magical === true,
        shapechangerDisadvantage: rawSave.shapechangerDisadvantage === true,
        revertShapechangerOnFailure: rawSave.revertShapechangerOnFailure === true,
        advantageIfTargetHasSwimSpeed: rawSave.advantageIfTargetHasSwimSpeed === true,
        automaticSuccessForDamageImmunity:
          (DND5E_DAMAGE_TYPES as readonly unknown[]).includes(rawSave.automaticSuccessForDamageImmunity)
            ? rawSave.automaticSuccessForDamageImmunity as Dnd5eDamageType
            : undefined,
      }
    : undefined

  const rawCondition = record(trigger.condition)
  const rawConditionModifiers = record(rawCondition?.modifiers)
  const conditionModifiers = rawConditionModifiers &&
    Object.keys(rawConditionModifiers).every((key) =>
      key === 'actionOrBonusActionOnly' || key === 'preventReactions') &&
    (rawConditionModifiers.actionOrBonusActionOnly == null ||
      typeof rawConditionModifiers.actionOrBonusActionOnly === 'boolean') &&
    (rawConditionModifiers.preventReactions == null ||
      typeof rawConditionModifiers.preventReactions === 'boolean')
    ? {
        actionOrBonusActionOnly: rawConditionModifiers.actionOrBonusActionOnly as boolean | undefined,
        preventReactions: rawConditionModifiers.preventReactions as boolean | undefined,
      }
    : rawCondition?.modifiers == null
      ? undefined
      : null
  const rawDuration = record(rawCondition?.duration)
  const duration = rawDuration && EXPIRATIONS.includes(rawDuration.expiresAt as Dnd5ePluginEffectDuration['expiresAt']) &&
    (rawDuration.remainingRounds == null || integer(rawDuration.remainingRounds, 1, DND5E_DECLARATIVE_DURATION_MAX_ROUNDS)) &&
    (rawDuration.saveAbility == null || ABILITIES.includes(rawDuration.saveAbility as AbilityKey)) &&
    (rawDuration.saveDc == null || integer(rawDuration.saveDc, 1, 40))
    ? {
        expiresAt: rawDuration.expiresAt as Dnd5ePluginEffectDuration['expiresAt'],
        remainingRounds: rawDuration.remainingRounds as number | undefined,
        saveAbility: rawDuration.saveAbility as AbilityKey | undefined,
        saveDc: rawDuration.saveDc as number | undefined,
      }
    : undefined
  const rawEscapeCheck = record(rawCondition?.escapeCheck)
  const escapeCheck = rawCondition?.escapeCheck == null
    ? undefined
    : rawEscapeCheck &&
      Object.keys(rawEscapeCheck).every((key) => ['ability', 'alternativeAbility', 'dc', 'economy'].includes(key)) &&
      ABILITIES.includes(rawEscapeCheck.ability as AbilityKey) &&
      (rawEscapeCheck.alternativeAbility == null ||
        ABILITIES.includes(rawEscapeCheck.alternativeAbility as AbilityKey)) &&
      integer(rawEscapeCheck.dc, 1, 100) &&
      rawEscapeCheck.economy === 'action'
      ? {
          ability: rawEscapeCheck.ability as AbilityKey,
          alternativeAbility: rawEscapeCheck.alternativeAbility as AbilityKey | undefined,
          dc: Number(rawEscapeCheck.dc),
          economy: 'action' as const,
        }
      : null
  const condition = rawCondition && duration &&
    (DND5E_STANDARD_CONDITION_IDS as readonly unknown[]).includes(rawCondition.condition) &&
    (duration.expiresAt !== 'target-turn-end-save' || (!!duration.saveAbility && !!duration.saveDc)) &&
    escapeCheck !== null && conditionModifiers !== null
    ? {
        condition: rawCondition.condition as Dnd5eStandardConditionId,
        duration,
        escapeCheck,
        modifiers: conditionModifiers,
      }
    : undefined

  const consumeActionOnFailedSave = trigger.consumeActionOnFailedSave === true
  if (trigger.consumeActionOnFailedSave != null && typeof trigger.consumeActionOnFailedSave !== 'boolean') return undefined
  const endTargetConcentrationOnFailedSave = trigger.endTargetConcentrationOnFailedSave === true
  if (
    trigger.endTargetConcentrationOnFailedSave != null &&
    typeof trigger.endTargetConcentrationOnFailedSave !== 'boolean'
  ) return undefined
  if (
    (trigger.oncePerRound != null && typeof trigger.oncePerRound !== 'boolean') ||
    (trigger.oncePerTurn != null && typeof trigger.oncePerTurn !== 'boolean') ||
    (trigger.oncePerTarget != null && typeof trigger.oncePerTarget !== 'boolean')
  ) return undefined
  const excludedTokenIds = trigger.excludedTokenIds == null
    ? undefined
    : Array.isArray(trigger.excludedTokenIds) && trigger.excludedTokenIds.length <= 256 &&
      trigger.excludedTokenIds.every((id) => typeof id === 'string' && /^[a-z0-9][a-z0-9._:-]{0,159}$/.test(id)) &&
      new Set(trigger.excludedTokenIds).size === trigger.excludedTokenIds.length
      ? [...trigger.excludedTokenIds] as string[]
      : null
  if (excludedTokenIds === null) return undefined
  const minimumLifecycleAdvances = trigger.minimumLifecycleAdvances == null
    ? undefined
    : integer(trigger.minimumLifecycleAdvances, 0, 14_400)
      ? Number(trigger.minimumLifecycleAdvances)
      : undefined
  const maximumLifecycleAdvances = trigger.maximumLifecycleAdvances == null
    ? undefined
    : integer(trigger.maximumLifecycleAdvances, 0, 14_400)
      ? Number(trigger.maximumLifecycleAdvances)
      : undefined
  if (
    (trigger.minimumLifecycleAdvances != null && minimumLifecycleAdvances == null) ||
    (trigger.maximumLifecycleAdvances != null && maximumLifecycleAdvances == null) ||
    (minimumLifecycleAdvances != null && maximumLifecycleAdvances != null && minimumLifecycleAdvances > maximumLifecycleAdvances)
  ) return undefined
  const rawForcedMovement = record(trigger.forcedMovement)
  const forcedMovement = rawForcedMovement &&
    Object.keys(rawForcedMovement).every((key) => ['mode', 'distanceFeet', 'appliesOn'].includes(key)) &&
    rawForcedMovement.mode === 'push-from-source' &&
    integer(rawForcedMovement.distanceFeet, 1, 1_000) &&
    ['failed-save', 'successful-save', 'always'].includes(String(rawForcedMovement.appliesOn))
    ? {
        mode: 'push-from-source' as const,
        distanceFeet: Number(rawForcedMovement.distanceFeet),
        appliesOn: rawForcedMovement.appliesOn as 'failed-save' | 'successful-save' | 'always',
      }
    : undefined
  if (trigger.forcedMovement != null && !forcedMovement) return undefined
  if (forcedMovement && forcedMovement.appliesOn !== 'always' && !savingThrow) return undefined
  if (!damage && !healing && !condition && !notification && !savingThrow && !consumeActionOnFailedSave && !forcedMovement) return undefined
  if (damage && damage.count === 0 && damage.modifier <= 0 && !damage.modifierFormula) return undefined
  if (trigger.healing != null && !healing) return undefined
  if (trigger.notification != null && !notification) return undefined
  if (trigger.savingThrow != null && !savingThrow) return undefined
  if (rawSave?.automaticSuccessForDamageImmunity != null &&
    !(DND5E_DAMAGE_TYPES as readonly unknown[]).includes(rawSave.automaticSuccessForDamageImmunity)) return undefined
  if (consumeActionOnFailedSave && !savingThrow) return undefined
  if (endTargetConcentrationOnFailedSave && savingThrow?.ability !== 'con') return undefined
  const movementIntervalFeet = trigger.timing === 'on-move-distance' &&
    integer(trigger.movementIntervalFeet, 1, 1_000)
    ? trigger.movementIntervalFeet
    : undefined
  if (trigger.timing === 'on-move-distance' && movementIntervalFeet == null) return undefined
  if (trigger.timing !== 'on-move-distance' && trigger.movementIntervalFeet != null) return undefined
  const maximumTotalUses = trigger.maximumTotalUses == null
    ? undefined
    : integer(trigger.maximumTotalUses, 1, 10_000)
      ? Number(trigger.maximumTotalUses)
      : undefined
  if (trigger.maximumTotalUses != null && maximumTotalUses == null) return undefined
  const sourceChoosesTargets = trigger.sourceChoosesTargets === true
  if (trigger.sourceChoosesTargets != null && typeof trigger.sourceChoosesTargets !== 'boolean') return undefined
  if (sourceChoosesTargets && (trigger.timing !== 'source-turn-start' || maximumTotalUses == null)) return undefined
  const targetKinds = trigger.targetKinds == null
    ? undefined
    : Array.isArray(trigger.targetKinds) && trigger.targetKinds.length === 1 &&
      trigger.targetKinds.every((kind) => kind === 'creature') &&
      new Set(trigger.targetKinds).size === trigger.targetKinds.length
      ? [...trigger.targetKinds] as 'creature'[]
      : null
  if (targetKinds === null) return undefined
  const maximumTotalDamage = trigger.maximumTotalDamage == null
    ? undefined
    : integer(trigger.maximumTotalDamage, 1, 1_000_000)
      ? Number(trigger.maximumTotalDamage)
      : undefined
  if (trigger.maximumTotalDamage != null && maximumTotalDamage == null) return undefined
  const cells = trigger.cells == null
    ? undefined
    : Array.isArray(trigger.cells) && trigger.cells.length >= 1 && trigger.cells.length <= 4_096
      ? trigger.cells.flatMap((cell) => {
          const entry = record(cell)
          return entry && integer(entry.col, -10_000, 10_000) && integer(entry.row, -10_000, 10_000)
            ? [{ col: Number(entry.col), row: Number(entry.row) }]
            : []
        })
      : []
  if (trigger.cells != null && (
    !Array.isArray(trigger.cells) || cells?.length !== trigger.cells.length
  )) return undefined
  const skipSaveWhenSourceConditionActive =
    (DND5E_STANDARD_CONDITION_IDS as readonly unknown[]).includes(trigger.skipSaveWhenSourceConditionActive)
      ? trigger.skipSaveWhenSourceConditionActive as Dnd5eStandardConditionId
      : undefined
  if (trigger.skipSaveWhenSourceConditionActive != null && !skipSaveWhenSourceConditionActive) return undefined
  return {
    id,
    frequencyGroupId: frequencyGroupId as string | undefined,
    label: label.trim(),
    timing,
    minimumLifecycleAdvances,
    maximumLifecycleAdvances,
    oncePerRound: trigger.oncePerTarget === true || trigger.oncePerTurn === true
      ? false
      : trigger.oncePerRound !== false,
    oncePerTurn: trigger.oncePerTarget === true ? false : trigger.oncePerTurn === true,
    oncePerTarget: trigger.oncePerTarget === true,
    excludedTokenIds,
    maximumTotalUses,
    sourceChoosesTargets,
    targetKinds,
    maximumTotalDamage,
    movementIntervalFeet,
    savingThrow,
    skipSaveWhenSourceConditionActive,
    damage,
    healing,
    condition,
    notification,
    consumeActionOnFailedSave,
    endTargetConcentrationOnFailedSave,
    forcedMovement,
    cells,
    dmAdjustable: trigger.dmAdjustable === true,
  }
}

/** Build-time boundary for plugin declarations whose save DC may come from the source. */
export function normalizeDnd5ePersistentAreaTriggerDeclaration(
  value: unknown,
): Dnd5ePersistentAreaTriggerDeclaration | undefined {
  const trigger = record(value)
  if (!trigger) return undefined
  const rawSave = record(trigger.savingThrow)
  if (rawSave && rawSave.dc !== 'source-save-dc' && !integer(rawSave.dc, 1, 40)) return undefined
  const normalized = normalizeDnd5ePersistentAreaTriggerSnapshot({
    ...trigger,
    savingThrow: rawSave
      ? { ...rawSave, dc: rawSave.dc === 'source-save-dc' ? 10 : rawSave.dc }
      : undefined,
  })
  if (!normalized) return undefined
  return {
    ...normalized,
    savingThrow: normalized.savingThrow && rawSave
      ? {
          ability: normalized.savingThrow.ability,
          dc: rawSave.dc === 'source-save-dc' ? 'source-save-dc' : normalized.savingThrow.dc,
          onSuccess: normalized.savingThrow.onSuccess,
          magical: normalized.savingThrow.magical,
          shapechangerDisadvantage: normalized.savingThrow.shapechangerDisadvantage,
          revertShapechangerOnFailure: normalized.savingThrow.revertShapechangerOnFailure,
          advantageIfTargetHasSwimSpeed: normalized.savingThrow.advantageIfTargetHasSwimSpeed,
          automaticSuccessForDamageImmunity:
            normalized.savingThrow.automaticSuccessForDamageImmunity,
        }
      : undefined,
  }
}
