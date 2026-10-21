import type { Dnd5eCombatant } from './headlessCombatEngine'
import type { Dnd5eDamageType } from './damageTypes'
import { dnd5eCombatantClassLevel, dnd5eCombatantHasSubclass } from './headlessCombatPrimitives'
import { dnd5eRageFeatureForCombatant } from './rageFeature'
import { dnd5eHasStandardCondition } from './conditions'
import { effectiveDnd5eActiveEffects } from './activeEffects'

/** Unconditional-by-damage-source defenses shared by settlement and disclosure. */
export function dnd5eClassStateDamageResistance(target: Dnd5eCombatant, type: Dnd5eDamageType): boolean {
  const broad = target.classState.raging
    ? dnd5eRageFeatureForCombatant(target, 'broad-rage-resistance') : undefined
  return !!(
    (target.classState.raging && (
      (broad && !broad.mechanic.excludedDamageTypes?.includes(type)) ||
      type === 'bludgeoning' || type === 'piercing' || type === 'slashing')) ||
    ((target.classState.emptyBodyRoundsRemaining ?? 0) > 0 && type !== 'force') ||
    (dnd5eCombatantClassLevel(target, 'warlock') >= 10 &&
      dnd5eCombatantHasSubclass(target, 'warlock', 'fiend') &&
      target.classSelections['fiendish-resilience']?.includes(type)) ||
    ((target.classState.draconicResistanceRoundsRemaining ?? 0) > 0 &&
      target.classState.draconicResistanceType === type) ||
    dnd5eHasStandardCondition(target, 'petrified') ||
    (type === 'poison' && effectiveDnd5eActiveEffects(target.classState.activeEffects).some(effect =>
      effect.definitionId === 'srd-5.1:spell:protection-from-poison'))
  )
}
