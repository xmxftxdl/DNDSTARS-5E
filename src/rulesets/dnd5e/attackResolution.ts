import type { AttackResolution } from '../contracts'

export interface Dnd5eAttackOutcomeInput {
  attack: AttackResolution
  targetArmorClass?: number
  criticalThreshold?: number
  automaticCritical?: boolean
  forceHit?: boolean
}

/**
 * D&D 5e 2014 的最终命中/重击判定。
 *
 * 扩展重击范围只改变“命中后的重击”范围；只有天然 20 会无视 AC
 * 自动命中。麻痹/昏迷等自动重击也必须建立在攻击已经命中的前提上。
 */
export function resolveDnd5eAttackOutcome(input: Dnd5eAttackOutcomeInput): AttackResolution {
  const targetAc = input.targetArmorClass ?? input.attack.targetAc
  const threshold = Math.min(20, Math.max(2, Math.floor(input.criticalThreshold ?? 20)))
  const roll = input.attack.roll
  const hit = roll.naturalTwenty || input.forceHit === true || (!roll.naturalOne && roll.total >= targetAc)
  const critical = hit && (roll.d20 >= threshold || input.automaticCritical === true)
  return { ...input.attack, targetAc, hit, critical }
}
