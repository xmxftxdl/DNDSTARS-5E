/** One optional move during the same end-of-turn legendary-action window. */
export interface Dnd5eMonsterLegendaryMovementGrant {
  schemaVersion: 1
  actionId: string
  boundaryKey: string
  maximumFeet: number
  traversalMode: 'fly' | 'any'
  provokesOpportunityAttacks: boolean
  /** Applies only while this exact movement window remains authoritative. */
  temporaryDamageImmunity?: 'all'
  temporaryConditionImmunities?: readonly (
    'grappled' | 'petrified' | 'prone' | 'restrained' | 'stunned'
  )[]
}

export function dnd5eLegendaryMovementBoundaryKey(state: {
  combatId: string; round: number; turnSlotId?: string; initiativeSlotIds?: readonly string[]; initiativeOrder: readonly string[]; initiativeIndex: number
}): string {
  return `${state.combatId}:${state.round}:${state.initiativeSlotIds?.[state.initiativeIndex] ?? state.turnSlotId ?? state.initiativeOrder[state.initiativeIndex]}`
}
