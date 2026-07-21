import type { AbilityKey } from '../../lib/dnd'
import { DND5E_STANDARD_CONDITION_IDS, type Dnd5eStandardConditionId } from './conditions'
import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from './monsters'

export const DND5E_DECLARATIVE_LABEL_MAX_LENGTH = 120
export const DND5E_DECLARATIVE_DURATION_MAX_ROUNDS = 14_400

export const DND5E_PERSISTENT_AREA_VISUAL_PRESETS = [
  'arcane',
  'toxic-cloud',
  'moonbeam',
  'spirit-guardians',
  'spike-growth',
  'flaming-sphere',
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

export interface Dnd5ePluginEffectDuration {
  expiresAt: 'source-next-turn-start' | 'target-next-turn-start' | 'target-turn-end' | 'target-turn-end-save'
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

export interface Dnd5ePersistentAreaMovementDeclaration {
  economy: 'action' | 'bonus-action'
  maximumFeet: number
}

export interface Dnd5ePersistentAreaDamageDeclaration {
  count: number
  sides: number
  modifier?: number
  type: Dnd5eDamageType
}

export interface Dnd5ePersistentAreaSaveDeclaration {
  ability: AbilityKey
  dc: number | 'source-save-dc'
  onSuccess: 'none' | 'half'
  /** 核心规则扩展：变形生物进行此豁免时具有劣势。 */
  shapechangerDisadvantage?: boolean
  /** 核心规则扩展：变形生物豁免失败时恢复原形。 */
  revertShapechangerOnFailure?: boolean
}

export interface Dnd5ePersistentAreaConditionDeclaration {
  condition: Dnd5eStandardConditionId
  duration: Dnd5ePluginEffectDuration
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
  /** `on-move-distance` 每累计多少尺触发一次；由 Host 根据完整移动路径计数。 */
  movementIntervalFeet?: number
  savingThrow?: Dnd5ePersistentAreaSaveDeclaration
  damage?: Dnd5ePersistentAreaDamageDeclaration
  condition?: Dnd5ePersistentAreaConditionDeclaration
  /** Pause before commit so the DM may adjust the proposed save, damage or condition. */
  dmAdjustable?: boolean
}

export interface Dnd5ePersistentAreaTriggerSnapshot extends Omit<Dnd5ePersistentAreaTriggerDeclaration, 'savingThrow'> {
  savingThrow?: Omit<Dnd5ePersistentAreaSaveDeclaration, 'dc'> & { dc: number }
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
  'source-next-turn-start', 'target-next-turn-start', 'target-turn-end', 'target-turn-end-save',
]

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function integer(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max
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
  const damage = rawDamage && integer(rawDamage.count, 1, 40) && integer(rawDamage.sides, 2, 100) &&
    integer(rawDamage.modifier ?? 0, -1_000, 1_000) &&
    (DND5E_DAMAGE_TYPES as readonly unknown[]).includes(rawDamage.type)
    ? {
        count: rawDamage.count,
        sides: rawDamage.sides,
        modifier: Number(rawDamage.modifier ?? 0),
        type: rawDamage.type as Dnd5eDamageType,
      }
    : undefined

  const rawSave = record(trigger.savingThrow)
  const savingThrow = rawSave && ABILITIES.includes(rawSave.ability as AbilityKey) &&
    integer(rawSave.dc, 1, 40) && (rawSave.onSuccess === 'none' || rawSave.onSuccess === 'half')
    ? {
        ability: rawSave.ability as AbilityKey,
        dc: rawSave.dc,
        onSuccess: rawSave.onSuccess as 'none' | 'half',
        shapechangerDisadvantage: rawSave.shapechangerDisadvantage === true,
        revertShapechangerOnFailure: rawSave.revertShapechangerOnFailure === true,
      }
    : undefined

  const rawCondition = record(trigger.condition)
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
  const condition = rawCondition && duration &&
    (DND5E_STANDARD_CONDITION_IDS as readonly unknown[]).includes(rawCondition.condition) &&
    (duration.expiresAt !== 'target-turn-end-save' || (!!duration.saveAbility && !!duration.saveDc))
    ? { condition: rawCondition.condition as Dnd5eStandardConditionId, duration }
    : undefined

  if (!damage && !condition) return undefined
  if (trigger.savingThrow != null && !savingThrow) return undefined
  const movementIntervalFeet = trigger.timing === 'on-move-distance' &&
    integer(trigger.movementIntervalFeet, 1, 1_000)
    ? trigger.movementIntervalFeet
    : undefined
  if (trigger.timing === 'on-move-distance' && movementIntervalFeet == null) return undefined
  if (trigger.timing !== 'on-move-distance' && trigger.movementIntervalFeet != null) return undefined
  return {
    id,
    frequencyGroupId: frequencyGroupId as string | undefined,
    label: label.trim(),
    timing,
    oncePerRound: trigger.oncePerTurn === true ? false : trigger.oncePerRound !== false,
    oncePerTurn: trigger.oncePerTurn === true,
    movementIntervalFeet,
    savingThrow,
    damage,
    condition,
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
          shapechangerDisadvantage: normalized.savingThrow.shapechangerDisadvantage,
          revertShapechangerOnFailure: normalized.savingThrow.revertShapechangerOnFailure,
        }
      : undefined,
  }
}
