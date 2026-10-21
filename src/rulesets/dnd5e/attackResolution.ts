import type { AttackResolution, D20RollResult } from '../contracts'
import { dnd5eTargetCriticalThreshold } from './targetCriticalThreshold'
import type { Dnd5eActiveEffectInstance } from './activeEffects'

export interface Dnd5eAttackOutcomeInput {
  sourceId?: string
  targetEffects?: readonly Dnd5eActiveEffectInstance[]
  attack: AttackResolution
  targetArmorClass?: number
  criticalThreshold?: number
  automaticCritical?: boolean
  /** Host-authorized cancellation after a critical hit; never changes whether the attack hit. */
  cancelCritical?: boolean
  forceHit?: boolean
}

/** Headless sentinel: total cover cannot be bypassed by a natural 20 or a forced hit. */
export const DND5E_TOTAL_COVER_ARMOR_CLASS = 1_000_000

/**
 * D&D 5e 2014 的最终命中/重击判定。
 *
 * 达到扩展重击范围的骰值直接命中。麻痹/昏迷等“命中后自动重击”
 * 仍必须建立在攻击已经命中的前提上；完全掩护仍使目标不可攻击。
 */
export function resolveDnd5eAttackOutcome(input: Dnd5eAttackOutcomeInput): AttackResolution {
  const targetAc = input.targetArmorClass ?? input.attack.targetAc
  return { ...input.attack, targetAc, ...resolveDnd5eAttackRollOutcome({ ...input, roll: input.attack.roll, targetArmorClass: targetAc,
    criticalThreshold: dnd5eTargetCriticalThreshold(input.targetEffects, input.sourceId, input.criticalThreshold) }) }
}

/** Shared by native attacks, Activity settlement and submitted-dice hit prediction. */
export function resolveDnd5eAttackRollOutcome(input: {
  roll: Pick<D20RollResult, 'd20' | 'total' | 'naturalOne' | 'naturalTwenty'>
  targetArmorClass: number
  criticalThreshold?: number
  automaticCritical?: boolean
  /** Host-authorized cancellation after a critical hit; never changes whether the attack hit. */
  cancelCritical?: boolean
  forceHit?: boolean
}): { hit: boolean; critical: boolean } {
  const targetAc = input.targetArmorClass
  const threshold = Math.min(20, Math.max(2, Math.floor(input.criticalThreshold ?? 20)))
  const roll = input.roll
  const totalCover = targetAc >= DND5E_TOTAL_COVER_ARMOR_CLASS
  const hit = !totalCover && (roll.naturalTwenty || input.forceHit === true ||
    (!roll.naturalOne && (roll.d20 >= threshold || roll.total >= targetAc)))
  const critical = hit && input.cancelCritical !== true && (roll.d20 >= threshold || input.automaticCritical === true)
  return { hit, critical }
}
