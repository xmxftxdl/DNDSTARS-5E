import type { BattleMap } from '../store/maps'
import type { InitiativeEntry } from '../components/map/InitiativeTracker'
import type { Character } from '../types/character'
import {
  cloneHeadlessCombatState,
  resolveHeadlessDmAction,
  startHeadlessCombat,
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

export function startHeadlessDmCombatAuthority(input: {
  map: BattleMap
  characters: Character[]
  initiativeOrder: InitiativeEntry[]
  clearStatuses?: boolean
}): HeadlessCombatResult {
  const enemyApByToken = Object.fromEntries(
    input.map.tokens
      .filter((token) => token.type === 'enemy')
      .map((token) => [token.id, { current: 2, max: 2 }]),
  )
  const state = startHeadlessCombat(
    {
      map: input.map,
      characters: input.characters,
      active: false,
      round: 1,
      initiativeIndex: 0,
      initiativeOrder: input.initiativeOrder,
      enemyApByToken,
      disengagedCharacterIds: [],
    },
    undefined,
    { clearStatuses: input.clearStatuses },
  )
  return { ok: true, state, events: [] }
}

export function endHeadlessDmCombatAuthority(state: HeadlessDmCombatState): HeadlessCombatResult {
  const next = cloneHeadlessCombatState(state)
  next.active = false
  next.initiativeIndex = 0
  next.initiativeOrder = []
  next.enemyApByToken = {}
  next.disengagedCharacterIds = []
  return { ok: true, state: next, events: [] }
}

export function createHeadlessDmAuthority(input: {
  createSnapshot: (map: BattleMap) => HeadlessDmCombatState
}): HeadlessDmAuthority {
  return {
    resolve: (map, action) => resolveHeadlessDmAuthorityAction(input.createSnapshot(map), action),
    resolveState: (state, action) => resolveHeadlessDmAuthorityAction(state, action),
  }
}
