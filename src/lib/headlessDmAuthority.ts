import type { BattleMap } from '../store/maps'
import {
  resolveHeadlessDmAction,
  type HeadlessCombatAction,
  type HeadlessCombatResult,
  type HeadlessDmCombatState,
} from './headlessDmCombatEngine'

export interface HeadlessDmAuthority {
  resolve(map: BattleMap, action: HeadlessCombatAction): HeadlessCombatResult
  resolveState(state: HeadlessDmCombatState, action: HeadlessCombatAction): HeadlessCombatResult
}

export function resolveHeadlessDmAuthorityAction(
  state: HeadlessDmCombatState,
  action: HeadlessCombatAction,
): HeadlessCombatResult {
  return resolveHeadlessDmAction(state, action)
}

export function createHeadlessDmAuthority(input: {
  createSnapshot: (map: BattleMap) => HeadlessDmCombatState
}): HeadlessDmAuthority {
  return {
    resolve: (map, action) => resolveHeadlessDmAuthorityAction(input.createSnapshot(map), action),
    resolveState: (state, action) => resolveHeadlessDmAuthorityAction(state, action),
  }
}
