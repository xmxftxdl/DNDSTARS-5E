import type {
  DmAdjudicationInterruptResponse,
  DmDamageAdjustment,
} from './combatInterruptProtocol'
import type {
  CombatInterruptPhase,
  SharedCombatInterrupt,
} from './combatInterruptQueue'

export interface DmInterruptProposedOutcome {
  hit?: boolean
  damage?: number
  saveSuccess?: boolean
  conditionIds?: readonly string[]
}

export interface DmInterruptResolvedOutcome {
  hit?: boolean
  damage?: number
  saveSuccess?: boolean
  conditionIds: string[]
  changed: boolean
  reasons: string[]
}

function adjustedDamage(current: number, adjustment: DmDamageAdjustment | undefined): number {
  if (!adjustment) return current
  const raw = adjustment.mode === 'set'
    ? adjustment.value
    : adjustment.mode === 'add'
      ? current + adjustment.value
      : current * adjustment.value
  return Math.max(0, Math.floor(Number.isFinite(raw) ? raw : current))
}

/**
 * DM 只能修改平台公开的结算字段；任何 DOM、Store 或任意代码均不进入 Headless 事务。
 * 返回值可以作为新的动作输入，原始事务快照保持不变，取消时可安全回滚。
 */
export function applyDmInterruptResolution(input: {
  phase: CombatInterruptPhase
  proposed: DmInterruptProposedOutcome
  response: DmAdjudicationInterruptResponse
}): DmInterruptResolvedOutcome {
  const conditionIds = [...new Set(input.proposed.conditionIds ?? [])]
  if (input.response.decision !== 'approved') {
    return { ...input.proposed, conditionIds, changed: false, reasons: ['DM 取消了本次裁定'] }
  }
  let hit = input.proposed.hit
  let damage = input.proposed.damage
  let saveSuccess = input.proposed.saveSuccess
  const reasons: string[] = []
  if (input.phase === 'before-hit' && input.response.hitOverride != null && hit !== input.response.hitOverride) {
    hit = input.response.hitOverride
    reasons.push(`DM 将命中结果调整为${hit ? '命中' : '未命中'}`)
  }
  if (input.phase === 'before-damage' && damage != null && input.response.damageAdjustment) {
    const next = adjustedDamage(damage, input.response.damageAdjustment)
    if (next !== damage) reasons.push(`DM 将伤害从 ${damage} 调整为 ${next}`)
    damage = next
  }
  if (input.phase === 'after-save') {
    const override = input.response.useLegendaryResistance ? true : input.response.saveSuccessOverride
    if (override != null && override !== saveSuccess) {
      saveSuccess = override
      reasons.push(input.response.useLegendaryResistance ? '目标使用传奇抗性，豁免改为成功' : `DM 将豁免改为${override ? '成功' : '失败'}`)
    }
  }
  const blocked = input.phase === 'before-condition'
    ? new Set(input.response.blockedConditionIds ?? [])
    : new Set<string>()
  const nextConditions = conditionIds.filter((conditionId) => !blocked.has(conditionId))
  if (nextConditions.length !== conditionIds.length) reasons.push('DM 阻止了一个或多个状态效果')
  return { hit, damage, saveSuccess, conditionIds: nextConditions, changed: reasons.length > 0, reasons }
}

export type CombatInterruptTimeoutDecision =
  | { action: 'rollback'; reason: 'timeout' | 'dm-disconnected' }
  | { action: 'wait-for-dm'; reason: 'timeout' | 'dm-disconnected' }

export function resolveCombatInterruptTimeout(
  interrupt: Pick<SharedCombatInterrupt, 'timeoutPolicy'>,
  reason: CombatInterruptTimeoutDecision['reason'],
): CombatInterruptTimeoutDecision {
  return interrupt.timeoutPolicy === 'wait-for-dm'
    ? { action: 'wait-for-dm', reason }
    : { action: 'rollback', reason }
}

export function isCounterspellSuccessful(input: {
  spellLevel: number
  counterspellSlotLevel: number
  abilityCheckTotal?: number
}): boolean {
  if (input.counterspellSlotLevel >= input.spellLevel) return true
  return Number.isInteger(input.abilityCheckTotal) && input.abilityCheckTotal! >= 10 + input.spellLevel
}
