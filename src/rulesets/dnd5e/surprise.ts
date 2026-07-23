import type { Dnd5eAction, Dnd5eCombatant } from './headlessCombatEngine'

type SurpriseState = Pick<Dnd5eCombatant, 'classId' | 'level' | 'classLevels' | 'classState'>

export function dnd5eCombatantIsSurprised(combatant: SurpriseState, combatId: string): boolean {
  return combatant.classState.surprisedCombatId === combatId &&
    combatant.classState.surpriseResolvedCombatId !== combatId
}

export function dnd5eCanUseFeralInstinctWhileSurprised(combatant: SurpriseState): boolean {
  const barbarianLevel = combatant.classLevels?.barbarian ?? (combatant.classId === 'barbarian' ? combatant.level : 0)
  return barbarianLevel >= 7
}

export function dnd5eActionAllowedWhileSurprised(
  combatant: SurpriseState,
  combatId: string,
  action: Dnd5eAction,
): boolean {
  if (!dnd5eCombatantIsSurprised(combatant, combatId)) return true
  if ([
    'end-turn',
    'death-save',
    'death-save-turn',
    'concentration-save',
    'barbarian-relentless-rage-save',
    'monster-undead-fortitude-save',
    'monster-on-hit-save',
    'active-effect-damage-save',
  ].includes(action.type)) return true
  return action.type === 'barbarian-rage' && !action.end && dnd5eCanUseFeralInstinctWhileSurprised(combatant)
}

export function resolveDnd5eSurpriseForCombatant<T extends SurpriseState>(combatant: T, combatId: string): T {
  if (!dnd5eCombatantIsSurprised(combatant, combatId)) return combatant
  return {
    ...combatant,
    classState: { ...combatant.classState, surpriseResolvedCombatId: combatId },
  }
}
