import type { Dnd5eAttackCoverOverride } from '../../lib/sharedCombatTypes'

export const DND5E_COVER_LABELS: Record<Dnd5eAttackCoverOverride, string> = {
  none: '无掩护',
  half: '半身掩护（+2 AC）',
  'three-quarters': '四分之三掩护（+5 AC）',
  total: '全身掩护（无法直接攻击）',
}
