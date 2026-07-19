import type { AbilityKey } from '../../lib/dnd'
import { DND5E_STANDARD_CONDITION_IDS, type Dnd5eStandardConditionId } from './conditions'
import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from './monsters'

export interface Dnd5ePluginEffectDuration {
  expiresAt: 'source-next-turn-start' | 'target-next-turn-start' | 'target-turn-end' | 'target-turn-end-save'
  remainingRounds?: number
  saveAbility?: AbilityKey
  saveDc?: number
}

export type Dnd5ePersistentAreaTriggerTiming =
  | 'on-create'
  | 'on-enter'
  | 'turn-start'
  | 'turn-end'

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
  label: string
  timing: Dnd5ePersistentAreaTriggerTiming
  oncePerRound?: boolean
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
  transactionId: string
}

const ABILITIES: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const TIMINGS: readonly Dnd5ePersistentAreaTriggerTiming[] = ['on-create', 'on-enter', 'turn-start', 'turn-end']
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

/** Runtime boundary used by map migration and shared-state validation. */
export function normalizeDnd5ePersistentAreaTriggerSnapshot(
  value: unknown,
): Dnd5ePersistentAreaTriggerSnapshot | undefined {
  const trigger = record(value)
  if (!trigger) return undefined
  const id = trigger.id
  const label = trigger.label
  const timing = trigger.timing as Dnd5ePersistentAreaTriggerTiming
  if (
    typeof id !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/.test(id) ||
    typeof label !== 'string' || !label.trim() || label.length > 120 ||
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
      }
    : undefined

  const rawCondition = record(trigger.condition)
  const rawDuration = record(rawCondition?.duration)
  const duration = rawDuration && EXPIRATIONS.includes(rawDuration.expiresAt as Dnd5ePluginEffectDuration['expiresAt']) &&
    (rawDuration.remainingRounds == null || integer(rawDuration.remainingRounds, 1, 14_400)) &&
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
  return {
    id,
    label: label.trim(),
    timing,
    oncePerRound: trigger.oncePerRound !== false,
    savingThrow,
    damage,
    condition,
    dmAdjustable: trigger.dmAdjustable === true,
  }
}
