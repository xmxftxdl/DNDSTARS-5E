export function shouldPublishCombatStateFromRender(input: {
  combatActive: boolean
  initiativeOrderCount: number
}): boolean {
  return input.combatActive && input.initiativeOrderCount > 0
}
