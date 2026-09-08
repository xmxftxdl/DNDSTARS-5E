export type CombatSettlementMode = 'automatic' | 'manual'
export type ManualSettlementOperation =
  | 'damage'
  | 'healing'
  | 'temporary-hit-points'
  | 'increase-temporary-hit-points'
  | 'decrease-temporary-hit-points'

export interface ManualHitPointState {
  currentHp: number
  maxHp: number
  temporaryHp: number
}

export function normalizeCombatSettlementMode(value: unknown): CombatSettlementMode {
  // Global settlement selection was removed. Keep the legacy wire union so old
  // snapshots still decode, but every room now routes each individual action
  // by its audited Headless capability instead of a room-wide switch.
  void value
  return 'automatic'
}

export function usesAutomatedPlayerSettlement(_mode: CombatSettlementMode): boolean {
  void _mode
  return true
}

export function allowsPlayerActionInSettlementMode(
  mode: CombatSettlementMode,
  actionType: string,
  combatActive = true,
): boolean {
  // Kept in the public signature for callers that distinguish exploration
  // from combat; movement is intentionally authorized in both states.
  void combatActive
  void mode
  void actionType
  return true
}

export function supportsManualDice(_mode: CombatSettlementMode, role: 'dm' | 'player'): boolean {
  void _mode
  return role === 'dm'
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
  // DM 管理入口需要精确修正临时生命；法术/能力继续使用下面的
  // temporary-hit-points 分支，遵守 5e “不叠加、取较高值”的规则。
  if (operation === 'increase-temporary-hit-points') {
    return { currentHp, maxHp, temporaryHp: temporaryHp + amount }
  }
  if (operation === 'decrease-temporary-hit-points') {
    return { currentHp, maxHp, temporaryHp: Math.max(0, temporaryHp - amount) }
  }
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
