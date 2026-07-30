export type CombatSettlementMode = 'automatic' | 'manual'
export type ManualSettlementOperation = 'damage' | 'healing' | 'temporary-hit-points'

export interface ManualHitPointState {
  currentHp: number
  maxHp: number
  temporaryHp: number
}

export const COMBAT_SETTLEMENT_MODE_OPTIONS: ReadonlyArray<{
  id: CombatSettlementMode
  label: string
  summary: string
}> = [
  { id: 'automatic', label: '自动结算', summary: '玩家与怪物都由 D&D 5e Headless 结算。' },
  { id: 'manual', label: '手动结算', summary: '双方只使用公共骰盘，DM 手工应用伤害和治疗。' },
]

export function normalizeCombatSettlementMode(value: unknown): CombatSettlementMode {
  // 旧房间的半自动模式迁移为手动，避免重新载入后意外启动怪物 AI。
  return value === 'manual' || value === 'semi-automatic' ? 'manual' : 'automatic'
}

export function usesAutomatedPlayerSettlement(mode: CombatSettlementMode): boolean {
  return mode !== 'manual'
}

export function allowsPlayerActionInSettlementMode(
  mode: CombatSettlementMode,
  actionType: string,
  combatActive = true,
): boolean {
  return usesAutomatedPlayerSettlement(mode) ||
    actionType === 'end-turn' ||
    actionType === 'dnd5e-map-interaction' ||
    (!combatActive && actionType === 'move-token')
}

export function usesAutomatedMonsterSettlement(mode: CombatSettlementMode): boolean {
  return mode === 'automatic'
}

export function supportsManualDice(mode: CombatSettlementMode, role: 'dm' | 'player'): boolean {
  return role === 'dm' || mode === 'manual'
}

/**
 * DM 战场修正不属于角色行动，也不受自动／手动结算模式限制。
 * 玩家永远不能通过该入口直接改写生命值或状态。
 */
export function supportsDmBattlefieldAdjustment(
  _mode: CombatSettlementMode,
  role: 'dm' | 'player',
): boolean {
  return role === 'dm'
}

export function applyManualHitPointOperation(
  state: ManualHitPointState,
  operation: ManualSettlementOperation,
  rawAmount: number,
): ManualHitPointState {
  const maxHp = Math.max(0, Math.floor(state.maxHp))
  const amount = Math.max(0, Math.floor(rawAmount))
  const currentHp = Math.min(maxHp, Math.max(0, Math.floor(state.currentHp)))
  const temporaryHp = Math.max(0, Math.floor(state.temporaryHp))
  if (operation === 'temporary-hit-points') {
    return { currentHp, maxHp, temporaryHp: Math.max(temporaryHp, amount) }
  }
  if (operation === 'healing') {
    return { currentHp: Math.min(maxHp, currentHp + amount), maxHp, temporaryHp }
  }
  const absorbed = Math.min(temporaryHp, amount)
  return {
    currentHp: Math.max(0, currentHp - (amount - absorbed)),
    maxHp,
    temporaryHp: temporaryHp - absorbed,
  }
}
