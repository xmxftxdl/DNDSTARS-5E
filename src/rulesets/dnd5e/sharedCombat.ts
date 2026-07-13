import type { Dnd5eHeadlessCombatState } from './headlessCombatEngine'

export interface SharedDnd5eTurnEconomy {
  actionAvailable: boolean
  bonusActionAvailable: boolean
  reactionAvailable: boolean
  movementRemaining: number
}

export interface SharedDnd5eCombatantState {
  id: string
  currentHp: number
  temporaryHp: number
  position: { x: number; y: number }
  turn: SharedDnd5eTurnEconomy
  dodging: boolean
  disengaged: boolean
  concentrating: boolean
  deathSaves: { successes: number; failures: number; stable: boolean; dead: boolean }
}

export interface SharedDnd5eCombatState {
  rulesetId: 'dnd5e-srd-5.2.1'
  mapId: string
  combatId: string
  active: boolean
  round: number
  initiativeIndex: number
  initiativeOrder: readonly string[]
  combatants: Record<string, SharedDnd5eCombatantState>
  revision: number
  updatedAt: number
}

export function publishDnd5eCombatState(
  state: Dnd5eHeadlessCombatState,
  input: { mapId: string; revision: number; updatedAt?: number },
): SharedDnd5eCombatState {
  return {
    rulesetId: state.rulesetId,
    mapId: input.mapId,
    combatId: state.combatId,
    active: state.active,
    round: state.round,
    initiativeIndex: state.initiativeIndex,
    initiativeOrder: [...state.initiativeOrder],
    combatants: Object.fromEntries(Object.entries(state.combatants).map(([id, combatant]) => [id, {
      id,
      currentHp: combatant.currentHp,
      temporaryHp: combatant.temporaryHp,
      position: { ...combatant.position },
      turn: { ...combatant.turn },
      dodging: combatant.dodging,
      disengaged: combatant.disengaged,
      concentrating: combatant.concentrating,
      deathSaves: { ...combatant.deathSaves },
    }])),
    revision: input.revision,
    updatedAt: input.updatedAt ?? Date.now(),
  }
}

export type SharedDnd5eApplyDecision =
  | { status: 'ignored'; reason: 'wrong-ruleset' | 'wrong-map' | 'wrong-combat' | 'stale' | 'unchanged' }
  | { status: 'apply'; state: SharedDnd5eCombatState }

export function shouldApplySharedDnd5eCombatState(input: {
  incoming: SharedDnd5eCombatState
  mapId: string
  combatId: string
  currentRevision: number
  currentSnapshot?: SharedDnd5eCombatState
}): SharedDnd5eApplyDecision {
  const { incoming } = input
  if (incoming.rulesetId !== 'dnd5e-srd-5.2.1') return { status: 'ignored', reason: 'wrong-ruleset' }
  if (incoming.mapId !== input.mapId) return { status: 'ignored', reason: 'wrong-map' }
  if (incoming.combatId !== input.combatId) return { status: 'ignored', reason: 'wrong-combat' }
  if (incoming.revision < input.currentRevision) return { status: 'ignored', reason: 'stale' }
  if (input.currentSnapshot && JSON.stringify(incoming) === JSON.stringify(input.currentSnapshot)) {
    return { status: 'ignored', reason: 'unchanged' }
  }
  return { status: 'apply', state: incoming }
}
