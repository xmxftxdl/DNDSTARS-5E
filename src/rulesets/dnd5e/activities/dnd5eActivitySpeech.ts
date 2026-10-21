import { dnd5eActiveActionRestriction } from '../activeEffects'
import { dnd5eCombatantCanSpeakAudibly, type Dnd5eCombatant } from '../headlessCombatEngine'

/** Speech production, independent of listener hearing and linguistic comprehension. */
export function dnd5eActivityCanSpeakAudibly(combatant: Dnd5eCombatant): boolean {
  return dnd5eCombatantCanSpeakAudibly(combatant) &&
    !combatant.conditions.some(condition => ['paralyzed', 'petrified', 'unconscious'].includes(condition)) &&
    !dnd5eActiveActionRestriction(combatant.classState.activeEffects)?.prohibited.includes('speech')
}
