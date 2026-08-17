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

export type Dnd5ePersistentAreaSourceKind = 'plugin-feature' | 'core-spell'
export type Dnd5ePersistentAreaAnchorMode = 'fixed' | 'source-token' | 'effect-token'

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
  damageImmunities?: readonly Dnd5eDamageType[]
  damageResistances?: readonly Dnd5eDamageType[]
  conditionImmunities?: readonly Dnd5eStandardConditionId[]
  /** Advantage on saving throws against spells while occupying the area. */
  spellSavingThrowAdvantage?: boolean
  /** Evasion-style suppression of half damage after a successful spell save. */
  successfulSpellSaveNegatesDamage?: boolean
  hitPointMaximumReductionImmunity?: boolean
}

/** Bounded physical geometry supplied by a persistent-area entity. */
export interface Dnd5ePersistentAreaBlocking {
  movement?: boolean
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
  economy: 'action' | 'bonus-action'
  maximumFeet: number
  /** Optional tether to the source token, checked again after every move. */
  maximumDistanceFromSourceFeet?: number
}

/**
 * Closed turn-boundary evolution for an authoritative map area. This is used
 * by moving hazards such as a wave, but remains content-neutral so Workshop
 * rules can reuse the same Host-owned translation and scaling transaction.
 */
export interface Dnd5ePersistentAreaTurnLifecycle {
  timing: 'source-turn-start'
  /** Move the complete occupied-cell snapshot directly away from its source. */
  translateAwayFromSourceFeet?: number
  /** Reduce the authoritative vertical volume after each translation. */
  heightReductionFeet?: number
  /** Apply this delta to the named trigger damage dice after each advance. */
  damageDiceCountDelta?: number
  damageTriggerIds?: readonly string[]
  minimumDamageDiceCount?: number
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
  oncePerRound?: boolean
  /** 同一目标在每个生物回合内最多触发一次；用于“每回合首次进入/开始”语义。 */
  oncePerTurn?: boolean
  /** Total number of successful trigger transactions allowed for the area. */
  maximumTotalUses?: number
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
  /** On a failed save, consume the target's action for the current turn. */
  consumeActionOnFailedSave?: boolean
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
}

const ABILITIES: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const TIMINGS: readonly Dnd5ePersistentAreaTriggerTiming[] = [
  'on-create', 'on-enter', 'on-move-distance', 'on-area-move-impact', 'turn-start', 'turn-end',
]
const EXPIRATIONS: readonly Dnd5ePluginEffectDuration['expiresAt'][] = [
  'source-next-turn-start', 'source-turn-end', 'target-next-turn-start', 'target-turn-end', 'target-turn-end-save', 'permanent',
]

export function normalizeDnd5ePersistentAreaTurnLifecycle(
  value: unknown,
): Dnd5ePersistentAreaTurnLifecycle | undefined {
  const lifecycle = record(value)
  if (!lifecycle || lifecycle.timing !== 'source-turn-start') return undefined
  const allowed = new Set([
    'timing', 'translateAwayFromSourceFeet', 'heightReductionFeet',
    'damageDiceCountDelta', 'damageTriggerIds', 'minimumDamageDiceCount',
  ])
  if (Object.keys(lifecycle).some((key) => !allowed.has(key))) return undefined
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
    lifecycle.damageDiceCountDelta == null
  ) return undefined
  if (lifecycle.damageDiceCountDelta != null && !damageTriggerIds?.length) return undefined
  return {
    timing: 'source-turn-start',
    translateAwayFromSourceFeet: lifecycle.translateAwayFromSourceFeet as number | undefined,
    heightReductionFeet: lifecycle.heightReductionFeet as number | undefined,
    damageDiceCountDelta: lifecycle.damageDiceCountDelta as number | undefined,
    damageTriggerIds,
    minimumDamageDiceCount: lifecycle.minimumDamageDiceCount as number | undefined,
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
    'containment', 'preventsVerbalComponents', 'damageImmunities', 'damageResistances',
    'conditionImmunities', 'spellSavingThrowAdvantage',
    'successfulSpellSaveNegatesDamage', 'hitPointMaximumReductionImmunity',
  ].includes(key))) return undefined
  const containment = modifiers.containment ?? 'intersects'
  if (containment !== 'intersects' && containment !== 'fully-contained') return undefined
  if (modifiers.preventsVerbalComponents != null && typeof modifiers.preventsVerbalComponents !== 'boolean') {
    return undefined
  }
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
  const conditionImmunities = modifiers.conditionImmunities == null
    ? []
    : Array.isArray(modifiers.conditionImmunities)
      ? [...new Set(modifiers.conditionImmunities)]
      : []
  if (modifiers.conditionImmunities != null && (
    !Array.isArray(modifiers.conditionImmunities) ||
    conditionImmunities.some((entry) => !(DND5E_STANDARD_CONDITION_IDS as readonly unknown[]).includes(entry))
  )) return undefined
  for (const key of [
    'spellSavingThrowAdvantage', 'successfulSpellSaveNegatesDamage',
    'hitPointMaximumReductionImmunity',
  ] as const) {
    if (modifiers[key] != null && typeof modifiers[key] !== 'boolean') return undefined
  }
  if (
    modifiers.preventsVerbalComponents !== true && damageImmunities.length === 0 &&
    damageResistances.length === 0 && conditionImmunities.length === 0 &&
    modifiers.spellSavingThrowAdvantage !== true &&
    modifiers.successfulSpellSaveNegatesDamage !== true &&
    modifiers.hitPointMaximumReductionImmunity !== true
  ) return undefined
  return {
    containment,
    preventsVerbalComponents: modifiers.preventsVerbalComponents === true,
    damageImmunities: damageImmunities as Dnd5eDamageType[],
    damageResistances: damageResistances as Dnd5eDamageType[],
    conditionImmunities: conditionImmunities as Dnd5eStandardConditionId[],
    spellSavingThrowAdvantage: modifiers.spellSavingThrowAdvantage === true,
    successfulSpellSaveNegatesDamage: modifiers.successfulSpellSaveNegatesDamage === true,
    hitPointMaximumReductionImmunity: modifiers.hitPointMaximumReductionImmunity === true,
  }
}

export function normalizeDnd5ePersistentAreaBlocking(
  value: unknown,
): Dnd5ePersistentAreaBlocking | undefined {
  const blocking = record(value)
  if (!blocking || Object.keys(blocking).some((key) => ![
    'movement', 'vision', 'lineOfEffect',
  ].includes(key))) return undefined
  if (['movement', 'vision', 'lineOfEffect'].some((key) =>
    blocking[key] != null && typeof blocking[key] !== 'boolean')) return undefined
  if (blocking.movement !== true && blocking.vision !== true && blocking.lineOfEffect !== true) return undefined
  return {
    movement: blocking.movement === true,
    vision: blocking.vision === true,
    lineOfEffect: blocking.lineOfEffect === true,
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
  const damage = rawDamage && integer(rawDamage.count, 1, 40) && integer(rawDamage.sides, 2, 100) &&
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
  if (!damage && !healing && !condition && !consumeActionOnFailedSave) return undefined
  if (trigger.healing != null && !healing) return undefined
  if (trigger.savingThrow != null && !savingThrow) return undefined
  if (rawSave?.automaticSuccessForDamageImmunity != null &&
    !(DND5E_DAMAGE_TYPES as readonly unknown[]).includes(rawSave.automaticSuccessForDamageImmunity)) return undefined
  if (consumeActionOnFailedSave && !savingThrow) return undefined
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
    oncePerRound: trigger.oncePerTurn === true ? false : trigger.oncePerRound !== false,
    oncePerTurn: trigger.oncePerTurn === true,
    maximumTotalUses,
    movementIntervalFeet,
    savingThrow,
    skipSaveWhenSourceConditionActive,
    damage,
    healing,
    condition,
    consumeActionOnFailedSave,
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
