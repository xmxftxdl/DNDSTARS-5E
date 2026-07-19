import type { AbilityKey } from '../../lib/dnd'
import type { Dnd5eStandardConditionId } from './conditions'

/**
 * schema v1 的旧限时效果格式。
 *
 * 该类型只用于读取旧存档并迁移为 ActiveEffectInstance。运行时不得创建、
 * 更新或查询这种数据，也不得把它写回 schema v2 的共享资源。
 */
export interface Dnd5eTimedEffect {
  id: string
  sourceActorId: string
  sourceSpellId: string
  appliedTurnKey?: string
  kind: 'speed-penalty' | 'reaction-lock' | 'condition'
  amount?: number
  condition?: Dnd5eStandardConditionId
  expiresAt: 'source-next-turn-start' | 'target-next-turn-start' | 'target-turn-end' | 'target-turn-end-save'
  remainingRounds?: number
  saveAbility?: AbilityKey
  saveDc?: number
}
