/** Stored separately from the latest boundary so late arrivals need not start in round one. */
export interface Dnd5eFirstOwnCombatTurn {
  combatId: string
  turnKey: string
}

export function recordDnd5eFirstOwnCombatTurn(
  classState: { firstOwnCombatTurn?: Dnd5eFirstOwnCombatTurn },
  combatId: string,
  turnKey: string,
): void {
  if (classState.firstOwnCombatTurn?.combatId !== combatId) {
    classState.firstOwnCombatTurn = { combatId, turnKey }
  }
}

export function isDnd5eFirstOwnCombatTurn(
  classState: { firstOwnCombatTurn?: Dnd5eFirstOwnCombatTurn },
  combatId: string,
  turnKey: string,
): boolean {
  return classState.firstOwnCombatTurn?.combatId === combatId &&
    classState.firstOwnCombatTurn.turnKey === turnKey
}
