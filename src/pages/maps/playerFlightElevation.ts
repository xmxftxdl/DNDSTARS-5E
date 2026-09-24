import { dnd5eEffectiveFlySpeed, type Dnd5eCombatant } from '../../rulesets/dnd5e/headlessCombatEngine'
import { isMovementLocked } from '../../lib/combatStatus'
import { dnd5eActiveConditionSpeedReductionApplies, dnd5eActivePlanarPhase } from '../../rulesets/dnd5e/activeEffects'

export function canAdjustPlayerFlightElevation(actor?: Dnd5eCombatant): boolean {
  if (!actor) return false
  if (isMovementLocked(actor.conditions.filter(condition =>
    dnd5eActiveConditionSpeedReductionApplies(actor.classState.activeEffects, condition)))) return false
  return (dnd5eEffectiveFlySpeed(actor) ?? 0) > 0 ||
    dnd5eActivePlanarPhase(actor.classState.activeEffects).unrestrictedVerticalMovement
}
